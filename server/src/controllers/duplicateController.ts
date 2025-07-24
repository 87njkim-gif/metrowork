import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'

const pool = getPool()

// ?´ë¦„+?ë…„?”ì¼ ì¤‘ë³µ ?•ì¸
export const checkDuplicate = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate } = req.body

    // ?´ë¦„ê³??ë…„?”ì¼ë¡??¬ìš©??ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT id, name, email, status FROM users WHERE name = ? AND birth_date = ?',
      [name, birthDate]
    ) as any[]

    if (users.length > 0) {
      // ì¤‘ë³µ???¬ìš©?ê? ?ˆëŠ” ê²½ìš°
      const user = users[0]
      
      res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '?´ë? ê°€?…ëœ ?¬ìš©?ì…?ˆë‹¤.',
        data: {
          duplicateInfo: {
            name: user.name,
            email: user.email,
            status: user.status
          },
          suggestion: 'ë¹„ë?ë²ˆí˜¸ ì°¾ê¸°ë¥??´ìš©?´ì£¼?¸ìš”.',
          helpText: 'ê°€?????¬ìš©???´ë©”?¼ë¡œ ë¹„ë?ë²ˆí˜¸ë¥??¬ì„¤?•í•  ???ˆìŠµ?ˆë‹¤.'
        }
      })
    } else {
      // ì¤‘ë³µ?˜ì? ?Šì? ê²½ìš°
      res.status(200).json({
        success: true,
        isDuplicate: false,
        message: '?¬ìš© ê°€?¥í•œ ?•ë³´?…ë‹ˆ??',
        data: {
          suggestion: '?Œì›ê°€?…ì„ ì§„í–‰?´ì£¼?¸ìš”.'
        }
      })
    }
  } catch (error) {
    console.error('Check duplicate error:', error)
    res.status(500).json({
      success: false,
      message: 'ì¤‘ë³µ ?•ì¸ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ? íš¨??ê²€??ê·œì¹™
export const checkDuplicateValidation = [
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
    })
] 
