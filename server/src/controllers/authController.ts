import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { generateToken, generateRefreshToken, saveRefreshToken, getTokenExpirationTime } from '../utils/jwt'
import { RegisterRequest, LoginRequest, ApproveUserRequest, UserWithoutPassword } from '../types/auth'

const pool = getPool()
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

// ë¹„ë?ë²ˆí˜¸ ?´ì‹œ??
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

// ë¹„ë?ë²ˆí˜¸ ê²€ì¦?
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

// ?Œì›ê°€??API
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // ? íš¨??ê²€??
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?…ë ¥ ?°ì´?°ê? ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.',
        errors: errors.array()
      })
      return
    }

    const { email, password, name, phone, department, position }: RegisterRequest = req.body

    // ?´ë©”??ì¤‘ë³µ ì²´í¬
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as any[]

    if (existingUsers.length > 0) {
      res.status(409).json({
        success: false,
        message: '?´ë? ?±ë¡???´ë©”?¼ì…?ˆë‹¤.'
      })
      return
    }

    // ë¹„ë?ë²ˆí˜¸ ?´ì‹œ??
    const hashedPassword = await hashPassword(password)

    // ?¬ìš©???ì„±
    const [result] = await pool.query(
      `INSERT INTO users (email, password, name, phone, department, position, role, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'pending')`,
      [email, hashedPassword, name, phone ?? null, department ?? null, position ?? null]
    ) as any

    const userId = result.insertId

    // ?ì„±???¬ìš©???•ë³´ ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT id, email, name, role, status, phone, department, position, created_at FROM users WHERE id = ?',
      [userId]
    ) as any[]

    const user = users[0] as UserWithoutPassword

    res.status(201).json({
      success: true,
      message: '?Œì›ê°€?…ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ?? ê´€ë¦¬ì ?¹ì¸??ê¸°ë‹¤?¤ì£¼?¸ìš”.',
      data: {
        user,
        requiresApproval: true
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      message: '?Œì›ê°€??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¡œê·¸??API
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // ? íš¨??ê²€??
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?…ë ¥ ?°ì´?°ê? ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.',
        errors: errors.array()
      })
      return
    }

    const { name, password }: LoginRequest = req.body
    console.log('=== ë°±ì—”??ë¡œê·¸???œë„ ===')
    console.log('ë°›ì? ?°ì´??', { name, password })

    // ?¬ìš©??ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT * FROM users WHERE name = ?',
      [name]
    ) as any[]

    console.log('DB ì¡°íšŒ ê²°ê³¼:', users.length, 'ëª…ì˜ ?¬ìš©??ë°œê²¬')

    if (users.length === 0) {
      console.log('?¬ìš©?ë? ì°¾ì„ ???†ìŒ')
      res.status(401).json({
        success: false,
        message: '?´ë¦„ ?ëŠ” ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.'
      })
      return
    }

    const user = users[0]
    console.log('ì°¾ì? ?¬ìš©??', { id: user.id, name: user.name, status: user.status })

    // ë¹„ë?ë²ˆí˜¸ ê²€ì¦?
    const isPasswordValid = await verifyPassword(password, user.password)
    console.log('ë¹„ë?ë²ˆí˜¸ ê²€ì¦?ê²°ê³¼:', isPasswordValid)
    
    if (!isPasswordValid) {
      console.log('ë¹„ë?ë²ˆí˜¸ê°€ ?¼ì¹˜?˜ì? ?ŠìŒ')
      res.status(401).json({
        success: false,
        message: '?´ë¦„ ?ëŠ” ë¹„ë?ë²ˆí˜¸ê°€ ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.'
      })
      return
    }

    // ?¹ì¸ ?íƒœ ì²´í¬
    if (user.status !== 'approved') {
      console.log('?¹ì¸?˜ì? ?Šì? ê³„ì •:', user.status)
      res.status(403).json({
        success: false,
        message: user.status === 'pending' 
          ? '?¹ì¸ ?€ê¸?ì¤‘ì…?ˆë‹¤. ê´€ë¦¬ì ?¹ì¸??ê¸°ë‹¤?¤ì£¼?¸ìš”.' 
          : '?¹ì¸?˜ì? ?Šì? ê³„ì •?…ë‹ˆ??'
      })
      return
    }

    console.log('ë¡œê·¸???±ê³µ, ? í° ?ì„± ì¤?..')

    // ë§ˆì?ë§?ë¡œê·¸???œê°„ ?…ë°?´íŠ¸
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    )

    // JWT ? í° ?ì„±
    const { password: _, ...userWithoutPassword } = user
    const token = generateToken(userWithoutPassword as UserWithoutPassword)
    const refreshToken = generateRefreshToken()

    // ë¦¬í”„?ˆì‹œ ? í° ?€??
    await saveRefreshToken(user.id, refreshToken)

    console.log('ë¡œê·¸???„ë£Œ, ?‘ë‹µ ?„ì†¡')

    res.status(200).json({
      success: true,
      message: 'ë¡œê·¸?¸ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??',
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
        expiresIn: getTokenExpirationTime()
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      message: 'ë¡œê·¸??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ê´€ë¦¬ì ?¹ì¸ API
export const approveUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId)
    const { status, rejection_reason }: ApproveUserRequest = req.body
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

    // ?´ë? ì²˜ë¦¬???¬ìš©?ì¸ì§€ ì²´í¬
    if (user.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: '?´ë? ì²˜ë¦¬???¬ìš©?ì…?ˆë‹¤.'
      })
      return
    }

    // ?¹ì¸/ê±°ë? ì²˜ë¦¬
    if (status === 'approved') {
      await pool.query(
        'UPDATE users SET status = ?, approved_at = NOW(), approved_by = ? WHERE id = ?',
        [status, adminId, userId]
      )
    } else if (status === 'rejected') {
      await pool.query(
        'UPDATE users SET status = ?, rejected_at = NOW(), rejected_by = ?, rejection_reason = ? WHERE id = ?',
        [status, adminId, rejection_reason, userId]
      )
    }

    // ?…ë°?´íŠ¸???¬ìš©???•ë³´ ì¡°íšŒ
    const [updatedUsers] = await pool.query(
      'SELECT id, email, name, role, status, phone, department, position, created_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason FROM users WHERE id = ?',
      [userId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: `?¬ìš©?ê? ${status === 'approved' ? '?¹ì¸' : 'ê±°ë?'}?˜ì—ˆ?µë‹ˆ??`,
      data: {
        user: updatedUsers[0]
      }
    })
  } catch (error) {
    console.error('Approve user error:', error)
    res.status(500).json({
      success: false,
      message: '?¬ìš©???¹ì¸ ì²˜ë¦¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¦¬í”„?ˆì‹œ ? í° API
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'ë¦¬í”„?ˆì‹œ ? í°???„ìš”?©ë‹ˆ??'
      })
      return
    }

    // ë¦¬í”„?ˆì‹œ ? í° ê²€ì¦?
    const user = await verifyRefreshToken(refreshToken)
    if (!user) {
      res.status(401).json({
        success: false,
        message: '? íš¨?˜ì? ?Šì? ë¦¬í”„?ˆì‹œ ? í°?…ë‹ˆ??'
      })
      return
    }

    // ?ˆë¡œ??? í° ?ì„±
    const newToken = generateToken(user)
    const newRefreshToken = generateRefreshToken()

    // ê¸°ì¡´ ë¦¬í”„?ˆì‹œ ? í° ë¬´íš¨??
    await invalidateRefreshToken(refreshToken)

    // ?ˆë¡œ??ë¦¬í”„?ˆì‹œ ? í° ?€??
    await saveRefreshToken(user.id, newRefreshToken)

    res.status(200).json({
      success: true,
      message: '? í°??ê°±ì‹ ?˜ì—ˆ?µë‹ˆ??',
      data: {
        user,
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: getTokenExpirationTime()
      }
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({
      success: false,
      message: '? í° ê°±ì‹  ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¡œê·¸?„ì›ƒ API
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (refreshToken) {
      // ë¦¬í”„?ˆì‹œ ? í° ë¬´íš¨??
      await invalidateRefreshToken(refreshToken)
    }

    res.status(200).json({
      success: true,
      message: 'ë¡œê·¸?„ì›ƒ???„ë£Œ?˜ì—ˆ?µë‹ˆ??'
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: 'ë¡œê·¸?„ì›ƒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?„ì¬ ?¬ìš©???•ë³´ ì¡°íšŒ
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user

    res.status(200).json({
      success: true,
      data: {
        user
      }
    })
  } catch (error) {
    console.error('Get current user error:', error)
    res.status(500).json({
      success: false,
      message: '?¬ìš©???•ë³´ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¹„ë?ë²ˆí˜¸ ?´ì‹œ ?ì„± (?„ì‹œ??
export const generatePasswordHash = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body
    const hashedPassword = await hashPassword(password)
    
    res.status(200).json({
      success: true,
      hashedPassword
    })
  } catch (error) {
    console.error('Hash generation error:', error)
    res.status(500).json({
      success: false,
      message: '?´ì‹œ ?ì„± ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ê´€ë¦¬ì ë¹„ë?ë²ˆí˜¸ ?…ë°?´íŠ¸ (ê°œë°œ??
export const updateAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body

    if (!password) {
      res.status(400).json({
        success: false,
        message: '??ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.'
      })
      return
    }

    // ê´€ë¦¬ì ê³„ì • ì°¾ê¸°
    const [adminUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      ['admin@metrowork.com', 'admin']
    ) as any[]

    if (adminUsers.length === 0) {
      res.status(404).json({
        success: false,
        message: 'ê´€ë¦¬ì ê³„ì •??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    // ??ë¹„ë?ë²ˆí˜¸ ?´ì‹œ??
    const hashedPassword = await hashPassword(password)

    // ë¹„ë?ë²ˆí˜¸ ?…ë°?´íŠ¸
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, adminUsers[0].id]
    )

    res.status(200).json({
      success: true,
      message: 'ê´€ë¦¬ì ë¹„ë?ë²ˆí˜¸ê°€ ?…ë°?´íŠ¸?˜ì—ˆ?µë‹ˆ??',
      data: {
        newPassword: password
      }
    })
  } catch (error) {
    console.error('Update admin password error:', error)
    res.status(500).json({
      success: false,
      message: 'ë¹„ë?ë²ˆí˜¸ ?…ë°?´íŠ¸ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ? íš¨??ê²€??ê·œì¹™
export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('? íš¨???´ë©”??ì£¼ì†Œë¥??…ë ¥?´ì£¼?¸ìš”.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('ë¹„ë?ë²ˆí˜¸??ìµœì†Œ 6???´ìƒ?´ì–´???©ë‹ˆ??')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .withMessage('ë¹„ë?ë²ˆí˜¸???ë¬¸ê³??«ìë¥??¬í•¨?´ì•¼ ?©ë‹ˆ??'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('?´ë¦„?€ 2???´ìƒ 50???´í•˜?¬ì•¼ ?©ë‹ˆ??'),
  body('phone')
    .optional()
    .matches(/^[0-9-+()\s]+$/)
    .withMessage('? íš¨???„í™”ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('ë¶€?œëª…?€ 100???´í•˜?¬ì•¼ ?©ë‹ˆ??'),
  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('ì§ì±…?€ 100???´í•˜?¬ì•¼ ?©ë‹ˆ??')
]

export const loginValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('?´ë¦„???…ë ¥?´ì£¼?¸ìš”.')
    .isLength({ min: 2, max: 50 })
    .withMessage('?´ë¦„?€ 2???´ìƒ 50???´í•˜?¬ì•¼ ?©ë‹ˆ??'),
  body('password')
    .notEmpty()
    .withMessage('ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.')
]

export const approveUserValidation = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('? íš¨???íƒœê°’ì„ ?…ë ¥?´ì£¼?¸ìš”.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('ê±°ë? ?¬ìœ ??500???´í•˜?¬ì•¼ ?©ë‹ˆ??')
] 
