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

// 모든 ?�우?�에 ?�증 �??�인 미들?�어 ?�용
router.use(extractToken, authenticate, requireApproved)

// ?�정 ?�무??체크 ?�태 조회
router.get('/status/:taskId', getWorkCheckStatus)

// ?�체 ?�무 체크 ?�황 조회 (관리자??
router.get('/all-status', getAllWorkCheckStatus)

// ?�시�??�무 ?�황 조회
router.get('/real-time-status', getRealTimeWorkStatus)

// ?�무 체크 (?�시�?공유)
router.post('/check', checkWorkValidation, checkWork)

// ?�무 체크 취소
router.delete('/uncheck/:taskId', uncheckWork)

export default router 
