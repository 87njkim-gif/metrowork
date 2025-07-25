import * as XLSX from 'xlsx'
import { getPool } from '../config/database'
import { ExcelColumn, ExcelData, ProcessingJob } from '../types/excel'
import { clearFileCache } from './cache'
import path from 'path'
import fs from 'fs'

const pool = getPool()

// ?�이???�??감�?
export const detectDataType = (value: any): 'string' | 'number' | 'date' | 'boolean' | 'json' => {
  if (value === null || value === undefined) return 'string'
  
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  
  if (typeof value === 'string') {
    // ?�짜 ?�식 체크
    const dateRegex = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/
    if (dateRegex.test(value)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) return 'date'
    }
    
    // JSON ?�식 체크
    try {
      JSON.parse(value)
      return 'json'
    } catch {
      return 'string'
    }
  }
  
  return 'string'
}

// 컬럼 ?�보 분석
export const analyzeColumns = (headers: string[], sampleData: any[][]): ExcelColumn[] => {
  return headers.map((header, index) => {
    // ?�플 ?�이?�에???�당 컬럼??값들 ?�집
    const columnValues = sampleData.map(row => row[index]).filter(val => val !== null && val !== undefined)
    
    // ?�이???�??감�?
    let columnType: 'string' | 'number' | 'date' | 'boolean' | 'json' = 'string'
    if (columnValues.length > 0) {
      const typeCounts = columnValues.map(val => detectDataType(val))
      const mostCommonType = typeCounts.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      columnType = Object.entries(mostCommonType).reduce((a, b) => 
        mostCommonType[a[0]] > mostCommonType[b[0]] ? a : b
      )[0] as any
    }
    
    return {
      id: 0, // DB?�서 ?�성??
      file_id: 0, // ?�중???�정
      column_index: index,
      column_name: header,
      column_type: columnType,
      is_required: false,
      is_searchable: true,
      is_sortable: true,
      display_name: header,
      description: '',
      created_at: new Date()
    }
  })
}

// ?�이???�효??검??
export const validateRowData = (rowData: Record<string, any>, columns: ExcelColumn[]): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  
  for (const column of columns) {
    const value = rowData[column.column_name]
    
    if (column.is_required && (value === null || value === undefined || value === '')) {
      errors.push(`${column.column_name}?�(?? ?�수 ??��?�니??`)
      continue
    }
    
    if (value !== null && value !== undefined && value !== '') {
      // ?�이???�??검�?
      switch (column.column_type) {
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`${column.column_name}?�(?? ?�자?�야 ?�니??`)
          }
          break
        case 'date':
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            errors.push(`${column.column_name}?�(?? ?�효???�짜?�야 ?�니??`)
          }
          break
        case 'boolean':
          if (!['true', 'false', '1', '0', true, false].includes(value)) {
            errors.push(`${column.column_name}?�(?? true/false 값이?�야 ?�니??`)
          }
          break
        case 'json':
          try {
            JSON.parse(value)
          } catch {
            errors.push(`${column.column_name}?�(?? ?�효??JSON ?�식?�어???�니??`)
          }
          break
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// �?�� ?�위�??�이??처리
export const processExcelChunk = async (
  fileId: number,
  data: any[][],
  columns: ExcelColumn[],
  startRow: number,
  chunkSize: number = 1000
): Promise<{ processed: number; errors: number }> => {
  let processed = 0
  let errors = 0
  
  try {
    // 배치 ?�입???�한 ?�이??준�?
    const batchData: Array<[number, number, string, boolean, string]> = []
    
    for (let i = 0; i < data.length && i < chunkSize; i++) {
      const row = data[i]
      const rowIndex = startRow + i
      
      // ???�이?��? 객체�?변??
      const rowData: Record<string, any> = {}
      columns.forEach((column, colIndex) => {
        rowData[column.column_name] = row[colIndex] || null
      })
      
      // ?�효??검??
      const validation = validateRowData(rowData, columns)
      
      batchData.push([
        fileId,
        rowIndex,
        JSON.stringify(rowData),
        validation.isValid,
        validation.errors.length > 0 ? JSON.stringify(validation.errors) : null
      ])
      
      if (!validation.isValid) {
        errors++
      }
      processed++
    }
    
    // 배치 ?�입 ?�행
    if (batchData.length > 0) {
      const placeholders = batchData.map((_, index) => {
        const baseIndex = index * 5
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`
      }).join(', ')
      const values = batchData.flat()
      
      await pool.query(
        `INSERT INTO excel_data (file_id, row_index, row_data, is_valid, validation_errors) VALUES ${placeholders}`,
        values
      )
    }
    
  } catch (error) {
    console.error('Process chunk error:', error)
    throw error
  }
  
  return { processed, errors }
}

// ?��? ?�일 처리 (�?�� ?�위)
export const processExcelFile = async (
  filePath: string,
  fileId: number,
  userId: number,
  chunkSize: number = 1000,
  validateData: boolean = true
): Promise<ProcessingJob> => {
  const jobId = `job_${fileId}_${Date.now()}`
  const job: ProcessingJob = {
    id: jobId,
    fileId,
    status: 'processing',
    progress: 0,
    totalRows: 0,
    processedRows: 0,
    createdAt: new Date(),
    startedAt: new Date()
  }
  
  try {
    // ?��? ?�일 ?�기
    // 파일 존재 확인 및 안전한 파일 읽기
    if (!fs.existsSync(filePath)) {
      throw new Error('파일을 찾을 수 없습니다: ' + filePath)
    }
    
    // 파일을 안전하게 읽기
    let buffer: Buffer
    try {
      buffer = fs.readFileSync(filePath)
    } catch (readError) {
      console.error('파일 읽기 오류:', readError)
      throw new Error('파일을 읽을 수 없습니다. 파일이 손상되었거나 접근 권한이 없습니다.')
    }
    
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // JSON?�로 변??
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    if (jsonData.length === 0) {
      throw new Error('�??��? ?�일?�니??')
    }
    
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1) as any[][]
    
    job.totalRows = dataRows.length
    
    // 컬럼 ?�보 분석 �??�??
    const columns = analyzeColumns(headers, dataRows.slice(0, 100)) // 처음 100?�으�?분석
    
    // 컬럼 ?�보 ?�??
            for (const column of columns) {
          column.file_id = fileId
          await pool.query(
            `INSERT INTO excel_columns (file_id, column_index, column_name, column_type, is_required, is_searchable, is_sortable, display_name, description) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [column.file_id, column.column_index, column.column_name, column.column_type, column.is_required, column.is_searchable, column.is_sortable, column.display_name, column.description]
          )
        }
    
    // �?�� ?�위�??�이??처리
    let totalProcessed = 0
    let totalErrors = 0
    
    for (let i = 0; i < dataRows.length; i += chunkSize) {
      const chunk = dataRows.slice(i, i + chunkSize)
      const result = await processExcelChunk(fileId, chunk, columns, i + 1, chunkSize)
      
      totalProcessed += result.processed
      totalErrors += result.errors
      
      // 진행�??�데?�트
      job.processedRows = totalProcessed
      job.progress = Math.round((totalProcessed / job.totalRows) * 100)
      
      // 메모�??�리
      if (i % (chunkSize * 10) === 0) {
        global.gc && global.gc()
      }
    }
    
    // ?�일 처리 ?�료 ?�태 ?�데?�트
    await pool.query(
      'UPDATE excel_files SET is_processed = TRUE, total_rows = $1, total_columns = $2 WHERE id = $3',
      [job.totalRows, columns.length, fileId]
    )
    
    job.status = 'completed'
    job.completedAt = new Date()
    
    // 캐시 ?�리
    await clearFileCache(fileId)
    
  } catch (error) {
    console.error('Process excel file error:', error)
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : '?????�는 ?�류'
    job.completedAt = new Date()
  }
  
  return job
}

// ?�일 ?�보 조회
export const getFileInfo = async (fileId: number): Promise<any> => {
  const [files] = await pool.query(
    'SELECT * FROM excel_files WHERE id = ?',
    [fileId]
  ) as any[]
  
  if (files.length === 0) {
    throw new Error('?�일??찾을 ???�습?�다.')
  }
  
  return files[0]
}

// 컬럼 ?�보 조회
export const getColumns = async (fileId: number): Promise<ExcelColumn[]> => {
  const [columns] = await pool.query(
    'SELECT * FROM excel_columns WHERE file_id = ? ORDER BY column_index',
    [fileId]
  ) as any[]
  
  return columns
}

// ?�이??개수 조회
export const getDataCount = async (fileId: number, filters?: Record<string, any>): Promise<number> => {
  let query = 'SELECT COUNT(*) as count FROM excel_data WHERE file_id = ?'
  const params: any[] = [fileId]
  
  if (filters) {
    // ?�터 조건 추�?
    const conditions: string[] = []
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        conditions.push(`JSON_EXTRACT(row_data, '$.${key}') = ?`)
        params.push(value)
      }
    }
    
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`
    }
  }
  
  const [result] = await pool.query(query, params) as any[]
  return result[0].count
}

// 검??조건 ?�성
export const buildSearchQuery = (
  baseQuery: string,
  searchTerm?: string,
  filters?: Record<string, any>,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): { query: string; params: any[] } => {
  const conditions: string[] = []
  const params: any[] = []
  
  // 검?�어 처리
  if (searchTerm) {
    conditions.push(`(
      JSON_SEARCH(row_data, 'one', ?, null, '$.*') IS NOT NULL
    )`)
    params.push(`%${searchTerm}%`)
  }
  
  // ?�터 처리
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          // 범위 검??
          conditions.push(`(
            JSON_EXTRACT(row_data, '$.${key}') >= ? AND 
            JSON_EXTRACT(row_data, '$.${key}') <= ?
          )`)
          params.push(value.min, value.max)
        } else {
          // ?�확??�?검??- JSON 문자?�에???�옴???�거
          let cleanValue = value;
          if (typeof value === 'string') {
            // 모든 ?�태???�옴???�거 (?�스케?�프???�옴?? ?�반 ?�옴??
            cleanValue = value
              .replace(/^\\"/, '')  // ?�작 부분의 ?�스케?�프???�옴???�거
              .replace(/\\"$/, '')  // ??부분의 ?�스케?�프???�옴???�거
              .replace(/^"/, '')    // ?�작 부분의 ?�반 ?�옴???�거
              .replace(/"$/, '');   // ??부분의 ?�반 ?�옴???�거
            console.log(`?�터 �?처리: "${value}" -> "${cleanValue}"`);
          }
          conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(row_data, '$.${key}')) = ?`)
          params.push(cleanValue)
        }
      }
    }
  }
  
  let query = baseQuery
  if (conditions.length > 0) {
    // baseQuery???��? WHERE가 ?�는지 ?�인
    if (baseQuery.toUpperCase().includes('WHERE')) {
      query += ` AND ${conditions.join(' AND ')}`
    } else {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
  }
  
  // ?�렬 처리
  if (sortBy) {
    query += ` ORDER BY JSON_EXTRACT(row_data, '$.${sortBy}') ${sortOrder.toUpperCase()}`
  }
  
  return { query, params }
} 
