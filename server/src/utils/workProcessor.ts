import { getPool } from '../config/database'
import { 
  WorkStatus, 
  WorkStatusWithData, 
  CompletedWorkQuery, 
  WorkSummary,
  UserWorkStats,
  FileWorkStats,
  WorkActivity,
  WorkFilter
} from '../types/work'

const pool = getPool()

// ?��? ?�이????체크/?�제 (?�로???�스??
export const toggleWorkStatus = async (
  excelDataId: number,
  userId: number,
  isCompleted: boolean,
  notes?: string
): Promise<WorkStatus> => {
  try {
    // 기존 ?�태 ?�인
    const [existing] = await pool.query(
      'SELECT * FROM work_status WHERE excel_data_id = ? AND user_id = ?',
      [excelDataId, userId]
    ) as any[]

    const completedAt = isCompleted ? new Date() : null
    let workStatus: WorkStatus

    if (existing.length > 0) {
      // 기존 ?�태 ?�데?�트
      await pool.query(
        `UPDATE work_status 
         SET is_completed = ?, completed_at = ?, notes = ?, updated_at = NOW()
         WHERE excel_data_id = ? AND user_id = ?`,
        [isCompleted, completedAt, notes, excelDataId, userId]
      )

      // ?�데?�트???�태 조회
      const [updated] = await pool.query(
        'SELECT * FROM work_status WHERE excel_data_id = ? AND user_id = ?',
        [excelDataId, userId]
      ) as any[]

      workStatus = updated[0] as WorkStatus
    } else {
      // ?�로???�태 ?�성
      const [result] = await pool.query(
        `INSERT INTO work_status (excel_data_id, user_id, is_completed, completed_at, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [excelDataId, userId, isCompleted, completedAt, notes]
      ) as any[]

      const workStatusId = result.insertId

      // ?�성???�태 조회
      const [newStatus] = await pool.query(
        'SELECT * FROM work_status WHERE id = ?',
        [workStatusId]
      ) as any[]

      workStatus = newStatus[0] as WorkStatus
    }

    // ?�력 로그 기록
    const action = isCompleted ? 'completed' : 'uncompleted'
    await logWorkActivity(excelDataId, userId, action, !isCompleted, isCompleted, notes)

    return workStatus
  } catch (error) {
    console.error('Toggle work status error:', error)
    throw error
  }
}

// 모든 ?�용?�에�??�무 ?�료 ?�태 ?�기??
export const syncWorkStatusToAllUsers = async (excelDataId: number, isCompleted: boolean): Promise<void> => {
  try {
    // 모든 ?�인???�용??조회
    const [users] = await pool.query(
      'SELECT id FROM users WHERE status = "approved" AND role = "user"'
    ) as any[]

    // �??�용?�에�??�무 ?�태 ?�기??
    for (const user of users) {
      const [existing] = await pool.query(
        'SELECT id FROM work_status WHERE excel_data_id = ? AND user_id = ?',
        [excelDataId, user.id]
      ) as any[]

      if (existing.length > 0) {
        // 기존 ?�태 ?�데?�트
        await pool.query(
          `UPDATE work_status 
           SET is_completed = ?, completed_at = ?, updated_at = NOW()
           WHERE excel_data_id = ? AND user_id = ?`,
          [isCompleted, isCompleted ? new Date() : null, excelDataId, user.id]
        )
      } else {
        // ?�로???�태 ?�성
        await pool.query(
          `INSERT INTO work_status (excel_data_id, user_id, is_completed, completed_at)
           VALUES (?, ?, ?, ?)`,
          [excelDataId, user.id, isCompleted, isCompleted ? new Date() : null]
        )
      }
    }
  } catch (error) {
    console.error('Sync work status error:', error)
    throw error
  }
}

// ?�무 ?�제 권한 ?�인
export const canUncompleteWork = async (excelDataId: number, userId: number): Promise<boolean> => {
  try {
    // ?�당 ?�무�??�료???�용??조회
    const [completedUsers] = await pool.query(
      'SELECT user_id FROM work_status WHERE excel_data_id = ? AND is_completed = TRUE',
      [excelDataId]
    ) as any[]

    // ?�재 ?�용?��? ?�료???�무?��? ?�인
    const userCompleted = completedUsers.some((user: any) => user.user_id === userId)
    
    return userCompleted
  } catch (error) {
    console.error('Check uncomplete permission error:', error)
    return false
  }
}

// ?�원�??�무 ?�계 조회
export const getUserWorkStats = async (): Promise<UserWorkStats[]> => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.department as user_department,
        COUNT(ws.id) as total_work_count,
        COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) as completed_count,
        COUNT(CASE WHEN ws.is_completed = FALSE THEN 1 END) as pending_count,
        ROUND(
          (COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) / NULLIF(COUNT(ws.id), 0)) * 100, 
          2
        ) as completion_rate,
        MAX(ws.completed_at) as last_completed_at
      FROM users u
      LEFT JOIN work_status ws ON u.id = ws.user_id
      WHERE u.role = 'user' AND u.status = 'approved'
      GROUP BY u.id, u.name, u.email, u.department
      ORDER BY completed_count DESC
    `) as any[]

    return stats.map((stat: any) => ({
      user_id: stat.user_id,
      user_name: stat.user_name,
      user_email: stat.user_email,
      user_department: stat.user_department,
      total_work_count: stat.total_work_count || 0,
      completed_count: stat.completed_count || 0,
      pending_count: stat.pending_count || 0,
      completion_rate: stat.completion_rate || 0,
      last_completed_at: stat.last_completed_at
    }))
  } catch (error) {
    console.error('Get user work stats error:', error)
    throw error
  }
}

// ?�역 ?�무 ?�황 조회
export const getGlobalWorkStats = async (): Promise<any[]> => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        ed.id as excel_data_id,
        ed.row_index,
        ed.row_data,
        ef.original_name as file_name,
        COUNT(ws.id) as total_users,
        COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) as completed_users,
        COUNT(CASE WHEN ws.is_completed = FALSE THEN 1 END) as pending_users,
        ROUND(
          (COUNT(CASE WHEN ws.is_completed = TRUE THEN 1 END) / NULLIF(COUNT(ws.id), 0)) * 100, 
          2
        ) as completion_rate,
        MAX(ws.completed_at) as last_completed_at
      FROM excel_data ed
      JOIN excel_files ef ON ed.file_id = ef.id
      LEFT JOIN work_status ws ON ed.id = ws.excel_data_id
      GROUP BY ed.id, ed.row_index, ed.row_data, ef.original_name
      ORDER BY completion_rate DESC, last_completed_at DESC
    `) as any[]

    return stats
  } catch (error) {
    console.error('Get global work stats error:', error)
    throw error
  }
}

// ?�료???�무 목록 조회 (기존 ?�수 ?��?)
export const getCompletedWork = async (query: CompletedWorkQuery): Promise<{
  workStatuses: WorkStatusWithData[]
  total: number
  summary: {
    totalCompleted: number
    todayCompleted: number
    thisWeekCompleted: number
    thisMonthCompleted: number
  }
}> => {
  try {
    const page = query.page || 1
    const limit = Math.min(query.limit || 20, 100)
    const offset = (page - 1) * limit

    // 기본 WHERE 조건
    let whereConditions = ['ws.is_completed = TRUE']
    const params: any[] = []

    // ?�짜 ?�터
    if (query.startDate) {
      whereConditions.push('DATE(ws.completed_at) >= ?')
      params.push(query.startDate)
    }
    if (query.endDate) {
      whereConditions.push('DATE(ws.completed_at) <= ?')
      params.push(query.endDate)
    }

    // ?�용???�터
    if (query.userId) {
      whereConditions.push('ws.user_id = ?')
      params.push(query.userId)
    }

    // ?�일 ?�터
    if (query.fileId) {
      whereConditions.push('ed.file_id = ?')
      params.push(query.fileId)
    }

    // 검?�어 ?�터
    if (query.search) {
      whereConditions.push(`(
        JSON_SEARCH(ed.row_data, 'one', ?, null, '$.*') IS NOT NULL OR
        u.name LIKE ? OR
        ef.original_name LIKE ?
      )`)
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // ?�체 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM work_status ws
      JOIN excel_data ed ON ws.excel_data_id = ed.id
      JOIN users u ON ws.user_id = u.id
      JOIN excel_files ef ON ed.file_id = ef.id
      ${whereClause}
    `
    const [countResult] = await pool.query(countQuery, params) as any[]
    const total = countResult[0].total

    // ?�이??조회
    const dataQuery = `
      SELECT 
        ws.*,
        ed.id as excel_data_id,
        ed.row_index,
        ed.row_data,
        ed.is_valid,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        ef.id as file_id,
        ef.original_name as file_name,
        ef.description as file_description
      FROM work_status ws
      JOIN excel_data ed ON ws.excel_data_id = ed.id
      JOIN users u ON ws.user_id = u.id
      JOIN excel_files ef ON ed.file_id = ef.id
      ${whereClause}
      ORDER BY ws.completed_at DESC
      LIMIT ? OFFSET ?
    `
    const [workStatuses] = await pool.query(dataQuery, [...params, limit, offset]) as any[]

    // ?�계 ?�보 조회
    const summary = await getWorkSummary()

    return {
      workStatuses: workStatuses.map((ws: any) => ({
        id: ws.id,
        excel_data_id: ws.excel_data_id,
        file_id: ws.file_id,
        user_id: ws.user_id,
        is_completed: ws.is_completed,
        completed_at: ws.completed_at,
        notes: ws.notes,
        created_at: ws.created_at,
        updated_at: ws.updated_at,
        excel_data: {
          id: ws.excel_data_id,
          row_index: ws.row_index,
          row_data: JSON.parse(ws.row_data),
          is_valid: ws.is_valid
        },
        user: {
          id: ws.user_id,
          name: ws.user_name,
          email: ws.user_email
        },
        file: {
          id: ws.file_id,
          original_name: ws.file_name,
          description: ws.file_description
        }
      })),
      total,
      summary
    }
  } catch (error) {
    console.error('Get completed work error:', error)
    throw error
  }
}

// ?�무 ?�약 ?�보 조회
export const getWorkSummary = async (): Promise<WorkSummary> => {
  try {
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as totalCompleted,
        COUNT(CASE WHEN DATE(completed_at) = CURDATE() THEN 1 END) as todayCompleted,
        COUNT(CASE WHEN completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as thisWeekCompleted,
        COUNT(CASE WHEN completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as thisMonthCompleted
      FROM work_status 
      WHERE is_completed = TRUE
    `) as any[]

    return {
      totalCompleted: summary[0].totalCompleted || 0,
      todayCompleted: summary[0].todayCompleted || 0,
      thisWeekCompleted: summary[0].thisWeekCompleted || 0,
      thisMonthCompleted: summary[0].thisMonthCompleted || 0
    }
  } catch (error) {
    console.error('Get work summary error:', error)
    throw error
  }
}

// ?�동 로그 기록
export const logWorkActivity = async (
  excelDataId: number,
  userId: number,
  action: string,
  oldStatus: boolean | null,
  newStatus: boolean | null,
  notes?: string
): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO work_history (excel_data_id, user_id, action, old_status, new_status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [excelDataId, userId, action, oldStatus, newStatus, notes]
    )
  } catch (error) {
    console.error('Log work activity error:', error)
    throw error
  }
}

// ?�???�무 처리
export const bulkToggleWorkStatus = async (
  rowIds: number[],
  userId: number,
  isCompleted: boolean,
  notes?: string
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const result = { success: 0, failed: 0, errors: [] as string[] }

  for (const rowId of rowIds) {
    try {
      await toggleWorkStatus(rowId, userId, isCompleted, notes)
      result.success++
    } catch (error) {
      result.failed++
      result.errors.push(`Row ${rowId}: ${error}`)
    }
  }

  return result
} 
