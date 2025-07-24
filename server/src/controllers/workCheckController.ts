import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { io } from '../socket/socketServer'

const pool = getPool()

// ?…ë¬´ ì²´í¬ ?íƒœ ì¡°íšŒ
export const getWorkCheckStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params

    // ?¹ì • ?…ë¬´??ì²´í¬ ?íƒœ ì¡°íšŒ
    const [checks] = await pool.query(
      `SELECT wc.id, wc.task_id, wc.user_id, wc.checked_at, wc.status,
              u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.task_id = ?
       ORDER BY wc.checked_at DESC`,
      [taskId]
    ) as any[]

    // ì²´í¬ ?µê³„ ê³„ì‚°
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
      message: '?…ë¬´ ì²´í¬ ?íƒœ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?„ì²´ ?…ë¬´ ì²´í¬ ?„í™© ì¡°íšŒ (ê´€ë¦¬ì??
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

    // ?µê³„ ê³„ì‚°
    const totalChecks = checks.length
    const completedChecks = checks.filter((check: any) => check.status === 'completed').length
    const inProgressChecks = checks.filter((check: any) => check.status === 'in_progress').length

    // ?¬ìš©?ë³„ ?µê³„
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
      message: '?„ì²´ ?…ë¬´ ì²´í¬ ?„í™© ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?…ë¬´ ì²´í¬ (?¤ì‹œê°?ê³µìœ )
export const checkWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?…ë ¥ ?°ì´?°ê? ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.',
        errors: errors.array()
      })
      return
    }

    const { taskId, status, notes } = req.body
    const userId = (req as any).user.id

    // ?´ë? ì²´í¬???…ë¬´?¸ì? ?•ì¸
    const [existingChecks] = await pool.query(
      'SELECT wc.*, u.name as user_name FROM work_checks wc JOIN users u ON wc.user_id = u.id WHERE wc.task_id = ?',
      [taskId]
    ) as any[]

    if (existingChecks.length > 0) {
      const existingCheck = existingChecks[0]
      
      // ?¤ë¥¸ ?¬ìš©?ê? ?´ë? ì²´í¬??ê²½ìš°
      if (existingCheck.user_id !== userId) {
        res.status(409).json({
          success: false,
          message: '?´ë? ?¤ë¥¸ ?¬ìš©?ê? ì²´í¬???…ë¬´?…ë‹ˆ??',
          data: {
            existingCheck: {
              userName: existingCheck.user_name,
              checkedAt: existingCheck.checked_at,
              status: existingCheck.status,
              notes: existingCheck.notes
            },
            suggestion: '?…ë¬´ê°€ ?´ë? ì§„í–‰ ì¤‘ì´ë¯€ë¡??´ë‹¹?ì? ?‘ì˜?´ì£¼?¸ìš”.'
          }
        })
        return
      }

      // ê°™ì? ?¬ìš©?ê? ?¬ì²´?¬í•˜??ê²½ìš° (?íƒœ ?…ë°?´íŠ¸)
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

      // ?¤ì‹œê°??Œë¦¼ ?„ì†¡
      io.emit('workCheckUpdated', {
        type: 'updated',
        data: updatedCheck[0],
        message: `${updatedCheck[0].user_name}?˜ì´ ?…ë¬´ ?íƒœë¥??…ë°?´íŠ¸?ˆìŠµ?ˆë‹¤.`
      })

      res.status(200).json({
        success: true,
        message: '?…ë¬´ ?íƒœê°€ ?…ë°?´íŠ¸?˜ì—ˆ?µë‹ˆ??',
        data: {
          check: updatedCheck[0],
          isUpdate: true
        }
      })
      return
    }

    // ?ˆë¡œ???…ë¬´ ì²´í¬
    const [result] = await pool.query(
      'INSERT INTO work_checks (task_id, user_id, status, notes, checked_at) VALUES (?, ?, ?, ?, NOW())',
      [taskId, userId, status, notes]
    ) as any[]

    const checkId = result.insertId

    // ?ì„±??ì²´í¬ ?•ë³´ ì¡°íšŒ
    const [newCheck] = await pool.query(
      `SELECT wc.*, u.name as user_name, u.email as user_email
       FROM work_checks wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.id = ?`,
      [checkId]
    ) as any[]

    // ?¤ì‹œê°??Œë¦¼ ?„ì†¡
    io.emit('workCheckCreated', {
      type: 'created',
      data: newCheck[0],
      message: `${newCheck[0].user_name}?˜ì´ ?ˆë¡œ???…ë¬´ë¥?ì²´í¬?ˆìŠµ?ˆë‹¤.`
    })

    res.status(201).json({
      success: true,
      message: '?…ë¬´ê°€ ?±ê³µ?ìœ¼ë¡?ì²´í¬?˜ì—ˆ?µë‹ˆ??',
      data: {
        check: newCheck[0],
        isUpdate: false
      }
    })
  } catch (error) {
    console.error('Work check error:', error)
    res.status(500).json({
      success: false,
      message: '?…ë¬´ ì²´í¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?…ë¬´ ì²´í¬ ì·¨ì†Œ
export const uncheckWork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params
    const userId = (req as any).user.id

    // ì²´í¬ ?•ë³´ ì¡°íšŒ
    const [checks] = await pool.query(
      'SELECT * FROM work_checks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    ) as any[]

    if (checks.length === 0) {
      res.status(404).json({
        success: false,
        message: 'ì²´í¬???…ë¬´ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    const check = checks[0]

    // ì²´í¬ ?? œ
    await pool.query(
      'DELETE FROM work_checks WHERE id = ?',
      [check.id]
    )

    // ?¤ì‹œê°??Œë¦¼ ?„ì†¡
    io.emit('workCheckDeleted', {
      type: 'deleted',
      taskId: taskId,
      userId: userId,
      message: '?…ë¬´ ì²´í¬ê°€ ì·¨ì†Œ?˜ì—ˆ?µë‹ˆ??'
    })

    res.status(200).json({
      success: true,
      message: '?…ë¬´ ì²´í¬ê°€ ì·¨ì†Œ?˜ì—ˆ?µë‹ˆ??',
      data: {
        taskId: taskId,
        deletedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Work uncheck error:', error)
    res.status(500).json({
      success: false,
      message: '?…ë¬´ ì²´í¬ ì·¨ì†Œ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?¤ì‹œê°??…ë¬´ ?„í™© ì¡°íšŒ
export const getRealTimeWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // ?¤ëŠ˜ ì²´í¬???…ë¬´ ?µê³„
    const [todayStats] = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress
       FROM work_checks 
       WHERE DATE(checked_at) = ?`,
      [today]
    ) as any[]

    // ?¬ìš©?ë³„ ?¤ëŠ˜ ì²´í¬ ?„í™©
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

    // ìµœê·¼ ì²´í¬???…ë¬´ (ìµœê·¼ 10ê°?
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
      message: '?¤ì‹œê°??…ë¬´ ?„í™© ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ? íš¨??ê²€??ê·œì¹™
export const checkWorkValidation = [
  body('taskId')
    .isInt({ min: 1 })
    .withMessage('? íš¨?˜ì? ?Šì? ?…ë¬´ ID?…ë‹ˆ??'),
  
  body('status')
    .isIn(['in_progress', 'completed', 'pending'])
    .withMessage('?íƒœ??in_progress, completed, pending ì¤??˜ë‚˜?¬ì•¼ ?©ë‹ˆ??'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('ë©”ëª¨??500???´í•˜?¬ì•¼ ?©ë‹ˆ??')
] 
