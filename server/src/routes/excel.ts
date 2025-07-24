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

// 모든 라우트에 인증 적용
router.use(extractToken, authenticate, requireApproved)

// 파일 업로드
router.post('/upload', uploadExcel)

// 업로드 진행률 조회
router.get('/upload/:fileId/progress', getUploadProgress)

// 파일 목록 조회
router.get('/files', getExcelFiles)

// 파일 삭제
router.delete('/files/:fileId', deleteExcelFile)

// 팀 목록 조회
router.get('/teams/:fileId', getTeamList)

// 데이터 조회 (캐시 적용)
router.get('/data/:fileId', cacheMiddleware('data'), getExcelData)

// 고급 검색 (캐시 적용)
router.post('/search/:fileId', cacheMiddleware('search'), searchExcelData)

// 요약 정보 조회 (캐시 적용)
router.get('/summary/:fileId', cacheMiddleware('summary'), getExcelSummary)

export default router 