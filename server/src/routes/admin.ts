import { Router } from 'express'
import { Request, Response } from 'express'
import { getPool } from '../config/database'
import { authenticate, requireAdmin, extractToken } from '../middleware/auth'
import { body, validationResult } from 'express-validator'

const router = Router()
const pool = getPool()

// 모든 라우트에 관리자 권한 체크 적용
router.use(extractToken, authenticate, requireAdmin)

// 대기 중인 사용자 목록 조회
router.get('/pending-users', async (req: Request, res: Response): Promise<void> => {
  try {
    const [users] = await pool.execute(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.phone, u.department, u.position,
        u.created_at, u.approved_at, u.approved_by, u.rejected_at, u.rejected_by, u.rejection_reason,
        approver.name as approver_name,
        rejector.name as rejector_name
      FROM users u
      LEFT JOIN users approver ON u.approved_by = approver.id
      LEFT JOIN users rejector ON u.rejected_by = rejector.id
      WHERE u.status = 'pending'
      ORDER BY u.created_at ASC
    `) as any[]

    res.status(200).json({
      success: true,
      data: {
        users,
        total: users.length
      }
    })
  } catch (error) {
    console.error('Get pending users error:', error)
    res.status(500).json({
      success: false,
      message: '대기 중인 사용자 목록 조회 중 오류가 발생했습니다.'
    })
  }
})

// 모든 사용자 목록 조회
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string || ''
    const status = req.query.status as string || ''
    const role = req.query.role as string || ''
    
    const offset = (page - 1) * limit
    
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (search) {
      whereClause += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.department LIKE ?)'
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    
    if (status) {
      whereClause += ' AND u.status = ?'
      params.push(status)
    }
    
    if (role) {
      whereClause += ' AND u.role = ?'
      params.push(role)
    }
    
    // 전체 개수 조회
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    ) as any[]
    
    const total = countResult[0].total
    
    // 사용자 목록 조회
    const [users] = await pool.execute(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.phone, u.department, u.position,
        u.created_at, u.approved_at, u.approved_by, u.rejected_at, u.rejected_by, u.rejection_reason,
        u.last_login_at,
        approver.name as approver_name,
        rejector.name as rejector_name
      FROM users u
      LEFT JOIN users approver ON u.approved_by = approver.id
      LEFT JOIN users rejector ON u.rejected_by = rejector.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]) as any[]

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다.'
    })
  }
})

// 사용자 상세 정보 조회
router.get('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId)
    
    const [users] = await pool.execute(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.phone, u.department, u.position,
        u.created_at, u.approved_at, u.approved_by, u.rejected_at, u.rejected_by, u.rejection_reason,
        u.last_login_at,
        approver.name as approver_name,
        rejector.name as rejector_name
      FROM users u
      LEFT JOIN users approver ON u.approved_by = approver.id
      LEFT JOIN users rejector ON u.rejected_by = rejector.id
      WHERE u.id = ?
    `, [userId]) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        user: users[0]
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({
      success: false,
      message: '사용자 정보 조회 중 오류가 발생했습니다.'
    })
  }
})

// 사용자 상태 변경
router.put('/users/:userId/status', [
  body('status')
    .isIn(['approved', 'rejected', 'inactive'])
    .withMessage('유효한 상태값을 입력해주세요.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('거부 사유는 500자 이하여야 합니다.')
], async (req: Request, res: Response): Promise<void> => {
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

    const userId = parseInt(req.params.userId)
    const { status, rejection_reason } = req.body
    const adminId = req.user!.id

    // 사용자 존재 여부 체크
    const [users] = await pool.execute(
      'SELECT id, email, name, status FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      })
      return
    }

    const user = users[0]

    // 상태 변경 처리
    if (status === 'approved') {
      await pool.execute(
        'UPDATE users SET status = ?, approved_at = NOW(), approved_by = ?, rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL WHERE id = ?',
        [status, adminId, userId]
      )
    } else if (status === 'rejected') {
      await pool.execute(
        'UPDATE users SET status = ?, rejected_at = NOW(), rejected_by = ?, rejection_reason = ?, approved_at = NULL, approved_by = NULL WHERE id = ?',
        [status, adminId, rejection_reason, userId]
      )
    } else if (status === 'inactive') {
      await pool.execute(
        'UPDATE users SET status = ? WHERE id = ?',
        [status, userId]
      )
    }

    // 업데이트된 사용자 정보 조회
    const [updatedUsers] = await pool.execute(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.phone, u.department, u.position,
        u.created_at, u.approved_at, u.approved_by, u.rejected_at, u.rejected_by, u.rejection_reason,
        approver.name as approver_name,
        rejector.name as rejector_name
      FROM users u
      LEFT JOIN users approver ON u.approved_by = approver.id
      LEFT JOIN users rejector ON u.rejected_by = rejector.id
      WHERE u.id = ?
    `, [userId]) as any[]

    res.status(200).json({
      success: true,
      message: `사용자 상태가 ${status === 'approved' ? '승인' : status === 'rejected' ? '거부' : '비활성화'}되었습니다.`,
      data: {
        user: updatedUsers[0]
      }
    })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({
      success: false,
      message: '사용자 상태 변경 중 오류가 발생했습니다.'
    })
  }
})

// 사용자 역할 변경
router.put('/users/:userId/role', [
  body('role')
    .isIn(['admin', 'user'])
    .withMessage('유효한 역할값을 입력해주세요.')
], async (req: Request, res: Response): Promise<void> => {
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

    const userId = parseInt(req.params.userId)
    const { role } = req.body

    // 사용자 존재 여부 체크
    const [users] = await pool.execute(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      })
      return
    }

    // 역할 변경
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    )

    res.status(200).json({
      success: true,
      message: `사용자 역할이 ${role === 'admin' ? '관리자' : '일반 사용자'}로 변경되었습니다.`
    })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({
      success: false,
      message: '사용자 역할 변경 중 오류가 발생했습니다.'
    })
  }
})

// 대시보드 통계
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    // 전체 사용자 통계
    const [userStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_users,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_users,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users
      FROM users
    `) as any[]

    // 최근 가입자
    const [recentUsers] = await pool.execute(`
      SELECT id, email, name, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `) as any[]

    // 부서별 통계
    const [departmentStats] = await pool.execute(`
      SELECT 
        department,
        COUNT(*) as user_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
      FROM users
      WHERE department IS NOT NULL AND department != ''
      GROUP BY department
      ORDER BY user_count DESC
    `) as any[]

    res.status(200).json({
      success: true,
      data: {
        userStats: userStats[0],
        recentUsers,
        departmentStats
      }
    })
  } catch (error) {
    console.error('Get dashboard error:', error)
    res.status(500).json({
      success: false,
      message: '대시보드 데이터 조회 중 오류가 발생했습니다.'
    })
  }
})

// 회원별 업무 처리 통계 조회
router.get('/work/user-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getUserWorkStatistics } = await import('../controllers/adminController')
    await getUserWorkStatistics(req, res)
  } catch (error) {
    console.error('Get user work stats error:', error)
    res.status(500).json({
      success: false,
      message: '회원별 업무 통계 조회 중 오류가 발생했습니다.'
    })
  }
})

// 전역 업무 현황 조회
router.get('/work/global-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getGlobalWorkStatistics } = await import('../controllers/adminController')
    await getGlobalWorkStatistics(req, res)
  } catch (error) {
    console.error('Get global work stats error:', error)
    res.status(500).json({
      success: false,
      message: '전역 업무 현황 조회 중 오류가 발생했습니다.'
    })
  }
})

// 관리자 대시보드 통계
router.get('/dashboard/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getAdminDashboardStats } = await import('../controllers/adminController')
    await getAdminDashboardStats(req, res)
  } catch (error) {
    console.error('Get admin dashboard stats error:', error)
    res.status(500).json({
      success: false,
      message: '관리자 대시보드 통계 조회 중 오류가 발생했습니다.'
    })
  }
})

export default router 