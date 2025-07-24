import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { generateToken, generateRefreshToken, saveRefreshToken, getTokenExpirationTime } from '../utils/jwt'
import { RegisterRequest, LoginRequest, ApproveUserRequest, UserWithoutPassword } from '../types/auth'

const pool = getPool()
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

// 비밀번호 해시화
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

// 비밀번호 검증
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

// 회원가입 API
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // 유효성 검사
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: errors.array()
      })
      return
    }

    const { email, password, name, phone, department, position }: RegisterRequest = req.body

    // 이메일 중복 체크
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    ) as any[]

    if (existingUsers.length > 0) {
      res.status(409).json({
        success: false,
        message: '이미 등록된 이메일입니다.'
      })
      return
    }

    // 비밀번호 해시화
    const hashedPassword = await hashPassword(password)

    // 사용자 생성
    const [result] = await pool.execute(
      `INSERT INTO users (email, password, name, phone, department, position, role, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'pending')`,
      [email, hashedPassword, name, phone ?? null, department ?? null, position ?? null]
    ) as any

    const userId = result.insertId

    // 생성된 사용자 정보 조회
    const [users] = await pool.execute(
      'SELECT id, email, name, role, status, phone, department, position, created_at FROM users WHERE id = ?',
      [userId]
    ) as any[]

    const user = users[0] as UserWithoutPassword

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.',
      data: {
        user,
        requiresApproval: true
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      message: '회원가입 중 오류가 발생했습니다.'
    })
  }
}

// 로그인 API
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // 유효성 검사
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: errors.array()
      })
      return
    }

    const { name, password }: LoginRequest = req.body
    console.log('=== 백엔드 로그인 시도 ===')
    console.log('받은 데이터:', { name, password })

    // 사용자 조회
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE name = ?',
      [name]
    ) as any[]

    console.log('DB 조회 결과:', users.length, '명의 사용자 발견')

    if (users.length === 0) {
      console.log('사용자를 찾을 수 없음')
      res.status(401).json({
        success: false,
        message: '이름 또는 비밀번호가 올바르지 않습니다.'
      })
      return
    }

    const user = users[0]
    console.log('찾은 사용자:', { id: user.id, name: user.name, status: user.status })

    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, user.password)
    console.log('비밀번호 검증 결과:', isPasswordValid)
    
    if (!isPasswordValid) {
      console.log('비밀번호가 일치하지 않음')
      res.status(401).json({
        success: false,
        message: '이름 또는 비밀번호가 올바르지 않습니다.'
      })
      return
    }

    // 승인 상태 체크
    if (user.status !== 'approved') {
      console.log('승인되지 않은 계정:', user.status)
      res.status(403).json({
        success: false,
        message: user.status === 'pending' 
          ? '승인 대기 중입니다. 관리자 승인을 기다려주세요.' 
          : '승인되지 않은 계정입니다.'
      })
      return
    }

    console.log('로그인 성공, 토큰 생성 중...')

    // 마지막 로그인 시간 업데이트
    await pool.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    )

    // JWT 토큰 생성
    const { password: _, ...userWithoutPassword } = user
    const token = generateToken(userWithoutPassword as UserWithoutPassword)
    const refreshToken = generateRefreshToken()

    // 리프레시 토큰 저장
    await saveRefreshToken(user.id, refreshToken)

    console.log('로그인 완료, 응답 전송')

    res.status(200).json({
      success: true,
      message: '로그인이 완료되었습니다.',
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
      message: '로그인 중 오류가 발생했습니다.'
    })
  }
}

// 관리자 승인 API
export const approveUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId)
    const { status, rejection_reason }: ApproveUserRequest = req.body
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

    // 이미 처리된 사용자인지 체크
    if (user.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: '이미 처리된 사용자입니다.'
      })
      return
    }

    // 승인/거부 처리
    if (status === 'approved') {
      await pool.execute(
        'UPDATE users SET status = ?, approved_at = NOW(), approved_by = ? WHERE id = ?',
        [status, adminId, userId]
      )
    } else if (status === 'rejected') {
      await pool.execute(
        'UPDATE users SET status = ?, rejected_at = NOW(), rejected_by = ?, rejection_reason = ? WHERE id = ?',
        [status, adminId, rejection_reason, userId]
      )
    }

    // 업데이트된 사용자 정보 조회
    const [updatedUsers] = await pool.execute(
      'SELECT id, email, name, role, status, phone, department, position, created_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason FROM users WHERE id = ?',
      [userId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: `사용자가 ${status === 'approved' ? '승인' : '거부'}되었습니다.`,
      data: {
        user: updatedUsers[0]
      }
    })
  } catch (error) {
    console.error('Approve user error:', error)
    res.status(500).json({
      success: false,
      message: '사용자 승인 처리 중 오류가 발생했습니다.'
    })
  }
}

// 리프레시 토큰 API
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: '리프레시 토큰이 필요합니다.'
      })
      return
    }

    // 리프레시 토큰 검증
    const user = await verifyRefreshToken(refreshToken)
    if (!user) {
      res.status(401).json({
        success: false,
        message: '유효하지 않은 리프레시 토큰입니다.'
      })
      return
    }

    // 새로운 토큰 생성
    const newToken = generateToken(user)
    const newRefreshToken = generateRefreshToken()

    // 기존 리프레시 토큰 무효화
    await invalidateRefreshToken(refreshToken)

    // 새로운 리프레시 토큰 저장
    await saveRefreshToken(user.id, newRefreshToken)

    res.status(200).json({
      success: true,
      message: '토큰이 갱신되었습니다.',
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
      message: '토큰 갱신 중 오류가 발생했습니다.'
    })
  }
}

// 로그아웃 API
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (refreshToken) {
      // 리프레시 토큰 무효화
      await invalidateRefreshToken(refreshToken)
    }

    res.status(200).json({
      success: true,
      message: '로그아웃이 완료되었습니다.'
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: '로그아웃 중 오류가 발생했습니다.'
    })
  }
}

// 현재 사용자 정보 조회
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
      message: '사용자 정보 조회 중 오류가 발생했습니다.'
    })
  }
}

// 비밀번호 해시 생성 (임시용)
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
      message: '해시 생성 중 오류가 발생했습니다.'
    })
  }
}

// 관리자 비밀번호 업데이트 (개발용)
export const updateAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body

    if (!password) {
      res.status(400).json({
        success: false,
        message: '새 비밀번호를 입력해주세요.'
      })
      return
    }

    // 관리자 계정 찾기
    const [adminUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      ['admin@metrowork.com', 'admin']
    ) as any[]

    if (adminUsers.length === 0) {
      res.status(404).json({
        success: false,
        message: '관리자 계정을 찾을 수 없습니다.'
      })
      return
    }

    // 새 비밀번호 해시화
    const hashedPassword = await hashPassword(password)

    // 비밀번호 업데이트
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, adminUsers[0].id]
    )

    res.status(200).json({
      success: true,
      message: '관리자 비밀번호가 업데이트되었습니다.',
      data: {
        newPassword: password
      }
    })
  } catch (error) {
    console.error('Update admin password error:', error)
    res.status(500).json({
      success: false,
      message: '비밀번호 업데이트 중 오류가 발생했습니다.'
    })
  }
}

// 유효성 검사 규칙
export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('비밀번호는 최소 6자 이상이어야 합니다.')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
    .withMessage('비밀번호는 영문과 숫자를 포함해야 합니다.'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2자 이상 50자 이하여야 합니다.'),
  body('phone')
    .optional()
    .matches(/^[0-9-+()\s]+$/)
    .withMessage('유효한 전화번호를 입력해주세요.'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('부서명은 100자 이하여야 합니다.'),
  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('직책은 100자 이하여야 합니다.')
]

export const loginValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('이름을 입력해주세요.')
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2자 이상 50자 이하여야 합니다.'),
  body('password')
    .notEmpty()
    .withMessage('비밀번호를 입력해주세요.')
]

export const approveUserValidation = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('유효한 상태값을 입력해주세요.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('거부 사유는 500자 이하여야 합니다.')
] 