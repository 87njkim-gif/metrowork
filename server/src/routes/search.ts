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

// ëª¨ë“  ?¼ìš°?¸ì— ?¸ì¦ ?ìš©
router.use(extractToken, authenticate, requireApproved)

// ?€?¥ëœ ê²€??ëª©ë¡ ì¡°íšŒ
router.get('/:fileId/saved', getSavedSearches)

// ê²€??ì¡°ê±´ ?€??
router.post('/:fileId/saved', saveSearchValidation, saveSearch)

// ?€?¥ëœ ê²€?‰ìœ¼ë¡??°ì´??ì¡°íšŒ
router.get('/:fileId/saved/:searchId/execute', executeSavedSearch)

// ?€?¥ëœ ê²€???˜ì •
router.put('/:fileId/saved/:searchId', updateSearchValidation, updateSavedSearch)

// ?€?¥ëœ ê²€???? œ
router.delete('/:fileId/saved/:searchId', deleteSavedSearch)

// ê²€???ˆìŠ¤? ë¦¬ ì¡°íšŒ
router.get('/:fileId/history', getSearchHistory)

export default router 
