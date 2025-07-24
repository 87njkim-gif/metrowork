import { Router } from 'express'
import { 
  resetPassword, 
  confirmPasswordReset, 
  resetPasswordValidation, 
  confirmPasswordResetValidation 
} from '../controllers/passwordResetController'

const router = Router()

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤???”ì²­
router.post('/reset-password', resetPasswordValidation, resetPassword)

// ë¹„ë?ë²ˆí˜¸ ?¬ì„¤??? í° ê²€ì¦?ë°???ë¹„ë?ë²ˆí˜¸ ?¤ì •
router.post('/confirm-reset', confirmPasswordResetValidation, confirmPasswordReset)

export default router 
