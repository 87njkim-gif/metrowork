import { Router } from 'express'
import {
  checkWorkItem,
  getCompletedWorkList,
  setTodayDate,
  getTodayDate,
  getCompletedWorkByDate,
  getWorkStats,
  bulkCheckWork,
  getUserWorkStatus,
  getWorkHistory,
  checkWorkValidation,
  todayDateValidation,
  bulkCheckValidation
} from '../controllers/workController'
import {
  authenticate,
  requireApproved,
  extractToken
} from '../middleware/auth'

const router = Router()

// 모든 ?�우?�에 ?�증 ?�용
router.use(extractToken, authenticate, requireApproved)

// ?��? ?�이????체크/?�제
router.put('/excel/:rowId/check', checkWorkValidation, checkWorkItem)

// ?�료???�무 목록 조회
router.get('/completed', getCompletedWorkList)

// ?�늘 ?�짜 ?�정
router.put('/today-date', todayDateValidation, setTodayDate)

// ?�재 ?�정???�늘 ?�짜 조회
router.get('/today-date', getTodayDate)

// ?�정 ?�짜???�료???�무 조회
router.get('/completed/:date', getCompletedWorkByDate)

// ?�무 ?�계 조회
router.get('/stats', getWorkStats)

// ?�??체크/?�제
router.post('/bulk-check', bulkCheckValidation, bulkCheckWork)

// ?�용?�별 ?�무 ?�황 조회
router.get('/user-status', getUserWorkStatus)

// ?�무 ?�동 ?�스?�리 조회
router.get('/history', getWorkHistory)

export default router 
