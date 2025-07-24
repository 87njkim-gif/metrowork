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

// 모든 라우트에 인증 적용
router.use(extractToken, authenticate, requireApproved)

// 엑셀 데이터 행 체크/해제
router.put('/excel/:rowId/check', checkWorkValidation, checkWorkItem)

// 완료된 업무 목록 조회
router.get('/completed', getCompletedWorkList)

// 오늘 날짜 설정
router.put('/today-date', todayDateValidation, setTodayDate)

// 현재 설정된 오늘 날짜 조회
router.get('/today-date', getTodayDate)

// 특정 날짜의 완료된 업무 조회
router.get('/completed/:date', getCompletedWorkByDate)

// 업무 통계 조회
router.get('/stats', getWorkStats)

// 대량 체크/해제
router.post('/bulk-check', bulkCheckValidation, bulkCheckWork)

// 사용자별 업무 현황 조회
router.get('/user-status', getUserWorkStatus)

// 업무 활동 히스토리 조회
router.get('/history', getWorkHistory)

export default router 