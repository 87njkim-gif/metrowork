import { Router } from 'express'
import { checkDuplicate, checkDuplicateValidation } from '../controllers/duplicateController'

const router = Router()

// ?´ë¦„+?ë…„?”ì¼ ì¤‘ë³µ ?•ì¸
router.post('/check-duplicate', checkDuplicateValidation, checkDuplicate)

export default router 
