import { Router } from 'express'
import { 
  getWorkCheckStatus,
  getAllWorkCheckStatus,
  checkWork,
  uncheckWork,
  getRealTimeWorkStatus,
  checkWorkValidation
} from '../controllers/workCheckController'
import { extractToken, authenticate, requireApproved } from '../middleware/auth'

const router = Router()

// 모든 라우트에 인증 및 승인 미들웨어 적용
router.use(extractToken, authenticate, requireApproved)

// 특정 업무의 체크 상태 조회
router.get('/status/:taskId', getWorkCheckStatus)

// 전체 업무 체크 현황 조회 (관리자용)
router.get('/all-status', getAllWorkCheckStatus)

// 실시간 업무 현황 조회
router.get('/real-time-status', getRealTimeWorkStatus)

// 업무 체크 (실시간 공유)
router.post('/check', checkWorkValidation, checkWork)

// 업무 체크 취소
router.delete('/uncheck/:taskId', uncheckWork)

export default router 