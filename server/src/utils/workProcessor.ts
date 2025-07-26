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

// 작업 상태 토글/체크 (프로덕션용)
export const toggleWorkStatus = async (
  excelDataId: number,
  userId: number,
  isCompleted: boolean,
  notes?: string
): Promise<WorkStatus> => {
  try {
    // 기존 상태 확인
    const existing = await pool.query(
      'SELECT * FROM work_status WHERE data_id = $1 AND user_id = $2',
      [excelDataId, userId]
    )

    const completedAt = isCompleted ? new Date() : null
    let workStatus: WorkStatus

    if (existing.rows.length > 0) {
      // 기존 상태 업데이트
      await pool.query(
        `UPDATE work_status 
         SET is_completed = $1, completed_at = $2, notes = $3, updated_at = NOW()
         WHERE data_id = $4 AND user_id = $5`,
        [isCompleted, completedAt, notes, excelDataId, userId]
      )

      // 업데이트된 상태 조회
      const updated = await pool.query(
        'SELECT * FROM work_status WHERE data_id = $1 AND user_id = $2',
        [excelDataId, userId]
      )

      workStatus = updated.rows[0] as WorkStatus
    } else {
      // 새로운 상태 생성
      const result = await pool.query(
        `INSERT INTO work_status (data_id, user_id, assigned_to, is_completed, completed_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [excelDataId, userId, userId, isCompleted, completedAt, notes]
      )

      const workStatusId = result.rows[0].id

      // 생성된 상태 조회
      const newStatus = await pool.query(
        'SELECT * FROM work_status WHERE id = $1',
        [workStatusId]
      )

      workStatus = newStatus.rows[0] as WorkStatus
    }

    // 활동 로그 기록
    const action = isCompleted ? 'completed' : 'cancelled'
    await logWorkActivity(excelDataId, userId, action, !isCompleted, isCompleted, notes)

    return workStatus
  } catch (error) {
    console.error('Toggle work status error:', error)
    throw error
  }
}

// 모든 사용자에 대한 작업 상태 동기화
export const syncWorkStatusToAllUsers = async (excelDataId: number, isCompleted: boolean): Promise<void> => {
  try {
    // 모든 사용자 조회
    const users = await pool.query(
      'SELECT id FROM users WHERE status = $1 AND role = $2',
      ['approved', 'user']
    )

    // 각 사용자에 대한 작업 상태 동기화
    for (const user of users.rows) {
      const existing = await pool.query(
        'SELECT id FROM work_status WHERE data_id = $1 AND user_id = $2',
        [excelDataId, user.id]
      )

      if (existing.rows.length > 0) {
        // 기존 상태 업데이트
        await pool.query(
          `UPDATE work_status 
           SET is_completed = $1, completed_at = $2, updated_at = NOW()
           WHERE data_id = $3 AND user_id = $4`,
          [isCompleted, isCompleted ? new Date() : null, excelDataId, user.id]
        )
      } else {
        // 새로운 상태 생성 (중복 방지)
        await pool.query(
          `INSERT INTO work_status (data_id, user_id, assigned_to, is_completed, completed_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (data_id, assigned_to) 
           DO UPDATE SET 
             is_completed = EXCLUDED.is_completed,
             completed_at = EXCLUDED.completed_at,
             updated_at = NOW()`,
          [excelDataId, user.id, user.id, isCompleted, isCompleted ? new Date() : null]
        )
      }
    }
  } catch (error) {
    console.error('Sync work status error:', error)
    throw error
  }
}

// 작업 상태 취소 권한 확인
export const canUncompleteWork = async (excelDataId: number, userId: number): Promise<{
  canUncomplete: boolean;
  completedBy?: string;
  completedByUserId?: number;
}> => {
  try {
    // 해당 작업에 대한 완료된 사용자 조회
    const completedUsers = await pool.query(`
      SELECT ws.user_id, u.name as user_name 
      FROM work_status ws 
      JOIN users u ON ws.user_id = u.id 
      WHERE ws.data_id = $1 AND ws.is_completed = TRUE
    `, [excelDataId])

    if (completedUsers.rows.length === 0) {
      return { canUncomplete: false }
    }

    const completedUser = completedUsers.rows[0]
    
    // 현재 사용자가 완료한 사용자인지 확인
    const canUncomplete = completedUser.user_id === userId
    
    return {
      canUncomplete,
      completedBy: completedUser.user_name,
      completedByUserId: completedUser.user_id
    }
  } catch (error) {
    console.error('Check uncomplete permission error:', error)
    return { canUncomplete: false }
  }
}

// 사용자별 작업 통계 조회
export const getUserWorkStats = async (): Promise<UserWorkStats[]> => {
  try {
    const stats = await pool.query(`
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
      WHERE u.role = $1 AND u.status = $2
      GROUP BY u.id, u.name, u.email, u.department
      ORDER BY completed_count DESC
    `, ['user', 'approved'])

    return stats.rows.map((stat: any) => ({
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

// 전체 작업 통계 조회
export const getGlobalWorkStats = async (): Promise<any[]> => {
  try {
    const stats = await pool.query(`
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
      LEFT JOIN work_status ws ON ed.id = ws.data_id
      GROUP BY ed.id, ed.row_index, ed.row_data, ef.original_name
      ORDER BY completion_rate DESC, last_completed_at DESC
    `)

    return stats.rows
  } catch (error) {
    console.error('Get global work stats error:', error)
    throw error
  }
}

// 완료된 작업 목록 조회 (기존 페이지 기반)
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
    console.log('=== getCompletedWork 호출 ===')
    console.log('받은 쿼리:', query)
    
    const page = query.page || 1
    const limit = Math.min(query.limit || 20, 100)
    const offset = (page - 1) * limit

    // 기본 WHERE 조건
    let whereConditions = ['ws.is_completed = TRUE']
    const params: any[] = []

    // 시작 날짜
    if (query.startDate) {
      whereConditions.push(`DATE(ws.completed_at) >= $${params.length + 1}`)
      params.push(query.startDate)
    }
    if (query.endDate) {
      whereConditions.push(`DATE(ws.completed_at) <= $${params.length + 1}`)
      params.push(query.endDate)
    }

    // 사용자 필터
    if (query.userId) {
      whereConditions.push(`ws.user_id = $${params.length + 1}`)
      params.push(query.userId)
      console.log('사용자 필터 추가됨:', query.userId)
    } else {
      console.log('사용자 필터 없음')
    }

    // 파일 필터
    if (query.fileId) {
      whereConditions.push(`ed.file_id = $${params.length + 1}`)
      params.push(query.fileId)
    }

    // 검색어 필터
    if (query.search) {
      whereConditions.push(`(
        ed.row_data::text ILIKE $${params.length + 1} OR
        u.name ILIKE $${params.length + 2} OR
        ef.original_name ILIKE $${params.length + 3}
      )`)
      params.push(`%${query.search}%`, `%${query.search}%`, `%${query.search}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    console.log('최종 WHERE 절:', whereClause)
    console.log('파라미터:', params)

    // 전체 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM work_status ws
      JOIN excel_data ed ON ws.data_id = ed.id
      JOIN users u ON ws.user_id = u.id
      JOIN excel_files ef ON ed.file_id = ef.id
      ${whereClause}
    `
    const countResult = await pool.query(countQuery, params)
    const total = countResult.rows[0].total

    // 데이터 조회
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
      JOIN excel_data ed ON ws.data_id = ed.id
      JOIN users u ON ws.user_id = u.id
      JOIN excel_files ef ON ed.file_id = ef.id
      ${whereClause}
      ORDER BY ws.completed_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const workStatuses = await pool.query(dataQuery, [...params, limit, offset])

    // 요약 조회
    const summary = await getWorkSummary()

    return {
      workStatuses: workStatuses.rows.map((ws: any) => ({
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
          row_data: typeof ws.row_data === 'string' ? JSON.parse(ws.row_data) : ws.row_data,
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

// 작업 요약 조회
export const getWorkSummary = async (): Promise<WorkSummary> => {
  try {
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as totalCompleted,
        COUNT(CASE WHEN DATE(completed_at) = CURRENT_DATE THEN 1 END) as todayCompleted,
        COUNT(CASE WHEN completed_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as thisWeekCompleted,
        COUNT(CASE WHEN completed_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as thisMonthCompleted
      FROM work_status 
      WHERE is_completed = TRUE
    `)

    return {
      totalCompleted: summary.rows[0].totalCompleted || 0,
      todayCompleted: summary.rows[0].todayCompleted || 0,
      thisWeekCompleted: summary.rows[0].thisWeekCompleted || 0,
      thisMonthCompleted: summary.rows[0].thisMonthCompleted || 0
    }
  } catch (error) {
    console.error('Get work summary error:', error)
    throw error
  }
}

// 작업 활동 로그 기록
export const logWorkActivity = async (
  excelDataId: number,
  userId: number,
  action: string,
  oldStatus: boolean | null,
  newStatus: boolean | null,
  notes?: string
): Promise<void> => {
  try {
    // work_status_id 조회
    const workStatusResult = await pool.query(
      'SELECT id FROM work_status WHERE data_id = $1 AND user_id = $2',
      [excelDataId, userId]
    )
    
    if (workStatusResult.rows.length > 0) {
      const workStatusId = workStatusResult.rows[0].id
      
      await pool.query(
        `INSERT INTO work_history (work_status_id, user_id, action, old_status, new_status, comment)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workStatusId, userId, action, oldStatus, newStatus, notes]
      )
    }
  } catch (error) {
    console.error('Log work activity error:', error)
    // 로그 기록 실패는 전체 프로세스를 중단하지 않도록 함
  }
}

// 작업 상태 일괄 토글 처리
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
