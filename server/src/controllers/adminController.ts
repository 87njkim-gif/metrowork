import { Request, Response } from 'express'
import { getPool } from '../config/database'
import { getUserWorkStats, getGlobalWorkStats } from '../utils/workProcessor'

const pool = getPool()

// 회원별 업무 처리 통계 조회
export const getUserWorkStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    // 캐시 방지 헤더 설정
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })

    const stats = await getUserWorkStats()

    res.status(200).json({
      success: true,
      data: {
        userStats: stats,
        summary: {
          totalUsers: stats.length,
          totalCompleted: stats.reduce((sum, stat) => sum + stat.completed_count, 0),
          totalPending: stats.reduce((sum, stat) => sum + stat.pending_count, 0),
          averageCompletionRate: stats.length > 0 
            ? stats.reduce((sum, stat) => sum + stat.completion_rate, 0) / stats.length 
            : 0
        }
      }
    })
  } catch (error) {
    console.error('Get user work statistics error:', error)
    res.status(500).json({
      success: false,
      message: '회원별 업무 통계 조회 중 오류가 발생했습니다.'
    })
  }
}

// ?역 ?�무 ?�황 조회
export const getGlobalWorkStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getGlobalWorkStats()

    res.status(200).json({
      success: true,
      data: {
        globalStats: stats,
        summary: {
          totalWorkItems: stats.length,
          totalCompleted: stats.reduce((sum, stat) => sum + stat.completed_users, 0),
          totalPending: stats.reduce((sum, stat) => sum + stat.pending_users, 0),
          averageCompletionRate: stats.length > 0 
            ? stats.reduce((sum, stat) => sum + stat.completion_rate, 0) / stats.length 
            : 0
        }
      }
    })
  } catch (error) {
    console.error('Get global work statistics error:', error)
    res.status(500).json({
      success: false,
      message: '?�역 ?�무 ?�황 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// 관리자 ?�?�보???�계
export const getAdminDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // ?�원�??�계
    const userStats = await getUserWorkStats()
    
    // ?�역 ?�무 ?�계
    const globalStats = await getGlobalWorkStats()
    
    // ?�체 ?�용????
    const [userCount] = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE role = "user" AND status = "approved"'
    ) as any[]
    
    // ?�늘 ?�료???�무 ??
    const [todayCompleted] = await pool.query(
      'SELECT COUNT(*) as total FROM work_status WHERE is_completed = TRUE AND DATE(completed_at) = CURDATE()'
    ) as any[]

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers: userCount[0].total,
          totalWorkItems: globalStats.length,
          todayCompleted: todayCompleted[0].total,
          totalCompleted: userStats.reduce((sum, stat) => sum + stat.completed_count, 0)
        },
        userStats: userStats.slice(0, 10), // ?�위 10명만
        globalStats: globalStats.slice(0, 20), // ?�위 20�??�무�?
        topPerformers: userStats
          .filter(stat => stat.completed_count > 0)
          .sort((a, b) => b.completed_count - a.completed_count)
          .slice(0, 5)
      }
    })
  } catch (error) {
    console.error('Get admin dashboard stats error:', error)
    res.status(500).json({
      success: false,
      message: '관리자 ?�?�보???�계 조회 �??�류가 발생?�습?�다.'
    })
  }
} 

// 데이터 정리: 미완료 업무 삭제
export const cleanupWorkStatusData = async (req: Request, res: Response): Promise<void> => {
  try {
    // 미완료 업무 삭제
    const deleteResult = await pool.query(
      'DELETE FROM work_status WHERE is_completed = FALSE'
    )

    // 삭제 후 통계 조회
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN is_completed = TRUE THEN 1 END) as completed_records
      FROM work_status
    `)

    const stats = statsResult.rows[0]

    // 사용자별 완료된 업무 현황
    const userStatsResult = await pool.query(`
      SELECT 
        u.name as user_name,
        u.email as user_email,
        COUNT(ws.id) as completed_count
      FROM users u
      LEFT JOIN work_status ws ON u.id = ws.user_id AND ws.is_completed = TRUE
      WHERE u.role = $1 AND u.status = $2
      GROUP BY u.id, u.name, u.email
      ORDER BY completed_count DESC
    `, ['user', 'approved'])

    res.status(200).json({
      success: true,
      message: `데이터 정리 완료: ${deleteResult.rowCount}개의 미완료 업무 삭제`,
      data: {
        deletedCount: deleteResult.rowCount,
        currentStats: {
          totalRecords: stats.total_records,
          completedRecords: stats.completed_records
        },
        userStats: userStatsResult.rows
      }
    })
  } catch (error) {
    console.error('Cleanup work status data error:', error)
    res.status(500).json({
      success: false,
      message: '데이터 정리 중 오류가 발생했습니다.'
    })
  }
} 
