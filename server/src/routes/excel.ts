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

// 모든 ?�우?�에 ?�증 ?�용
router.use(extractToken, authenticate, requireApproved)

// ?�일 ?�로??
router.post('/upload', uploadExcel)

// ?�로??진행�?조회
router.get('/upload/:fileId/progress', getUploadProgress)

// ?�일 목록 조회
router.get('/files', getExcelFiles)

// ?�일 ??��
router.delete('/files/:fileId', deleteExcelFile)

// ?� 목록 조회
router.get('/teams/:fileId', getTeamList)

// ?�이??조회 (캐시 ?�용)
router.get('/data/:fileId', cacheMiddleware('data'), getExcelData)

// 고급 검??(캐시 ?�용)
router.post('/search/:fileId', cacheMiddleware('search'), searchExcelData)

// ?�약 ?�보 조회 (캐시 ?�용)
router.get('/summary/:fileId', cacheMiddleware('summary'), getExcelSummary)

export default router 
