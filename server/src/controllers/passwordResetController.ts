import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const pool = getPool()

// ?�메???�송 ?�정 (?�경변?�에??가?�오�?
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// 비�?번호 ?�설???�큰 ?�성
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// 비�?번호 ?�설???�메???�송
const sendPasswordResetEmail = async (email: string, resetToken: string, userName: string): Promise<boolean> => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '[MetroWork] 비�?번호 ?�설???�내',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">MetroWork 비�?번호 ?�설??/h2>
          <p>?�녕?�세?? <strong>${userName}</strong>??</p>
          <p>비�?번호 ?�설???�청???�수?�었?�니??</p>
          <p>?�래 링크�??�릭?�여 ?�로??비�?번호�??�정?�주?�요:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              비�?번호 ?�설?�하�?
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            ??링크??1?�간 ?�에 만료?�니??<br>
            본인???�청?��? ?�았?�면 ???�메?�을 무시?�세??
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            ???�메?��? MetroWork ?�스?�에???�동?�로 발송?�었?�니??
          </p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Email sending error:', error)
    return false
  }
}

// 비�?번호 ?�설???�청
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate, email } = req.body

    // ?�름, ?�년?�일, ?�메?�로 ?�용??조회
    const [users] = await pool.query(
      'SELECT id, name, email, status FROM users WHERE name = ? AND birth_date = ? AND email = ?',
      [name, birthDate, email]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�치?�는 ?�용???�보�?찾을 ???�습?�다.',
        data: {
          suggestion: '?�름, ?�년?�일, ?�메?�을 ?�시 ?�인?�주?�요.'
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

    // 기존 ?�설???�큰???�다�???��
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [user.id]
    )

    // ?�로???�설???�큰 ?�성
    const resetToken = generateResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1?�간 ??만료

    // ?�설???�큰 ?�??
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    )

    // ?�메???�송
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.name)

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: '비�?번호 ?�설???�메?�이 발송?�었?�니??',
        data: {
          email: email,
          expiresAt: expiresAt,
          suggestion: '?�메?�을 ?�인?�여 비�?번호�??�설?�해주세??'
        }
      })
    } else {
      // ?�메???�송 ?�패 ???�큰 ??��
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
      )

      res.status(500).json({
        success: false,
        message: '?�메???�송???�패?�습?�다.',
        data: {
          suggestion: '?�시 ???�시 ?�도?�주?�요.'
        }
      })
    }
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({
      success: false,
      message: '비�?번호 ?�설??�??�류가 발생?�습?�다.'
    })
  }
}

// 비�?번호 ?�설???�큰 검�?�???비�?번호 ?�정
export const confirmPasswordReset = async (req: Request, res: Response): Promise<void> => {
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

    const { token, newPassword } = req.body

    // ?�큰?�로 ?�용??조회
    const [tokens] = await pool.query(
      `SELECT prt.user_id, prt.expires_at, u.name, u.email 
       FROM password_reset_tokens prt 
       JOIN users u ON prt.user_id = u.id 
       WHERE prt.token = ?`,
      [token]
    ) as any[]

    if (tokens.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�효?��? ?��? ?�설???�큰?�니??',
        data: {
          suggestion: '비�?번호 ?�설?�을 ?�시 ?�청?�주?�요.'
        }
      })
      return
    }

    const resetToken = tokens[0]

    // ?�큰 만료 ?�인
    if (new Date() > new Date(resetToken.expires_at)) {
      // 만료???�큰 ??��
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE token = ?',
        [token]
      )

      res.status(400).json({
        success: false,
        message: '?�설???�큰??만료?�었?�니??',
        data: {
          suggestion: '비�?번호 ?�설?�을 ?�시 ?�청?�주?�요.'
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
      [hashedPassword, resetToken.user_id]
    )

    // ?�용???�큰 ??��
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE token = ?',
      [token]
    )

    // ?�공 ?�메???�송
    const successEmailSent = await sendPasswordChangeNotification(resetToken.email, resetToken.name)

    res.status(200).json({
      success: true,
      message: '비�?번호가 ?�공?�으�?변경되?�습?�다.',
      data: {
        suggestion: '??비�?번호�?로그?�해주세??',
        emailSent: successEmailSent
      }
    })
  } catch (error) {
    console.error('Password confirmation error:', error)
    res.status(500).json({
      success: false,
      message: '비�?번호 변�?�??�류가 발생?�습?�다.'
    })
  }
}

// 비�?번호 변�??�료 ?�림 ?�메??
const sendPasswordChangeNotification = async (email: string, userName: string): Promise<boolean> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '[MetroWork] 비�?번호 변�??�료',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">비�?번호 변�??�료</h2>
          <p>?�녕?�세?? <strong>${userName}</strong>??</p>
          <p>비�?번호가 ?�공?�으�?변경되?�습?�다.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">
              변�??�간: ${new Date().toLocaleString('ko-KR')}<br>
              변경된 비�?번호???�전?�게 ?�호?�되???�?�되?�습?�다.
            </p>
          </div>
          <p style="color: #666; font-size: 14px;">
            본인??변경하지 ?�았?�면 즉시 관리자?�게 ?�락?�주?�요.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            ???�메?��? MetroWork ?�스?�에???�동?�로 발송?�었?�니??
          </p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error('Success email sending error:', error)
    return false
  }
}

// ?�효??검??규칙
export const resetPasswordValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('?�름?� 2-50???�이?�야 ?�니??')
    .matches(/^[가-?�a-zA-Z\s]+$/)
    .withMessage('?�름?� ?��?, ?�문, 공백�??�력 가?�합?�다.'),
  
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
  
  body('email')
    .isEmail()
    .withMessage('?�효???�메??주소�??�력?�주?�요.')
    .normalizeEmail()
]

export const confirmPasswordResetValidation = [
  body('token')
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
