import { Router } from 'express'
import { Request, Response } from 'express'
import { getPool } from '../config/database'
import { authenticate, requireAdmin, extractToken } from '../middleware/auth'
import { body, validationResult } from 'express-validator'

const router = Router()
const pool = getPool()

// 모든 ?�우?�에 관리자 권한 체크 ?�용
router.use(extractToken, authenticate, requireAdmin)

// ?��?중인 ?�용??목록 조회
router.get('/pending-users', async (req: Request, res: Response): Promise<void> => {
  try {
    const [users] = await pool.query(`
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
      message: '?��?중인 ?�용??목록 조회 �??�류가 발생?�습?�다.'
    })
  }
})

// 모든 ?�용??목록 조회
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
    
    // ?�체 개수 조회
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    ) as any[]
    
    const total = countResult[0].total
    
    // ?�용??목록 조회
    const [users] = await pool.query(`
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
      message: '?�용??목록 조회 �??�류가 발생?�습?�다.'
    })
  }
})

// ?�용???�세 ?�보 조회
router.get('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId)
    
    const [users] = await pool.query(`
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
        message: '?�용?��? 찾을 ???�습?�다.'
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
      message: '?�용???�보 조회 �??�류가 발생?�습?�다.'
    })
  }
})

// ?�용???�태 변�?
router.put('/users/:userId/status', [
  body('status')
    .isIn(['approved', 'rejected', 'inactive'])
    .withMessage('?�효???�태값을 ?�력?�주?�요.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('거�? ?�유??500???�하?�야 ?�니??')
], async (req: Request, res: Response): Promise<void> => {
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

    const userId = parseInt(req.params.userId)
    const { status, rejection_reason } = req.body
    const adminId = req.user!.id

    // ?�용??존재 ?��? 체크
    const [users] = await pool.query(
      'SELECT id, email, name, status FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�용?��? 찾을 ???�습?�다.'
      })
      return
    }

    const user = users[0]

    // ?�태 변�?처리
    if (status === 'approved') {
      await pool.query(
        'UPDATE users SET status = ?, approved_at = NOW(), approved_by = ?, rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL WHERE id = ?',
        [status, adminId, userId]
      )
    } else if (status === 'rejected') {
      await pool.query(
        'UPDATE users SET status = ?, rejected_at = NOW(), rejected_by = ?, rejection_reason = ?, approved_at = NULL, approved_by = NULL WHERE id = ?',
        [status, adminId, rejection_reason, userId]
      )
    } else if (status === 'inactive') {
      await pool.query(
        'UPDATE users SET status = ? WHERE id = ?',
        [status, userId]
      )
    }

    // ?�데?�트???�용???�보 조회
    const [updatedUsers] = await pool.query(`
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
      message: `?�용???�태가 ${status === 'approved' ? '?�인' : status === 'rejected' ? '거�?' : '비활?�화'}?�었?�니??`,
      data: {
        user: updatedUsers[0]
      }
    })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({
      success: false,
      message: '?�용???�태 변�?�??�류가 발생?�습?�다.'
    })
  }
})

// ?�용????�� 변�?
router.put('/users/:userId/role', [
  body('role')
    .isIn(['admin', 'user'])
    .withMessage('?�효????��값을 ?�력?�주?�요.')
], async (req: Request, res: Response): Promise<void> => {
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

    const userId = parseInt(req.params.userId)
    const { role } = req.body

    // ?�용??존재 ?��? 체크
    const [users] = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�용?��? 찾을 ???�습?�다.'
      })
      return
    }

    // ??�� 변�?
    await pool.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    )

    res.status(200).json({
      success: true,
      message: `?�용????��??${role === 'admin' ? '관리자' : '?�반 ?�용??}�?변경되?�습?�다.`
    })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({
      success: false,
      message: '?�용????�� 변�?�??�류가 발생?�습?�다.'
    })
  }
})

// ?�?�보???�계
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    // ?�체 ?�용???�계
    const [userStats] = await pool.query(`
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

    // 최근 가?�자
    const [recentUsers] = await pool.query(`
      SELECT id, email, name, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `) as any[]

    // 부?�별 ?�계
    const [departmentStats] = await pool.query(`
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
      message: '?�?�보???�이??조회 �??�류가 발생?�습?�다.'
    })
  }
})

// ?�원�??�무 처리 ?�계 조회
router.get('/work/user-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getUserWorkStatistics } = await import('../controllers/adminController')
    await getUserWorkStatistics(req, res)
  } catch (error) {
    console.error('Get user work stats error:', error)
    res.status(500).json({
      success: false,
      message: '?�원�??�무 ?�계 조회 �??�류가 발생?�습?�다.'
    })
  }
})

// ?�역 ?�무 ?�황 조회
router.get('/work/global-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getGlobalWorkStatistics } = await import('../controllers/adminController')
    await getGlobalWorkStatistics(req, res)
  } catch (error) {
    console.error('Get global work stats error:', error)
    res.status(500).json({
      success: false,
      message: '?�역 ?�무 ?�황 조회 �??�류가 발생?�습?�다.'
    })
  }
})

// 관리자 ?�?�보???�계
router.get('/dashboard/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getAdminDashboardStats } = await import('../controllers/adminController')
    await getAdminDashboardStats(req, res)
  } catch (error) {
    console.error('Get admin dashboard stats error:', error)
    res.status(500).json({
      success: false,
      message: '관리자 ?�?�보???�계 조회 �??�류가 발생?�습?�다.'
    })
  }
})

export default router 
