import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const pool = getPool()

// ?´ë©”???„ì†¡ ?¤ì • (?˜ê²½ë³€?˜ì—??ê°€?¸ì˜¤ê¸?
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤??? í° ?ì„±
const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???´ë©”???„ì†¡
const sendPasswordResetEmail = async (email: string, resetToken: string, userName: string): Promise<boolean> => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '[MetroWork] ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???ˆë‚´',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">MetroWork ë¹„ë?ë²ˆí˜¸ ?¬ì„¤??/h2>
          <p>?ˆë…•?˜ì„¸?? <strong>${userName}</strong>??</p>
          <p>ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???”ì²­???‘ìˆ˜?˜ì—ˆ?µë‹ˆ??</p>
          <p>?„ë˜ ë§í¬ë¥??´ë¦­?˜ì—¬ ?ˆë¡œ??ë¹„ë?ë²ˆí˜¸ë¥??¤ì •?´ì£¼?¸ìš”:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              ë¹„ë?ë²ˆí˜¸ ?¬ì„¤?•í•˜ê¸?
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            ??ë§í¬??1?œê°„ ?„ì— ë§Œë£Œ?©ë‹ˆ??<br>
            ë³¸ì¸???”ì²­?˜ì? ?Šì•˜?¤ë©´ ???´ë©”?¼ì„ ë¬´ì‹œ?˜ì„¸??
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            ???´ë©”?¼ì? MetroWork ?œìŠ¤?œì—???ë™?¼ë¡œ ë°œì†¡?˜ì—ˆ?µë‹ˆ??
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

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???”ì²­
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate, email } = req.body

    // ?´ë¦„, ?ë…„?”ì¼, ?´ë©”?¼ë¡œ ?¬ìš©??ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT id, name, email, status FROM users WHERE name = ? AND birth_date = ? AND email = ?',
      [name, birthDate, email]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?¼ì¹˜?˜ëŠ” ?¬ìš©???•ë³´ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.',
        data: {
          suggestion: '?´ë¦„, ?ë…„?”ì¼, ?´ë©”?¼ì„ ?¤ì‹œ ?•ì¸?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    const user = users[0]

    // ê³„ì • ?íƒœ ?•ì¸
    if (user.status !== 'approved') {
      res.status(403).json({
        success: false,
        message: '?¹ì¸?˜ì? ?Šì? ê³„ì •?…ë‹ˆ??',
        data: {
          suggestion: 'ê´€ë¦¬ì?ê²Œ ê³„ì • ?¹ì¸???”ì²­?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    // ê¸°ì¡´ ?¬ì„¤??? í°???ˆë‹¤ë©??? œ
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ?',
      [user.id]
    )

    // ?ˆë¡œ???¬ì„¤??? í° ?ì„±
    const resetToken = generateResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1?œê°„ ??ë§Œë£Œ

    // ?¬ì„¤??? í° ?€??
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetToken, expiresAt]
    )

    // ?´ë©”???„ì†¡
    const emailSent = await sendPasswordResetEmail(email, resetToken, user.name)

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: 'ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???´ë©”?¼ì´ ë°œì†¡?˜ì—ˆ?µë‹ˆ??',
        data: {
          email: email,
          expiresAt: expiresAt,
          suggestion: '?´ë©”?¼ì„ ?•ì¸?˜ì—¬ ë¹„ë?ë²ˆí˜¸ë¥??¬ì„¤?•í•´ì£¼ì„¸??'
        }
      })
    } else {
      // ?´ë©”???„ì†¡ ?¤íŒ¨ ??? í° ?? œ
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
      )

      res.status(500).json({
        success: false,
        message: '?´ë©”???„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.',
        data: {
          suggestion: '? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.'
        }
      })
    }
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({
      success: false,
      message: 'ë¹„ë?ë²ˆí˜¸ ?¬ì„¤??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤??? í° ê²€ì¦?ë°???ë¹„ë?ë²ˆí˜¸ ?¤ì •
export const confirmPasswordReset = async (req: Request, res: Response): Promise<void> => {
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

    const { token, newPassword } = req.body

    // ? í°?¼ë¡œ ?¬ìš©??ì¡°íšŒ
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
        message: '? íš¨?˜ì? ?Šì? ?¬ì„¤??? í°?…ë‹ˆ??',
        data: {
          suggestion: 'ë¹„ë?ë²ˆí˜¸ ?¬ì„¤?•ì„ ?¤ì‹œ ?”ì²­?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    const resetToken = tokens[0]

    // ? í° ë§Œë£Œ ?•ì¸
    if (new Date() > new Date(resetToken.expires_at)) {
      // ë§Œë£Œ??? í° ?? œ
      await pool.query(
        'DELETE FROM password_reset_tokens WHERE token = ?',
        [token]
      )

      res.status(400).json({
        success: false,
        message: '?¬ì„¤??? í°??ë§Œë£Œ?˜ì—ˆ?µë‹ˆ??',
        data: {
          suggestion: 'ë¹„ë?ë²ˆí˜¸ ?¬ì„¤?•ì„ ?¤ì‹œ ?”ì²­?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    // ??ë¹„ë?ë²ˆí˜¸ ?´ì‹œ??
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

    // ë¹„ë?ë²ˆí˜¸ ?…ë°?´íŠ¸
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, resetToken.user_id]
    )

    // ?¬ìš©??? í° ?? œ
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE token = ?',
      [token]
    )

    // ?±ê³µ ?´ë©”???„ì†¡
    const successEmailSent = await sendPasswordChangeNotification(resetToken.email, resetToken.name)

    res.status(200).json({
      success: true,
      message: 'ë¹„ë?ë²ˆí˜¸ê°€ ?±ê³µ?ìœ¼ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤.',
      data: {
        suggestion: '??ë¹„ë?ë²ˆí˜¸ë¡?ë¡œê·¸?¸í•´ì£¼ì„¸??',
        emailSent: successEmailSent
      }
    })
  } catch (error) {
    console.error('Password confirmation error:', error)
    res.status(500).json({
      success: false,
      message: 'ë¹„ë?ë²ˆí˜¸ ë³€ê²?ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¹„ë?ë²ˆí˜¸ ë³€ê²??„ë£Œ ?Œë¦¼ ?´ë©”??
const sendPasswordChangeNotification = async (email: string, userName: string): Promise<boolean> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: '[MetroWork] ë¹„ë?ë²ˆí˜¸ ë³€ê²??„ë£Œ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">ë¹„ë?ë²ˆí˜¸ ë³€ê²??„ë£Œ</h2>
          <p>?ˆë…•?˜ì„¸?? <strong>${userName}</strong>??</p>
          <p>ë¹„ë?ë²ˆí˜¸ê°€ ?±ê³µ?ìœ¼ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #666;">
              ë³€ê²??œê°„: ${new Date().toLocaleString('ko-KR')}<br>
              ë³€ê²½ëœ ë¹„ë?ë²ˆí˜¸???ˆì „?˜ê²Œ ?”í˜¸?”ë˜???€?¥ë˜?ˆìŠµ?ˆë‹¤.
            </p>
          </div>
          <p style="color: #666; font-size: 14px;">
            ë³¸ì¸??ë³€ê²½í•˜ì§€ ?Šì•˜?¤ë©´ ì¦‰ì‹œ ê´€ë¦¬ì?ê²Œ ?°ë½?´ì£¼?¸ìš”.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            ???´ë©”?¼ì? MetroWork ?œìŠ¤?œì—???ë™?¼ë¡œ ë°œì†¡?˜ì—ˆ?µë‹ˆ??
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

// ? íš¨??ê²€??ê·œì¹™
export const resetPasswordValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('?´ë¦„?€ 2-50???¬ì´?¬ì•¼ ?©ë‹ˆ??')
    .matches(/^[ê°€-?£a-zA-Z\s]+$/)
    .withMessage('?´ë¦„?€ ?œê?, ?ë¬¸, ê³µë°±ë§??…ë ¥ ê°€?¥í•©?ˆë‹¤.'),
  
  body('birthDate')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('?ë…„?”ì¼?€ YYYY-MM-DD ?•ì‹?´ì–´???©ë‹ˆ??')
    .custom((value) => {
      const date = new Date(value)
      const today = new Date()
      const minDate = new Date('1900-01-01')
      
      if (isNaN(date.getTime())) {
        throw new Error('? íš¨?˜ì? ?Šì? ? ì§œ?…ë‹ˆ??')
      }
      
      if (date > today) {
        throw new Error('?ë…„?”ì¼?€ ?¤ëŠ˜ ? ì§œë³´ë‹¤ ?´ì „?´ì–´???©ë‹ˆ??')
      }
      
      if (date < minDate) {
        throw new Error('?ë…„?”ì¼?€ 1900???´í›„?¬ì•¼ ?©ë‹ˆ??')
      }
      
      return true
    }),
  
  body('email')
    .isEmail()
    .withMessage('? íš¨???´ë©”??ì£¼ì†Œë¥??…ë ¥?´ì£¼?¸ìš”.')
    .normalizeEmail()
]

export const confirmPasswordResetValidation = [
  body('token')
    .isLength({ min: 64, max: 64 })
    .withMessage('? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ??')
    .matches(/^[a-f0-9]+$/)
    .withMessage('? í° ?•ì‹???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.'),
  
  body('newPassword')
    .isLength({ min: 8, max: 100 })
    .withMessage('ë¹„ë?ë²ˆí˜¸??8-100???¬ì´?¬ì•¼ ?©ë‹ˆ??')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('ë¹„ë?ë²ˆí˜¸???ë¬¸ ?€?Œë¬¸?? ?«ì, ?¹ìˆ˜ë¬¸ìë¥??¬í•¨?´ì•¼ ?©ë‹ˆ??')
] 
