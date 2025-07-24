import { Router } from 'express'
import { Request, Response } from 'express'
import { getPool } from '../config/database'
import { authenticate, requireAdmin, extractToken } from '../middleware/auth'
import { body, validationResult } from 'express-validator'

const router = Router()
const pool = getPool()

// ëª¨ë“  ?¼ìš°?¸ì— ê´€ë¦¬ì ê¶Œí•œ ì²´í¬ ?ìš©
router.use(extractToken, authenticate, requireAdmin)

// ?€ê¸?ì¤‘ì¸ ?¬ìš©??ëª©ë¡ ì¡°íšŒ
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
      message: '?€ê¸?ì¤‘ì¸ ?¬ìš©??ëª©ë¡ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ëª¨ë“  ?¬ìš©??ëª©ë¡ ì¡°íšŒ
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
    
    // ?„ì²´ ê°œìˆ˜ ì¡°íšŒ
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    ) as any[]
    
    const total = countResult[0].total
    
    // ?¬ìš©??ëª©ë¡ ì¡°íšŒ
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
      message: '?¬ìš©??ëª©ë¡ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ?¬ìš©???ì„¸ ?•ë³´ ì¡°íšŒ
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
        message: '?¬ìš©?ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
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
      message: '?¬ìš©???•ë³´ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ?¬ìš©???íƒœ ë³€ê²?
router.put('/users/:userId/status', [
  body('status')
    .isIn(['approved', 'rejected', 'inactive'])
    .withMessage('? íš¨???íƒœê°’ì„ ?…ë ¥?´ì£¼?¸ìš”.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('ê±°ë? ?¬ìœ ??500???´í•˜?¬ì•¼ ?©ë‹ˆ??')
], async (req: Request, res: Response): Promise<void> => {
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

    const userId = parseInt(req.params.userId)
    const { status, rejection_reason } = req.body
    const adminId = req.user!.id

    // ?¬ìš©??ì¡´ì¬ ?¬ë? ì²´í¬
    const [users] = await pool.query(
      'SELECT id, email, name, status FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?¬ìš©?ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    const user = users[0]

    // ?íƒœ ë³€ê²?ì²˜ë¦¬
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

    // ?…ë°?´íŠ¸???¬ìš©???•ë³´ ì¡°íšŒ
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
      message: `?¬ìš©???íƒœê°€ ${status === 'approved' ? '?¹ì¸' : status === 'rejected' ? 'ê±°ë?' : 'ë¹„í™œ?±í™”'}?˜ì—ˆ?µë‹ˆ??`,
      data: {
        user: updatedUsers[0]
      }
    })
  } catch (error) {
    console.error('Update user status error:', error)
    res.status(500).json({
      success: false,
      message: '?¬ìš©???íƒœ ë³€ê²?ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ?¬ìš©????•  ë³€ê²?
router.put('/users/:userId/role', [
  body('role')
    .isIn(['admin', 'user'])
    .withMessage('? íš¨????• ê°’ì„ ?…ë ¥?´ì£¼?¸ìš”.')
], async (req: Request, res: Response): Promise<void> => {
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

    const userId = parseInt(req.params.userId)
    const { role } = req.body

    // ?¬ìš©??ì¡´ì¬ ?¬ë? ì²´í¬
    const [users] = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?¬ìš©?ë? ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    // ??•  ë³€ê²?
    await pool.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    )

    res.status(200).json({
      success: true,
      message: `?¬ìš©????• ??${role === 'admin' ? 'ê´€ë¦¬ì' : '?¼ë°˜ ?¬ìš©??}ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤.`
    })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({
      success: false,
      message: '?¬ìš©????•  ë³€ê²?ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ?€?œë³´???µê³„
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    // ?„ì²´ ?¬ìš©???µê³„
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

    // ìµœê·¼ ê°€?…ì
    const [recentUsers] = await pool.query(`
      SELECT id, email, name, role, status, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `) as any[]

    // ë¶€?œë³„ ?µê³„
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
      message: '?€?œë³´???°ì´??ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ?Œì›ë³??…ë¬´ ì²˜ë¦¬ ?µê³„ ì¡°íšŒ
router.get('/work/user-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getUserWorkStatistics } = await import('../controllers/adminController')
    await getUserWorkStatistics(req, res)
  } catch (error) {
    console.error('Get user work stats error:', error)
    res.status(500).json({
      success: false,
      message: '?Œì›ë³??…ë¬´ ?µê³„ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ?„ì—­ ?…ë¬´ ?„í™© ì¡°íšŒ
router.get('/work/global-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getGlobalWorkStatistics } = await import('../controllers/adminController')
    await getGlobalWorkStatistics(req, res)
  } catch (error) {
    console.error('Get global work stats error:', error)
    res.status(500).json({
      success: false,
      message: '?„ì—­ ?…ë¬´ ?„í™© ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

// ê´€ë¦¬ì ?€?œë³´???µê³„
router.get('/dashboard/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getAdminDashboardStats } = await import('../controllers/adminController')
    await getAdminDashboardStats(req, res)
  } catch (error) {
    console.error('Get admin dashboard stats error:', error)
    res.status(500).json({
      success: false,
      message: 'ê´€ë¦¬ì ?€?œë³´???µê³„ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
})

export default router 
