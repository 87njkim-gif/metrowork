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

// 본인 확인
router.post('/verify-user', verifyUserValidation, verifyUser)

// SMS 인증번호 발송
router.post('/send-sms', sendSMSValidation, sendSMSVerification)

// 인증번호 확인
router.post('/verify-sms', verifySMSValidation, verifySMS)

// 비밀번호 재설정 (SMS 인증 방식)
router.post('/reset-password', resetPasswordWithSMSValidation, resetPasswordWithSMS)

export default router 