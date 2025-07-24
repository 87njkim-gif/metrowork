export interface ExcelFile {
  id: number
  filename: string
  original_name: string
  file_path: string
  file_size: number
  file_type: string
  sheet_name: string
  total_rows: number
  total_columns: number
  uploaded_by: number
  description?: string
  tags?: string[]
  is_processed: boolean
  created_at: Date
  updated_at: Date
}

export interface ExcelColumn {
  id: number
  file_id: number
  column_index: number
  column_name: string
  column_type: 'string' | 'number' | 'date' | 'boolean' | 'json'
  is_required: boolean
  is_searchable: boolean
  is_sortable: boolean
  display_name?: string
  description?: string
  created_at: Date
}

export interface ExcelData {
  id: number
  file_id: number
  row_index: number
  row_data: Record<string, any>
  is_valid: boolean
  validation_errors?: string[]
  created_at: Date
  updated_at: Date
}

export interface UploadProgress {
  fileId: number
  totalRows: number
  processedRows: number
  percentage: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

export interface ExcelDataQuery {
  fileId: number
  page: number
  limit: number
  search?: string
  filters?: Record<string, any>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  columns?: string[]
}

export interface ExcelDataResponse {
  data: ExcelData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  columns: ExcelColumn[]
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
  }
}

export interface SearchCriteria {
  fileId: number
  searchTerm?: string
  columnFilters?: Record<string, any>
  rangeFilters?: {
    [column: string]: {
      min?: number | string
      max?: number | string
      type: 'number' | 'date' | 'string'
    }
  }
  booleanFilters?: Record<string, boolean>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page: number
  limit: number
}

export interface SavedSearch {
  id: number
  name: string
  file_id: number
  user_id: number
  criteria: SearchCriteria
  created_at: Date
  updated_at: Date
}

export interface ColumnSummary {
  column_name: string
  column_type: string
  total_values: number
  unique_values: number
  null_values: number
  min_value?: any
  max_value?: any
  sample_values: any[]
  value_counts?: Array<{
    value: any
    count: number
  }>
}

export interface ExcelSummary {
  file_id: number
  total_rows: number
  total_columns: number
  columns: ColumnSummary[]
  processing_time: number
  last_updated: Date
}

export interface UploadRequest {
  description?: string
  tags?: string[]
  chunkSize?: number
  validateData?: boolean
}

export interface SearchResponse {
  data: ExcelData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  searchInfo: {
    searchTerm?: string
    appliedFilters: Record<string, any>
    processingTime: number
  }
}

export interface CacheKey {
  type: 'data' | 'summary' | 'search'
  fileId: number
  params: Record<string, any>
}

export interface ProcessingJob {
  id: string
  fileId: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalRows: number
  processedRows: number
  error?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
} 