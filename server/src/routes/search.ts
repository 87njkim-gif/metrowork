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

// 모든 라우트에 인증 적용
router.use(extractToken, authenticate, requireApproved)

// 저장된 검색 목록 조회
router.get('/:fileId/saved', getSavedSearches)

// 검색 조건 저장
router.post('/:fileId/saved', saveSearchValidation, saveSearch)

// 저장된 검색으로 데이터 조회
router.get('/:fileId/saved/:searchId/execute', executeSavedSearch)

// 저장된 검색 수정
router.put('/:fileId/saved/:searchId', updateSearchValidation, updateSavedSearch)

// 저장된 검색 삭제
router.delete('/:fileId/saved/:searchId', deleteSavedSearch)

// 검색 히스토리 조회
router.get('/:fileId/history', getSearchHistory)

export default router 