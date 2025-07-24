import { Router } from 'express'
import { 
  verifyUser, 
  sendSMSVerification, 
  verifySMS, 
  resetPasswordWithSMS,
  verifyUserValidation,
  sendSMSValidation,
  verifySMSValidation,
  resetPasswordWithSMSValidation
} from '../controllers/smsAuthController'

const router = Router()

// 본인 ?�인
router.post('/verify-user', verifyUserValidation, verifyUser)

// SMS ?�증번호 발송
router.post('/send-sms', sendSMSValidation, sendSMSVerification)

// ?�증번호 ?�인
router.post('/verify-sms', verifySMSValidation, verifySMS)

// 비�?번호 ?�설??(SMS ?�증 방식)
router.post('/reset-password', resetPasswordWithSMSValidation, resetPasswordWithSMS)

export default router 
