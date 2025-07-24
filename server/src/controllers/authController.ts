import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { generateToken, generateRefreshToken, saveRefreshToken, getTokenExpirationTime } from '../utils/jwt'
import { RegisterRequest, LoginRequest, ApproveUserRequest, UserWithoutPassword } from '../types/auth'

const pool = getPool()
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

// 비�?번호 ?�시??
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

// 비�?번호 검�?
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

// ?�원가??API
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // ?�효??검??
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?�력 ?�이?��? ?�바르�? ?�습?�다.',
        errors: errors.array()
      })
      return
    }

    const { email, password, name, phone, department, position }: RegisterRequest = req.body

    // ?�메??중복 체크
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as any[]

    if (existingUsers.length > 0) {
      res.status(409).json({
        success: false,
        message: '?��? ?�록???�메?�입?�다.'
      })
      return
    }

    // 비�?번호 ?�시??
    const hashedPassword = await hashPassword(password)

    // ?�용???�성
    const [result] = await pool.query(
      `INSERT INTO users (email, password, name, phone, department, position, role, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'pending')`,
      [email, hashedPassword, name, phone ?? null, department ?? null, position ?? null]
    ) as any

    const userId = result.insertId

    // ?�성???�용???�보 조회
    const [users] = await pool.query(
      'SELECT id, email, name, role, status, phone, department, position, created_at FROM users WHERE id = ?',
      [userId]
    ) as any[]

    const user = users[0] as UserWithoutPassword

    res.status(201).json({
      success: true,
      message: '?�원가?�이 ?�료?�었?�니?? 관리자 ?�인??기다?�주?�요.',
      data: {
        user,
        requiresApproval: true
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      message: '?�원가??�??�류가 발생?�습?�다.'
    })
  }
}

// 로그??API
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // ?�효??검??
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?�력 ?�이?��? ?�바르�? ?�습?�다.',
        errors: errors.array()
      })
      return
    }

    const { name, password }: LoginRequest = req.body
    console.log('=== 백엔??로그???�도 ===')
    console.log('받�? ?�이??', { name, password })

    // ?�용??조회
    const [users] = await pool.query(
      'SELECT * FROM users WHERE name = ?',
      [name]
    ) as any[]

    console.log('DB 조회 결과:', users.length, '명의 ?�용??발견')

    if (users.length === 0) {
      console.log('?�용?��? 찾을 ???�음')
      res.status(401).json({
        success: false,
        message: '?�름 ?�는 비�?번호가 ?�바르�? ?�습?�다.'
      })
      return
    }

    const user = users[0]
    console.log('찾�? ?�용??', { id: user.id, name: user.name, status: user.status })

    // 비�?번호 검�?
    const isPasswordValid = await verifyPassword(password, user.password)
    console.log('비�?번호 검�?결과:', isPasswordValid)
    
    if (!isPasswordValid) {
      console.log('비�?번호가 ?�치?��? ?�음')
      res.status(401).json({
        success: false,
        message: '?�름 ?�는 비�?번호가 ?�바르�? ?�습?�다.'
      })
      return
    }

    // ?�인 ?�태 체크
    if (user.status !== 'approved') {
      console.log('?�인?��? ?��? 계정:', user.status)
      res.status(403).json({
        success: false,
        message: user.status === 'pending' 
          ? '?�인 ?��?중입?�다. 관리자 ?�인??기다?�주?�요.' 
          : '?�인?��? ?��? 계정?�니??'
      })
      return
    }

    console.log('로그???�공, ?�큰 ?�성 �?..')

    // 마�?�?로그???�간 ?�데?�트
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    )

    // JWT ?�큰 ?�성
    const { password: _, ...userWithoutPassword } = user
    const token = generateToken(userWithoutPassword as UserWithoutPassword)
    const refreshToken = generateRefreshToken()

    // 리프?�시 ?�큰 ?�??
    await saveRefreshToken(user.id, refreshToken)

    console.log('로그???�료, ?�답 ?�송')

    res.status(200).json({
      success: true,
      message: '로그?�이 ?�료?�었?�니??',
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
      message: '로그??�??�류가 발생?�습?�다.'
    })
  }
}

// 관리자 ?�인 API
export const approveUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId)
    const { status, rejection_reason }: ApproveUserRequest = req.body
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

    // ?��? 처리???�용?�인지 체크
    if (user.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: '?��? 처리???�용?�입?�다.'
      })
      return
    }

    // ?�인/거�? 처리
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

    // ?�데?�트???�용???�보 조회
    const [updatedUsers] = await pool.query(
      'SELECT id, email, name, role, status, phone, department, position, created_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason FROM users WHERE id = ?',
      [userId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: `?�용?��? ${status === 'approved' ? '?�인' : '거�?'}?�었?�니??`,
      data: {
        user: updatedUsers[0]
      }
    })
  } catch (error) {
    console.error('Approve user error:', error)
    res.status(500).json({
      success: false,
      message: '?�용???�인 처리 �??�류가 발생?�습?�다.'
    })
  }
}

// 리프?�시 ?�큰 API
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: '리프?�시 ?�큰???�요?�니??'
      })
      return
    }

    // 리프?�시 ?�큰 검�?
    const user = await verifyRefreshToken(refreshToken)
    if (!user) {
      res.status(401).json({
        success: false,
        message: '?�효?��? ?��? 리프?�시 ?�큰?�니??'
      })
      return
    }

    // ?�로???�큰 ?�성
    const newToken = generateToken(user)
    const newRefreshToken = generateRefreshToken()

    // 기존 리프?�시 ?�큰 무효??
    await invalidateRefreshToken(refreshToken)

    // ?�로??리프?�시 ?�큰 ?�??
    await saveRefreshToken(user.id, newRefreshToken)

    res.status(200).json({
      success: true,
      message: '?�큰??갱신?�었?�니??',
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
      message: '?�큰 갱신 �??�류가 발생?�습?�다.'
    })
  }
}

// 로그?�웃 API
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (refreshToken) {
      // 리프?�시 ?�큰 무효??
      await invalidateRefreshToken(refreshToken)
    }

    res.status(200).json({
      success: true,
      message: '로그?�웃???�료?�었?�니??'
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: '로그?�웃 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�재 ?�용???�보 조회
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
      message: '?�용???�보 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// 비�?번호 ?�시 ?�성 (?�시??
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
      message: '?�시 ?�성 �??�류가 발생?�습?�다.'
    })
  }
}

// 관리자 비�?번호 ?�데?�트 (개발??
export const updateAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body

    if (!password) {
      res.status(400).json({
        success: false,
        message: '??비�?번호�??�력?�주?�요.'
      })
      return
    }

    // 관리자 계정 찾기
    const [adminUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      ['admin@metrowork.com', 'admin']
    ) as any[]

    if (adminUsers.length === 0) {
      res.status(404).json({
        success: false,
        message: '관리자 계정??찾을 ???�습?�다.'
      })
      return
    }

    // ??비�?번호 ?�시??
    const hashedPassword = await hashPassword(password)

    // 비�?번호 ?�데?�트
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, adminUsers[0].id]
    )

    res.status(200).json({
      success: true,
      message: '관리자 비�?번호가 ?�데?�트?�었?�니??',
      data: {
        newPassword: password
      }
    })
  } catch (error) {
    console.error('Update admin password error:', error)
    res.status(500).json({
      success: false,
      message: '비�?번호 ?�데?�트 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�효??검??규칙
export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('?�효???�메??주소�??�력?�주?�요.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('비�?번호??최소 6???�상?�어???�니??')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .withMessage('비�?번호???�문�??�자�??�함?�야 ?�니??'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('?�름?� 2???�상 50???�하?�야 ?�니??'),
  body('phone')
    .optional()
    .matches(/^[0-9-+()\s]+$/)
    .withMessage('?�효???�화번호�??�력?�주?�요.'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('부?�명?� 100???�하?�야 ?�니??'),
  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('직책?� 100???�하?�야 ?�니??')
]

export const loginValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('?�름???�력?�주?�요.')
    .isLength({ min: 2, max: 50 })
    .withMessage('?�름?� 2???�상 50???�하?�야 ?�니??'),
  body('password')
    .notEmpty()
    .withMessage('비�?번호�??�력?�주?�요.')
]

export const approveUserValidation = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('?�효???�태값을 ?�력?�주?�요.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('거�? ?�유??500???�하?�야 ?�니??')
] 
