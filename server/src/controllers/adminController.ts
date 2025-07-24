import { Request, Response } from 'express'
import { getPool } from '../config/database'
import { getUserWorkStats, getGlobalWorkStats } from '../utils/workProcessor'

const pool = getPool()

// ?�원�??�무 처리 ?�계 조회
export const getUserWorkStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
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
      message: '?�원�??�무 ?�계 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�역 ?�무 ?�황 조회
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
