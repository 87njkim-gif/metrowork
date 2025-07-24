import { Router } from 'express'
import { checkDuplicate, checkDuplicateValidation } from '../controllers/duplicateController'

const router = Router()

// 이름+생년월일 중복 확인
router.post('/check-duplicate', checkDuplicateValidation, checkDuplicate)

export default router 