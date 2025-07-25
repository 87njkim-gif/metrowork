import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { SavedSearch, SearchCriteria } from '../types/excel'
import { searchExcelData } from './excelController'

const pool = getPool()

// ??₯λ κ²??λͺ©λ‘ μ‘°ν
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
      message: '??₯λ κ²??λͺ©λ‘ μ‘°ν μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// κ²??μ‘°κ±΄ ???
export const saveSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?λ ₯ ?°μ΄?°κ? ?¬λ°λ₯΄μ? ?μ΅?λ€.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const { name, criteria }: { name: string; criteria: SearchCriteria } = req.body

    // μ€λ³΅ ?΄λ¦ μ²΄ν¬
    const [existing] = await pool.query(
      'SELECT id FROM saved_searches WHERE file_id = ? AND user_id = ? AND name = ?',
      [fileId, userId, name]
    ) as any[]

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        message: '?΄λ? μ‘΄μ¬?λ κ²???΄λ¦?λ??'
      })
      return
    }

    // κ²??μ‘°κ±΄ ???
    const [result] = await pool.query(
      'INSERT INTO saved_searches (name, file_id, user_id, criteria) VALUES (?, ?, ?, ?)',
      [name, fileId, userId, JSON.stringify(criteria)]
    ) as any

    const searchId = result.insertId

    // ??₯λ κ²???λ³΄ μ‘°ν
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(201).json({
      success: true,
      message: 'κ²??μ‘°κ±΄????₯λ?μ΅?λ€.',
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
      message: 'κ²??μ‘°κ±΄ ???μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ??₯λ κ²?μΌλ‘??°μ΄??μ‘°ν
export const executeSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // ??₯λ κ²??μ‘°κ±΄ μ‘°ν
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '??₯λ κ²?μ μ°Ύμ ???μ΅?λ€.'
      })
      return
    }

    const savedSearch = searches[0]
    const criteria: SearchCriteria = JSON.parse(savedSearch.criteria)

    // κ²???€ν???ν΄ request body ?€μ 
    req.body = criteria

    // κΈ°μ‘΄ κ²???¨μ ?ΈμΆ
    await searchExcelData(req, res)
  } catch (error) {
    console.error('Execute saved search error:', error)
    res.status(500).json({
      success: false,
      message: '??₯λ κ²???€ν μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ??₯λ κ²???μ 
export const updateSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?λ ₯ ?°μ΄?°κ? ?¬λ°λ₯΄μ? ?μ΅?λ€.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id
    const { name, criteria }: { name?: string; criteria?: SearchCriteria } = req.body

    // ??₯λ κ²??μ‘΄μ¬ ?¬λ? ?μΈ
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '??₯λ κ²?μ μ°Ύμ ???μ΅?λ€.'
      })
      return
    }

    // ?λ°?΄νΈ???λ κ΅¬μ±
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
        message: '?λ°?΄νΈ???΄μ©???μ΅?λ€.'
      })
      return
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(searchId, fileId, userId)

    // ?λ°?΄νΈ ?€ν
    await pool.query(
      `UPDATE saved_searches SET ${updateFields.join(', ')} WHERE id = ? AND file_id = ? AND user_id = ?`,
      updateValues
    )

    // ?λ°?΄νΈ??κ²???λ³΄ μ‘°ν
    const [updatedSearches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: '??₯λ κ²?μ΄ ?μ ?μ?΅λ??',
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
      message: '??₯λ κ²???μ  μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// ??₯λ κ²???? 
export const deleteSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // ??₯λ κ²??μ‘΄μ¬ ?¬λ? ?μΈ
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '??₯λ κ²?μ μ°Ύμ ???μ΅?λ€.'
      })
      return
    }

    // ??  ?€ν
    await pool.query(
      'DELETE FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    )

    res.status(200).json({
      success: true,
      message: '??₯λ κ²?μ΄ ?? ?μ?΅λ??'
    })
  } catch (error) {
    console.error('Delete saved search error:', error)
    res.status(500).json({
      success: false,
      message: '??₯λ κ²????  μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// κ²???μ€? λ¦¬ μ‘°ν
export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const offset = (page - 1) * limit

    // ?μ²΄ κ°μ μ‘°ν
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM search_history WHERE file_id = ? AND user_id = ?',
      [fileId, userId]
    ) as any[]

    const total = countResult[0].total

    // κ²???μ€? λ¦¬ μ‘°ν
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
      message: 'κ²???μ€? λ¦¬ μ‘°ν μ€??€λ₯κ° λ°μ?μ΅?λ€.'
    })
  }
}

// κ²???μ€? λ¦¬ ???
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

// ? ν¨??κ²??κ·μΉ
export const saveSearchValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('κ²???΄λ¦? 1-100???¬μ΄?¬μΌ ?©λ??'),
  body('criteria')
    .isObject()
    .withMessage('κ²??μ‘°κ±΄? κ°μ²΄?¬μΌ ?©λ??')
]

export const updateSearchValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('κ²???΄λ¦? 1-100???¬μ΄?¬μΌ ?©λ??'),
  body('criteria')
    .optional()
    .isObject()
    .withMessage('κ²??μ‘°κ±΄? κ°μ²΄?¬μΌ ?©λ??')
] 
