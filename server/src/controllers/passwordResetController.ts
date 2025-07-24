import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const pool = getPool()

// 이메일 전송 설정 (환경변수에서 가져오기)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// 비밀번호 재설정 토큰 생성
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// 비밀번호 재설정 이메일 전송
const sendPasswordResetEmail = async (email: string, resetToken: string, userName: string): Promise<boolean> => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '[MetroWork] 비밀번호 재설정 안내',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">MetroWork 비밀번호 재설정</h2>
          <p>안녕하세요, <strong>${userName}</strong>님.</p>
          <p>비밀번호 재설정 요청이 접수되었습니다.</p>
          <p>아래 링크를 클릭하여 새로운 비밀번호를 설정해주세요:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              비밀번호 재설정하기
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            이 링크는 1시간 후에 만료됩니다.<br>
            본인이 요청하지 않았다면 이 이메일을 무시하세요.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            이 이메일은 MetroWork 시스템에서 자동으로 발송되었습니다.
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

// 비밀번호 재설정 요청
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate, email } = req.body

    // 이름, 생년월일, 이메일로 사용자 조회
    const [users] = await pool.execute(
      'SELECT id, name, email, status FROM users WHERE name = ? AND birth_date = ? AND email = ?',
      [name, birthDate, email]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '일치하는 사용자 정보를 찾을 수 없습니다.',
        data: {
          suggestion: '이름, 생년월일, 이메일을 다시 확인해주세요.'
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

    // 기존 재설정 토큰이 있다면 삭제
    await pool.execute(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [user.id]
    )

    // 새로운 재설정 토큰 생성
    const resetToken = generateResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1시간 후 만료

    // 재설정 토큰 저장
    await pool.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    )

    // 이메일 전송
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.name)

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: '비밀번호 재설정 이메일이 발송되었습니다.',
        data: {
          email: email,
          expiresAt: expiresAt,
          suggestion: '이메일을 확인하여 비밀번호를 재설정해주세요.'
        }
      })
    } else {
      // 이메일 전송 실패 시 토큰 삭제
      await pool.execute(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
      )

      res.status(500).json({
        success: false,
        message: '이메일 전송에 실패했습니다.',
        data: {
          suggestion: '잠시 후 다시 시도해주세요.'
        }
      })
    }
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({
      success: false,
      message: '비밀번호 재설정 중 오류가 발생했습니다.'
    })
  }
}

// 비밀번호 재설정 토큰 검증 및 새 비밀번호 설정
export const confirmPasswordReset = async (req: Request, res: Response): Promise<void> => {
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

    const { token, newPassword } = req.body

    // 토큰으로 사용자 조회
    const [tokens] = await pool.execute(
      `SELECT prt.user_id, prt.expires_at, u.name, u.email 
       FROM password_reset_tokens prt 
       JOIN users u ON prt.user_id = u.id 
       WHERE prt.token = ?`,
      [token]
    ) as any[]

    if (tokens.length === 0) {
      res.status(404).json({
        success: false,
        message: '유효하지 않은 재설정 토큰입니다.',
        data: {
          suggestion: '비밀번호 재설정을 다시 요청해주세요.'
        }
      })
      return
    }

    const resetToken = tokens[0]

    // 토큰 만료 확인
    if (new Date() > new Date(resetToken.expires_at)) {
      // 만료된 토큰 삭제
      await pool.execute(
        'DELETE FROM password_reset_tokens WHERE token = ?',
        [token]
      )

      res.status(400).json({
        success: false,
        message: '재설정 토큰이 만료되었습니다.',
        data: {
          suggestion: '비밀번호 재설정을 다시 요청해주세요.'
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
      [hashedPassword, resetToken.user_id]
    )

    // 사용된 토큰 삭제
    await pool.execute(
      'DELETE FROM password_reset_tokens WHERE token = ?',
      [token]
    )

    // 성공 이메일 전송
    const successEmailSent = await sendPasswordChangeNotification(resetToken.email, resetToken.name)

    res.status(200).json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
      data: {
        suggestion: '새 비밀번호로 로그인해주세요.',
        emailSent: successEmailSent
      }
    })
  } catch (error) {
    console.error('Password confirmation error:', error)
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    })
  }
}

// 비밀번호 변경 완료 알림 이메일
const sendPasswordChangeNotification = async (email: string, userName: string): Promise<boolean> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '[MetroWork] 비밀번호 변경 완료',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">비밀번호 변경 완료</h2>
          <p>안녕하세요, <strong>${userName}</strong>님.</p>
          <p>비밀번호가 성공적으로 변경되었습니다.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">
              변경 시간: ${new Date().toLocaleString('ko-KR')}<br>
              변경된 비밀번호는 안전하게 암호화되어 저장되었습니다.
            </p>
          </div>
          <p style="color: #666; font-size: 14px;">
            본인이 변경하지 않았다면 즉시 관리자에게 연락해주세요.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            이 이메일은 MetroWork 시스템에서 자동으로 발송되었습니다.
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

// 유효성 검사 규칙
export const resetPasswordValidation = [
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
  
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.')
    .normalizeEmail()
]

export const confirmPasswordResetValidation = [
  body('token')
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