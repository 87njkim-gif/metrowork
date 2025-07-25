import { Router } from 'express'
import {
  getSavedSearches,
  saveSearch,
  executeSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  getSearchHistory,
  saveSearchValidation,
  updateSearchValidation
} from '../controllers/searchController'
import {
  authenticate,
  requireApproved,
  extractToken
} from '../middleware/auth'

const router = Router()

// λͺ¨λ  ?Όμ°?Έμ ?Έμ¦ ?μ©
router.use(extractToken, authenticate, requireApproved)

// ??₯λ κ²??λͺ©λ‘ μ‘°ν
router.get('/:fileId/saved', getSavedSearches)

// κ²??μ‘°κ±΄ ???
router.post('/:fileId/saved', saveSearchValidation, saveSearch)

// ??₯λ κ²?μΌλ‘??°μ΄??μ‘°ν
router.get('/:fileId/saved/:searchId/execute', executeSavedSearch)

// ??₯λ κ²???μ 
router.put('/:fileId/saved/:searchId', updateSearchValidation, updateSavedSearch)

// ??₯λ κ²???? 
router.delete('/:fileId/saved/:searchId', deleteSavedSearch)

// κ²???μ€? λ¦¬ μ‘°ν
router.get('/:fileId/history', getSearchHistory)

export default router 
