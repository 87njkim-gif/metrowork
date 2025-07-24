import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendSMS } from '../services/smsService'

const pool = getPool()

// 6자리 랜덤 인증번호 생성
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 임시 토큰 생성
const generateTempToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// 본인 확인
export const verifyUser = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate, phoneNumber } = req.body

    // 이름, 생년월일, 전화번호로 사용자 조회
    const [users] = await pool.execute(
      'SELECT id, name, phone_number, status FROM users WHERE name = ? AND birth_date = ? AND phone_number = ?',
      [name, birthDate, phoneNumber]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '일치하는 사용자 정보를 찾을 수 없습니다.',
        data: {
          suggestion: '이름, 생년월일, 전화번호를 다시 확인해주세요.'
        }
      })
      return
    }

    const user = users[0]

    // 계정 상태 확인
    if (user.status !== 'approved') {
      res.status(403).json({
        success: false,
        message: '승인되지 않은 계정입니다.',
        data: {
          suggestion: '관리자에게 계정 승인을 요청해주세요.'
        }
      })
      return
    }

    // 기존 인증 정보가 있다면 삭제
    await pool.execute(
      'DELETE FROM sms_verifications WHERE phone_number = ?',
      [phoneNumber]
    )

    // 새로운 인증번호 생성
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5분 후 만료

    // 인증 정보 저장
    await pool.execute(
      'INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES (?, ?, ?, ?)',
      [phoneNumber, verificationCode, expiresAt, user.id]
    )

    // SMS 발송 (개발 환경에서는 콘솔 로그)
    const smsSent = await sendSMS(phoneNumber, verificationCode)

    if (smsSent) {
      res.status(200).json({
        success: true,
        message: '인증번호가 발송되었습니다.',
        data: {
          phoneNumber: phoneNumber,
          expiresAt: expiresAt,
          suggestion: '5분 이내에 인증번호를 입력해주세요.'
        }
      })
    } else {
      // SMS 발송 실패 시 인증 정보 삭제
      await pool.execute(
        'DELETE FROM sms_verifications WHERE phone_number = ?',
        [phoneNumber]
      )

      res.status(500).json({
        success: false,
        message: 'SMS 발송에 실패했습니다.',
        data: {
          suggestion: '잠시 후 다시 시도해주세요.'
        }
      })
    }
  } catch (error) {
    console.error('User verification error:', error)
    res.status(500).json({
      success: false,
      message: '본인 확인 중 오류가 발생했습니다.'
    })
  }
}

// SMS 인증번호 발송
export const sendSMSVerification = async (req: Request, res: Response): Promise<void> => {
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

    const { phoneNumber } = req.body

    // 기존 인증 정보 확인
    const [verifications] = await pool.execute(
      'SELECT * FROM sms_verifications WHERE phone_number = ? AND expires_at > NOW()',
      [phoneNumber]
    ) as any[]

    if (verifications.length > 0) {
      const verification = verifications[0]
      const timeLeft = Math.ceil((new Date(verification.expires_at).getTime() - Date.now()) / 1000)

      res.status(400).json({
        success: false,
        message: '이미 발송된 인증번호가 있습니다.',
        data: {
          timeLeft: timeLeft,
          suggestion: `${timeLeft}초 후에 다시 요청해주세요.`
        }
      })
      return
    }

    // 새로운 인증번호 생성
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5분 후 만료

    // 사용자 정보 조회
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE phone_number = ?',
      [phoneNumber]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '등록되지 않은 전화번호입니다.',
        data: {
          suggestion: '회원가입을 먼저 진행해주세요.'
        }
      })
      return
    }

    // 인증 정보 저장
    await pool.execute(
      'INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES (?, ?, ?, ?)',
      [phoneNumber, verificationCode, expiresAt, users[0].id]
    )

    // SMS 발송
    const smsSent = await sendSMS(phoneNumber, verificationCode)

    if (smsSent) {
      res.status(200).json({
        success: true,
        message: '인증번호가 발송되었습니다.',
        data: {
          phoneNumber: phoneNumber,
          expiresAt: expiresAt,
          suggestion: '5분 이내에 인증번호를 입력해주세요.'
        }
      })
    } else {
      // SMS 발송 실패 시 인증 정보 삭제
      await pool.execute(
        'DELETE FROM sms_verifications WHERE phone_number = ?',
        [phoneNumber]
      )

      res.status(500).json({
        success: false,
        message: 'SMS 발송에 실패했습니다.',
        data: {
          suggestion: '잠시 후 다시 시도해주세요.'
        }
      })
    }
  } catch (error) {
    console.error('SMS sending error:', error)
    res.status(500).json({
      success: false,
      message: 'SMS 발송 중 오류가 발생했습니다.'
    })
  }
}

// 인증번호 확인
export const verifySMS = async (req: Request, res: Response): Promise<void> => {
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

    const { phoneNumber, verificationCode } = req.body

    // 인증 정보 조회
    const [verifications] = await pool.execute(
      'SELECT * FROM sms_verifications WHERE phone_number = ? AND verification_code = ? AND expires_at > NOW()',
      [phoneNumber, verificationCode]
    ) as any[]

    if (verifications.length === 0) {
      res.status(400).json({
        success: false,
        message: '유효하지 않은 인증번호입니다.',
        data: {
          suggestion: '인증번호를 다시 확인해주세요.'
        }
      })
      return
    }

    const verification = verifications[0]

    // 임시 토큰 생성
    const tempToken = generateTempToken()
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10분 후 만료

    // 임시 토큰 저장
    await pool.execute(
      'INSERT INTO temp_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [tempToken, verification.user_id, tokenExpiresAt]
    )

    // 사용된 인증 정보 삭제
    await pool.execute(
      'DELETE FROM sms_verifications WHERE id = ?',
      [verification.id]
    )

    res.status(200).json({
      success: true,
      message: '인증이 완료되었습니다.',
      data: {
        tempToken: tempToken,
        expiresAt: tokenExpiresAt,
        suggestion: '새 비밀번호를 입력해주세요.'
      }
    })
  } catch (error) {
    console.error('SMS verification error:', error)
    res.status(500).json({
      success: false,
      message: '인증번호 확인 중 오류가 발생했습니다.'
    })
  }
}

// 비밀번호 재설정 (SMS 인증 방식)
export const resetPasswordWithSMS = async (req: Request, res: Response): Promise<void> => {
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

    const { tempToken, newPassword } = req.body

    // 임시 토큰 검증
    const [tokens] = await pool.execute(
      `SELECT tt.user_id, tt.expires_at, u.name, u.phone_number 
       FROM temp_tokens tt 
       JOIN users u ON tt.user_id = u.id 
       WHERE tt.token = ?`,
      [tempToken]
    ) as any[]

    if (tokens.length === 0) {
      res.status(404).json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
        data: {
          suggestion: '인증을 다시 진행해주세요.'
        }
      })
      return
    }

    const token = tokens[0]

    // 토큰 만료 확인
    if (new Date() > new Date(token.expires_at)) {
      // 만료된 토큰 삭제
      await pool.execute(
        'DELETE FROM temp_tokens WHERE token = ?',
        [tempToken]
      )

      res.status(400).json({
        success: false,
        message: '토큰이 만료되었습니다.',
        data: {
          suggestion: '인증을 다시 진행해주세요.'
        }
      })
      return
    }

    // 새 비밀번호 해시화
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // 비밀번호 업데이트
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, token.user_id]
    )

    // 사용된 토큰 삭제
    await pool.execute(
      'DELETE FROM temp_tokens WHERE token = ?',
      [tempToken]
    )

    // 성공 SMS 발송
    const successSMSSent = await sendPasswordChangeNotification(token.phone_number, token.name)

    res.status(200).json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
      data: {
        suggestion: '새 비밀번호로 로그인해주세요.',
        smsSent: successSMSSent
      }
    })
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    })
  }
}

// 비밀번호 변경 완료 알림 SMS
const sendPasswordChangeNotification = async (phoneNumber: string, userName: string): Promise<boolean> => {
  try {
    const message = `[MetroWork] ${userName}님, 비밀번호가 성공적으로 변경되었습니다. 변경 시간: ${new Date().toLocaleString('ko-KR')}`
    
    const smsSent = await sendSMS(phoneNumber, message)
    return smsSent
  } catch (error) {
    console.error('Success SMS sending error:', error)
    return false
  }
}

// 유효성 검사 규칙
export const verifyUserValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2-50자 사이여야 합니다.')
    .matches(/^[가-힣a-zA-Z\s]+$/)
    .withMessage('이름은 한글, 영문, 공백만 입력 가능합니다.'),
  
  body('birthDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('생년월일은 YYYY-MM-DD 형식이어야 합니다.')
    .custom((value) => {
      const date = new Date(value)
      const today = new Date()
      const minDate = new Date('1900-01-01')
      
      if (isNaN(date.getTime())) {
        throw new Error('유효하지 않은 날짜입니다.')
      }
      
      if (date > today) {
        throw new Error('생년월일은 오늘 날짜보다 이전이어야 합니다.')
      }
      
      if (date < minDate) {
        throw new Error('생년월일은 1900년 이후여야 합니다.')
      }
      
      return true
    }),
  
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('전화번호는 010-1234-5678 형식이어야 합니다.')
]

export const sendSMSValidation = [
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('전화번호는 010-1234-5678 형식이어야 합니다.')
]

export const verifySMSValidation = [
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('전화번호는 010-1234-5678 형식이어야 합니다.'),
  
  body('verificationCode')
    .isLength({ min: 6, max: 6 })
    .withMessage('인증번호는 6자리여야 합니다.')
    .matches(/^\d{6}$/)
    .withMessage('인증번호는 숫자만 입력 가능합니다.')
]

export const resetPasswordWithSMSValidation = [
  body('tempToken')
    .isLength({ min: 64, max: 64 })
    .withMessage('유효하지 않은 토큰입니다.')
    .matches(/^[a-f0-9]+$/)
    .withMessage('토큰 형식이 올바르지 않습니다.'),
  
  body('newPassword')
    .isLength({ min: 8, max: 100 })
    .withMessage('비밀번호는 8-100자 사이여야 합니다.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('비밀번호는 영문 대소문자, 숫자, 특수문자를 포함해야 합니다.')
] 