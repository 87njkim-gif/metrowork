import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { SavedSearch, SearchCriteria } from '../types/excel'
import { searchExcelData } from './excelController'

const pool = getPool()

// ?�?�된 검??목록 조회
export const getSavedSearches = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    const [searches] = await pool.query(
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
      message: '?�?�된 검??목록 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// 검??조건 ?�??
export const saveSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?�력 ?�이?��? ?�바르�? ?�습?�다.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const { name, criteria }: { name: string; criteria: SearchCriteria } = req.body

    // 중복 ?�름 체크
    const [existing] = await pool.query(
      'SELECT id FROM saved_searches WHERE file_id = ? AND user_id = ? AND name = ?',
      [fileId, userId, name]
    ) as any[]

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        message: '?��? 존재?�는 검???�름?�니??'
      })
      return
    }

    // 검??조건 ?�??
    const [result] = await pool.query(
      'INSERT INTO saved_searches (name, file_id, user_id, criteria) VALUES (?, ?, ?, ?)',
      [name, fileId, userId, JSON.stringify(criteria)]
    ) as any

    const searchId = result.insertId

    // ?�?�된 검???�보 조회
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(201).json({
      success: true,
      message: '검??조건???�?�되?�습?�다.',
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
      message: '검??조건 ?�??�??�류가 발생?�습?�다.'
    })
  }
}

// ?�?�된 검?�으�??�이??조회
export const executeSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // ?�?�된 검??조건 조회
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�?�된 검?�을 찾을 ???�습?�다.'
      })
      return
    }

    const savedSearch = searches[0]
    const criteria: SearchCriteria = JSON.parse(savedSearch.criteria)

    // 검???�행???�해 request body ?�정
    req.body = criteria

    // 기존 검???�수 ?�출
    await searchExcelData(req, res)
  } catch (error) {
    console.error('Execute saved search error:', error)
    res.status(500).json({
      success: false,
      message: '?�?�된 검???�행 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�?�된 검???�정
export const updateSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?�력 ?�이?��? ?�바르�? ?�습?�다.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id
    const { name, criteria }: { name?: string; criteria?: SearchCriteria } = req.body

    // ?�?�된 검??존재 ?��? ?�인
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�?�된 검?�을 찾을 ???�습?�다.'
      })
      return
    }

    // ?�데?�트???�드 구성
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
        message: '?�데?�트???�용???�습?�다.'
      })
      return
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(searchId, fileId, userId)

    // ?�데?�트 ?�행
    await pool.query(
      `UPDATE saved_searches SET ${updateFields.join(', ')} WHERE id = ? AND file_id = ? AND user_id = ?`,
      updateValues
    )

    // ?�데?�트??검???�보 조회
    const [updatedSearches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: '?�?�된 검?�이 ?�정?�었?�니??',
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
      message: '?�?�된 검???�정 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�?�된 검????��
export const deleteSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // ?�?�된 검??존재 ?��? ?�인
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�?�된 검?�을 찾을 ???�습?�다.'
      })
      return
    }

    // ??�� ?�행
    await pool.query(
      'DELETE FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    )

    res.status(200).json({
      success: true,
      message: '?�?�된 검?�이 ??��?�었?�니??'
    })
  } catch (error) {
    console.error('Delete saved search error:', error)
    res.status(500).json({
      success: false,
      message: '?�?�된 검????�� �??�류가 발생?�습?�다.'
    })
  }
}

// 검???�스?�리 조회
export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const offset = (page - 1) * limit

    // ?�체 개수 조회
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM search_history WHERE file_id = ? AND user_id = ?',
      [fileId, userId]
    ) as any[]

    const total = countResult[0].total

    // 검???�스?�리 조회
    const [history] = await pool.query(
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
      message: '검???�스?�리 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// 검???�스?�리 ?�??
export const saveSearchHistory = async (
  fileId: number,
  userId: number,
  searchTerm: string,
  filters: Record<string, any>,
  resultCount: number,
  processingTime: number
): Promise<void> => {
  try {
    await pool.query(
      'INSERT INTO search_history (file_id, user_id, search_term, filters, result_count, processing_time) VALUES (?, ?, ?, ?, ?, ?)',
      [fileId, userId, searchTerm, JSON.stringify(filters), resultCount, processingTime]
    )
  } catch (error) {
    console.error('Save search history error:', error)
  }
}

// ?�효??검??규칙
export const saveSearchValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('검???�름?� 1-100???�이?�야 ?�니??'),
  body('criteria')
    .isObject()
    .withMessage('검??조건?� 객체?�야 ?�니??')
]

export const updateSearchValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('검???�름?� 1-100???�이?�야 ?�니??'),
  body('criteria')
    .optional()
    .isObject()
    .withMessage('검??조건?� 객체?�야 ?�니??')
] 
