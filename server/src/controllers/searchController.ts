import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { SavedSearch, SearchCriteria } from '../types/excel'
import { searchExcelData } from './excelController'

const pool = getPool()

// 저장된 검색 목록 조회
export const getSavedSearches = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    const [searches] = await pool.execute(
      'SELECT * FROM saved_searches WHERE file_id = ? AND user_id = ? ORDER BY created_at DESC',
      [fileId, userId]
    ) as any[]

    res.status(200).json({
      success: true,
      data: {
        searches: searches.map((search: any) => ({
          ...search,
          criteria: JSON.parse(search.criteria)
        }))
      }
    })
  } catch (error) {
    console.error('Get saved searches error:', error)
    res.status(500).json({
      success: false,
      message: '저장된 검색 목록 조회 중 오류가 발생했습니다.'
    })
  }
}

// 검색 조건 저장
export const saveSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const { name, criteria }: { name: string; criteria: SearchCriteria } = req.body

    // 중복 이름 체크
    const [existing] = await pool.execute(
      'SELECT id FROM saved_searches WHERE file_id = ? AND user_id = ? AND name = ?',
      [fileId, userId, name]
    ) as any[]

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        message: '이미 존재하는 검색 이름입니다.'
      })
      return
    }

    // 검색 조건 저장
    const [result] = await pool.execute(
      'INSERT INTO saved_searches (name, file_id, user_id, criteria) VALUES (?, ?, ?, ?)',
      [name, fileId, userId, JSON.stringify(criteria)]
    ) as any

    const searchId = result.insertId

    // 저장된 검색 정보 조회
    const [searches] = await pool.execute(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(201).json({
      success: true,
      message: '검색 조건이 저장되었습니다.',
      data: {
        search: {
          ...searches[0],
          criteria: JSON.parse(searches[0].criteria)
        }
      }
    })
  } catch (error) {
    console.error('Save search error:', error)
    res.status(500).json({
      success: false,
      message: '검색 조건 저장 중 오류가 발생했습니다.'
    })
  }
}

// 저장된 검색으로 데이터 조회
export const executeSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // 저장된 검색 조건 조회
    const [searches] = await pool.execute(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '저장된 검색을 찾을 수 없습니다.'
      })
      return
    }

    const savedSearch = searches[0]
    const criteria: SearchCriteria = JSON.parse(savedSearch.criteria)

    // 검색 실행을 위해 request body 설정
    req.body = criteria

    // 기존 검색 함수 호출
    await searchExcelData(req, res)
  } catch (error) {
    console.error('Execute saved search error:', error)
    res.status(500).json({
      success: false,
      message: '저장된 검색 실행 중 오류가 발생했습니다.'
    })
  }
}

// 저장된 검색 수정
export const updateSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id
    const { name, criteria }: { name?: string; criteria?: SearchCriteria } = req.body

    // 저장된 검색 존재 여부 확인
    const [searches] = await pool.execute(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '저장된 검색을 찾을 수 없습니다.'
      })
      return
    }

    // 업데이트할 필드 구성
    const updateFields: string[] = []
    const updateValues: any[] = []

    if (name !== undefined) {
      updateFields.push('name = ?')
      updateValues.push(name)
    }

    if (criteria !== undefined) {
      updateFields.push('criteria = ?')
      updateValues.push(JSON.stringify(criteria))
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        message: '업데이트할 내용이 없습니다.'
      })
      return
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(searchId, fileId, userId)

    // 업데이트 실행
    await pool.execute(
      `UPDATE saved_searches SET ${updateFields.join(', ')} WHERE id = ? AND file_id = ? AND user_id = ?`,
      updateValues
    )

    // 업데이트된 검색 정보 조회
    const [updatedSearches] = await pool.execute(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: '저장된 검색이 수정되었습니다.',
      data: {
        search: {
          ...updatedSearches[0],
          criteria: JSON.parse(updatedSearches[0].criteria)
        }
      }
    })
  } catch (error) {
    console.error('Update saved search error:', error)
    res.status(500).json({
      success: false,
      message: '저장된 검색 수정 중 오류가 발생했습니다.'
    })
  }
}

// 저장된 검색 삭제
export const deleteSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // 저장된 검색 존재 여부 확인
    const [searches] = await pool.execute(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '저장된 검색을 찾을 수 없습니다.'
      })
      return
    }

    // 삭제 실행
    await pool.execute(
      'DELETE FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    )

    res.status(200).json({
      success: true,
      message: '저장된 검색이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('Delete saved search error:', error)
    res.status(500).json({
      success: false,
      message: '저장된 검색 삭제 중 오류가 발생했습니다.'
    })
  }
}

// 검색 히스토리 조회
export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const offset = (page - 1) * limit

    // 전체 개수 조회
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM search_history WHERE file_id = ? AND user_id = ?',
      [fileId, userId]
    ) as any[]

    const total = countResult[0].total

    // 검색 히스토리 조회
    const [history] = await pool.execute(
      `SELECT 
        id, search_term, filters, result_count, processing_time, created_at
       FROM search_history 
       WHERE file_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [fileId, userId, limit, offset]
    ) as any[]

    res.status(200).json({
      success: true,
      data: {
        history: history.map((item: any) => ({
          ...item,
          filters: item.filters ? JSON.parse(item.filters) : {}
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Get search history error:', error)
    res.status(500).json({
      success: false,
      message: '검색 히스토리 조회 중 오류가 발생했습니다.'
    })
  }
}

// 검색 히스토리 저장
export const saveSearchHistory = async (
  fileId: number,
  userId: number,
  searchTerm: string,
  filters: Record<string, any>,
  resultCount: number,
  processingTime: number
): Promise<void> => {
  try {
    await pool.execute(
      'INSERT INTO search_history (file_id, user_id, search_term, filters, result_count, processing_time) VALUES (?, ?, ?, ?, ?, ?)',
      [fileId, userId, searchTerm, JSON.stringify(filters), resultCount, processingTime]
    )
  } catch (error) {
    console.error('Save search history error:', error)
  }
}

// 유효성 검사 규칙
export const saveSearchValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('검색 이름은 1-100자 사이여야 합니다.'),
  body('criteria')
    .isObject()
    .withMessage('검색 조건은 객체여야 합니다.')
]

export const updateSearchValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('검색 이름은 1-100자 사이여야 합니다.'),
  body('criteria')
    .optional()
    .isObject()
    .withMessage('검색 조건은 객체여야 합니다.')
] 