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
  canUncompleteWork
} from '../utils/workProcessor'
import {
  CheckWorkRequest,
  CompletedWorkQuery,
  TodayDateRequest,
  BulkCheckRequest
} from '../types/work'

const pool = getPool()

// 개별 아이템 체크/해제 (프로세스)
export const checkWorkItem = async (req: Request, res: Response): Promise<void> => {
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

    const rowId = parseInt(req.params.rowId)
    const userId = req.user!.id
    const { isCompleted, notes }: CheckWorkRequest = req.body

    // 해당 아이템 존재 여부 확인
    const result = await pool.query(
      'SELECT id, file_id FROM excel_data WHERE id = $1',
      [rowId]
    )
    
    const excelData = result.rows

    if (excelData.length === 0) {
      res.status(404).json({
        success: false,
        message: '해당 아이템을 찾을 수 없습니다.'
      })
      return
    }

    // 업무 해제 권한 확인
    if (!isCompleted) {
      const uncompleteCheck = await canUncompleteWork(rowId, userId)
      if (!uncompleteCheck.canUncomplete) {
        res.status(403).json({
          success: false,
          message: uncompleteCheck.completedBy 
            ? `${uncompleteCheck.completedBy} 회원이 처리한 업무입니다.` 
            : '업무가 완료된 사용자만 해제할 수 있습니다.'
        })
        return
      }
    }

    // 기존 상태 확인 (활동 로그용)
    const existingStatusResult = await pool.query(
      'SELECT is_completed FROM work_status WHERE excel_data_id = $1 AND user_id = $2',
      [rowId, userId]
    )
    
    const existingStatus = existingStatusResult.rows

    const oldStatus = existingStatus.length > 0 ? existingStatus[0].is_completed : null

    // 상태 변경 (본인만)
    const workStatus = await toggleWorkStatus(rowId, userId, isCompleted, notes)

    res.status(200).json({
      success: true,
      message: `업무가 ${isCompleted ? '완료' : '미완료'}로 변경되었습니다.`,
      data: {
        workStatus,
        action: isCompleted ? 'completed' : 'uncompleted'
      }
    })
  } catch (error) {
    console.error('Check work item error:', error)
    res.status(500).json({
      success: false,
      message: '업무 상태 변경 중 오류가 발생했습니다.'
    })
  }
}

// 완료된 업무 목록 조회
export const getCompletedWorkList = async (req: Request, res: Response): Promise<void> => {
  try {
    // 캐시 방지 헤더 설정
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })

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
      message: '완료된 업무 목록 조회 중 오류가 발생했습니다.'
    })
  }
}

// 오늘 업무 날짜 설정
export const setTodayDate = async (req: Request, res: Response): Promise<void> => {
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

    const userId = req.user!.id
    const { todayDate }: TodayDateRequest = req.body

    // 날짜 형식 검증
    const date = new Date(todayDate)
    if (isNaN(date.getTime())) {
      res.status(400).json({
        success: false,
        message: '유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식으로 입력해주세요.'
      })
      return
    }

    await setUserTodayDate(userId, todayDate)

    res.status(200).json({
      success: true,
      message: '오늘 날짜가 설정되었습니다.',
      data: {
        todayDate
      }
    })
  } catch (error) {
    console.error('Set today date error:', error)
    res.status(500).json({
      success: false,
      message: '오늘 날짜 설정 중 오류가 발생했습니다.'
    })
  }
}

// 현재 설정된 오늘 날짜 조회
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
      message: '오늘 날짜 조회 중 오류가 발생했습니다.'
    })
  }
}

// 특정 날짜의 완료된 업무 조회
export const getCompletedWorkByDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const date = req.params.date
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    // 날짜 형식 검증
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      res.status(400).json({
        success: false,
        message: '유효하지 않은 날짜 형식입니다. YYYY-MM-DD 형식으로 입력해주세요.'
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
      message: '날짜별 완료된 업무 조회 중 오류가 발생했습니다.'
    })
  }
}

// 업무 통계 조회
export const getWorkStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id

    // 기본 통계 조회
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_items,
        COUNT(CASE WHEN is_completed = FALSE THEN 1 END) as pending_items
      FROM work_status 
      WHERE user_id = $1
    `, [userId])

    const stats = statsResult.rows[0]
    const completionRate = stats.total_items > 0 ? (stats.completed_items / stats.total_items) * 100 : 0

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalItems: stats.total_items,
          completedItems: stats.completed_items,
          pendingItems: stats.pending_items,
          completionRate: Math.round(completionRate * 100) / 100
        },
        userStats: [],
        fileStats: []
      }
    })
  } catch (error) {
    console.error('Get work stats error:', error)
    res.status(500).json({
      success: false,
      message: '업무 통계 조회 중 오류가 발생했습니다.'
    })
  }
}

// 일괄체크/해제
export const bulkCheckWork = async (req: Request, res: Response): Promise<void> => {
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

    const userId = req.user!.id
    const { rowIds, isCompleted, notes }: BulkCheckRequest = req.body

    if (!rowIds || rowIds.length === 0) {
      res.status(400).json({
        success: false,
        message: '처리할 아이템 ID가 필요합니다.'
      })
      return
    }

    if (rowIds.length > 100) {
      res.status(400).json({
        success: false,
        message: '한번에 최대 100개만 처리할 수 있습니다.'
      })
      return
    }

    const result = await bulkToggleWorkStatus(rowIds, userId, isCompleted, notes)

    res.status(200).json({
      success: true,
      message: `일괄처리가 완료되었습니다. (성공: ${result.success}, 실패: ${result.failed})`,
      data: result
    })
  } catch (error) {
    console.error('Bulk check work error:', error)
    res.status(500).json({
      success: false,
      message: '일괄처리 중 오류가 발생했습니다.'
    })
  }
}

// 사용자별 업무 현황 조회
export const getUserWorkStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const todayDate = new Date().toISOString().split('T')[0] // 오늘 날짜

    // 전체 통계
    const totalStatsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_items,
        COUNT(CASE WHEN is_completed = FALSE THEN 1 END) as pending_items
      FROM work_status 
      WHERE user_id = $1
    `, [userId])

    const stats = totalStatsResult.rows[0]
    const completionRate = stats.total_items > 0 ? (stats.completed_items / stats.total_items) * 100 : 0

    // 오늘 완료된 업무 조회
    const todayWorkResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed
      FROM work_status 
      WHERE user_id = $1 AND DATE(created_at) = $2
    `, [userId, todayDate])

    const todayWork = todayWorkResult.rows[0]

    res.status(200).json({
      success: true,
      data: {
        todayDate,
        totalItems: stats.total_items,
        completedItems: stats.completed_items,
        pendingItems: stats.pending_items,
        completionRate: Math.round(completionRate * 100) / 100,
        todayCompleted: todayWork.total,
        recentWork: []
      }
    })
  } catch (error) {
    console.error('Get user work status error:', error)
    res.status(500).json({
      success: false,
      message: '사용자별 업무 현황 조회 중 오류가 발생했습니다.'
    })
  }
}

// 업무 활동 히스토리 조회
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

    // 전체 개수 조회
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM work_history wh
       JOIN excel_data ed ON wh.excel_data_id = ed.id
       WHERE ${whereClause}`,
      params
    ) as any[]

    const total = countResult[0].total

    // 활동 히스토리 조회
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
      message: '업무 활동 히스토리 조회 중 오류가 발생했습니다.'
    })
  }
}

// 유효성 검증 규칙
export const checkWorkValidation = [
  body('isCompleted')
    .isBoolean()
    .withMessage('완료 상태는 boolean 값이어야 합니다.'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('메모는 1000자 이하여야 합니다.')
]

export const todayDateValidation = [
  body('todayDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('날짜는 YYYY-MM-DD 형식이어야 합니다.')
]

export const bulkCheckValidation = [
  body('rowIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('아이템 ID는 1-100개의 배열이어야 합니다.'),
  body('rowIds.*')
    .isInt({ min: 1 })
    .withMessage('아이템 ID는 양의 정수여야 합니다.'),
  body('isCompleted')
    .isBoolean()
    .withMessage('완료 상태는 boolean 값이어야 합니다.'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('메모는 1000자 이하여야 합니다.')
] 
