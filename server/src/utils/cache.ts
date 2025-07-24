import { CacheKey, ExcelDataResponse, ExcelSummary, SearchResponse } from '../types/excel'

// 메모�?캐시 (Redis가 ?�는 경우�??�한 ?�백)
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5�?

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

  // 만료????�� ?�리
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
  }
}

// 캐시 ???�성
export const generateCacheKey = (type: CacheKey['type'], fileId: number, params: Record<string, any> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|')
  
  return `excel:${type}:${fileId}:${sortedParams}`
}

// 캐시 TTL ?�정
export const getCacheTTL = (type: CacheKey['type']): number => {
  switch (type) {
    case 'data':
      return 2 * 60 * 1000 // 2�?(?�이?�는 ?�주 변경될 ???�음)
    case 'summary':
      return 10 * 60 * 1000 // 10�?(?�약 ?�보???��??�으�??�정??
    case 'search':
      return 5 * 60 * 1000 // 5�?(검??결과)
    default:
      return 5 * 60 * 1000 // 5�?
  }
}

// 메모�?캐시 ?�스?�스
const memoryCache = new MemoryCache()

// ?�기?�인 캐시 ?�리 (5분마??
setInterval(() => {
  memoryCache.cleanup()
}, 5 * 60 * 1000)

// 캐시 ?�정
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

// 캐시 ??��
export const deleteCache = async (key: string): Promise<void> => {
  try {
    memoryCache.delete(key)
  } catch (error) {
    console.error('Cache delete error:', error)
  }
}

// ?�일 관??캐시 ?�체 ??��
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

// 캐시 ?�계
export const getCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: memoryCache.cache.size,
    keys: Array.from(memoryCache.cache.keys())
  }
}

// ?�답 ?�이??최적??(모바?�용)
export const optimizeResponse = (data: any, includeMetadata: boolean = false): any => {
  if (Array.isArray(data)) {
    return data.map(item => optimizeResponse(item, includeMetadata))
  }

  if (typeof data === 'object' && data !== null) {
    const optimized: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // null, undefined �??�거
      if (value === null || value === undefined) continue
      
      // ?�짜 객체�?ISO 문자?�로 변??
      if (value instanceof Date) {
        optimized[key] = value.toISOString()
        continue
      }
      
      // 중첩 객체 ?��? 처리
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

// ?�이지?�이???�답 최적??
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

// 검??결과 캐싱 ???�성
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

// ?�이??캐싱 ???�성
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

// ?�약 ?�보 캐싱 ???�성
export const generateSummaryCacheKey = (fileId: number): string => {
  return generateCacheKey('summary', fileId, {})
}

// 캐시 미들?�어
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

    // ?�본 ?�답 ?�??
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
