import { Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getPool } from '../config/database'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { processExcelFile, getFileInfo, getColumns, getDataCount, buildSearchQuery } from '../utils/excelProcessor'
import { 
  setCache, 
  getCache, 
  generateDataCacheKey, 
  generateSummaryCacheKey, 
  generateSearchCacheKey,
  optimizePaginationResponse,
  clearFileCache
} from '../utils/cache'
import { 
  ExcelDataQuery, 
  ExcelDataResponse, 
  SearchCriteria, 
  SearchResponse, 
  ExcelSummary,
  UploadRequest
} from '../types/excel'

const pool = getPool()

// ?Œì¼ ?…ë¡œ???¤ì •
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('ì§€?í•˜ì§€ ?ŠëŠ” ?Œì¼ ?•ì‹?…ë‹ˆ??'))
    }
  }
})

// ?‘ì? ?Œì¼ ?…ë¡œ??API
export const uploadExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        res.status(400).json({
          success: false,
          message: err.message
        })
        return
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '?Œì¼???…ë¡œ?œë˜ì§€ ?Šì•˜?µë‹ˆ??'
        })
        return
      }

      const { description, tags, chunkSize = 1000, validateData = true }: UploadRequest = req.body
      const userId = req.user!.id

      // ?Œì¼ ?•ë³´ ?€??
      const [result] = await pool.query(
        `INSERT INTO excel_files (filename, original_name, file_path, file_size, file_type, uploaded_by, description, tags, is_processed) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [
          req.file.filename,
          req.file.originalname,
          req.file.path,
          req.file.size,
          req.file.mimetype,
          userId,
          description || null,
          tags ? JSON.stringify(tags) : null
        ]
      ) as any

      const fileId = result.insertId

      // ë¹„ë™ê¸°ë¡œ ?Œì¼ ì²˜ë¦¬ ?œì‘
      processExcelFile(req.file.path, fileId, userId, chunkSize, validateData)
        .then(job => {
          console.log(`File processing completed: ${fileId}`)
        })
        .catch(error => {
          console.error(`File processing failed: ${fileId}`, error)
        })

      res.status(201).json({
        success: true,
        message: '?Œì¼???…ë¡œ?œë˜?ˆìŠµ?ˆë‹¤. ì²˜ë¦¬ ì¤‘ì…?ˆë‹¤.',
        data: {
          fileId,
          filename: req.file.originalname,
          fileSize: req.file.size,
          status: 'processing'
        }
      })
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      message: '?Œì¼ ?…ë¡œ??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?…ë¡œ??ì§„í–‰ë¥?ì¡°íšŒ
export const getUploadProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    
    const [files] = await pool.query(
      'SELECT id, filename, original_name, is_processed, total_rows, total_columns, created_at FROM excel_files WHERE id = ?',
      [fileId]
    ) as any[]

    if (files.length === 0) {
      res.status(404).json({
        success: false,
        message: '?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    const file = files[0]
    
    // ì²˜ë¦¬??????ì¡°íšŒ
    const [dataCount] = await pool.query(
      'SELECT COUNT(*) as count FROM excel_data WHERE file_id = ?',
      [fileId]
    ) as any[]

    const processedRows = dataCount[0].count
    const progress = file.total_rows > 0 ? Math.round((processedRows / file.total_rows) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        fileId: file.id,
        filename: file.original_name,
        isProcessed: file.is_processed,
        totalRows: file.total_rows,
        processedRows,
        progress,
        totalColumns: file.total_columns,
        createdAt: file.created_at
      }
    })
  } catch (error) {
    console.error('Get progress error:', error)
    res.status(500).json({
      success: false,
      message: 'ì§„í–‰ë¥?ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?˜ì´ì§€?¤ì´?˜ëœ ?°ì´??ì¡°íšŒ API
export const getExcelData = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100) // ìµœë? 100ê°?
    const search = req.query.search as string
    const sortBy = req.query.sortBy as string
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc'
    const columns = req.query.columns ? (req.query.columns as string).split(',') : undefined

    const offset = (page - 1) * limit

    // ìºì‹œ ???ì„±
    const cacheKey = generateDataCacheKey(fileId, page, limit, sortBy, sortOrder)
    
    // ìºì‹œ ?•ì¸
    const cached = await getCache(cacheKey)
    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        fromCache: true
      })
      return
    }

    // ê²€??ì¡°ê±´ ?ì„±
    const { query, params } = buildSearchQuery(
      'SELECT * FROM excel_data WHERE file_id = ?',
      search,
      undefined,
      sortBy,
      sortOrder
    )

    // file_id ?Œë¼ë¯¸í„° ì¶”ê?
    const allParams = [fileId, ...params]

    // ?„ì²´ ê°œìˆ˜ ì¡°íšŒ
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const [countResult] = await pool.query(countQuery, allParams) as any[]
    const total = countResult[0].count

    // ?°ì´??ì¡°íšŒ
    const dataQuery = query + ' LIMIT ? OFFSET ?'
    const [data] = await pool.query(dataQuery, [...allParams, limit, offset]) as any[]

    // ì»¬ëŸ¼ ?•ë³´ ì¡°íšŒ
    const columnsInfo = await getColumns(fileId)

    // ?‘ë‹µ ?°ì´??êµ¬ì„±
    const response: ExcelDataResponse = {
      data: data.map(row => ({
        id: row.id,
        file_id: row.file_id,
        row_index: row.row_index,
        row_data: JSON.parse(row.row_data),
        is_valid: row.is_valid,
        validation_errors: row.validation_errors ? JSON.parse(row.validation_errors) : undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      columns: columnsInfo,
      summary: {
        totalRows: total,
        validRows: data.filter(row => row.is_valid).length,
        invalidRows: data.filter(row => !row.is_valid).length
      }
    }

    // ?‘ë‹µ ìµœì ??
    const optimizedResponse = optimizePaginationResponse(response, false)

    // ìºì‹œ ?€??
    await setCache(cacheKey, optimizedResponse, 'data')

    res.status(200).json({
      success: true,
      data: optimizedResponse
    })
  } catch (error) {
    console.error('Get data error:', error)
    res.status(500).json({
      success: false,
      message: '?°ì´??ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ê³ ê¸‰ ê²€??API
export const searchExcelData = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const {
      searchTerm,
      columnFilters,
      rangeFilters,
      booleanFilters,
      sortBy,
      sortOrder = 'asc',
      page = 1,
      limit = 50
    }: SearchCriteria = req.body

    const offset = (page - 1) * limit

    // ìºì‹œ ???ì„±
    const cacheKey = generateSearchCacheKey(fileId, searchTerm || '', {
      columnFilters,
      rangeFilters,
      booleanFilters,
      sortBy,
      sortOrder
    }, page, limit)

    // ìºì‹œ ?•ì¸ (?„ì‹œë¡?ë¹„í™œ?±í™”)
    // const cached = await getCache(cacheKey)
    // if (cached) {
    //   res.status(200).json({
    //     success: true,
    //     data: cached,
    //     fromCache: true
    //   })
    //   return
    // }

    const startTime = Date.now()

    // ê²€??ì¡°ê±´ êµ¬ì„±
    const filters = { ...columnFilters, ...booleanFilters }
    if (rangeFilters) {
      Object.entries(rangeFilters).forEach(([key, range]) => {
        filters[key] = range
      })
    }

    // ê²€??ì¿¼ë¦¬ ?ì„±
    const { query, params } = buildSearchQuery(
      'SELECT * FROM excel_data WHERE file_id = ?',
      searchTerm,
      filters,
      sortBy,
      sortOrder
    )

    // file_id ?Œë¼ë¯¸í„° ì¶”ê?
    const allParams = [fileId, ...params]

    console.log('=== ê²€???”ë²„ê¹?===');
    console.log('FileId:', fileId);
    console.log('SearchTerm:', searchTerm);
    console.log('Filters:', filters);
    console.log('Query:', query);
    console.log('Params:', allParams);

    // ?¤ì œ ?°ì´?°ë² ?´ìŠ¤???€ ê°’ë“¤ ?•ì¸
    const [teamValues] = await pool.query(
      'SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?¤ì¹˜?€")) as team FROM excel_data WHERE file_id = ? ORDER BY team',
      [fileId]
    ) as any[];
    console.log('?°ì´?°ë² ?´ìŠ¤???¤ì œ ?€ ê°’ë“¤:', teamValues.map((row: any) => row.team));

    // ? íƒ???€???€???¤ì œ ?°ì´??ê°œìˆ˜ ?•ì¸
    if (filters['?¤ì¹˜?€']) {
      const [selectedTeamCount] = await pool.query(
        'SELECT COUNT(*) as count FROM excel_data WHERE file_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?¤ì¹˜?€")) = ?',
        [fileId, filters['?¤ì¹˜?€']]
      ) as any[];
      console.log(`? íƒ???€ "${filters['?¤ì¹˜?€']}"???¤ì œ ?°ì´??ê°œìˆ˜:`, selectedTeamCount[0].count);
      
      // ? íƒ???€???˜í”Œ ?°ì´???•ì¸
      const [sampleData] = await pool.query(
        'SELECT id, row_index, JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?¤ì¹˜?€")) as team FROM excel_data WHERE file_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?¤ì¹˜?€")) = ? LIMIT 3',
        [fileId, filters['?¤ì¹˜?€']]
      ) as any[];
      console.log(`? íƒ???€ "${filters['?¤ì¹˜?€']}"???˜í”Œ ?°ì´??`, sampleData);
    }

    // ?„ì²´ ê°œìˆ˜ ì¡°íšŒ
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    console.log('Count Query:', countQuery);
    const [countResult] = await pool.query(countQuery, allParams) as any[]
    const total = countResult[0].count
    console.log('Total count:', total);

    // ?°ì´??ì¡°íšŒ
    const dataQuery = query + ' LIMIT ? OFFSET ?'
    const [data] = await pool.query(dataQuery, [...allParams, limit, offset]) as any[]

    const processingTime = Date.now() - startTime

    // ì»¬ëŸ¼ ?•ë³´ ì¡°íšŒ
    const columnsInfo = await getColumns(fileId)

    // ?‘ë‹µ ?°ì´??êµ¬ì„±
    const response: SearchResponse = {
      data: data.map(row => ({
        id: row.id,
        file_id: row.file_id,
        row_index: row.row_index,
        row_data: JSON.parse(row.row_data),
        is_valid: row.is_valid,
        validation_errors: row.validation_errors ? JSON.parse(row.validation_errors) : undefined,
        created_at: row.created_at,
        updated_at: row.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      columns: columnsInfo,
      searchInfo: {
        searchTerm,
        appliedFilters: { columnFilters, rangeFilters, booleanFilters },
        processingTime
      }
    }

    // ?‘ë‹µ ìµœì ??
    const optimizedResponse = optimizePaginationResponse(response, false)

    // ìºì‹œ ?€??(?„ì‹œë¡?ë¹„í™œ?±í™”)
    // await setCache(cacheKey, optimizedResponse, 'search')

    // ìºì‹œ ë°©ì? ?¤ë” ì¶”ê?
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(200).json({
      success: true,
      data: optimizedResponse
    })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({
      success: false,
      message: 'ê²€??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ì»¬ëŸ¼ë³??”ì•½ ?•ë³´ API
export const getExcelSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)

    // ìºì‹œ ???ì„±
    const cacheKey = generateSummaryCacheKey(fileId)

    // ìºì‹œ ?•ì¸
    const cached = await getCache(cacheKey)
    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        fromCache: true
      })
      return
    }

    // ?Œì¼ ?•ë³´ ì¡°íšŒ
    const fileInfo = await getFileInfo(fileId)
    const columns = await getColumns(fileId)

    // ì»¬ëŸ¼ë³??”ì•½ ?•ë³´ ?ì„±
    const columnSummaries = await Promise.all(
      columns.map(async (column) => {
        const [result] = await pool.query(
          `SELECT 
            COUNT(*) as total_values,
            COUNT(DISTINCT JSON_EXTRACT(row_data, '$.${column.column_name}')) as unique_values,
            COUNT(CASE WHEN JSON_EXTRACT(row_data, '$.${column.column_name}') IS NULL THEN 1 END) as null_values,
            MIN(JSON_EXTRACT(row_data, '$.${column.column_name}')) as min_value,
            MAX(JSON_EXTRACT(row_data, '$.${column.column_name}')) as max_value
           FROM excel_data 
           WHERE file_id = ?`,
          [fileId]
        ) as any[]

        const stats = result[0]

        // ?˜í”Œ ê°’ë“¤ ì¡°íšŒ
        const [samples] = await pool.query(
          `SELECT DISTINCT JSON_EXTRACT(row_data, '$.${column.column_name}') as value
           FROM excel_data 
           WHERE file_id = ? AND JSON_EXTRACT(row_data, '$.${column.column_name}') IS NOT NULL
           LIMIT 10`,
          [fileId]
        ) as any[]

        // ê°’ë³„ ê°œìˆ˜ ì¡°íšŒ (?ìœ„ 10ê°?
        const [valueCounts] = await pool.query(
          `SELECT 
            JSON_EXTRACT(row_data, '$.${column.column_name}') as value,
            COUNT(*) as count
           FROM excel_data 
           WHERE file_id = ? AND JSON_EXTRACT(row_data, '$.${column.column_name}') IS NOT NULL
           GROUP BY JSON_EXTRACT(row_data, '$.${column.column_name}')
           ORDER BY count DESC
           LIMIT 10`,
          [fileId]
        ) as any[]

        return {
          column_name: column.column_name,
          column_type: column.column_type,
          total_values: stats.total_values,
          unique_values: stats.unique_values,
          null_values: stats.null_values,
          min_value: stats.min_value,
          max_value: stats.max_value,
          sample_values: samples.map((s: any) => s.value),
          value_counts: valueCounts.map((vc: any) => ({
            value: vc.value,
            count: vc.count
          }))
        }
      })
    )

    const summary: ExcelSummary = {
      file_id: fileId,
      total_rows: fileInfo.total_rows,
      total_columns: fileInfo.total_columns,
      columns: columnSummaries,
      processing_time: 0,
      last_updated: new Date()
    }

    // ìºì‹œ ?€??
    await setCache(cacheKey, summary, 'summary')

    res.status(200).json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Get summary error:', error)
    res.status(500).json({
      success: false,
      message: '?”ì•½ ?•ë³´ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?Œì¼ ëª©ë¡ ì¡°íšŒ
export const getExcelFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string
    const userId = req.user!.id

    const offset = (page - 1) * limit

    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (search) {
      whereClause += ' AND (original_name LIKE ? OR description LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    // ?„ì²´ ê°œìˆ˜ ì¡°íšŒ
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM excel_files ${whereClause}`,
      params
    ) as any[]

    const total = countResult[0].total

    // ?Œì¼ ëª©ë¡ ì¡°íšŒ
    const [files] = await pool.query(
      `SELECT 
        id, filename, original_name, file_size, file_type, total_rows, total_columns,
        description, tags, is_processed, uploaded_by, created_at, updated_at
       FROM excel_files 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[]

    res.status(200).json({
      success: true,
      data: {
        files: files.map((file: any) => ({
          ...file,
          tags: file.tags ? JSON.parse(file.tags) : []
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
    console.error('Get files error:', error)
    res.status(500).json({
      success: false,
      message: '?Œì¼ ëª©ë¡ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?Œì¼ ?? œ
export const deleteExcelFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    // ?Œì¼ ?•ë³´ ì¡°íšŒ
    const [files] = await pool.query(
      'SELECT * FROM excel_files WHERE id = ? AND uploaded_by = ?',
      [fileId, userId]
    ) as any[]

    if (files.length === 0) {
      res.status(404).json({
        success: false,
        message: '?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    const file = files[0]

    // ?Œì¼ ?œìŠ¤?œì—???? œ
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path)
    }

    // ?°ì´?°ë² ?´ìŠ¤?ì„œ ?? œ (CASCADEë¡?ê´€???°ì´?°ë„ ?? œ??
    await pool.query('DELETE FROM excel_files WHERE id = ?', [fileId])

    // ìºì‹œ ?•ë¦¬
    await clearFileCache(fileId)

    res.status(200).json({
      success: true,
      message: '?Œì¼???? œ?˜ì—ˆ?µë‹ˆ??'
    })
  } catch (error) {
    console.error('Delete file error:', error)
    res.status(500).json({
      success: false,
      message: '?Œì¼ ?? œ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
} 

// ?€ ëª©ë¡ ì¡°íšŒ API
export const getTeamList = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const columnIndex = parseInt(req.query.columnIndex as string) || 8 // ê¸°ë³¸ê°? I??(9ë²ˆì§¸ ì»¬ëŸ¼)

    // ì»¬ëŸ¼ ?•ë³´ ì¡°íšŒ
    const [columns] = await pool.query(
      'SELECT * FROM excel_columns WHERE file_id = ? AND column_index = ?',
      [fileId, columnIndex]
    ) as any[]

    if (columns.length === 0) {
      res.status(404).json({
        success: false,
        message: '?´ë‹¹ ì»¬ëŸ¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    const columnName = columns[0].column_name

    // ?„ì²´ ?°ì´?°ì—???€ ëª©ë¡ ì¶”ì¶œ
    const [teams] = await pool.query(
      `SELECT DISTINCT JSON_EXTRACT(row_data, '$.${columnName}') as team_name
       FROM excel_data 
       WHERE file_id = ? 
       AND JSON_EXTRACT(row_data, '$.${columnName}') IS NOT NULL
       AND JSON_EXTRACT(row_data, '$.${columnName}') != ''
       ORDER BY team_name`,
      [fileId]
    ) as any[]

    const teamList = teams.map((team: any) => team.team_name)

    res.status(200).json({
      success: true,
      data: {
        teams: teamList,
        columnName: columnName,
        columnIndex: columnIndex
      }
    })
  } catch (error) {
    console.error('Get team list error:', error)
    res.status(500).json({
      success: false,
      message: '?€ ëª©ë¡ ì¡°íšŒ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
} 
