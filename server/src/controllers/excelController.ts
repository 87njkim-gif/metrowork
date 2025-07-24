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

// ?�일 ?�로???�정
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
      cb(new Error('지?�하지 ?�는 ?�일 ?�식?�니??'))
    }
  }
})

// ?��? ?�일 ?�로??API
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
          message: '?�일???�로?�되지 ?�았?�니??'
        })
        return
      }

      const { description, tags, chunkSize = 1000, validateData = true }: UploadRequest = req.body
      const userId = req.user!.id

      // ?�일 ?�보 ?�??
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

      // 비동기로 ?�일 처리 ?�작
      processExcelFile(req.file.path, fileId, userId, chunkSize, validateData)
        .then(job => {
          console.log(`File processing completed: ${fileId}`)
        })
        .catch(error => {
          console.error(`File processing failed: ${fileId}`, error)
        })

      res.status(201).json({
        success: true,
        message: '?�일???�로?�되?�습?�다. 처리 중입?�다.',
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
      message: '?�일 ?�로??�??�류가 발생?�습?�다.'
    })
  }
}

// ?�로??진행�?조회
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
        message: '?�일??찾을 ???�습?�다.'
      })
      return
    }

    const file = files[0]
    
    // 처리??????조회
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
      message: '진행�?조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�이지?�이?�된 ?�이??조회 API
export const getExcelData = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100) // 최�? 100�?
    const search = req.query.search as string
    const sortBy = req.query.sortBy as string
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc'
    const columns = req.query.columns ? (req.query.columns as string).split(',') : undefined

    const offset = (page - 1) * limit

    // 캐시 ???�성
    const cacheKey = generateDataCacheKey(fileId, page, limit, sortBy, sortOrder)
    
    // 캐시 ?�인
    const cached = await getCache(cacheKey)
    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        fromCache: true
      })
      return
    }

    // 검??조건 ?�성
    const { query, params } = buildSearchQuery(
      'SELECT * FROM excel_data WHERE file_id = ?',
      search,
      undefined,
      sortBy,
      sortOrder
    )

    // file_id ?�라미터 추�?
    const allParams = [fileId, ...params]

    // ?�체 개수 조회
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const [countResult] = await pool.query(countQuery, allParams) as any[]
    const total = countResult[0].count

    // ?�이??조회
    const dataQuery = query + ' LIMIT ? OFFSET ?'
    const [data] = await pool.query(dataQuery, [...allParams, limit, offset]) as any[]

    // 컬럼 ?�보 조회
    const columnsInfo = await getColumns(fileId)

    // ?�답 ?�이??구성
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

    // ?�답 최적??
    const optimizedResponse = optimizePaginationResponse(response, false)

    // 캐시 ?�??
    await setCache(cacheKey, optimizedResponse, 'data')

    res.status(200).json({
      success: true,
      data: optimizedResponse
    })
  } catch (error) {
    console.error('Get data error:', error)
    res.status(500).json({
      success: false,
      message: '?�이??조회 �??�류가 발생?�습?�다.'
    })
  }
}

// 고급 검??API
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

    // 캐시 ???�성
    const cacheKey = generateSearchCacheKey(fileId, searchTerm || '', {
      columnFilters,
      rangeFilters,
      booleanFilters,
      sortBy,
      sortOrder
    }, page, limit)

    // 캐시 ?�인 (?�시�?비활?�화)
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

    // 검??조건 구성
    const filters = { ...columnFilters, ...booleanFilters }
    if (rangeFilters) {
      Object.entries(rangeFilters).forEach(([key, range]) => {
        filters[key] = range
      })
    }

    // 검??쿼리 ?�성
    const { query, params } = buildSearchQuery(
      'SELECT * FROM excel_data WHERE file_id = ?',
      searchTerm,
      filters,
      sortBy,
      sortOrder
    )

    // file_id ?�라미터 추�?
    const allParams = [fileId, ...params]

    console.log('=== 검???�버�?===');
    console.log('FileId:', fileId);
    console.log('SearchTerm:', searchTerm);
    console.log('Filters:', filters);
    console.log('Query:', query);
    console.log('Params:', allParams);

    // ?�제 ?�이?�베?�스???� 값들 ?�인
    const [teamValues] = await pool.query(
      'SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?�치?�")) as team FROM excel_data WHERE file_id = ? ORDER BY team',
      [fileId]
    ) as any[];
    console.log('?�이?�베?�스???�제 ?� 값들:', teamValues.map((row: any) => row.team));

    // ?�택???�???�???�제 ?�이??개수 ?�인
    if (filters['?�치?�']) {
      const [selectedTeamCount] = await pool.query(
        'SELECT COUNT(*) as count FROM excel_data WHERE file_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?�치?�")) = ?',
        [fileId, filters['?�치?�']]
      ) as any[];
      console.log(`?�택???� "${filters['?�치?�']}"???�제 ?�이??개수:`, selectedTeamCount[0].count);
      
      // ?�택???�???�플 ?�이???�인
      const [sampleData] = await pool.query(
        'SELECT id, row_index, JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?�치?�")) as team FROM excel_data WHERE file_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(row_data, "$.?�치?�")) = ? LIMIT 3',
        [fileId, filters['?�치?�']]
      ) as any[];
      console.log(`?�택???� "${filters['?�치?�']}"???�플 ?�이??`, sampleData);
    }

    // ?�체 개수 조회
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    console.log('Count Query:', countQuery);
    const [countResult] = await pool.query(countQuery, allParams) as any[]
    const total = countResult[0].count
    console.log('Total count:', total);

    // ?�이??조회
    const dataQuery = query + ' LIMIT ? OFFSET ?'
    const [data] = await pool.query(dataQuery, [...allParams, limit, offset]) as any[]

    const processingTime = Date.now() - startTime

    // 컬럼 ?�보 조회
    const columnsInfo = await getColumns(fileId)

    // ?�답 ?�이??구성
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

    // ?�답 최적??
    const optimizedResponse = optimizePaginationResponse(response, false)

    // 캐시 ?�??(?�시�?비활?�화)
    // await setCache(cacheKey, optimizedResponse, 'search')

    // 캐시 방�? ?�더 추�?
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
      message: '검??�??�류가 발생?�습?�다.'
    })
  }
}

// 컬럼�??�약 ?�보 API
export const getExcelSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)

    // 캐시 ???�성
    const cacheKey = generateSummaryCacheKey(fileId)

    // 캐시 ?�인
    const cached = await getCache(cacheKey)
    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        fromCache: true
      })
      return
    }

    // ?�일 ?�보 조회
    const fileInfo = await getFileInfo(fileId)
    const columns = await getColumns(fileId)

    // 컬럼�??�약 ?�보 ?�성
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

        // ?�플 값들 조회
        const [samples] = await pool.query(
          `SELECT DISTINCT JSON_EXTRACT(row_data, '$.${column.column_name}') as value
           FROM excel_data 
           WHERE file_id = ? AND JSON_EXTRACT(row_data, '$.${column.column_name}') IS NOT NULL
           LIMIT 10`,
          [fileId]
        ) as any[]

        // 값별 개수 조회 (?�위 10�?
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

    // 캐시 ?�??
    await setCache(cacheKey, summary, 'summary')

    res.status(200).json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Get summary error:', error)
    res.status(500).json({
      success: false,
      message: '?�약 ?�보 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�일 목록 조회
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

    // ?�체 개수 조회
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM excel_files ${whereClause}`,
      params
    ) as any[]

    const total = countResult[0].total

    // ?�일 목록 조회
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
      message: '?�일 목록 조회 �??�류가 발생?�습?�다.'
    })
  }
}

// ?�일 ??��
export const deleteExcelFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    // ?�일 ?�보 조회
    const [files] = await pool.query(
      'SELECT * FROM excel_files WHERE id = ? AND uploaded_by = ?',
      [fileId, userId]
    ) as any[]

    if (files.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�일??찾을 ???�습?�다.'
      })
      return
    }

    const file = files[0]

    // ?�일 ?�스?�에????��
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path)
    }

    // ?�이?�베?�스?�서 ??�� (CASCADE�?관???�이?�도 ??��??
    await pool.query('DELETE FROM excel_files WHERE id = ?', [fileId])

    // 캐시 ?�리
    await clearFileCache(fileId)

    res.status(200).json({
      success: true,
      message: '?�일????��?�었?�니??'
    })
  } catch (error) {
    console.error('Delete file error:', error)
    res.status(500).json({
      success: false,
      message: '?�일 ??�� �??�류가 발생?�습?�다.'
    })
  }
} 

// ?� 목록 조회 API
export const getTeamList = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const columnIndex = parseInt(req.query.columnIndex as string) || 8 // 기본�? I??(9번째 컬럼)

    // 컬럼 ?�보 조회
    const [columns] = await pool.query(
      'SELECT * FROM excel_columns WHERE file_id = ? AND column_index = ?',
      [fileId, columnIndex]
    ) as any[]

    if (columns.length === 0) {
      res.status(404).json({
        success: false,
        message: '?�당 컬럼??찾을 ???�습?�다.'
      })
      return
    }

    const columnName = columns[0].column_name

    // ?�체 ?�이?�에???� 목록 추출
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
      message: '?� 목록 조회 �??�류가 발생?�습?�다.'
    })
  }
} 
