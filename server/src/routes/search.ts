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

// 모든 ?�우?�에 ?�증 ?�용
router.use(extractToken, authenticate, requireApproved)

// ?�?�된 검??목록 조회
router.get('/:fileId/saved', getSavedSearches)

// 검??조건 ?�??
router.post('/:fileId/saved', saveSearchValidation, saveSearch)

// ?�?�된 검?�으�??�이??조회
router.get('/:fileId/saved/:searchId/execute', executeSavedSearch)

// ?�?�된 검???�정
router.put('/:fileId/saved/:searchId', updateSearchValidation, updateSavedSearch)

// ?�?�된 검????��
router.delete('/:fileId/saved/:searchId', deleteSavedSearch)

// 검???�스?�리 조회
router.get('/:fileId/history', getSearchHistory)

export default router 
