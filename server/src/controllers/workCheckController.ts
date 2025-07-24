import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { io } from '../socket/socketServer'

const pool = getPool()

// 업무 체크 상태 조회
export const getWorkCheckStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params

    // 특정 업무의 체크 상태 조회
    const [checks] = await pool.execute(
      `SELECT wc.id, wc.task_id, wc.user_id, wc.checked_at, wc.status,
              u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.task_id = ?
       ORDER BY wc.checked_at DESC`,
      [taskId]
    ) as any[]

    // 체크 통계 계산
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
      message: '업무 체크 상태 조회 중 오류가 발생했습니다.'
    })
  }
}

// 전체 업무 체크 현황 조회 (관리자용)
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

    const [checks] = await pool.execute(query, params) as any[]

    // 통계 계산
    const totalChecks = checks.length
    const completedChecks = checks.filter((check: any) => check.status === 'completed').length
    const inProgressChecks = checks.filter((check: any) => check.status === 'in_progress').length

    // 사용자별 통계
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
      message: '전체 업무 체크 현황 조회 중 오류가 발생했습니다.'
    })
  }
}

// 업무 체크 (실시간 공유)
export const checkWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: errors.array()
      })
      return
    }

    const { taskId, status, notes } = req.body
    const userId = (req as any).user.id

    // 이미 체크된 업무인지 확인
    const [existingChecks] = await pool.execute(
      'SELECT wc.*, u.name as user_name FROM work_checks wc JOIN users u ON wc.user_id = u.id WHERE wc.task_id = ?',
      [taskId]
    ) as any[]

    if (existingChecks.length > 0) {
      const existingCheck = existingChecks[0]
      
      // 다른 사용자가 이미 체크한 경우
      if (existingCheck.user_id !== userId) {
        res.status(409).json({
          success: false,
          message: '이미 다른 사용자가 체크한 업무입니다.',
          data: {
            existingCheck: {
              userName: existingCheck.user_name,
              checkedAt: existingCheck.checked_at,
              status: existingCheck.status,
              notes: existingCheck.notes
            },
            suggestion: '업무가 이미 진행 중이므로 담당자와 협의해주세요.'
          }
        })
        return
      }

      // 같은 사용자가 재체크하는 경우 (상태 업데이트)
      await pool.execute(
        'UPDATE work_checks SET status = ?, notes = ?, checked_at = NOW() WHERE id = ?',
        [status, notes, existingCheck.id]
      )

      const [updatedCheck] = await pool.execute(
        `SELECT wc.*, u.name as user_name, u.email as user_email
         FROM work_checks wc
         JOIN users u ON wc.user_id = u.id
         WHERE wc.id = ?`,
        [existingCheck.id]
      ) as any[]

      // 실시간 알림 전송
      io.emit('workCheckUpdated', {
        type: 'updated',
        data: updatedCheck[0],
        message: `${updatedCheck[0].user_name}님이 업무 상태를 업데이트했습니다.`
      })

      res.status(200).json({
        success: true,
        message: '업무 상태가 업데이트되었습니다.',
        data: {
          check: updatedCheck[0],
          isUpdate: true
        }
      })
      return
    }

    // 새로운 업무 체크
    const [result] = await pool.execute(
      'INSERT INTO work_checks (task_id, user_id, status, notes, checked_at) VALUES (?, ?, ?, ?, NOW())',
      [taskId, userId, status, notes]
    ) as any[]

    const checkId = result.insertId

    // 생성된 체크 정보 조회
    const [newCheck] = await pool.execute(
      `SELECT wc.*, u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.id = ?`,
      [checkId]
    ) as any[]

    // 실시간 알림 전송
    io.emit('workCheckCreated', {
      type: 'created',
      data: newCheck[0],
      message: `${newCheck[0].user_name}님이 새로운 업무를 체크했습니다.`
    })

    res.status(201).json({
      success: true,
      message: '업무가 성공적으로 체크되었습니다.',
      data: {
        check: newCheck[0],
        isUpdate: false
      }
    })
  } catch (error) {
    console.error('Work check error:', error)
    res.status(500).json({
      success: false,
      message: '업무 체크 중 오류가 발생했습니다.'
    })
  }
}

// 업무 체크 취소
export const uncheckWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params
    const userId = (req as any).user.id

    // 체크 정보 조회
    const [checks] = await pool.execute(
      'SELECT * FROM work_checks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    ) as any[]

    if (checks.length === 0) {
      res.status(404).json({
        success: false,
        message: '체크된 업무를 찾을 수 없습니다.'
      })
      return
    }

    const check = checks[0]

    // 체크 삭제
    await pool.execute(
      'DELETE FROM work_checks WHERE id = ?',
      [check.id]
    )

    // 실시간 알림 전송
    io.emit('workCheckDeleted', {
      type: 'deleted',
      taskId: taskId,
      userId: userId,
      message: '업무 체크가 취소되었습니다.'
    })

    res.status(200).json({
      success: true,
      message: '업무 체크가 취소되었습니다.',
      data: {
        taskId: taskId,
        deletedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Work uncheck error:', error)
    res.status(500).json({
      success: false,
      message: '업무 체크 취소 중 오류가 발생했습니다.'
    })
  }
}

// 실시간 업무 현황 조회
export const getRealTimeWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 오늘 체크된 업무 통계
    const [todayStats] = await pool.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress
       FROM work_checks 
       WHERE DATE(checked_at) = ?`,
      [today]
    ) as any[]

    // 사용자별 오늘 체크 현황
    const [userStats] = await pool.execute(
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

    // 최근 체크된 업무 (최근 10개)
    const [recentChecks] = await pool.execute(
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
      message: '실시간 업무 현황 조회 중 오류가 발생했습니다.'
    })
  }
}

// 유효성 검사 규칙
export const checkWorkValidation = [
  body('taskId')
    .isInt({ min: 1 })
    .withMessage('유효하지 않은 업무 ID입니다.'),
  
  body('status')
    .isIn(['in_progress', 'completed', 'pending'])
    .withMessage('상태는 in_progress, completed, pending 중 하나여야 합니다.'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('메모는 500자 이하여야 합니다.')
] 