import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  ApiResponse,
  ExcelFile,
  ExcelData,
  WorkStatus,
  SearchCriteria,
  SavedSearch
} from '../types'

// API 기본 설정
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://metrowork.onrender.com/api',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'https://metrowork.onrender.com/api',
      timeout: 60000, // 모바일 환경을 위해 60초로 증가
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 요청 인터셉터
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 응답 인터셉터
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // 재시도 로직이 포함된 API 호출 함수
  private async apiCallWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        // 네트워크 오류나 타임아웃인 경우에만 재시도
        if (error.code === 'ECONNABORTED' || 
            error.message === 'Network Error' ||
            error.message.includes('timeout') ||
            error.message.includes('aborted')) {
          
          if (attempt < maxRetries) {
            // 지수 백오프: 1초, 2초, 4초
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // 재시도할 수 없는 오류는 즉시 throw
        throw error;
      }
    }
    
    throw lastError;
  }

  // 인증 관련 API
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.apiCallWithRetry(async () => {
      const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login', data)
      return response.data
    });
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.apiCallWithRetry(async () => {
      const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/register', data)
      return response.data
    });
  }

  async refreshToken(): Promise<AuthResponse> {
    return this.apiCallWithRetry(async () => {
      const refreshToken = localStorage.getItem('refreshToken')
      const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/refresh', {
        refreshToken
      })
      return response.data
    });
  }

  async logout(): Promise<ApiResponse> {
    return this.apiCallWithRetry(async () => {
      const response: AxiosResponse<ApiResponse> = await this.api.post('/auth/logout')
      return response.data
    });
  }

  async getCurrentUser(): Promise<ApiResponse> {
    return this.apiCallWithRetry(async () => {
      const response: AxiosResponse<ApiResponse> = await this.api.get('/auth/me')
      return response.data
    });
  }

  async deleteAccount(password: string): Promise<ApiResponse> {
    return this.apiCallWithRetry(async () => {
      const response: AxiosResponse<ApiResponse> = await this.api.delete('/auth/account', {
        data: { password }
      })
      return response.data
    });
  }

  // 엑셀 관련 API
  async uploadExcelFile(formData: FormData): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post('/excel/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async getUploadProgress(fileId: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/excel/upload/${fileId}/progress`)
    return response.data
  }

  async getExcelFiles(params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<ApiResponse<{ files: ExcelFile[]; pagination: any }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/excel/files', { params })
    return response.data
  }

  async getExcelData(fileId: number, params?: {
    page?: number
    limit?: number
    search?: string
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<ApiResponse<{ data: ExcelData[]; pagination: any; columns: any[]; summary: any }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/excel/data/${fileId}`, { params })
    return response.data
  }

  async getTeamList(fileId: number, columnIndex?: number): Promise<ApiResponse<{ teams: string[]; columnName: string; columnIndex: number }>> {
    const params = columnIndex ? { columnIndex } : {}
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/excel/teams/${fileId}`, { params })
    return response.data
  }

  async searchExcelData(fileId: number, criteria: SearchCriteria): Promise<ApiResponse<{ data: ExcelData[]; pagination: any; searchInfo: any }>> {
    // 캐시 방지를 위한 타임스탬프 추가
    const timestamp = Date.now();
    const criteriaWithTimestamp = { ...criteria, _t: timestamp };
    
    const response: AxiosResponse<ApiResponse> = await this.api.post(`/excel/search/${fileId}`, criteriaWithTimestamp)
    return response.data
  }

  async getExcelSummary(fileId: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/excel/summary/${fileId}`)
    return response.data
  }

  async deleteExcelFile(fileId: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/excel/files/${fileId}`)
    return response.data
  }

  // 업무 관련 API
  async checkWorkItem(rowId: number, data: { isCompleted: boolean; notes?: string }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put(`/work/excel/${rowId}/check`, data)
    return response.data
  }

  async getCompletedWork(params?: {
    page?: number
    limit?: number
    startDate?: string
    endDate?: string
    userId?: number
    fileId?: number
    search?: string
  }): Promise<ApiResponse<{ workStatuses: WorkStatus[]; pagination: any; summary: any }>> {
    const queryParams = new URLSearchParams()
    
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)
    if (params?.userId) queryParams.append('userId', params.userId.toString())
    if (params?.fileId) queryParams.append('fileId', params.fileId.toString())
    if (params?.search) queryParams.append('search', params.search)
    
    const response: AxiosResponse<ApiResponse<{ workStatuses: WorkStatus[]; pagination: any; summary: any }>> = await this.api.get(`/work/completed?${queryParams.toString()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    return response.data
  }

  async setTodayDate(todayDate: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put('/work/today-date', { todayDate })
    return response.data
  }

  async getTodayDate(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/work/today-date')
    return response.data
  }

  async getCompletedWorkByDate(date: string, params?: {
    page?: number
    limit?: number
  }): Promise<ApiResponse<{ workStatuses: WorkStatus[]; pagination: any; date: string }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/work/completed/${date}`, { params })
    return response.data
  }

  async getWorkStats(): Promise<ApiResponse<{ summary: any; userStats: any[]; fileStats: any[] }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/work/stats')
    return response.data
  }

  async bulkCheckWork(data: { rowIds: number[]; isCompleted: boolean; notes?: string }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post('/work/bulk-check', data)
    return response.data
  }

  async getUserWorkStatus(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/work/user-status')
    return response.data
  }

  async getWorkHistory(params?: {
    page?: number
    limit?: number
    userId?: number
    fileId?: number
    action?: string
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<{ activities: any[]; pagination: any }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/work/history', { params })
    return response.data
  }

  // 검색 관련 API
  async getSavedSearches(fileId: number): Promise<ApiResponse<{ searches: SavedSearch[] }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/search/${fileId}/saved`)
    return response.data
  }

  async saveSearch(fileId: number, data: { name: string; criteria: SearchCriteria }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(`/search/${fileId}/saved`, data)
    return response.data
  }

  async executeSavedSearch(fileId: number, searchId: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/search/${fileId}/saved/${searchId}/execute`)
    return response.data
  }

  async updateSavedSearch(fileId: number, searchId: number, data: { name?: string; criteria?: SearchCriteria }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put(`/search/${fileId}/saved/${searchId}`, data)
    return response.data
  }

  async deleteSavedSearch(fileId: number, searchId: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.delete(`/search/${fileId}/saved/${searchId}`)
    return response.data
  }

  async getSearchHistory(fileId: number, params?: {
    page?: number
    limit?: number
  }): Promise<ApiResponse<{ history: any[]; pagination: any }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/search/${fileId}/history`, { params })
    return response.data
  }

  // 관리자 관련 API
  async getPendingUsers(): Promise<ApiResponse<{ users: any[]; total: number }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/admin/pending-users')
    return response.data
  }

  async approveUser(userId: number, data: { status: 'approved' | 'rejected'; rejection_reason?: string }): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.put(`/auth/admin/approve/${userId}`, data)
    return response.data
  }

  // 회원별 업무 통계 조회 (관리자만)
  async getUserWorkStats(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/admin/work/user-stats', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    return response.data
  }

  // 전역 업무 현황 조회
  async getGlobalWorkStats(): Promise<ApiResponse<{ globalStats: any[]; summary: any }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/admin/work/global-stats')
    return response.data
  }

  // 관리자 대시보드 통계
  async getAdminDashboardStats(): Promise<ApiResponse<{ overview: any; userStats: any[]; globalStats: any[]; topPerformers: any[] }>> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/admin/dashboard/stats')
    return response.data
  }

  async getAdminStats(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/admin/stats')
    return response.data
  }

  // 데이터 정리 (관리자만)
  async cleanupWorkStatusData(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post('/admin/cleanup-work-status')
    return response.data
  }

  // 유틸리티 메서드
  setAuthToken(token: string) {
    localStorage.setItem('token', token)
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  removeAuthToken() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    delete this.api.defaults.headers.common['Authorization']
  }

  getAuthToken(): string | null {
    return localStorage.getItem('token')
  }
}

// 싱글톤 인스턴스 생성
const apiService = new ApiService()

export default apiService 