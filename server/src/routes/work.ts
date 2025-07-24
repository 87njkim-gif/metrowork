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

// ëª¨ë“  ?¼ìš°?¸ì— ?¸ì¦ ?ìš©
router.use(extractToken, authenticate, requireApproved)

// ?‘ì? ?°ì´????ì²´í¬/?´ì œ
router.put('/excel/:rowId/check', checkWorkValidation, checkWorkItem)

// ?„ë£Œ???…ë¬´ ëª©ë¡ ì¡°íšŒ
router.get('/completed', getCompletedWorkList)

// ?¤ëŠ˜ ? ì§œ ?¤ì •
router.put('/today-date', todayDateValidation, setTodayDate)

// ?„ì¬ ?¤ì •???¤ëŠ˜ ? ì§œ ì¡°íšŒ
router.get('/today-date', getTodayDate)

// ?¹ì • ? ì§œ???„ë£Œ???…ë¬´ ì¡°íšŒ
router.get('/completed/:date', getCompletedWorkByDate)

// ?…ë¬´ ?µê³„ ì¡°íšŒ
router.get('/stats', getWorkStats)

// ?€??ì²´í¬/?´ì œ
router.post('/bulk-check', bulkCheckValidation, bulkCheckWork)

// ?¬ìš©?ë³„ ?…ë¬´ ?„í™© ì¡°íšŒ
router.get('/user-status', getUserWorkStatus)

// ?…ë¬´ ?œë™ ?ˆìŠ¤? ë¦¬ ì¡°íšŒ
router.get('/history', getWorkHistory)

export default router 
