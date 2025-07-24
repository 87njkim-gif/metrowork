import { Request, Response } from 'express'
import { getPool } from '../config/database'
import { getUserWorkStats, getGlobalWorkStats } from '../utils/workProcessor'

const pool = getPool()

// 회원별 업무 처리 통계 조회
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
      message: '회원별 업무 통계 조회 중 오류가 발생했습니다.'
    })
  }
}

// 전역 업무 현황 조회
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
      message: '전역 업무 현황 조회 중 오류가 발생했습니다.'
    })
  }
}

// 관리자 대시보드 통계
export const getAdminDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // 회원별 통계
    const userStats = await getUserWorkStats()
    
    // 전역 업무 통계
    const globalStats = await getGlobalWorkStats()
    
    // 전체 사용자 수
    const [userCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM users WHERE role = "user" AND status = "approved"'
    ) as any[]
    
    // 오늘 완료된 업무 수
    const [todayCompleted] = await pool.execute(
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
        userStats: userStats.slice(0, 10), // 상위 10명만
        globalStats: globalStats.slice(0, 20), // 상위 20개 업무만
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
      message: '관리자 대시보드 통계 조회 중 오류가 발생했습니다.'
    })
  }
} 