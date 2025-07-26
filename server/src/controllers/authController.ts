import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcrypt'
import { getPool } from '../config/database'
import { generateToken, generateRefreshToken, getTokenExpirationTime } from '../utils/jwt'
import { UserWithoutPassword, LoginRequest, RegisterRequest, ApproveUserRequest } from '../types/auth'

const pool = getPool()

// 비밀번호 해시화
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12)
}

// 비밀번호 검증
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword)
}

// 회원가입 API
export const register = async (req: Request, res: Response): Promise<void> => {
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

    const { name, email, password, phone }: RegisterRequest = req.body

    // 중복 사용자 체크
    const existingUsers = await pool.query(
      'SELECT id FROM users WHERE name = $1 OR email = $2',
      [name, email]
    )

    if (existingUsers.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: '이미 존재하는 사용자입니다.'
      })
      return
    }

    // 비밀번호 해시화
    const hashedPassword = await hashPassword(password)

    // 사용자 등록
    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, name, email, status',
      [name, email, hashedPassword, phone, 'pending']
    )

    const newUser = result.rows[0]

    console.log('새 사용자 등록 완료:', { id: newUser.id, name: newUser.name })

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인을 기다려주세요.',
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          status: newUser.status
        }
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
    const result = await pool.query(
      'SELECT * FROM users WHERE name = $1',
      [name]
    )

    console.log('DB 조회 결과:', result.rows.length, '명의 사용자 발견')

    if (result.rows.length === 0) {
      console.log('사용자를 찾을 수 없음')
      res.status(401).json({
        success: false,
        message: '이름 또는 비밀번호가 올바르지 않습니다.'
      })
      return
    }

    const user = result.rows[0]
    console.log('찾은 사용자:', { id: user.id, name: user.name, status: user.status })

    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, user.password)
    console.log('비밀번호 검증결과:', isPasswordValid)
    
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
          ? '승인 대기중입니다. 관리자 승인을 기다려주세요.' 
          : '승인되지 않은 계정입니다.'
      })
      return
    }

    console.log('로그인 성공, 토큰 생성 중...')

    // 마지막 로그인 시간 업데이트
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
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
    const result = await pool.query(
      'SELECT id, email, name, status FROM users WHERE id = $1',
      [userId]
    )
    
    const users = result.rows

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      })
      return
    }

    const user = users[0]

    // 이미 승인된 사용자인지 체크
    if (user.status === 'approved') {
      res.status(400).json({
        success: false,
        message: '이미 승인된 사용자입니다.'
      })
      return
    }

    // 상태 업데이트
    if (status === 'approved') {
      await pool.query(
        'UPDATE users SET status = $1, approved_at = NOW(), approved_by = $2 WHERE id = $3',
        [status, adminId, userId]
      )

      console.log(`사용자 승인 완료: ${user.name} (ID: ${userId})`)

      res.status(200).json({
        success: true,
        message: '사용자가 승인되었습니다.',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            status: 'approved'
          }
        }
      })
    } else if (status === 'rejected') {
      await pool.query(
        'UPDATE users SET status = $1, rejected_at = NOW(), rejected_by = $2, rejection_reason = $3 WHERE id = $4',
        [status, adminId, rejection_reason, userId]
      )

      console.log(`사용자 거부 완료: ${user.name} (ID: ${userId})`)

      res.status(200).json({
        success: true,
        message: '사용자가 거부되었습니다.',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            status: 'rejected'
          }
        }
      })
    } else {
      res.status(400).json({
        success: false,
        message: '유효하지 않은 상태입니다.'
      })
    }
  } catch (error) {
    console.error('Approve user error:', error)
    res.status(500).json({
      success: false,
      message: '사용자 승인 중 오류가 발생했습니다.'
    })
  }
}

// 토큰 갱신 API
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
    const userId = await verifyRefreshToken(refreshToken)
    if (!userId) {
      res.status(401).json({
        success: false,
        message: '유효하지 않은 리프레시 토큰입니다.'
      })
      return
    }

    // 사용자 정보 조회
    const [users] = await pool.query(
      'SELECT id, name, email, role, status FROM users WHERE id = $1',
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

    // 새로운 토큰 생성
    const newToken = generateToken(user as UserWithoutPassword)
    const newRefreshToken = generateRefreshToken()

    // 기존 리프레시 토큰 삭제 후 새 토큰 저장
    await deleteRefreshToken(refreshToken)
    await saveRefreshToken(user.id, newRefreshToken)

    res.status(200).json({
      success: true,
      message: '토큰이 갱신되었습니다.',
      data: {
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
      await deleteRefreshToken(refreshToken)
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

// 회원탈퇴 API
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const { password }: { password: string } = req.body

    // 비밀번호 확인
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      })
      return
    }

    const isPasswordValid = await verifyPassword(password, userResult.rows[0].password)
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: '비밀번호가 올바르지 않습니다.'
      })
      return
    }

    // 관리자는 탈퇴 불가
    const adminCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    )

    if (adminCheck.rows[0].role === 'admin') {
      res.status(403).json({
        success: false,
        message: '관리자는 탈퇴할 수 없습니다.'
      })
      return
    }

    // 트랜잭션 시작
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 사용자의 업무 기록 삭제
      await client.query(
        'DELETE FROM work_status WHERE user_id = $1',
        [userId]
      )

      // 2. 사용자의 업무 활동 기록 삭제
      await client.query(
        'DELETE FROM work_history WHERE user_id = $1',
        [userId]
      )

      // 3. 사용자 계정 삭제
      await client.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
      )

      await client.query('COMMIT')

      console.log('회원탈퇴 완료:', { userId })

      res.status(200).json({
        success: true,
        message: '회원탈퇴가 완료되었습니다.'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({
      success: false,
      message: '회원탈퇴 중 오류가 발생했습니다.'
    })
  }
}

// 현재 사용자 정보 조회 API
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id

    const result = await pool.query(
      'SELECT id, name, email, role, status, created_at, last_login_at FROM users WHERE id = $1',
      [userId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      })
      return
    }

    const user = result.rows[0]

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

// 비밀번호 해시 생성 API (개발용)
export const generatePasswordHash = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body

    if (!password) {
      res.status(400).json({
        success: false,
        message: '비밀번호가 필요합니다.'
      })
      return
    }

    const hashedPassword = await hashPassword(password)

    res.status(200).json({
      success: true,
      data: {
        originalPassword: password,
        hashedPassword
      }
    })
  } catch (error) {
    console.error('Generate password hash error:', error)
    res.status(500).json({
      success: false,
      message: '비밀번호 해시 생성 중 오류가 발생했습니다.'
    })
  }
}

// 관리자 비밀번호 업데이트 API
export const updateAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body

    if (!newPassword) {
      res.status(400).json({
        success: false,
        message: '새 비밀번호가 필요합니다.'
      })
      return
    }

    const hashedPassword = await hashPassword(newPassword)

    // 관리자 계정 업데이트 (name이 '시스템 관리자'인 계정)
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE name = $2 RETURNING id',
      [hashedPassword, '시스템 관리자']
    )

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '관리자 계정을 찾을 수 없습니다.'
      })
      return
    }

    console.log('관리자 비밀번호 업데이트 완료')

    res.status(200).json({
      success: true,
      message: '관리자 비밀번호가 업데이트되었습니다.',
      data: {
        newPassword: newPassword
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

// 리프레시 토큰 저장 함수 (임시 구현)
const saveRefreshToken = async (userId: number, refreshToken: string): Promise<void> => {
  try {
    // 임시로 콘솔에만 출력 (실제로는 Redis나 DB에 저장)
    console.log(`리프레시 토큰 저장: 사용자 ${userId}, 토큰: ${refreshToken.substring(0, 10)}...`)
  } catch (error) {
    console.error('Save refresh token error:', error)
  }
}

// 리프레시 토큰 삭제 함수 (임시 구현)
const deleteRefreshToken = async (refreshToken: string): Promise<void> => {
  try {
    // 임시로 콘솔에만 출력 (실제로는 Redis나 DB에서 삭제)
    console.log(`리프레시 토큰 삭제: ${refreshToken.substring(0, 10)}...`)
  } catch (error) {
    console.error('Delete refresh token error:', error)
  }
}

// 리프레시 토큰 검증 함수 (캐시에서 확인)
const verifyRefreshToken = async (refreshToken: string): Promise<number | null> => {
  try {
    // Redis에서 리프레시 토큰 확인
    const userId = await getRefreshToken(refreshToken)
    return userId ? parseInt(userId) : null
  } catch (error) {
    console.error('Verify refresh token error:', error)
    return null
  }
}

// Redis에서 리프레시 토큰 조회 함수
const getRefreshToken = async (refreshToken: string): Promise<string | null> => {
  try {
    // Redis 클라이언트가 있다면 사용, 없다면 null 반환
    return null
  } catch (error) {
    console.error('Get refresh token error:', error)
    return null
  }
}

// 효원가입 검증 규칙
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
    .withMessage('상태값을 입력해주세요.'),
  body('rejection_reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('거부 사유는 500자 이하여야 합니다.')
] 
