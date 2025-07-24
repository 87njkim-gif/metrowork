import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'

const pool = getPool()

// ?�름+?�년?�일 중복 ?�인
export const checkDuplicate = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate } = req.body

    // ?�름�??�년?�일�??�용??조회
    const [users] = await pool.query(
      'SELECT id, name, email, status FROM users WHERE name = ? AND birth_date = ?',
      [name, birthDate]
    ) as any[]

    if (users.length > 0) {
      // 중복???�용?��? ?�는 경우
      const user = users[0]
      
      res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '?��? 가?�된 ?�용?�입?�다.',
        data: {
          duplicateInfo: {
            name: user.name,
            email: user.email,
            status: user.status
          },
          suggestion: '비�?번호 찾기�??�용?�주?�요.',
          helpText: '가?????�용???�메?�로 비�?번호�??�설?�할 ???�습?�다.'
        }
      })
    } else {
      // 중복?��? ?��? 경우
      res.status(200).json({
        success: true,
        isDuplicate: false,
        message: '?�용 가?�한 ?�보?�니??',
        data: {
          suggestion: '?�원가?�을 진행?�주?�요.'
        }
      })
    }
  } catch (error) {
    console.error('Check duplicate error:', error)
    res.status(500).json({
      success: false,
      message: '중복 ?�인 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�효??검??규칙
export const checkDuplicateValidation = [
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
    })
] 
