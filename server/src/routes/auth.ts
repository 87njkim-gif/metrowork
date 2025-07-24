import { Router } from 'express'
import {
  register,
  login,
  approveUser,
  refreshToken,
  logout,
  getCurrentUser,
  registerValidation,
  loginValidation,
  approveUserValidation,
  generatePasswordHash,
  updateAdminPassword
} from '../controllers/authController'
import {
  authenticate,
  requireAdmin,
  requireApproved,
  extractToken
} from '../middleware/auth'

const router = Router()

// 공개 라우트 (인증 불필요)
router.post('/register', registerValidation, register)
router.post('/login', loginValidation, login)
router.post('/refresh', refreshToken)
router.post('/logout', logout)
router.post('/generate-hash', generatePasswordHash) // 임시용
router.post('/update-admin-password', updateAdminPassword) // 임시용

// 보호된 라우트 (인증 필요)
router.get('/me', extractToken, authenticate, getCurrentUser)

// 관리자 전용 라우트
router.put('/admin/approve/:userId', 
  extractToken, 
  authenticate, 
  requireAdmin, 
  approveUserValidation, 
  approveUser
)

export default router 