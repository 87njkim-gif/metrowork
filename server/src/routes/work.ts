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

// λͺ¨λ  ?Όμ°?Έμ ?Έμ¦ ?μ©
router.use(extractToken, authenticate, requireApproved)

// ?μ? ?°μ΄????μ²΄ν¬/?΄μ 
router.put('/excel/:rowId/check', checkWorkValidation, checkWorkItem)

// ?λ£???λ¬΄ λͺ©λ‘ μ‘°ν
router.get('/completed', getCompletedWorkList)

// ?€λ ? μ§ ?€μ 
router.put('/today-date', todayDateValidation, setTodayDate)

// ?μ¬ ?€μ ???€λ ? μ§ μ‘°ν
router.get('/today-date', getTodayDate)

// ?Ήμ  ? μ§???λ£???λ¬΄ μ‘°ν
router.get('/completed/:date', getCompletedWorkByDate)

// ?λ¬΄ ?΅κ³ μ‘°ν
router.get('/stats', getWorkStats)

// ???μ²΄ν¬/?΄μ 
router.post('/bulk-check', bulkCheckValidation, bulkCheckWork)

// ?¬μ©?λ³ ?λ¬΄ ?ν© μ‘°ν
router.get('/user-status', getUserWorkStatus)

// ?λ¬΄ ?λ ?μ€? λ¦¬ μ‘°ν
router.get('/history', getWorkHistory)

export default router 
