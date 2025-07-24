import { Router } from 'express'
import { 
  resetPassword, 
  confirmPasswordReset, 
  resetPasswordValidation, 
  confirmPasswordResetValidation 
} from '../controllers/passwordResetController'

const router = Router()

// 비�?번호 ?�설???�청
router.post('/reset-password', resetPasswordValidation, resetPassword)

// 비�?번호 ?�설???�큰 검�?�???비�?번호 ?�정
router.post('/confirm-reset', confirmPasswordResetValidation, confirmPasswordReset)

export default router 
