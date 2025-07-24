import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import {
  toggleWorkStatus,
  getCompletedWork,
  getWorkSummary,
  getUserWorkStats,
  bulkToggleWorkStatus,
  logWorkActivity,
  canUncompleteWork,
  syncWorkStatusToAllUsers
} from '../utils/workProcessor'
import {
  CheckWorkRequest,
  CompletedWorkQuery,
  TodayDateRequest,
  BulkCheckRequest
} from '../types/work'

const pool = getPool()

// ?‘ì? ?°ì´????ì²´í¬/?´ì œ (?ˆë¡œ???œìŠ¤??
export const checkWorkItem = async (req: Request, res: Response): Promise<void> => {
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

    const rowId = parseInt(req.params.rowId)
    const userId = req.user!.id
    const { isCompleted, notes }: CheckWorkRequest = req.body

    // ?‘ì? ?°ì´??ì¡´ì¬ ?¬ë? ?•ì¸
    const [excelData] = await pool.query(
      'SELECT id, file_id FROM excel_data WHERE id = ?',
      [rowId]
    ) as any[]

    if (excelData.length === 0) {
      res.status(404).json({
        success: false,
        message: '?´ë‹¹ ?‘ì? ?°ì´?°ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    // ?…ë¬´ ?´ì œ ê¶Œí•œ ?•ì¸
    if (!isCompleted) {
      const canUncomplete = await canUncompleteWork(rowId, userId)
      if (!canUncomplete) {
        res.status(403).json({
          success: false,
          message: '?…ë¬´ë¥??„ë£Œ???¬ìš©?ë§Œ ?´ì œ?????ˆìŠµ?ˆë‹¤.'
        })
        return
      }
    }

    // ê¸°ì¡´ ?íƒœ ?•ì¸ (?œë™ ë¡œê·¸??
    const [existingStatus] = await pool.query(
      'SELECT is_completed FROM work_status WHERE excel_data_id = ? AND user_id = ?',
      [rowId, userId]
    ) as any[]

    const oldStatus = existingStatus.length > 0 ? existingStatus[0].is_completed : null

    // ?íƒœ ? ê?
    const workStatus = await toggleWorkStatus(rowId, userId, isCompleted, notes)

    // ?„ë£Œ ì²˜ë¦¬??ê²½ìš° ëª¨ë“  ?¬ìš©?ì—ê²??™ê¸°??
    if (isCompleted) {
      await syncWorkStatusToAllUsers(rowId, true)
    }

    res.status(200).json({
      success: true,
      message: `?…ë¬´ê°€ ${isCompleted ? '?„ë£Œ' : 'ë¯¸ì™„ë£?}ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤.`,
      data: {
        workStatus,
        action: isCompleted ? 'completed' : 'uncompleted',
        synced: isCompleted // ?™ê¸°???¬ë?
      }
    })
  } catch (error) {
    console.error('Check work item error:', error)
    res.status(500).json({
      success: false,
      message: '?…ë¬´ ?íƒœ ë³€ê²?ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?„ë£Œ???…ë¬´ ëª©ë¡ ì¡°íšŒ
export const getCompletedWorkList = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const startDate = req.query.startDate as string
    const endDate = req.query.endDate as string
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined
    const fileId = req.query.fileId ? parseInt(req.query.fileId as string) : undefined
    const search = req.query.search as string

    const query: CompletedWorkQuery = {
      page,
      limit,
      startDate,
      endDate,
      userId,
      fileId,
      search
    }

    const result = await getCompletedWork(query)

    res.status(200).json({
      success: true,
      data: {
        workStatuses: result.workStatuses,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrev: page > 1
        },
        summary: result.summary
      }
    })
  } catch (error) {
    console.error('Get completed work list error:', error)
    res.status(500).json({
      success: false,
      message: '?„ë£Œ???…ë¬´ ëª©ë¡ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?¤ëŠ˜ ?…ë¬´ ? ì§œ ?¤ì •
export const setTodayDate = async (req: Request, res: Response): Promise<void> => {
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

    const userId = req.user!.id
    const { todayDate }: TodayDateRequest = req.body

    // ? ì§œ ?•ì‹ ê²€ì¦?
    const date = new Date(todayDate)
    if (isNaN(date.getTime())) {
      res.status(400).json({
        success: false,
        message: '? íš¨?˜ì? ?Šì? ? ì§œ ?•ì‹?…ë‹ˆ?? YYYY-MM-DD ?•ì‹?¼ë¡œ ?…ë ¥?´ì£¼?¸ìš”.'
      })
      return
    }

    await setUserTodayDate(userId, todayDate)

    res.status(200).json({
      success: true,
      message: '?¤ëŠ˜ ? ì§œê°€ ?¤ì •?˜ì—ˆ?µë‹ˆ??',
      data: {
        todayDate
      }
    })
  } catch (error) {
    console.error('Set today date error:', error)
    res.status(500).json({
      success: false,
      message: '?¤ëŠ˜ ? ì§œ ?¤ì • ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?„ì¬ ?¤ì •???¤ëŠ˜ ? ì§œ ì¡°íšŒ
export const getTodayDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const todayDate = await getUserTodayDate(userId)

    res.status(200).json({
      success: true,
      data: {
        todayDate
      }
    })
  } catch (error) {
    console.error('Get today date error:', error)
    res.status(500).json({
      success: false,
      message: '?¤ëŠ˜ ? ì§œ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?¹ì • ? ì§œ???„ë£Œ???…ë¬´ ì¡°íšŒ
export const getCompletedWorkByDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const date = req.params.date
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    // ? ì§œ ?•ì‹ ê²€ì¦?
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      res.status(400).json({
        success: false,
        message: '? íš¨?˜ì? ?Šì? ? ì§œ ?•ì‹?…ë‹ˆ?? YYYY-MM-DD ?•ì‹?¼ë¡œ ?…ë ¥?´ì£¼?¸ìš”.'
      })
      return
    }

    const result = await getCompletedWorkByDate(userId, date, page, limit)

    res.status(200).json({
      success: true,
      data: {
        workStatuses: result.workStatuses,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrev: page > 1
        },
        date
      }
    })
  } catch (error) {
    console.error('Get completed work by date error:', error)
    res.status(500).json({
      success: false,
      message: '? ì§œë³??„ë£Œ???…ë¬´ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?…ë¬´ ?µê³„ ì¡°íšŒ
export const getWorkStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [summary, userStats, fileStats] = await Promise.all([
      getWorkSummary(),
      getUserWorkStats(),
      getFileWorkStats()
    ])

    res.status(200).json({
      success: true,
      data: {
        summary,
        userStats,
        fileStats
      }
    })
  } catch (error) {
    console.error('Get work stats error:', error)
    res.status(500).json({
      success: false,
      message: '?…ë¬´ ?µê³„ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?€??ì²´í¬/?´ì œ
export const bulkCheckWork = async (req: Request, res: Response): Promise<void> => {
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

    const userId = req.user!.id
    const { rowIds, isCompleted, notes }: BulkCheckRequest = req.body

    if (!rowIds || rowIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'ì²˜ë¦¬????IDê°€ ?„ìš”?©ë‹ˆ??'
      })
      return
    }

    if (rowIds.length > 100) {
      res.status(400).json({
        success: false,
        message: '??ë²ˆì— ìµœë? 100ê°??‰ë§Œ ì²˜ë¦¬?????ˆìŠµ?ˆë‹¤.'
      })
      return
    }

    const result = await bulkToggleWorkStatus(rowIds, userId, isCompleted, notes)

    res.status(200).json({
      success: true,
      message: `?€??ì²˜ë¦¬ê°€ ?„ë£Œ?˜ì—ˆ?µë‹ˆ?? (?±ê³µ: ${result.success}, ?¤íŒ¨: ${result.failed})`,
      data: result
    })
  } catch (error) {
    console.error('Bulk check work error:', error)
    res.status(500).json({
      success: false,
      message: '?€??ì²˜ë¦¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?¬ìš©?ë³„ ?…ë¬´ ?„í™© ì¡°íšŒ
export const getUserWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const todayDate = await getUserTodayDate(userId)

    // ?¤ëŠ˜ ?„ë£Œ???…ë¬´ ì¡°íšŒ
    const todayWork = await getCompletedWorkByDate(userId, todayDate, 1, 10)

    // ?„ì²´ ?µê³„
    const [totalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_items,
        COUNT(CASE WHEN is_completed = FALSE THEN 1 END) as pending_items
      FROM work_status 
      WHERE user_id = ?
    `, [userId]) as any[]

    const stats = totalStats[0]
    const completionRate = stats.total_items > 0 ? (stats.completed_items / stats.total_items) * 100 : 0

    res.status(200).json({
      success: true,
      data: {
        todayDate,
        totalItems: stats.total_items,
        completedItems: stats.completed_items,
        pendingItems: stats.pending_items,
        completionRate: Math.round(completionRate * 100) / 100,
        todayCompleted: todayWork.total,
        recentWork: todayWork.workStatuses
      }
    })
  } catch (error) {
    console.error('Get user work status error:', error)
    res.status(500).json({
      success: false,
      message: '?¬ìš©???…ë¬´ ?„í™© ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?…ë¬´ ?œë™ ?ˆìŠ¤? ë¦¬ ì¡°íšŒ
export const getWorkHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined
    const fileId = req.query.fileId ? parseInt(req.query.fileId as string) : undefined
    const action = req.query.action as string
    const startDate = req.query.startDate as string
    const endDate = req.query.endDate as string

    const offset = (page - 1) * limit

    // WHERE ì¡°ê±´ êµ¬ì„±
    let whereConditions = ['1=1']
    const params: any[] = []

    if (userId) {
      whereConditions.push('wh.user_id = ?')
      params.push(userId)
    }

    if (fileId) {
      whereConditions.push('ed.file_id = ?')
      params.push(fileId)
    }

    if (action) {
      whereConditions.push('wh.action = ?')
      params.push(action)
    }

    if (startDate) {
      whereConditions.push('DATE(wh.created_at) >= ?')
      params.push(startDate)
    }

    if (endDate) {
      whereConditions.push('DATE(wh.created_at) <= ?')
      params.push(endDate)
    }

    const whereClause = whereConditions.join(' AND ')

    // ?„ì²´ ê°œìˆ˜ ì¡°íšŒ
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM work_history wh
       JOIN excel_data ed ON wh.excel_data_id = ed.id
       WHERE ${whereClause}`,
      params
    ) as any[]

    const total = countResult[0].total

    // ?œë™ ?ˆìŠ¤? ë¦¬ ì¡°íšŒ
    const [activities] = await pool.query(
      `SELECT 
        wh.*,
        u.name as user_name,
        ed.row_index,
        ed.row_data
       FROM work_history wh
       JOIN users u ON wh.user_id = u.id
       JOIN excel_data ed ON wh.excel_data_id = ed.id
       WHERE ${whereClause}
       ORDER BY wh.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]

    res.status(200).json({
      success: true,
      data: {
        activities: activities.map((activity: any) => ({
          id: activity.id,
          excel_data_id: activity.excel_data_id,
          user_id: activity.user_id,
          action: activity.action,
          old_status: activity.old_status,
          new_status: activity.new_status,
          notes: activity.notes,
          created_at: activity.created_at,
          user: {
            id: activity.user_id,
            name: activity.user_name
          },
          excel_data: {
            row_index: activity.row_index,
            row_data: JSON.parse(activity.row_data)
          }
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    })
  } catch (error) {
    console.error('Get work history error:', error)
    res.status(500).json({
      success: false,
      message: '?…ë¬´ ?œë™ ?ˆìŠ¤? ë¦¬ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ? íš¨??ê²€??ê·œì¹™
export const checkWorkValidation = [
  body('isCompleted')
    .isBoolean()
    .withMessage('?„ë£Œ ?íƒœ??boolean ê°’ì´?´ì•¼ ?©ë‹ˆ??'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('ë©”ëª¨??1000???´í•˜?¬ì•¼ ?©ë‹ˆ??')
]

export const todayDateValidation = [
  body('todayDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('? ì§œ??YYYY-MM-DD ?•ì‹?´ì–´???©ë‹ˆ??')
]

export const bulkCheckValidation = [
  body('rowIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('??ID??1-100ê°œì˜ ë°°ì—´?´ì–´???©ë‹ˆ??'),
  body('rowIds.*')
    .isInt({ min: 1 })
    .withMessage('??ID???‘ì˜ ?•ìˆ˜?¬ì•¼ ?©ë‹ˆ??'),
  body('isCompleted')
    .isBoolean()
    .withMessage('?„ë£Œ ?íƒœ??boolean ê°’ì´?´ì•¼ ?©ë‹ˆ??'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('ë©”ëª¨??1000???´í•˜?¬ì•¼ ?©ë‹ˆ??')
] 
