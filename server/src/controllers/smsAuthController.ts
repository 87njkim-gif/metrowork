import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendSMS } from '../services/smsService'

const pool = getPool()

// 6?ë¦¬ ?œë¤ ?¸ì¦ë²ˆí˜¸ ?ì„±
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ?„ì‹œ ? í° ?ì„±
const generateTempToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

// ë³¸ì¸ ?•ì¸
export const verifyUser = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate, phoneNumber } = req.body

    // ?´ë¦„, ?ë…„?”ì¼, ?„í™”ë²ˆí˜¸ë¡??¬ìš©??ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT id, name, phone_number, status FROM users WHERE name = ? AND birth_date = ? AND phone_number = ?',
      [name, birthDate, phoneNumber]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?¼ì¹˜?˜ëŠ” ?¬ìš©???•ë³´ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.',
        data: {
          suggestion: '?´ë¦„, ?ë…„?”ì¼, ?„í™”ë²ˆí˜¸ë¥??¤ì‹œ ?•ì¸?´ì£¼?¸ìš”.'
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

    // ê¸°ì¡´ ?¸ì¦ ?•ë³´ê°€ ?ˆë‹¤ë©??? œ
    await pool.query(
      'DELETE FROM sms_verifications WHERE phone_number = ?',
      [phoneNumber]
    )

    // ?ˆë¡œ???¸ì¦ë²ˆí˜¸ ?ì„±
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5ë¶???ë§Œë£Œ

    // ?¸ì¦ ?•ë³´ ?€??
    await pool.query(
      'INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES (?, ?, ?, ?)',
      [phoneNumber, verificationCode, expiresAt, user.id]
    )

    // SMS ë°œì†¡ (ê°œë°œ ?˜ê²½?ì„œ??ì½˜ì†” ë¡œê·¸)
    const smsSent = await sendSMS(phoneNumber, verificationCode)

    if (smsSent) {
      res.status(200).json({
        success: true,
        message: '?¸ì¦ë²ˆí˜¸ê°€ ë°œì†¡?˜ì—ˆ?µë‹ˆ??',
        data: {
          phoneNumber: phoneNumber,
          expiresAt: expiresAt,
          suggestion: '5ë¶??´ë‚´???¸ì¦ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.'
        }
      })
    } else {
      // SMS ë°œì†¡ ?¤íŒ¨ ???¸ì¦ ?•ë³´ ?? œ
      await pool.query(
        'DELETE FROM sms_verifications WHERE phone_number = ?',
        [phoneNumber]
      )

      res.status(500).json({
        success: false,
        message: 'SMS ë°œì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.',
        data: {
          suggestion: '? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.'
        }
      })
    }
  } catch (error) {
    console.error('User verification error:', error)
    res.status(500).json({
      success: false,
      message: 'ë³¸ì¸ ?•ì¸ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// SMS ?¸ì¦ë²ˆí˜¸ ë°œì†¡
export const sendSMSVerification = async (req: Request, res: Response): Promise<void> => {
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

    const { phoneNumber } = req.body

    // ê¸°ì¡´ ?¸ì¦ ?•ë³´ ?•ì¸
    const [verifications] = await pool.query(
      'SELECT * FROM sms_verifications WHERE phone_number = ? AND expires_at > NOW()',
      [phoneNumber]
    ) as any[]

    if (verifications.length > 0) {
      const verification = verifications[0]
      const timeLeft = Math.ceil((new Date(verification.expires_at).getTime() - Date.now()) / 1000)

      res.status(400).json({
        success: false,
        message: '?´ë? ë°œì†¡???¸ì¦ë²ˆí˜¸ê°€ ?ˆìŠµ?ˆë‹¤.',
        data: {
          timeLeft: timeLeft,
          suggestion: `${timeLeft}ì´??„ì— ?¤ì‹œ ?”ì²­?´ì£¼?¸ìš”.`
        }
      })
      return
    }

    // ?ˆë¡œ???¸ì¦ë²ˆí˜¸ ?ì„±
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5ë¶???ë§Œë£Œ

    // ?¬ìš©???•ë³´ ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT id FROM users WHERE phone_number = ?',
      [phoneNumber]
    ) as any[]

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: '?±ë¡?˜ì? ?Šì? ?„í™”ë²ˆí˜¸?…ë‹ˆ??',
        data: {
          suggestion: '?Œì›ê°€?…ì„ ë¨¼ì? ì§„í–‰?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    // ?¸ì¦ ?•ë³´ ?€??
    await pool.query(
      'INSERT INTO sms_verifications (phone_number, verification_code, expires_at, user_id) VALUES (?, ?, ?, ?)',
      [phoneNumber, verificationCode, expiresAt, users[0].id]
    )

    // SMS ë°œì†¡
    const smsSent = await sendSMS(phoneNumber, verificationCode)

    if (smsSent) {
      res.status(200).json({
        success: true,
        message: '?¸ì¦ë²ˆí˜¸ê°€ ë°œì†¡?˜ì—ˆ?µë‹ˆ??',
        data: {
          phoneNumber: phoneNumber,
          expiresAt: expiresAt,
          suggestion: '5ë¶??´ë‚´???¸ì¦ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.'
        }
      })
    } else {
      // SMS ë°œì†¡ ?¤íŒ¨ ???¸ì¦ ?•ë³´ ?? œ
      await pool.query(
        'DELETE FROM sms_verifications WHERE phone_number = ?',
        [phoneNumber]
      )

      res.status(500).json({
        success: false,
        message: 'SMS ë°œì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.',
        data: {
          suggestion: '? ì‹œ ???¤ì‹œ ?œë„?´ì£¼?¸ìš”.'
        }
      })
    }
  } catch (error) {
    console.error('SMS sending error:', error)
    res.status(500).json({
      success: false,
      message: 'SMS ë°œì†¡ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?¸ì¦ë²ˆí˜¸ ?•ì¸
export const verifySMS = async (req: Request, res: Response): Promise<void> => {
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

    const { phoneNumber, verificationCode } = req.body

    // ?¸ì¦ ?•ë³´ ì¡°íšŒ
    const [verifications] = await pool.query(
      'SELECT * FROM sms_verifications WHERE phone_number = ? AND verification_code = ? AND expires_at > NOW()',
      [phoneNumber, verificationCode]
    ) as any[]

    if (verifications.length === 0) {
      res.status(400).json({
        success: false,
        message: '? íš¨?˜ì? ?Šì? ?¸ì¦ë²ˆí˜¸?…ë‹ˆ??',
        data: {
          suggestion: '?¸ì¦ë²ˆí˜¸ë¥??¤ì‹œ ?•ì¸?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    const verification = verifications[0]

    // ?„ì‹œ ? í° ?ì„±
    const tempToken = generateTempToken()
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10ë¶???ë§Œë£Œ

    // ?„ì‹œ ? í° ?€??
    await pool.query(
      'INSERT INTO temp_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [tempToken, verification.user_id, tokenExpiresAt]
    )

    // ?¬ìš©???¸ì¦ ?•ë³´ ?? œ
    await pool.query(
      'DELETE FROM sms_verifications WHERE id = ?',
      [verification.id]
    )

    res.status(200).json({
      success: true,
      message: '?¸ì¦???„ë£Œ?˜ì—ˆ?µë‹ˆ??',
      data: {
        tempToken: tempToken,
        expiresAt: tokenExpiresAt,
        suggestion: '??ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.'
      }
    })
  } catch (error) {
    console.error('SMS verification error:', error)
    res.status(500).json({
      success: false,
      message: '?¸ì¦ë²ˆí˜¸ ?•ì¸ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤??(SMS ?¸ì¦ ë°©ì‹)
export const resetPasswordWithSMS = async (req: Request, res: Response): Promise<void> => {
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

    const { tempToken, newPassword } = req.body

    // ?„ì‹œ ? í° ê²€ì¦?
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
        message: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ??',
        data: {
          suggestion: '?¸ì¦???¤ì‹œ ì§„í–‰?´ì£¼?¸ìš”.'
        }
      })
      return
    }

    const token = tokens[0]

    // ? í° ë§Œë£Œ ?•ì¸
    if (new Date() > new Date(token.expires_at)) {
      // ë§Œë£Œ??? í° ?? œ
      await pool.query(
        'DELETE FROM temp_tokens WHERE token = ?',
        [tempToken]
      )

      res.status(400).json({
        success: false,
        message: '? í°??ë§Œë£Œ?˜ì—ˆ?µë‹ˆ??',
        data: {
          suggestion: '?¸ì¦???¤ì‹œ ì§„í–‰?´ì£¼?¸ìš”.'
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
      [hashedPassword, token.user_id]
    )

    // ?¬ìš©??? í° ?? œ
    await pool.query(
      'DELETE FROM temp_tokens WHERE token = ?',
      [tempToken]
    )

    // ?±ê³µ SMS ë°œì†¡
    const successSMSSent = await sendPasswordChangeNotification(token.phone_number, token.name)

    res.status(200).json({
      success: true,
      message: 'ë¹„ë?ë²ˆí˜¸ê°€ ?±ê³µ?ìœ¼ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤.',
      data: {
        suggestion: '??ë¹„ë?ë²ˆí˜¸ë¡?ë¡œê·¸?¸í•´ì£¼ì„¸??',
        smsSent: successSMSSent
      }
    })
  } catch (error) {
    console.error('Password reset error:', error)
    res.status(500).json({
      success: false,
      message: 'ë¹„ë?ë²ˆí˜¸ ë³€ê²?ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ë¹„ë?ë²ˆí˜¸ ë³€ê²??„ë£Œ ?Œë¦¼ SMS
const sendPasswordChangeNotification = async (phoneNumber: string, userName: string): Promise<boolean> => {
  try {
    const message = `[MetroWork] ${userName}?? ë¹„ë?ë²ˆí˜¸ê°€ ?±ê³µ?ìœ¼ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤. ë³€ê²??œê°„: ${new Date().toLocaleString('ko-KR')}`
    
    const smsSent = await sendSMS(phoneNumber, message)
    return smsSent
  } catch (error) {
    console.error('Success SMS sending error:', error)
    return false
  }
}

// ? íš¨??ê²€??ê·œì¹™
export const verifyUserValidation = [
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
  
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('?„í™”ë²ˆí˜¸??010-1234-5678 ?•ì‹?´ì–´???©ë‹ˆ??')
]

export const sendSMSValidation = [
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('?„í™”ë²ˆí˜¸??010-1234-5678 ?•ì‹?´ì–´???©ë‹ˆ??')
]

export const verifySMSValidation = [
  body('phoneNumber')
    .matches(/^01[0-9]-\d{3,4}-\d{4}$/)
    .withMessage('?„í™”ë²ˆí˜¸??010-1234-5678 ?•ì‹?´ì–´???©ë‹ˆ??'),
  
  body('verificationCode')
    .isLength({ min: 6, max: 6 })
    .withMessage('?¸ì¦ë²ˆí˜¸??6?ë¦¬?¬ì•¼ ?©ë‹ˆ??')
    .matches(/^\d{6}$/)
    .withMessage('?¸ì¦ë²ˆí˜¸???«ìë§??…ë ¥ ê°€?¥í•©?ˆë‹¤.')
]

export const resetPasswordWithSMSValidation = [
  body('tempToken')
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
