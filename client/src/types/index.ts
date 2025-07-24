// 사용자 관련 타입
export interface User {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  created_at: string
  updated_at: string
}

// 인증 관련 타입
export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginRequest {
  name: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface AuthResponse {
  success: boolean
  message: string
  data: {
    user: User
    token: string
    refreshToken: string
  }
}

// 엑셀 관련 타입
export interface ExcelFile {
  id: number
  filename: string
  original_name: string
  file_size: number
  total_rows: number
  total_columns: number
  description?: string
  tags?: string[]
  is_processed: boolean
  uploaded_by: number
  created_at: string
  updated_at: string
}

export interface ExcelData {
  id: number
  file_id: number
  row_index: number
  row_data: Record<string, any>
  is_valid: boolean
  validation_errors?: string[]
  created_at: string
  updated_at: string
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
}

export interface UploadProgress {
  fileId: number
  totalRows: number
  processedRows: number
  percentage: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
}

// 업무 관련 타입
export interface WorkStatus {
  id: number
  excel_data_id: number
  file_id: number
  user_id: number
  is_completed: boolean
  completed_at?: string
  completed_by: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface WorkStatusWithData extends WorkStatus {
  excel_data: ExcelData
  user: User
  file: ExcelFile
}

// 검색 관련 타입
export interface SearchCriteria {
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
  created_at: string
  updated_at: string
}

// 페이지네이션 타입
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
}

// 네비게이션 타입
export interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  requiresAuth: boolean
  requiresAdmin?: boolean
}

// 모달 타입
export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

// 토스트 타입
export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

// 로딩 상태 타입
export interface LoadingState {
  isLoading: boolean
  message?: string
}

// 파일 업로드 타입
export interface FileUpload {
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

// 필터 타입
export interface FilterOption {
  value: string
  label: string
  count?: number
}

export interface FilterGroup {
  name: string
  label: string
  options: FilterOption[]
  type: 'checkbox' | 'radio' | 'range' | 'date'
}

// 차트 데이터 타입
export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string[]
    borderColor?: string[]
    borderWidth?: number
  }[]
}

// 통계 타입
export interface WorkStats {
  totalWorkItems: number
  completedItems: number
  pendingItems: number
  completionRate: number
  todayCompleted: number
  thisWeekCompleted: number
  thisMonthCompleted: number
}

export interface UserStats {
  userId: number
  userName: string
  totalCompleted: number
  todayCompleted: number
  thisWeekCompleted: number
  thisMonthCompleted: number
  averageCompletionTime: number
  lastCompletedAt?: string
}

export interface FileStats {
  fileId: number
  fileName: string
  totalRows: number
  completedRows: number
  pendingRows: number
  completionRate: number
  lastActivityAt?: string
}

// 설정 타입
export interface UserSettings {
  todayDate: string
  theme: 'light' | 'dark' | 'auto'
  language: 'ko' | 'en'
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
}

// 에러 타입
export interface AppError {
  code: string
  message: string
  details?: any
}

// 폼 타입
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    message?: string
  }
}

// 테이블 타입
export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
  render?: (value: any, row: any) => React.ReactNode
}

export interface TableProps {
  columns: TableColumn[]
  data: any[]
  loading?: boolean
  pagination?: Pagination
  onSort?: (key: string, order: 'asc' | 'desc') => void
  onRowClick?: (row: any) => void
  selectable?: boolean
  onSelectionChange?: (selectedRows: any[]) => void
} 