import { Router } from 'express'
import { 
  resetPassword, 
  confirmPasswordReset, 
  resetPasswordValidation, 
  confirmPasswordResetValidation 
} from '../controllers/passwordResetController'

const router = Router()

// 비밀번호 재설정 요청
router.post('/reset-password', resetPasswordValidation, resetPassword)

// 비밀번호 재설정 토큰 검증 및 새 비밀번호 설정
router.post('/confirm-reset', confirmPasswordResetValidation, confirmPasswordReset)

export default router 