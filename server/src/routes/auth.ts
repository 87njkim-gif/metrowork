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

// 공개 ?�우??(?�증 불필??
router.post('/register', registerValidation, register)
router.post('/login', loginValidation, login)
router.post('/refresh', refreshToken)
router.post('/logout', logout)
router.post('/generate-hash', generatePasswordHash) // ?�시??
router.post('/update-admin-password', updateAdminPassword) // ?�시??

// 보호???�우??(?�증 ?�요)
router.get('/me', extractToken, authenticate, getCurrentUser)

// 관리자 ?�용 ?�우??
router.put('/admin/approve/:userId', 
  extractToken, 
  authenticate, 
  requireAdmin, 
  approveUserValidation, 
  approveUser
)

export default router 
