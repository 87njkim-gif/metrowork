import * as XLSX from 'xlsx'
import { getPool } from '../config/database'
import { ExcelColumn, ExcelData, ProcessingJob } from '../types/excel'
import { clearFileCache } from './cache'
import path from 'path'
import fs from 'fs'

const pool = getPool()

// ?°ì´???€??ê°ì?
export const detectDataType = (value: any): 'string' | 'number' | 'date' | 'boolean' | 'json' => {
  if (value === null || value === undefined) return 'string'
  
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  
  if (typeof value === 'string') {
    // ? ì§œ ?•ì‹ ì²´í¬
    const dateRegex = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/
    if (dateRegex.test(value)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) return 'date'
    }
    
    // JSON ?•ì‹ ì²´í¬
    try {
      JSON.parse(value)
      return 'json'
    } catch {
      return 'string'
    }
  }
  
  return 'string'
}

// ì»¬ëŸ¼ ?•ë³´ ë¶„ì„
export const analyzeColumns = (headers: string[], sampleData: any[][]): ExcelColumn[] => {
  return headers.map((header, index) => {
    // ?˜í”Œ ?°ì´?°ì—???´ë‹¹ ì»¬ëŸ¼??ê°’ë“¤ ?˜ì§‘
    const columnValues = sampleData.map(row => row[index]).filter(val => val !== null && val !== undefined)
    
    // ?°ì´???€??ê°ì?
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
      id: 0, // DB?ì„œ ?ì„±??
      file_id: 0, // ?˜ì¤‘???¤ì •
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

// ?°ì´??? íš¨??ê²€??
export const validateRowData = (rowData: Record<string, any>, columns: ExcelColumn[]): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  
  for (const column of columns) {
    const value = rowData[column.column_name]
    
    if (column.is_required && (value === null || value === undefined || value === '')) {
      errors.push(`${column.column_name}?€(?? ?„ìˆ˜ ??ª©?…ë‹ˆ??`)
      continue
    }
    
    if (value !== null && value !== undefined && value !== '') {
      // ?°ì´???€??ê²€ì¦?
      switch (column.column_type) {
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`${column.column_name}?€(?? ?«ì?¬ì•¼ ?©ë‹ˆ??`)
          }
          break
        case 'date':
          const date = new Date(value)
          if (isNaN(date.getTime())) {
            errors.push(`${column.column_name}?€(?? ? íš¨??? ì§œ?¬ì•¼ ?©ë‹ˆ??`)
          }
          break
        case 'boolean':
          if (!['true', 'false', '1', '0', true, false].includes(value)) {
            errors.push(`${column.column_name}?€(?? true/false ê°’ì´?´ì•¼ ?©ë‹ˆ??`)
          }
          break
        case 'json':
          try {
            JSON.parse(value)
          } catch {
            errors.push(`${column.column_name}?€(?? ? íš¨??JSON ?•ì‹?´ì–´???©ë‹ˆ??`)
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

// ì²?¬ ?¨ìœ„ë¡??°ì´??ì²˜ë¦¬
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
    // ë°°ì¹˜ ?½ì…???„í•œ ?°ì´??ì¤€ë¹?
    const batchData: Array<[number, number, string, boolean, string]> = []
    
    for (let i = 0; i < data.length && i < chunkSize; i++) {
      const row = data[i]
      const rowIndex = startRow + i
      
      // ???°ì´?°ë? ê°ì²´ë¡?ë³€??
      const rowData: Record<string, any> = {}
      columns.forEach((column, colIndex) => {
        rowData[column.column_name] = row[colIndex] || null
      })
      
      // ? íš¨??ê²€??
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
    
    // ë°°ì¹˜ ?½ì… ?¤í–‰
    if (batchData.length > 0) {
      const placeholders = batchData.map(() => '(?, ?, ?, ?, ?)').join(', ')
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

// ?‘ì? ?Œì¼ ì²˜ë¦¬ (ì²?¬ ?¨ìœ„)
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
    // ?‘ì? ?Œì¼ ?½ê¸°
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // JSON?¼ë¡œ ë³€??
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    if (jsonData.length === 0) {
      throw new Error('ë¹??‘ì? ?Œì¼?…ë‹ˆ??')
    }
    
    const headers = jsonData[0] as string[]
    const dataRows = jsonData.slice(1) as any[][]
    
    job.totalRows = dataRows.length
    
    // ì»¬ëŸ¼ ?•ë³´ ë¶„ì„ ë°??€??
    const columns = analyzeColumns(headers, dataRows.slice(0, 100)) // ì²˜ìŒ 100?‰ìœ¼ë¡?ë¶„ì„
    
    // ì»¬ëŸ¼ ?•ë³´ ?€??
    for (const column of columns) {
      column.file_id = fileId
      await pool.query(
        `INSERT INTO excel_columns (file_id, column_index, column_name, column_type, is_required, is_searchable, is_sortable, display_name, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [column.file_id, column.column_index, column.column_name, column.column_type, column.is_required, column.is_searchable, column.is_sortable, column.display_name, column.description]
      )
    }
    
    // ì²?¬ ?¨ìœ„ë¡??°ì´??ì²˜ë¦¬
    let totalProcessed = 0
    let totalErrors = 0
    
    for (let i = 0; i < dataRows.length; i += chunkSize) {
      const chunk = dataRows.slice(i, i + chunkSize)
      const result = await processExcelChunk(fileId, chunk, columns, i + 1, chunkSize)
      
      totalProcessed += result.processed
      totalErrors += result.errors
      
      // ì§„í–‰ë¥??…ë°?´íŠ¸
      job.processedRows = totalProcessed
      job.progress = Math.round((totalProcessed / job.totalRows) * 100)
      
      // ë©”ëª¨ë¦??•ë¦¬
      if (i % (chunkSize * 10) === 0) {
        global.gc && global.gc()
      }
    }
    
    // ?Œì¼ ì²˜ë¦¬ ?„ë£Œ ?íƒœ ?…ë°?´íŠ¸
    await pool.query(
      'UPDATE excel_files SET is_processed = TRUE, total_rows = ?, total_columns = ? WHERE id = ?',
      [job.totalRows, columns.length, fileId]
    )
    
    job.status = 'completed'
    job.completedAt = new Date()
    
    // ìºì‹œ ?•ë¦¬
    await clearFileCache(fileId)
    
  } catch (error) {
    console.error('Process excel file error:', error)
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : '?????†ëŠ” ?¤ë¥˜'
    job.completedAt = new Date()
  }
  
  return job
}

// ?Œì¼ ?•ë³´ ì¡°íšŒ
export const getFileInfo = async (fileId: number): Promise<any> => {
  const [files] = await pool.query(
    'SELECT * FROM excel_files WHERE id = ?',
    [fileId]
  ) as any[]
  
  if (files.length === 0) {
    throw new Error('?Œì¼??ì°¾ì„ ???†ìŠµ?ˆë‹¤.')
  }
  
  return files[0]
}

// ì»¬ëŸ¼ ?•ë³´ ì¡°íšŒ
export const getColumns = async (fileId: number): Promise<ExcelColumn[]> => {
  const [columns] = await pool.query(
    'SELECT * FROM excel_columns WHERE file_id = ? ORDER BY column_index',
    [fileId]
  ) as any[]
  
  return columns
}

// ?°ì´??ê°œìˆ˜ ì¡°íšŒ
export const getDataCount = async (fileId: number, filters?: Record<string, any>): Promise<number> => {
  let query = 'SELECT COUNT(*) as count FROM excel_data WHERE file_id = ?'
  const params: any[] = [fileId]
  
  if (filters) {
    // ?„í„° ì¡°ê±´ ì¶”ê?
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

// ê²€??ì¡°ê±´ ?ì„±
export const buildSearchQuery = (
  baseQuery: string,
  searchTerm?: string,
  filters?: Record<string, any>,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): { query: string; params: any[] } => {
  const conditions: string[] = []
  const params: any[] = []
  
  // ê²€?‰ì–´ ì²˜ë¦¬
  if (searchTerm) {
    conditions.push(`(
      JSON_SEARCH(row_data, 'one', ?, null, '$.*') IS NOT NULL
    )`)
    params.push(`%${searchTerm}%`)
  }
  
  // ?„í„° ì²˜ë¦¬
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          // ë²”ìœ„ ê²€??
          conditions.push(`(
            JSON_EXTRACT(row_data, '$.${key}') >= ? AND 
            JSON_EXTRACT(row_data, '$.${key}') <= ?
          )`)
          params.push(value.min, value.max)
        } else {
          // ?•í™•??ê°?ê²€??- JSON ë¬¸ì?´ì—???°ì˜´???œê±°
          let cleanValue = value;
          if (typeof value === 'string') {
            // ëª¨ë“  ?•íƒœ???°ì˜´???œê±° (?´ìŠ¤ì¼€?´í”„???°ì˜´?? ?¼ë°˜ ?°ì˜´??
            cleanValue = value
              .replace(/^\\"/, '')  // ?œì‘ ë¶€ë¶„ì˜ ?´ìŠ¤ì¼€?´í”„???°ì˜´???œê±°
              .replace(/\\"$/, '')  // ??ë¶€ë¶„ì˜ ?´ìŠ¤ì¼€?´í”„???°ì˜´???œê±°
              .replace(/^"/, '')    // ?œì‘ ë¶€ë¶„ì˜ ?¼ë°˜ ?°ì˜´???œê±°
              .replace(/"$/, '');   // ??ë¶€ë¶„ì˜ ?¼ë°˜ ?°ì˜´???œê±°
            console.log(`?„í„° ê°?ì²˜ë¦¬: "${value}" -> "${cleanValue}"`);
          }
          conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(row_data, '$.${key}')) = ?`)
          params.push(cleanValue)
        }
      }
    }
  }
  
  let query = baseQuery
  if (conditions.length > 0) {
    // baseQuery???´ë? WHEREê°€ ?ˆëŠ”ì§€ ?•ì¸
    if (baseQuery.toUpperCase().includes('WHERE')) {
      query += ` AND ${conditions.join(' AND ')}`
    } else {
      query += ` WHERE ${conditions.join(' AND ')}`
    }
  }
  
  // ?•ë ¬ ì²˜ë¦¬
  if (sortBy) {
    query += ` ORDER BY JSON_EXTRACT(row_data, '$.${sortBy}') ${sortOrder.toUpperCase()}`
  }
  
  return { query, params }
} 
