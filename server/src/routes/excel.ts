import { Router } from 'express'
import {
  uploadExcel,
  getUploadProgress,
  getExcelData,
  searchExcelData,
  getExcelSummary,
  getExcelFiles,
  deleteExcelFile,
  getTeamList
} from '../controllers/excelController'
import {
  authenticate,
  requireApproved,
  extractToken
} from '../middleware/auth'
import { cacheMiddleware } from '../utils/cache'

const router = Router()

// λͺ¨λ  ?Όμ°?Έμ ?Έμ¦ ?μ©
router.use(extractToken, authenticate, requireApproved)

// ?μΌ ?λ‘??
router.post('/upload', uploadExcel)

// ?λ‘??μ§νλ₯?μ‘°ν
router.get('/upload/:fileId/progress', getUploadProgress)

// ?μΌ λͺ©λ‘ μ‘°ν
router.get('/files', getExcelFiles)

// ?μΌ ?? 
router.delete('/files/:fileId', deleteExcelFile)

// ? λͺ©λ‘ μ‘°ν
router.get('/teams/:fileId', getTeamList)

// ?°μ΄??μ‘°ν (μΊμ ?μ©)
router.get('/data/:fileId', cacheMiddleware('data'), getExcelData)

// κ³ κΈ κ²??(μΊμ ?μ©)
router.post('/search/:fileId', cacheMiddleware('search'), searchExcelData)

// ?μ½ ?λ³΄ μ‘°ν (μΊμ ?μ©)
router.get('/summary/:fileId', cacheMiddleware('summary'), getExcelSummary)

export default router 
