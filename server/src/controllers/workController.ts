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

// ?��? ?�이????체크/?�제 (?�로???�스??
export const checkWorkItem = async (req: Request, res: Response): Promise<void> => {
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

    const rowId = parseInt(req.params.rowId)
    const userId = req.user!.id
    const { isCompleted, notes }: CheckWorkRequest = req.body

    // ?��? ?�이??존재 ?��? ?�인
    const [excelData] = await pool.query(
      'SELECT id, file_id FROM excel_data WHERE id = ?',
      [rowId]
    ) as any[]

    if (excelData.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�당 ?��? ?�이?��? 찾을 ???�습?�다.'
      })
      return
    }

    // ?�무 ?�제 권한 ?�인
    if (!isCompleted) {
      const canUncomplete = await canUncompleteWork(rowId, userId)
      if (!canUncomplete) {
        res.status(403).json({
          success: false,
          message: '?�무�??�료???�용?�만 ?�제?????�습?�다.'
        })
        return
      }
    }

    // 기존 ?�태 ?�인 (?�동 로그??
    const [existingStatus] = await pool.query(
      'SELECT is_completed FROM work_status WHERE excel_data_id = ? AND user_id = ?',
      [rowId, userId]
    ) as any[]

    const oldStatus = existingStatus.length > 0 ? existingStatus[0].is_completed : null

    // ?�태 ?��?
    const workStatus = await toggleWorkStatus(rowId, userId, isCompleted, notes)

    // ?�료 처리??경우 모든 ?�용?�에�??�기??
    if (isCompleted) {
      await syncWorkStatusToAllUsers(rowId, true)
    }

    res.status(200).json({
      success: true,
      message: `?�무가 ${isCompleted ? '?�료' : '미완�?}�?변경되?�습?�다.`,
      data: {
        workStatus,
        action: isCompleted ? 'completed' : 'uncompleted',
        synced: isCompleted // ?�기???��?
      }
    })
  } catch (error) {
    console.error('Check work item error:', error)
    res.status(500).json({
      success: false,
      message: '?�무 ?�태 변�?�??�류가 발생?�습?�다.'
    })
  }
}

// ?�료???�무 목록 조회
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
      message: '?�료???�무 목록 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�늘 ?�무 ?�짜 ?�정
export const setTodayDate = async (req: Request, res: Response): Promise<void> => {
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

    const userId = req.user!.id
    const { todayDate }: TodayDateRequest = req.body

    // ?�짜 ?�식 검�?
    const date = new Date(todayDate)
    if (isNaN(date.getTime())) {
      res.status(400).json({
        success: false,
        message: '?�효?��? ?��? ?�짜 ?�식?�니?? YYYY-MM-DD ?�식?�로 ?�력?�주?�요.'
      })
      return
    }

    await setUserTodayDate(userId, todayDate)

    res.status(200).json({
      success: true,
      message: '?�늘 ?�짜가 ?�정?�었?�니??',
      data: {
        todayDate
      }
    })
  } catch (error) {
    console.error('Set today date error:', error)
    res.status(500).json({
      success: false,
      message: '?�늘 ?�짜 ?�정 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�재 ?�정???�늘 ?�짜 조회
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
      message: '?�늘 ?�짜 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�정 ?�짜???�료???�무 조회
export const getCompletedWorkByDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const date = req.params.date
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    // ?�짜 ?�식 검�?
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      res.status(400).json({
        success: false,
        message: '?�효?��? ?��? ?�짜 ?�식?�니?? YYYY-MM-DD ?�식?�로 ?�력?�주?�요.'
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
      message: '?�짜�??�료???�무 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�무 ?�계 조회
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
      message: '?�무 ?�계 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�??체크/?�제
export const bulkCheckWork = async (req: Request, res: Response): Promise<void> => {
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

    const userId = req.user!.id
    const { rowIds, isCompleted, notes }: BulkCheckRequest = req.body

    if (!rowIds || rowIds.length === 0) {
      res.status(400).json({
        success: false,
        message: '처리????ID가 ?�요?�니??'
      })
      return
    }

    if (rowIds.length > 100) {
      res.status(400).json({
        success: false,
        message: '??번에 최�? 100�??�만 처리?????�습?�다.'
      })
      return
    }

    const result = await bulkToggleWorkStatus(rowIds, userId, isCompleted, notes)

    res.status(200).json({
      success: true,
      message: `?�??처리가 ?�료?�었?�니?? (?�공: ${result.success}, ?�패: ${result.failed})`,
      data: result
    })
  } catch (error) {
    console.error('Bulk check work error:', error)
    res.status(500).json({
      success: false,
      message: '?�??처리 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�용?�별 ?�무 ?�황 조회
export const getUserWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const todayDate = await getUserTodayDate(userId)

    // ?�늘 ?�료???�무 조회
    const todayWork = await getCompletedWorkByDate(userId, todayDate, 1, 10)

    // ?�체 ?�계
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
      message: '?�용???�무 ?�황 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�무 ?�동 ?�스?�리 조회
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

    // WHERE 조건 구성
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

    // ?�체 개수 조회
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM work_history wh
       JOIN excel_data ed ON wh.excel_data_id = ed.id
       WHERE ${whereClause}`,
      params
    ) as any[]

    const total = countResult[0].total

    // ?�동 ?�스?�리 조회
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
      message: '?�무 ?�동 ?�스?�리 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�효??검??규칙
export const checkWorkValidation = [
  body('isCompleted')
    .isBoolean()
    .withMessage('?�료 ?�태??boolean 값이?�야 ?�니??'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('메모??1000???�하?�야 ?�니??')
]

export const todayDateValidation = [
  body('todayDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('?�짜??YYYY-MM-DD ?�식?�어???�니??')
]

export const bulkCheckValidation = [
  body('rowIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('??ID??1-100개의 배열?�어???�니??'),
  body('rowIds.*')
    .isInt({ min: 1 })
    .withMessage('??ID???�의 ?�수?�야 ?�니??'),
  body('isCompleted')
    .isBoolean()
    .withMessage('?�료 ?�태??boolean 값이?�야 ?�니??'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('메모??1000???�하?�야 ?�니??')
] 
