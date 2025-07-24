import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendSMS } from '../services/smsService'

const pool = getPool()

// 6?�리 ?�덤 ?�증번호 ?�성
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ?�시 ?�큰 ?�성
const generateTempToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// 본인 ?�인
export const verifyUser = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate, phoneNumber } = req.body

    // ?�름, ?�년?�일, ?�화번호�??�용??조회
    const [users] = await pool.query(
      'SELECT id, name, phone_number, status FROM users WHERE name = ? AND birth_date = ? AND phone_number = ?',
      [name, birthDate, phoneNumber]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�치?�는 ?�용???�보�?찾을 ???�습?�다.',
        data: {
          suggestion: '?�름, ?�년?�일, ?�화번호�??�시 ?�인?�주?�요.'
        }
      })
      return
    }

    const user = users[0]

    // 계정 ?�태 ?�인
    if (user.status !== 'approved') {
      res.status(403).json({
        success: false,
        message: '?�인?��? ?��? 계정?�니??',
        data: {
          suggestion: '관리자?�게 계정 ?�인???�청?�주?�요.'
        }
      })
      return
    }

    // 기존 ?�증 ?�보가 ?�다�???��
    await pool.query(
      'DELETE FROM sms_verifications WHERE phone_number = ?',
      [phoneNumber]
    )

    // ?�로???�증번호 ?�성
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5�???만료

    // ?�증 ?�보 ?�??
    await pool.query(
      'INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES (?, ?, ?, ?)',
      [phoneNumber, verificationCode, expiresAt, user.id]
    )

    // SMS 발송 (개발 ?�경?�서??콘솔 로그)
    const smsSent = await sendSMS(phoneNumber, verificationCode)

    if (smsSent) {
      res.status(200).json({
        success: true,
        message: '?�증번호가 발송?�었?�니??',
        data: {
          phoneNumber: phoneNumber,
          expiresAt: expiresAt,
          suggestion: '5�??�내???�증번호�??�력?�주?�요.'
        }
      })
    } else {
      // SMS 발송 ?�패 ???�증 ?�보 ??��
      await pool.query(
        'DELETE FROM sms_verifications WHERE phone_number = ?',
        [phoneNumber]
      )

      res.status(500).json({
        success: false,
        message: 'SMS 발송???�패?�습?�다.',
        data: {
          suggestion: '?�시 ???�시 ?�도?�주?�요.'
        }
      })
    }
  } catch (error) {
    console.error('User verification error:', error)
    res.status(500).json({
      success: false,
      message: '본인 ?�인 �??�류가 발생?�습?�다.'
    })
  }
}

// SMS ?�증번호 발송
export const sendSMSVerification = async (req: Request, res: Response): Promise<void> => {
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

    const { phoneNumber } = req.body

    // 기존 ?�증 ?�보 ?�인
    const [verifications] = await pool.query(
      'SELECT * FROM sms_verifications WHERE phone_number = ? AND expires_at > NOW()',
      [phoneNumber]
    ) as any[]

    if (verifications.length > 0) {
      const verification = verifications[0]
      const timeLeft = Math.ceil((new Date(verification.expires_at).getTime() - Date.now()) / 1000)

      res.status(400).json({
        success: false,
        message: '?��? 발송???�증번호가 ?�습?�다.',
        data: {
          timeLeft: timeLeft,
          suggestion: `${timeLeft}�??�에 ?�시 ?�청?�주?�요.`
        }
      })
      return
    }

    // ?�로???�증번호 ?�성
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5�???만료

    // ?�용???�보 조회
    const [users] = await pool.query(
      'SELECT id FROM users WHERE phone_number = ?',
      [phoneNumber]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�록?��? ?��? ?�화번호?�니??',
        data: {
          suggestion: '?�원가?�을 먼�? 진행?�주?�요.'
        }
      })
      return
    }

    // ?�증 ?�보 ?�??
    await pool.query(
      'INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES (?, ?, ?, ?)',
      [phoneNumber, verificationCode, expiresAt, users[0].id]
    )

    // SMS 발송
    const smsSent = await sendSMS(phoneNumber, verificationCode)

    if (smsSent) {
      res.status(200).json({
        success: true,
        message: '?�증번호가 발송?�었?�니??',
        data: {
          phoneNumber: phoneNumber,
          expiresAt: expiresAt,
          suggestion: '5�??�내???�증번호�??�력?�주?�요.'
        }
      })
    } else {
      // SMS 발송 ?�패 ???�증 ?�보 ??��
      await pool.query(
        'DELETE FROM sms_verifications WHERE phone_number = ?',
        [phoneNumber]
      )

      res.status(500).json({
        success: false,
        message: 'SMS 발송???�패?�습?�다.',
        data: {
          suggestion: '?�시 ???�시 ?�도?�주?�요.'
        }
      })
    }
  } catch (error) {
    console.error('SMS sending error:', error)
    res.status(500).json({
      success: false,
      message: 'SMS 발송 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�증번호 ?�인
export const verifySMS = async (req: Request, res: Response): Promise<void> => {
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

    const { phoneNumber, verificationCode } = req.body

    // ?�증 ?�보 조회
    const [verifications] = await pool.query(
      'SELECT * FROM sms_verifications WHERE phone_number = ? AND verification_code = ? AND expires_at > NOW()',
      [phoneNumber, verificationCode]
    ) as any[]

    if (verifications.length === 0) {
      res.status(400).json({
        success: false,
        message: '?�효?��? ?��? ?�증번호?�니??',
        data: {
          suggestion: '?�증번호�??�시 ?�인?�주?�요.'
        }
      })
      return
    }

    const verification = verifications[0]

    // ?�시 ?�큰 ?�성
    const tempToken = generateTempToken()
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10�???만료

    // ?�시 ?�큰 ?�??
    await pool.query(
      'INSERT INTO temp_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [tempToken, verification.user_id, tokenExpiresAt]
    )

    // ?�용???�증 ?�보 ??��
    await pool.query(
      'DELETE FROM sms_verifications WHERE id = ?',
      [verification.id]
    )

    res.status(200).json({
      success: true,
      message: '?�증???�료?�었?�니??',
      data: {
        tempToken: tempToken,
        expiresAt: tokenExpiresAt,
        suggestion: '??비�?번호�??�력?�주?�요.'
      }
    })
  } catch (error) {
    console.error('SMS verification error:', error)
    res.status(500).json({
      success: false,
      message: '?�증번호 ?�인 �??�류가 발생?�습?�다.'
    })
  }
}

// 비�?번호 ?�설??(SMS ?�증 방식)
export const resetPasswordWithSMS = async (req: Request, res: Response): Promise<void> => {
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

    const { tempToken, newPassword } = req.body

    // ?�시 ?�큰 검�?
    const [tokens] = await pool.query(
      `SELECT tt.user_id, tt.expires_at, u.name, u.phone_number 
       FROM temp_tokens tt 
       JOIN users u ON tt.user_id = u.id 
       WHERE tt.token = ?`,
      [tempToken]
    ) as any[]

    if (tokens.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�효?��? ?��? ?�큰?�니??',
        data: {
          suggestion: '?�증???�시 진행?�주?�요.'
        }
      })
      return
    }

    const token = tokens[0]

    // ?�큰 만료 ?�인
    if (new Date() > new Date(token.expires_at)) {
      // 만료???�큰 ??��
      await pool.query(
        'DELETE FROM temp_tokens WHERE token = ?',
        [tempToken]
      )

      res.status(400).json({
        success: false,
        message: '?�큰??만료?�었?�니??',
        data: {
          suggestion: '?�증???�시 진행?�주?�요.'
        }
      })
      return
    }

    // ??비�?번호 ?�시??
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // 비�?번호 ?�데?�트
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, token.user_id]
    )

    // ?�용???�큰 ??��
    await pool.query(
      'DELETE FROM temp_tokens WHERE token = ?',
      [tempToken]
    )

    // ?�공 SMS 발송
    const successSMSSent = await sendPasswordChangeNotification(token.phone_number, token.name)

    res.status(200).json({
      success: true,
      message: '비�?번호가 ?�공?�으�?변경되?�습?�다.',
      data: {
        suggestion: '??비�?번호�?로그?�해주세??',
        smsSent: successSMSSent
      }
    })
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({
      success: false,
      message: '비�?번호 변�?�??�류가 발생?�습?�다.'
    })
  }
}

// 비�?번호 변�??�료 ?�림 SMS
const sendPasswordChangeNotification = async (phoneNumber: string, userName: string): Promise<boolean> => {
  try {
    const message = `[MetroWork] ${userName}?? 비�?번호가 ?�공?�으�?변경되?�습?�다. 변�??�간: ${new Date().toLocaleString('ko-KR')}`
    
    const smsSent = await sendSMS(phoneNumber, message)
    return smsSent
  } catch (error) {
    console.error('Success SMS sending error:', error)
    return false
  }
}

// ?�효??검??규칙
export const verifyUserValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2-50자여야 합니다.')
    .matches(/^[가-힣a-zA-Z\s]+$/)
    .withMessage('이름은 한글, 영문, 공백만 입력 가능합니다.'),
  
  body('birthDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('?�년?�일?� YYYY-MM-DD ?�식?�어???�니??')
    .custom((value) => {
      const date = new Date(value)
      const today = new Date()
      const minDate = new Date('1900-01-01')
      
      if (isNaN(date.getTime())) {
        throw new Error('?�효?��? ?��? ?�짜?�니??')
      }
      
      if (date > today) {
        throw new Error('?�년?�일?� ?�늘 ?�짜보다 ?�전?�어???�니??')
      }
      
      if (date < minDate) {
        throw new Error('?�년?�일?� 1900???�후?�야 ?�니??')
      }
      
      return true
    }),
  
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('?�화번호??010-1234-5678 ?�식?�어???�니??')
]

export const sendSMSValidation = [
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('?�화번호??010-1234-5678 ?�식?�어???�니??')
]

export const verifySMSValidation = [
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('?�화번호??010-1234-5678 ?�식?�어???�니??'),
  
  body('verificationCode')
    .isLength({ min: 6, max: 6 })
    .withMessage('?�증번호??6?�리?�야 ?�니??')
    .matches(/^\d{6}$/)
    .withMessage('?�증번호???�자�??�력 가?�합?�다.')
]

export const resetPasswordWithSMSValidation = [
  body('tempToken')
    .isLength({ min: 64, max: 64 })
    .withMessage('?�효?��? ?��? ?�큰?�니??')
    .matches(/^[a-f0-9]+$/)
    .withMessage('?�큰 ?�식???�바르�? ?�습?�다.'),
  
  body('newPassword')
    .isLength({ min: 8, max: 100 })
    .withMessage('비�?번호??8-100???�이?�야 ?�니??')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('비�?번호???�문 ?�?�문?? ?�자, ?�수문자�??�함?�야 ?�니??')
] 
