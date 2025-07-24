import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { io } from '../socket/socketServer'

const pool = getPool()

// ?�무 체크 ?�태 조회
export const getWorkCheckStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params

    // ?�정 ?�무??체크 ?�태 조회
    const [checks] = await pool.query(
      `SELECT wc.id, wc.task_id, wc.user_id, wc.checked_at, wc.status,
              u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.task_id = ?
       ORDER BY wc.checked_at DESC`,
      [taskId]
    ) as any[]

    // 체크 ?�계 계산
    const totalChecks = checks.length
    const completedChecks = checks.filter((check: any) => check.status === 'completed').length
    const inProgressChecks = checks.filter((check: any) => check.status === 'in_progress').length

    res.status(200).json({
      success: true,
      data: {
        taskId: taskId,
        checks: checks,
        statistics: {
          total: totalChecks,
          completed: completedChecks,
          inProgress: inProgressChecks,
          completionRate: totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0
        }
      }
    })
  } catch (error) {
    console.error('Work check status error:', error)
    res.status(500).json({
      success: false,
      message: '?�무 체크 ?�태 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�체 ?�무 체크 ?�황 조회 (관리자??
export const getAllWorkCheckStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, userId } = req.query

    let query = `
      SELECT wc.id, wc.task_id, wc.user_id, wc.checked_at, wc.status, wc.notes,
             u.name as user_name, u.email as user_email,
             ed.row_data, ed.file_name
      FROM work_checks wc
      JOIN users u ON wc.user_id = u.id
      LEFT JOIN excel_data ed ON wc.task_id = ed.id
      WHERE 1=1
    `
    const params: any[] = []

    if (date) {
      query += ' AND DATE(wc.checked_at) = ?'
      params.push(date)
    }

    if (userId) {
      query += ' AND wc.user_id = ?'
      params.push(userId)
    }

    query += ' ORDER BY wc.checked_at DESC'

    const [checks] = await pool.query(query, params) as any[]

    // ?�계 계산
    const totalChecks = checks.length
    const completedChecks = checks.filter((check: any) => check.status === 'completed').length
    const inProgressChecks = checks.filter((check: any) => check.status === 'in_progress').length

    // ?�용?�별 ?�계
    const userStats = checks.reduce((acc: any, check: any) => {
      const userId = check.user_id
      if (!acc[userId]) {
        acc[userId] = {
          userId: userId,
          userName: check.user_name,
          total: 0,
          completed: 0,
          inProgress: 0
        }
      }
      acc[userId].total++
      if (check.status === 'completed') acc[userId].completed++
      if (check.status === 'in_progress') acc[userId].inProgress++
      return acc
    }, {})

    res.status(200).json({
      success: true,
      data: {
        checks: checks,
        statistics: {
          total: totalChecks,
          completed: completedChecks,
          inProgress: inProgressChecks,
          completionRate: totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0
        },
        userStatistics: Object.values(userStats)
      }
    })
  } catch (error) {
    console.error('All work check status error:', error)
    res.status(500).json({
      success: false,
      message: '?�체 ?�무 체크 ?�황 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�무 체크 (?�시�?공유)
export const checkWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?�력 ?�이?��? ?�바르�? ?�습?�다.',
        errors: errors.array()
      })
      return
    }

    const { taskId, status, notes } = req.body
    const userId = (req as any).user.id

    // ?��? 체크???�무?��? ?�인
    const [existingChecks] = await pool.query(
      'SELECT wc.*, u.name as user_name FROM work_checks wc JOIN users u ON wc.user_id = u.id WHERE wc.task_id = ?',
      [taskId]
    ) as any[]

    if (existingChecks.length > 0) {
      const existingCheck = existingChecks[0]
      
      // ?�른 ?�용?��? ?��? 체크??경우
      if (existingCheck.user_id !== userId) {
        res.status(409).json({
          success: false,
          message: '?��? ?�른 ?�용?��? 체크???�무?�니??',
          data: {
            existingCheck: {
              userName: existingCheck.user_name,
              checkedAt: existingCheck.checked_at,
              status: existingCheck.status,
              notes: existingCheck.notes
            },
            suggestion: '?�무가 ?��? 진행 중이므�??�당?��? ?�의?�주?�요.'
          }
        })
        return
      }

      // 같�? ?�용?��? ?�체?�하??경우 (?�태 ?�데?�트)
      await pool.query(
        'UPDATE work_checks SET status = ?, notes = ?, checked_at = NOW() WHERE id = ?',
        [status, notes, existingCheck.id]
      )

      const [updatedCheck] = await pool.query(
        `SELECT wc.*, u.name as user_name, u.email as user_email
         FROM work_checks wc
         JOIN users u ON wc.user_id = u.id
         WHERE wc.id = ?`,
        [existingCheck.id]
      ) as any[]

      // ?�시�??�림 ?�송
      io.emit('workCheckUpdated', {
        type: 'updated',
        data: updatedCheck[0],
        message: `${updatedCheck[0].user_name}?�이 ?�무 ?�태�??�데?�트?�습?�다.`
      })

      res.status(200).json({
        success: true,
        message: '?�무 ?�태가 ?�데?�트?�었?�니??',
        data: {
          check: updatedCheck[0],
          isUpdate: true
        }
      })
      return
    }

    // ?�로???�무 체크
    const [result] = await pool.query(
      'INSERT INTO work_checks (task_id, user_id, status, notes, checked_at) VALUES (?, ?, ?, ?, NOW())',
      [taskId, userId, status, notes]
    ) as any[]

    const checkId = result.insertId

    // ?�성??체크 ?�보 조회
    const [newCheck] = await pool.query(
      `SELECT wc.*, u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.id = ?`,
      [checkId]
    ) as any[]

    // ?�시�??�림 ?�송
    io.emit('workCheckCreated', {
      type: 'created',
      data: newCheck[0],
      message: `${newCheck[0].user_name}?�이 ?�로???�무�?체크?�습?�다.`
    })

    res.status(201).json({
      success: true,
      message: '?�무가 ?�공?�으�?체크?�었?�니??',
      data: {
        check: newCheck[0],
        isUpdate: false
      }
    })
  } catch (error) {
    console.error('Work check error:', error)
    res.status(500).json({
      success: false,
      message: '?�무 체크 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�무 체크 취소
export const uncheckWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params
    const userId = (req as any).user.id

    // 체크 ?�보 조회
    const [checks] = await pool.query(
      'SELECT * FROM work_checks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    ) as any[]

    if (checks.length === 0) {
      res.status(404).json({
        success: false,
        message: '체크???�무�?찾을 ???�습?�다.'
      })
      return
    }

    const check = checks[0]

    // 체크 ??��
    await pool.query(
      'DELETE FROM work_checks WHERE id = ?',
      [check.id]
    )

    // ?�시�??�림 ?�송
    io.emit('workCheckDeleted', {
      type: 'deleted',
      taskId: taskId,
      userId: userId,
      message: '?�무 체크가 취소?�었?�니??'
    })

    res.status(200).json({
      success: true,
      message: '?�무 체크가 취소?�었?�니??',
      data: {
        taskId: taskId,
        deletedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Work uncheck error:', error)
    res.status(500).json({
      success: false,
      message: '?�무 체크 취소 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�시�??�무 ?�황 조회
export const getRealTimeWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // ?�늘 체크???�무 ?�계
    const [todayStats] = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress
       FROM work_checks 
       WHERE DATE(checked_at) = ?`,
      [today]
    ) as any[]

    // ?�용?�별 ?�늘 체크 ?�황
    const [userStats] = await pool.query(
      `SELECT 
         u.id, u.name, u.email,
         COUNT(wc.id) as totalChecks,
         SUM(CASE WHEN wc.status = 'completed' THEN 1 ELSE 0 END) as completedChecks,
         SUM(CASE WHEN wc.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressChecks
       FROM users u
       LEFT JOIN work_checks wc ON u.id = wc.user_id AND DATE(wc.checked_at) = ?
       WHERE u.status = 'approved'
       GROUP BY u.id, u.name, u.email
       ORDER BY totalChecks DESC`,
      [today]
    ) as any[]

    // 최근 체크???�무 (최근 10�?
    const [recentChecks] = await pool.query(
      `SELECT wc.*, u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       ORDER BY wc.checked_at DESC
       LIMIT 10`
    ) as any[]

    res.status(200).json({
      success: true,
      data: {
        today: today,
        statistics: todayStats[0],
        userStatistics: userStats,
        recentChecks: recentChecks
      }
    })
  } catch (error) {
    console.error('Real-time work status error:', error)
    res.status(500).json({
      success: false,
      message: '?�시�??�무 ?�황 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�효??검??규칙
export const checkWorkValidation = [
  body('taskId')
    .isInt({ min: 1 })
    .withMessage('?�효?��? ?��? ?�무 ID?�니??'),
  
  body('status')
    .isIn(['in_progress', 'completed', 'pending'])
    .withMessage('?�태??in_progress, completed, pending �??�나?�야 ?�니??'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('메모??500???�하?�야 ?�니??')
] 
