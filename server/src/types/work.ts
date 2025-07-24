export interface WorkStatus {
  id: number
  excel_data_id: number
  file_id: number
  user_id: number
  is_completed: boolean
  completed_at?: Date
  completed_by: number
  notes?: string
  created_at: Date
  updated_at: Date
}

export interface WorkStatusWithData extends WorkStatus {
  excel_data: {
    id: number
    row_index: number
    row_data: Record<string, any>
    is_valid: boolean
  }
  user: {
    id: number
    name: string
    email: string
  }
  file: {
    id: number
    original_name: string
    description?: string
  }
}

export interface CheckWorkRequest {
  isCompleted: boolean
  notes?: string
}

export interface CompletedWorkQuery {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  userId?: number
  fileId?: number
  search?: string
}

export interface CompletedWorkResponse {
  workStatuses: WorkStatusWithData[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  summary: {
    totalCompleted: number
    todayCompleted: number
    thisWeekCompleted: number
    thisMonthCompleted: number
  }
}

export interface TodayDateRequest {
  todayDate: string // YYYY-MM-DD ?ïÏãù
}

export interface WorkSummary {
  totalWorkItems: number
  completedItems: number
  pendingItems: number
  completionRate: number
  todayCompleted: number
  thisWeekCompleted: number
  thisMonthCompleted: number
  recentActivity: WorkStatusWithData[]
}

export interface UserWorkStats {
  userId: number
  userName: string
  totalCompleted: number
  todayCompleted: number
  thisWeekCompleted: number
  thisMonthCompleted: number
  averageCompletionTime: number // Î∂??®ÏúÑ
  lastCompletedAt?: Date
}

export interface FileWorkStats {
  fileId: number
  fileName: string
  totalRows: number
  completedRows: number
  pendingRows: number
  completionRate: number
  lastActivityAt?: Date
}

export interface WorkActivity {
  id: number
  excel_data_id: number
  user_id: number
  action: 'completed' | 'uncompleted' | 'note_added'
  old_status?: boolean
  new_status?: boolean
  notes?: string
  created_at: Date
  user: {
    id: number
    name: string
  }
  excel_data: {
    row_index: number
    row_data: Record<string, any>
  }
}

export interface WorkActivityQuery {
  page?: number
  limit?: number
  userId?: number
  fileId?: number
  action?: string
  startDate?: string
  endDate?: string
}

export interface WorkActivityResponse {
  activities: WorkActivity[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface BulkCheckRequest {
  rowIds: number[]
  isCompleted: boolean
  notes?: string
}

export interface BulkCheckResponse {
  success: number
  failed: number
  errors: Array<{
    rowId: number
    error: string
  }>
}

export interface WorkFilter {
  status?: 'completed' | 'pending' | 'all'
  userId?: number
  fileId?: number
  dateRange?: {
    start: string
    end: string
  }
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface WorkStatusUpdate {
  id: number
  isCompleted: boolean
  completedAt?: Date
  notes?: string
  updatedAt: Date
} 
