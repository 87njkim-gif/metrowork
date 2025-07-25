import { Request, Response } from 'express'
import { validationResult } from 'express-validator'
import { getPool } from '../config/database'
import { processExcelFile, analyzeColumns, processExcelChunk } from '../utils/excelProcessor'
import { clearFileCache, getCache, setCache } from '../utils/cache'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pool = getPool()

// Multer 설정
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
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
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
      cb(new Error('지원하지 않는 파일 형식입니다.'))
    }
  }
})

// 엑셀 파일 업로드
export const uploadExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err)
        res.status(400).json({
          success: false,
          message: err.message || '파일 업로드 중 오류가 발생했습니다.'
        })
        return
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '파일이 선택되지 않았습니다.'
        })
        return
      }

      const userId = req.user!.id
      const file = req.file
      const { description, tags } = req.body

      // 파일 정보 저장
      const result = await pool.query(
        `INSERT INTO excel_files 
         (filename, original_name, file_path, file_size, file_type, description, tags, uploaded_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          description || '',
          tags ? JSON.stringify(tags.split(',').map((tag: string) => tag.trim())) : '[]',
          userId
        ]
      )

      const fileId = result.rows[0].id

      // 파일을 즉시 메모리로 읽어서 처리
      try {
        const buffer = fs.readFileSync(file.path)
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        if (jsonData.length === 0) {
          throw new Error('빈 파일입니다')
        }
        
        const headers = jsonData[0] as string[]
        const dataRows = jsonData.slice(1) as any[][]
        
        // 컬럼 정보 분석 및 저장
        const columns = analyzeColumns(headers, dataRows.slice(0, 100))
        
        for (const column of columns) {
          column.file_id = fileId
          await pool.query(
            `INSERT INTO excel_columns (file_id, column_index, column_name, column_type, is_required, is_searchable, is_sortable, display_name, description) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [column.file_id, column.column_index, column.column_name, column.column_type, column.is_required, column.is_searchable, column.is_sortable, column.display_name, column.description]
          )
        }
        
        // 데이터 처리
        let totalProcessed = 0
        let totalErrors = 0
        const chunkSize = 1000
        
        for (let i = 0; i < dataRows.length; i += chunkSize) {
          const chunk = dataRows.slice(i, i + chunkSize)
          const result = await processExcelChunk(fileId, chunk, columns, i + 1, chunkSize)
          
          totalProcessed += result.processed
          totalErrors += result.errors
        }
        
        // 파일 처리 완료 상태 업데이트
        await pool.query(
          'UPDATE excel_files SET is_processed = TRUE, total_rows = $1, total_columns = $2 WHERE id = $3',
          [dataRows.length, columns.length, fileId]
        )
        
        // 캐시 정리
        await clearFileCache(fileId)
        
      } catch (error) {
        console.error('File processing error:', error)
        // 처리 실패 시 상태 업데이트
        await pool.query(
          'UPDATE excel_files SET is_processed = FALSE, processing_status = $1 WHERE id = $2',
          ['failed', fileId]
        )
      }

      res.status(201).json({
        success: true,
        message: '파일이 성공적으로 업로드되었습니다.',
        data: {
          fileId,
          filename: file.originalname,
          size: file.size
        }
      })
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      message: '파일 업로드 중 오류가 발생했습니다.'
    })
  }
}

// 업로드 진행률 조회
export const getUploadProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    const result = await pool.query(
      'SELECT is_processed, processing_status FROM excel_files WHERE id = $1 AND uploaded_by = $2',
      [fileId, userId]
    )

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      })
      return
    }

    const file = result.rows[0]
    res.status(200).json({
      success: true,
      data: {
        isProcessed: file.is_processed,
        status: file.processing_status || 'pending'
      }
    })
  } catch (error) {
    console.error('Get progress error:', error)
    res.status(500).json({
      success: false,
      message: '진행률 조회 중 오류가 발생했습니다.'
    })
  }
}

// 엑셀 데이터 조회
export const getExcelData = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const { page = 1, limit = 50, search = '', sortBy = 'id', sortOrder = 'asc' } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    // 파일 존재 확인
    const fileResult = await pool.query(
      'SELECT * FROM excel_files WHERE id = $1',
      [fileId]
    )

    if (fileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      })
      return
    }

    const file = fileResult.rows[0]

    if (!file.is_processed) {
      res.status(400).json({
        success: false,
        message: '파일이 아직 처리되지 않았습니다.'
      })
      return
    }

    // 캐시 확인
    const cacheKey = `excel_data_${fileId}_${page}_${limit}_${search}_${sortBy}_${sortOrder}`
    const cachedData = await getCache(cacheKey)
    
    if (cachedData) {
      res.status(200).json(cachedData)
      return
    }

    // 데이터 조회
    let whereClause = 'WHERE file_id = $1'
    let params = [fileId]
    let paramIndex = 2

    if (search) {
      whereClause += ` AND (row_data::text ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // 전체 개수 조회
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM excel_data ${whereClause}`,
      params
    )

    const total = countResult.rows[0].total

    // 데이터 목록 조회
    const dataResult = await pool.query(
      `SELECT * FROM excel_data 
       ${whereClause}
       ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    const data = dataResult.rows.map((row: any) => ({
      ...row,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    }))

    // 컬럼 정보 조회
    const columnsResult = await pool.query(
      'SELECT column_name, column_type FROM excel_columns WHERE file_id = $1 ORDER BY column_index',
      [fileId]
    )

    const response = {
      success: true,
      data: {
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        },
        columns: columnsResult.rows,
        summary: {
          totalRows: total,
          totalColumns: columnsResult.rows.length
        }
      }
    }

    // 캐시 저장
    await setCache(cacheKey, response, 'data')

    res.status(200).json(response)
  } catch (error) {
    console.error('Get data error:', error)
    res.status(500).json({
      success: false,
      message: '데이터 조회 중 오류가 발생했습니다.'
    })
  }
}

// 엑셀 데이터 검색
export const searchExcelData = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id
    const { page = 1, limit = 50 } = req.query
    const { criteria = {} } = req.body

    const offset = (Number(page) - 1) * Number(limit)

    // 파일 존재 확인
    const fileResult = await pool.query(
      'SELECT * FROM excel_files WHERE id = $1',
      [fileId]
    )

    if (fileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      })
      return
    }

    const file = fileResult.rows[0]

    if (!file.is_processed) {
      res.status(400).json({
        success: false,
        message: '파일이 아직 처리되지 않았습니다.'
      })
      return
    }

    // 검색 조건 구성
    let whereClause = 'WHERE file_id = $1'
    let params = [fileId]
    let paramIndex = 2

    if (criteria && criteria.search) {
      whereClause += ` AND (row_data::text ILIKE $${paramIndex})`
      params.push(`%${criteria.search}%`)
      paramIndex++
    }

    if (criteria && criteria.filters && criteria.filters.length > 0) {
      criteria.filters.forEach((filter: any) => {
        whereClause += ` AND (row_data->>'${filter.column}')::${filter.type} ${filter.operator} $${paramIndex}`
        params.push(filter.value)
        paramIndex++
      })
    }

    // 전체 개수 조회
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM excel_data ${whereClause}`,
      params
    )

    const total = countResult.rows[0].total

    // 데이터 목록 조회
    const dataResult = await pool.query(
      `SELECT * FROM excel_data 
       ${whereClause}
       ORDER BY id ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    const data = dataResult.rows.map((row: any) => ({
      ...row,
      data: typeof row.row_data === 'string' ? JSON.parse(row.row_data) : row.row_data
    }))

    res.status(200).json({
      success: true,
      data: {
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        },
        searchInfo: {
          criteria,
          totalResults: total
        }
      }
    })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({
      success: false,
      message: '검색 중 오류가 발생했습니다.'
    })
  }
}

// 엑셀 요약 정보 조회
export const getExcelSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    // 파일 존재 확인
    const fileResult = await pool.query(
      'SELECT * FROM excel_files WHERE id = $1',
      [fileId]
    )

    if (fileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      })
      return
    }

    const file = fileResult.rows[0]

    if (!file.is_processed) {
      res.status(400).json({
        success: false,
        message: '파일이 아직 처리되지 않았습니다.'
      })
      return
    }

    // 캐시 확인
    const cacheKey = `excel_summary_${fileId}`
    const cachedData = await getCache(cacheKey)
    
    if (cachedData) {
      res.status(200).json(cachedData)
      return
    }

    // 컬럼 정보 조회
    const columnsResult = await pool.query(
      'SELECT column_name, column_type, column_index FROM excel_columns WHERE file_id = $1 ORDER BY column_index',
      [fileId]
    )

    // 데이터 통계 조회
    const statsResult = await pool.query(
      'SELECT COUNT(*) as total_rows FROM excel_data WHERE file_id = $1',
      [fileId]
    )

    const response = {
      success: true,
      data: {
        file: {
          id: file.id,
          filename: file.original_name,
          size: file.file_size,
          type: file.file_type,
          totalRows: statsResult.rows[0].total_rows,
          totalColumns: columnsResult.rows.length,
          uploadedAt: file.created_at
        },
        columns: columnsResult.rows
      }
    }

    // 캐시 저장
    await setCache(cacheKey, response, 'summary')

    res.status(200).json(response)
  } catch (error) {
    console.error('Get summary error:', error)
    res.status(500).json({
      success: false,
      message: '요약 정보 조회 중 오류가 발생했습니다.'
    })
  }
}

// 엑셀 파일 목록 조회
export const getExcelFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const { page = 1, limit = 10, search = '' } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    let whereClause = 'WHERE uploaded_by = $1'
    let params = [userId]

    if (search) {
      whereClause += ' AND (original_name ILIKE $2 OR description ILIKE $2)'
      params.push(`%${search}%`)
    }

    // 전체 개수 조회
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM excel_files ${whereClause}`,
      params
    )

    const total = countResult.rows[0].total

    // 파일 목록 조회
    const filesResult = await pool.query(
      `SELECT 
        id, filename, original_name, file_size, file_type, total_rows, total_columns,
        description, tags, is_processed, uploaded_by, created_at, updated_at
       FROM excel_files 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    )
    const files = filesResult.rows

    res.status(200).json({
      success: true,
      data: {
        files: files.map((file: any) => ({
          ...file,
          tags: file.tags ? (typeof file.tags === 'string' ? JSON.parse(file.tags) : file.tags) : []
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
      message: '파일 목록 조회 중 오류가 발생했습니다.'
    })
  }
}

// 파일 삭제
export const deleteExcelFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const userId = req.user!.id

    // 파일 정보 조회
    const fileResult = await pool.query(
      'SELECT * FROM excel_files WHERE id = $1 AND uploaded_by = $2',
      [fileId, userId]
    )

    if (fileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      })
      return
    }

    const file = fileResult.rows[0]

    // 파일 시스템에서 삭제
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path)
    }

    // 데이터베이스에서 삭제 (CASCADE로 관련 데이터도 삭제됨)
    await pool.query('DELETE FROM excel_files WHERE id = $1', [fileId])

    // 캐시 정리
    await clearFileCache(fileId)

    res.status(200).json({
      success: true,
      message: '파일이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('Delete file error:', error)
    res.status(500).json({
      success: false,
      message: '파일 삭제 중 오류가 발생했습니다.'
    })
  }
}

// 팀 목록 조회 API
export const getTeamList = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = parseInt(req.params.fileId)
    const { columnIndex = 0 } = req.query
    const userId = req.user!.id

    // 파일 존재 확인
    const fileResult = await pool.query(
      'SELECT * FROM excel_files WHERE id = $1',
      [fileId]
    )

    if (fileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '파일을 찾을 수 없습니다.'
      })
      return
    }

    // 컬럼 정보 조회
    const columnResult = await pool.query(
      'SELECT column_name FROM excel_columns WHERE file_id = $1 AND column_index = $2',
      [fileId, columnIndex]
    )

    if (columnResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '컬럼을 찾을 수 없습니다.'
      })
      return
    }

    const columnName = columnResult.rows[0].column_name

    // 팀 목록 조회 (중복 제거)
    const teamsResult = await pool.query(
      `SELECT DISTINCT row_data->>'${columnName}' as team_name 
       FROM excel_data 
       WHERE file_id = $1 
       AND row_data->>'${columnName}' IS NOT NULL 
       AND row_data->>'${columnName}' != ''
       ORDER BY team_name`,
      [fileId]
    )

    const teams = teamsResult.rows.map((row: any) => row.team_name)

    res.status(200).json({
      success: true,
      data: {
        teams,
        columnName,
        columnIndex: Number(columnIndex)
      }
    })
  } catch (error) {
    console.error('Get team list error:', error)
    res.status(500).json({
      success: false,
      message: '팀 목록 조회 중 오류가 발생했습니다.'
    })
  }
} 
