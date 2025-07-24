import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'

const pool = getPool()

// 이름+생년월일 중복 확인
export const checkDuplicate = async (req: Request, res: Response): Promise<void> => {
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

    const { name, birthDate } = req.body

    // 이름과 생년월일로 사용자 조회
    const [users] = await pool.execute(
      'SELECT id, name, email, status FROM users WHERE name = ? AND birth_date = ?',
      [name, birthDate]
    ) as any[]

    if (users.length > 0) {
      // 중복된 사용자가 있는 경우
      const user = users[0]
      
      res.status(200).json({
        success: true,
        isDuplicate: true,
        message: '이미 가입된 사용자입니다.',
        data: {
          duplicateInfo: {
            name: user.name,
            email: user.email,
            status: user.status
          },
          suggestion: '비밀번호 찾기를 이용해주세요.',
          helpText: '가입 시 사용한 이메일로 비밀번호를 재설정할 수 있습니다.'
        }
      })
    } else {
      // 중복되지 않은 경우
      res.status(200).json({
        success: true,
        isDuplicate: false,
        message: '사용 가능한 정보입니다.',
        data: {
          suggestion: '회원가입을 진행해주세요.'
        }
      })
    }
  } catch (error) {
    console.error('Check duplicate error:', error)
    res.status(500).json({
      success: false,
      message: '중복 확인 중 오류가 발생했습니다.'
    })
  }
}

// 유효성 검사 규칙
export const checkDuplicateValidation = [
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
    })
] 