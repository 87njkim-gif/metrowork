import * as XLSX from 'xlsx'
import { getPool } from '../config/database'
import { ExcelColumn, ExcelData, ProcessingJob } from '../types/excel'
import { clearFileCache } from './cache'
import path from 'path'
import fs from 'fs'

const pool = getPool()

// 데이터 타입 감지
export const detectDataType = (value: any): 'string' | 'number' | 'date' | 'boolean' | 'json' => {
  if (value === null || value === undefined) return 'string'
  
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  
  if (typeof value === 'string') {
    // 날짜 형식 체크
    const dateRegex = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/
    if (dateRegex.test(value)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) return 'date'
    }
    
    // JSON 형식 체크
    try {
      JSON.parse(value)
      return 'json'
    } catch {
      return 'string'
    }
  }
  
  return 'string'
}

// 컬럼 정보 분석
export const analyzeColumns = (headers: string[], sampleData: any[][]): ExcelColumn[] => {
  return headers.map((header, index) => {
    // 샘플 데이터에서 해당 컬럼의 값들 수집
    const columnValues = sampleData.map(row => row[index]).filter(val => val !== null && val !== undefined)
    
    // 데이터 타입 감지
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
      id: 0, // DB에서 생성됨
      file_id: 0, // 나중에 설정
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

// 데이터 유효성 검사
export const validateRowData = (rowData: Record<string, any>, columns: ExcelColumn[]): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  
  for (const column of columns) {
    const value = rowData[column.column_name]
    
    if (column.is_required && (value === null || value === undefined || value === '')) {
      errors.push(`${column.column_name}은(는) 필수 항목입니다.`)
      continue
    }
    
    if (value !== null && value !== undefined && value !== '') {
      // 데이터 타입 검증
      switch (column.column_type) {
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`${column.column_name}은(는) 숫자여야 합니다.`)
          }
          break
        case 'date':
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            errors.push(`${column.column_name}은(는) 유효한 날짜여야 합니다.`)
          }
          break
        case 'boolean':
          if (!['true', 'false', '1', '0', true, false].includes(value)) {
            errors.push(`${column.column_name}은(는) true/false 값이어야 합니다.`)
          }
          break
        case 'json':
          try {
            JSON.parse(value)
          } catch {
            errors.push(`${column.column_name}은(는) 유효한 JSON 형식이어야 합니다.`)
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

// 청크 단위로 데이터 처리
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
    // 배치 삽입을 위한 데이터 준비
    const batchData: Array<[number, number, string, boolean, string]> = []
    
    for (let i = 0; i < data.length && i < chunkSize; i++) {
      const row = data[i]
      const rowIndex = startRow + i
      
      // 행 데이터를 객체로 변환
      const rowData: Record<string, any> = {}
      columns.forEach((column, colIndex) => {
        rowData[column.column_name] = row[colIndex] || null
      })
      
      // 유효성 검사
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
    
    // 배치 삽입 실행
    if (batchData.length > 0) {
      const placeholders = batchData.map(() => '(?, ?, ?, ?, ?)').join(', ')
      const values = batchData.flat()
      
      await pool.execute(
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

// 엑셀 파일 처리 (청크 단위)
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
    // 엑셀 파일 읽기
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // JSON으로 변환
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    if (jsonData.length === 0) {
      throw new Error('빈 엑셀 파일입니다.')
    }
    
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1) as any[][]
    
    job.totalRows = dataRows.length
    
    // 컬럼 정보 분석 및 저장
    const columns = analyzeColumns(headers, dataRows.slice(0, 100)) // 처음 100행으로 분석
    
    // 컬럼 정보 저장
    for (const column of columns) {
      column.file_id = fileId
      await pool.execute(
        `INSERT INTO excel_columns (file_id, column_index, column_name, column_type, is_required, is_searchable, is_sortable, display_name, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [column.file_id, column.column_index, column.column_name, column.column_type, column.is_required, column.is_searchable, column.is_sortable, column.display_name, column.description]
      )
    }
    
    // 청크 단위로 데이터 처리
    let totalProcessed = 0
    let totalErrors = 0
    
    for (let i = 0; i < dataRows.length; i += chunkSize) {
      const chunk = dataRows.slice(i, i + chunkSize)
      const result = await processExcelChunk(fileId, chunk, columns, i + 1, chunkSize)
      
      totalProcessed += result.processed
      totalErrors += result.errors
      
      // 진행률 업데이트
      job.processedRows = totalProcessed
      job.progress = Math.round((totalProcessed / job.totalRows) * 100)
      
      // 메모리 정리
      if (i % (chunkSize * 10) === 0) {
        global.gc && global.gc()
      }
    }
    
    // 파일 처리 완료 상태 업데이트
    await pool.execute(
      'UPDATE excel_files SET is_processed = TRUE, total_rows = ?, total_columns = ? WHERE id = ?',
      [job.totalRows, columns.length, fileId]
    )
    
    job.status = 'completed'
    job.completedAt = new Date()
    
    // 캐시 정리
    await clearFileCache(fileId)
    
  } catch (error) {
    console.error('Process excel file error:', error)
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : '알 수 없는 오류'
    job.completedAt = new Date()
  }
  
  return job
}

// 파일 정보 조회
export const getFileInfo = async (fileId: number): Promise<any> => {
  const [files] = await pool.execute(
    'SELECT * FROM excel_files WHERE id = ?',
    [fileId]
  ) as any[]
  
  if (files.length === 0) {
    throw new Error('파일을 찾을 수 없습니다.')
  }
  
  return files[0]
}

// 컬럼 정보 조회
export const getColumns = async (fileId: number): Promise<ExcelColumn[]> => {
  const [columns] = await pool.execute(
    'SELECT * FROM excel_columns WHERE file_id = ? ORDER BY column_index',
    [fileId]
  ) as any[]
  
  return columns
}

// 데이터 개수 조회
export const getDataCount = async (fileId: number, filters?: Record<string, any>): Promise<number> => {
  let query = 'SELECT COUNT(*) as count FROM excel_data WHERE file_id = ?'
  const params: any[] = [fileId]
  
  if (filters) {
    // 필터 조건 추가
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
  
  const [result] = await pool.execute(query, params) as any[]
  return result[0].count
}

// 검색 조건 생성
export const buildSearchQuery = (
  baseQuery: string,
  searchTerm?: string,
  filters?: Record<string, any>,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): { query: string; params: any[] } => {
  const conditions: string[] = []
  const params: any[] = []
  
  // 검색어 처리
  if (searchTerm) {
    conditions.push(`(
      JSON_SEARCH(row_data, 'one', ?, null, '$.*') IS NOT NULL
    )`)
    params.push(`%${searchTerm}%`)
  }
  
  // 필터 처리
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          // 범위 검색
          conditions.push(`(
            JSON_EXTRACT(row_data, '$.${key}') >= ? AND 
            JSON_EXTRACT(row_data, '$.${key}') <= ?
          )`)
          params.push(value.min, value.max)
        } else {
          // 정확한 값 검색 - JSON 문자열에서 따옴표 제거
          let cleanValue = value;
          if (typeof value === 'string') {
            // 모든 형태의 따옴표 제거 (이스케이프된 따옴표, 일반 따옴표)
            cleanValue = value
              .replace(/^\\"/, '')  // 시작 부분의 이스케이프된 따옴표 제거
              .replace(/\\"$/, '')  // 끝 부분의 이스케이프된 따옴표 제거
              .replace(/^"/, '')    // 시작 부분의 일반 따옴표 제거
              .replace(/"$/, '');   // 끝 부분의 일반 따옴표 제거
            console.log(`필터 값 처리: "${value}" -> "${cleanValue}"`);
          }
          conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(row_data, '$.${key}')) = ?`)
          params.push(cleanValue)
        }
      }
    }
  }
  
  let query = baseQuery
  if (conditions.length > 0) {
    // baseQuery에 이미 WHERE가 있는지 확인
    if (baseQuery.toUpperCase().includes('WHERE')) {
      query += ` AND ${conditions.join(' AND ')}`
    } else {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
  }
  
  // 정렬 처리
  if (sortBy) {
    query += ` ORDER BY JSON_EXTRACT(row_data, '$.${sortBy}') ${sortOrder.toUpperCase()}`
  }
  
  return { query, params }
} 