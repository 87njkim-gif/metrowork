import { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { SavedSearch, SearchCriteria } from '../types/excel'
import { searchExcelData } from './excelController'

const pool = getPool()

// ?€?¥ëœ ê²€??ëª©ë¡ ì¡°íšŒ
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
      message: '?€?¥ëœ ê²€??ëª©ë¡ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ê²€??ì¡°ê±´ ?€??
export const saveSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?…ë ¥ ?°ì´?°ê? ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const { name, criteria }: { name: string; criteria: SearchCriteria } = req.body

    // ì¤‘ë³µ ?´ë¦„ ì²´í¬
    const [existing] = await pool.query(
      'SELECT id FROM saved_searches WHERE file_id = ? AND user_id = ? AND name = ?',
      [fileId, userId, name]
    ) as any[]

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        message: '?´ë? ì¡´ì¬?˜ëŠ” ê²€???´ë¦„?…ë‹ˆ??'
      })
      return
    }

    // ê²€??ì¡°ê±´ ?€??
    const [result] = await pool.query(
      'INSERT INTO saved_searches (name, file_id, user_id, criteria) VALUES (?, ?, ?, ?)',
      [name, fileId, userId, JSON.stringify(criteria)]
    ) as any

    const searchId = result.insertId

    // ?€?¥ëœ ê²€???•ë³´ ì¡°íšŒ
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(201).json({
      success: true,
      message: 'ê²€??ì¡°ê±´???€?¥ë˜?ˆìŠµ?ˆë‹¤.',
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
      message: 'ê²€??ì¡°ê±´ ?€??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?€?¥ëœ ê²€?‰ìœ¼ë¡??°ì´??ì¡°íšŒ
export const executeSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // ?€?¥ëœ ê²€??ì¡°ê±´ ì¡°íšŒ
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '?€?¥ëœ ê²€?‰ì„ ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    const savedSearch = searches[0]
    const criteria: SearchCriteria = JSON.parse(savedSearch.criteria)

    // ê²€???¤í–‰???„í•´ request body ?¤ì •
    req.body = criteria

    // ê¸°ì¡´ ê²€???¨ìˆ˜ ?¸ì¶œ
    await searchExcelData(req, res)
  } catch (error) {
    console.error('Execute saved search error:', error)
    res.status(500).json({
      success: false,
      message: '?€?¥ëœ ê²€???¤í–‰ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?€?¥ëœ ê²€???˜ì •
export const updateSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '?…ë ¥ ?°ì´?°ê? ?¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤.',
        errors: errors.array()
      })
      return
    }

    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id
    const { name, criteria }: { name?: string; criteria?: SearchCriteria } = req.body

    // ?€?¥ëœ ê²€??ì¡´ì¬ ?¬ë? ?•ì¸
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '?€?¥ëœ ê²€?‰ì„ ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    // ?…ë°?´íŠ¸???„ë“œ êµ¬ì„±
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
        message: '?…ë°?´íŠ¸???´ìš©???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(searchId, fileId, userId)

    // ?…ë°?´íŠ¸ ?¤í–‰
    await pool.query(
      `UPDATE saved_searches SET ${updateFields.join(', ')} WHERE id = ? AND file_id = ? AND user_id = ?`,
      updateValues
    )

    // ?…ë°?´íŠ¸??ê²€???•ë³´ ì¡°íšŒ
    const [updatedSearches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ?',
      [searchId]
    ) as any[]

    res.status(200).json({
      success: true,
      message: '?€?¥ëœ ê²€?‰ì´ ?˜ì •?˜ì—ˆ?µë‹ˆ??',
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
      message: '?€?¥ëœ ê²€???˜ì • ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?€?¥ëœ ê²€???? œ
export const deleteSavedSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const searchId = parseInt(req.params.searchId)
    const userId = req.user!.id

    // ?€?¥ëœ ê²€??ì¡´ì¬ ?¬ë? ?•ì¸
    const [searches] = await pool.query(
      'SELECT * FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    ) as any[]

    if (searches.length === 0) {
      res.status(404).json({
        success: false,
        message: '?€?¥ëœ ê²€?‰ì„ ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    // ?? œ ?¤í–‰
    await pool.query(
      'DELETE FROM saved_searches WHERE id = ? AND file_id = ? AND user_id = ?',
      [searchId, fileId, userId]
    )

    res.status(200).json({
      success: true,
      message: '?€?¥ëœ ê²€?‰ì´ ?? œ?˜ì—ˆ?µë‹ˆ??'
    })
  } catch (error) {
    console.error('Delete saved search error:', error)
    res.status(500).json({
      success: false,
      message: '?€?¥ëœ ê²€???? œ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ê²€???ˆìŠ¤? ë¦¬ ì¡°íšŒ
export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    const offset = (page - 1) * limit

    // ?„ì²´ ê°œìˆ˜ ì¡°íšŒ
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM search_history WHERE file_id = ? AND user_id = ?',
      [fileId, userId]
    ) as any[]

    const total = countResult[0].total

    // ê²€???ˆìŠ¤? ë¦¬ ì¡°íšŒ
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
      message: 'ê²€???ˆìŠ¤? ë¦¬ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ê²€???ˆìŠ¤? ë¦¬ ?€??
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

// ? íš¨??ê²€??ê·œì¹™
export const saveSearchValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('ê²€???´ë¦„?€ 1-100???¬ì´?¬ì•¼ ?©ë‹ˆ??'),
  body('criteria')
    .isObject()
    .withMessage('ê²€??ì¡°ê±´?€ ê°ì²´?¬ì•¼ ?©ë‹ˆ??')
]

export const updateSearchValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('ê²€???´ë¦„?€ 1-100???¬ì´?¬ì•¼ ?©ë‹ˆ??'),
  body('criteria')
    .optional()
    .isObject()
    .withMessage('ê²€??ì¡°ê±´?€ ê°ì²´?¬ì•¼ ?©ë‹ˆ??')
] 
