import { Router } from 'express'
import { checkDuplicate, checkDuplicateValidation } from '../controllers/duplicateController'

const router = Router()

// ?�름+?�년?�일 중복 ?�인
router.post('/check-duplicate', checkDuplicateValidation, checkDuplicate)

export default router 
