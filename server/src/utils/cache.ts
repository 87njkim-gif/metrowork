import { CacheKey, ExcelDataResponse, ExcelSummary, SearchResponse } from '../types/excel'

// 메모리 캐시 (Redis가 없는 경우를 위한 폴백)
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5분

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    const expires = Date.now() + ttl
    this.cache.set(key, { data, expires })
  }

  get(key: string): any | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // 만료된 항목 정리
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
  }
}

// 캐시 키 생성
export const generateCacheKey = (type: CacheKey['type'], fileId: number, params: Record<string, any> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|')
  
  return `excel:${type}:${fileId}:${sortedParams}`
}

// 캐시 TTL 설정
export const getCacheTTL = (type: CacheKey['type']): number => {
  switch (type) {
    case 'data':
      return 2 * 60 * 1000 // 2분 (데이터는 자주 변경될 수 있음)
    case 'summary':
      return 10 * 60 * 1000 // 10분 (요약 정보는 상대적으로 안정적)
    case 'search':
      return 5 * 60 * 1000 // 5분 (검색 결과)
    default:
      return 5 * 60 * 1000 // 5분
  }
}

// 메모리 캐시 인스턴스
const memoryCache = new MemoryCache()

// 정기적인 캐시 정리 (5분마다)
setInterval(() => {
  memoryCache.cleanup()
}, 5 * 60 * 1000)

// 캐시 설정
export const setCache = async (key: string, data: any, type: CacheKey['type']): Promise<void> => {
  try {
    const ttl = getCacheTTL(type)
    memoryCache.set(key, data, ttl)
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

// 캐시 조회
export const getCache = async (key: string): Promise<any | null> => {
  try {
    return memoryCache.get(key)
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

// 캐시 삭제
export const deleteCache = async (key: string): Promise<void> => {
  try {
    memoryCache.delete(key)
  } catch (error) {
    console.error('Cache delete error:', error)
  }
}

// 파일 관련 캐시 전체 삭제
export const clearFileCache = async (fileId: number): Promise<void> => {
  try {
    const keys = Array.from(memoryCache.cache.keys())
    const fileKeys = keys.filter(key => key.includes(`:${fileId}:`))
    
    for (const key of fileKeys) {
      memoryCache.delete(key)
    }
  } catch (error) {
    console.error('Clear file cache error:', error)
  }
}

// 캐시 통계
export const getCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: memoryCache.cache.size,
    keys: Array.from(memoryCache.cache.keys())
  }
}

// 응답 데이터 최적화 (모바일용)
export const optimizeResponse = (data: any, includeMetadata: boolean = false): any => {
  if (Array.isArray(data)) {
    return data.map(item => optimizeResponse(item, includeMetadata))
  }

  if (typeof data === 'object' && data !== null) {
    const optimized: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // null, undefined 값 제거
      if (value === null || value === undefined) continue
      
      // 날짜 객체를 ISO 문자열로 변환
      if (value instanceof Date) {
        optimized[key] = value.toISOString()
        continue
      }
      
      // 중첩 객체 재귀 처리
      if (typeof value === 'object') {
        optimized[key] = optimizeResponse(value, includeMetadata)
        continue
      }
      
      optimized[key] = value
    }
    
    return optimized
  }
  
  return data
}

// 페이지네이션 응답 최적화
export const optimizePaginationResponse = (
  data: ExcelDataResponse | SearchResponse,
  includeFullData: boolean = false
): any => {
  const optimized = {
    data: includeFullData ? data.data : data.data.map(row => ({
      id: row.id,
      row_index: row.row_index,
      row_data: row.row_data,
      is_valid: row.is_valid
    })),
    pagination: data.pagination
  }

  if ('columns' in data) {
    optimized.columns = data.columns.map(col => ({
      id: col.id,
      column_name: col.column_name,
      column_type: col.column_type,
      display_name: col.display_name,
      is_searchable: col.is_searchable,
      is_sortable: col.is_sortable
    }))
  }

  if ('summary' in data) {
    optimized.summary = data.summary
  }

  if ('searchInfo' in data) {
    optimized.searchInfo = data.searchInfo
  }

  return optimized
}

// 검색 결과 캐싱 키 생성
export const generateSearchCacheKey = (
  fileId: number,
  searchTerm: string,
  filters: Record<string, any>,
  page: number,
  limit: number
): string => {
  const filterString = JSON.stringify(filters)
  return generateCacheKey('search', fileId, {
    search: searchTerm,
    filters: filterString,
    page,
    limit
  })
}

// 데이터 캐싱 키 생성
export const generateDataCacheKey = (
  fileId: number,
  page: number,
  limit: number,
  sortBy?: string,
  sortOrder?: string
): string => {
  return generateCacheKey('data', fileId, {
    page,
    limit,
    sortBy,
    sortOrder
  })
}

// 요약 정보 캐싱 키 생성
export const generateSummaryCacheKey = (fileId: number): string => {
  return generateCacheKey('summary', fileId, {})
}

// 캐시 미들웨어
export const cacheMiddleware = (type: CacheKey['type'], ttl?: number) => {
  return async (req: any, res: any, next: any) => {
    const fileId = parseInt(req.params.fileId || req.query.fileId || req.body.fileId)
    
    if (!fileId) {
      return next()
    }

    const cacheKey = generateCacheKey(type, fileId, {
      ...req.query,
      ...req.body,
      ...req.params
    })

    try {
      const cached = await getCache(cacheKey)
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          fromCache: true
        })
      }
    } catch (error) {
      console.error('Cache middleware error:', error)
    }

    // 원본 응답 저장
    const originalSend = res.json
    res.json = function(data: any) {
      if (data.success) {
        setCache(cacheKey, data.data, type)
      }
      return originalSend.call(this, data)
    }

    next()
  }
} 