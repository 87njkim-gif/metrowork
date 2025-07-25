import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { io } from '../socket/socketServer'

const pool = getPool()

// ?λ¬΄ μ²΄ν¬ ?ν μ‘°ν
export const getWorkCheckStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params

    // ?Ήμ  ?λ¬΄??μ²΄ν¬ ?ν μ‘°ν
    const [checks] = await pool.query(
      `SELECT wc.id, wc.task_id, wc.user_id, wc.checked_at, wc.status,
              u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.task_id = ?
       ORDER BY wc.checked_at DESC`,
      [taskId]
    ) as any[]

    // μ²΄ν¬ ?΅κ³ κ³μ°
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
      message: '?λ¬΄ μ²΄ν¬ ?ν μ‘°ν μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ?μ²΄ ?λ¬΄ μ²΄ν¬ ?ν© μ‘°ν (κ΄λ¦¬μ??
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

    // ?΅κ³ κ³μ°
    const totalChecks = checks.length
    const completedChecks = checks.filter((check: any) => check.status === 'completed').length
    const inProgressChecks = checks.filter((check: any) => check.status === 'in_progress').length

    // ?¬μ©?λ³ ?΅κ³
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
      message: '?μ²΄ ?λ¬΄ μ²΄ν¬ ?ν© μ‘°ν μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ?λ¬΄ μ²΄ν¬ (?€μκ°?κ³΅μ )
export const checkWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?λ ₯ ?°μ΄?°κ? ?¬λ°λ₯΄μ? ?μ΅?λ€.',
        errors: errors.array()
      })
      return
    }

    const { taskId, status, notes } = req.body
    const userId = (req as any).user.id

    // ?΄λ? μ²΄ν¬???λ¬΄?Έμ? ?μΈ
    const [existingChecks] = await pool.query(
      'SELECT wc.*, u.name as user_name FROM work_checks wc JOIN users u ON wc.user_id = u.id WHERE wc.task_id = ?',
      [taskId]
    ) as any[]

    if (existingChecks.length > 0) {
      const existingCheck = existingChecks[0]
      
      // ?€λ₯Έ ?¬μ©?κ? ?΄λ? μ²΄ν¬??κ²½μ°
      if (existingCheck.user_id !== userId) {
        res.status(409).json({
          success: false,
          message: '?΄λ? ?€λ₯Έ ?¬μ©?κ? μ²΄ν¬???λ¬΄?λ??',
          data: {
            existingCheck: {
              userName: existingCheck.user_name,
              checkedAt: existingCheck.checked_at,
              status: existingCheck.status,
              notes: existingCheck.notes
            },
            suggestion: '?λ¬΄κ° ?΄λ? μ§ν μ€μ΄λ―λ‘??΄λΉ?μ? ?μ?΄μ£Ό?Έμ.'
          }
        })
        return
      }

      // κ°μ? ?¬μ©?κ? ?¬μ²΄?¬ν??κ²½μ° (?ν ?λ°?΄νΈ)
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

      // ?€μκ°??λ¦Ό ?μ‘
      io.emit('workCheckUpdated', {
        type: 'updated',
        data: updatedCheck[0],
        message: `${updatedCheck[0].user_name}?μ΄ ?λ¬΄ ?νλ₯??λ°?΄νΈ?μ΅?λ€.`
      })

      res.status(200).json({
        success: true,
        message: '?λ¬΄ ?νκ° ?λ°?΄νΈ?μ?΅λ??',
        data: {
          check: updatedCheck[0],
          isUpdate: true
        }
      })
      return
    }

    // ?λ‘???λ¬΄ μ²΄ν¬
    const [result] = await pool.query(
      'INSERT INTO work_checks (task_id, user_id, status, notes, checked_at) VALUES (?, ?, ?, ?, NOW())',
      [taskId, userId, status, notes]
    ) as any[]

    const checkId = result.insertId

    // ?μ±??μ²΄ν¬ ?λ³΄ μ‘°ν
    const [newCheck] = await pool.query(
      `SELECT wc.*, u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.id = ?`,
      [checkId]
    ) as any[]

    // ?€μκ°??λ¦Ό ?μ‘
    io.emit('workCheckCreated', {
      type: 'created',
      data: newCheck[0],
      message: `${newCheck[0].user_name}?μ΄ ?λ‘???λ¬΄λ₯?μ²΄ν¬?μ΅?λ€.`
    })

    res.status(201).json({
      success: true,
      message: '?λ¬΄κ° ?±κ³΅?μΌλ‘?μ²΄ν¬?μ?΅λ??',
      data: {
        check: newCheck[0],
        isUpdate: false
      }
    })
  } catch (error) {
    console.error('Work check error:', error)
    res.status(500).json({
      success: false,
      message: '?λ¬΄ μ²΄ν¬ μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ?λ¬΄ μ²΄ν¬ μ·¨μ
export const uncheckWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params
    const userId = (req as any).user.id

    // μ²΄ν¬ ?λ³΄ μ‘°ν
    const [checks] = await pool.query(
      'SELECT * FROM work_checks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    ) as any[]

    if (checks.length === 0) {
      res.status(404).json({
        success: false,
        message: 'μ²΄ν¬???λ¬΄λ₯?μ°Ύμ ???μ΅?λ€.'
      })
      return
    }

    const check = checks[0]

    // μ²΄ν¬ ?? 
    await pool.query(
      'DELETE FROM work_checks WHERE id = ?',
      [check.id]
    )

    // ?€μκ°??λ¦Ό ?μ‘
    io.emit('workCheckDeleted', {
      type: 'deleted',
      taskId: taskId,
      userId: userId,
      message: '?λ¬΄ μ²΄ν¬κ° μ·¨μ?μ?΅λ??'
    })

    res.status(200).json({
      success: true,
      message: '?λ¬΄ μ²΄ν¬κ° μ·¨μ?μ?΅λ??',
      data: {
        taskId: taskId,
        deletedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Work uncheck error:', error)
    res.status(500).json({
      success: false,
      message: '?λ¬΄ μ²΄ν¬ μ·¨μ μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ?€μκ°??λ¬΄ ?ν© μ‘°ν
export const getRealTimeWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // ?€λ μ²΄ν¬???λ¬΄ ?΅κ³
    const [todayStats] = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress
       FROM work_checks 
       WHERE DATE(checked_at) = ?`,
      [today]
    ) as any[]

    // ?¬μ©?λ³ ?€λ μ²΄ν¬ ?ν©
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

    // μ΅κ·Ό μ²΄ν¬???λ¬΄ (μ΅κ·Ό 10κ°?
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
      message: '?€μκ°??λ¬΄ ?ν© μ‘°ν μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ? ν¨??κ²??κ·μΉ
export const checkWorkValidation = [
  body('taskId')
    .isInt({ min: 1 })
    .withMessage('? ν¨?μ? ?μ? ?λ¬΄ ID?λ??'),
  
  body('status')
    .isIn(['in_progress', 'completed', 'pending'])
    .withMessage('?ν??in_progress, completed, pending μ€??λ?¬μΌ ?©λ??'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('λ©λͺ¨??500???΄ν?¬μΌ ?©λ??')
] 
