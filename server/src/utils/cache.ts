import { CacheKey, ExcelDataResponse, ExcelSummary, SearchResponse } from '../types/excel'

// ë©”ëª¨ë¦?ìºì‹œ (Redisê°€ ?†ëŠ” ê²½ìš°ë¥??„í•œ ?´ë°±)
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5ë¶?

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

  // ë§Œë£Œ????ª© ?•ë¦¬
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
  }
}

// ìºì‹œ ???ì„±
export const generateCacheKey = (type: CacheKey['type'], fileId: number, params: Record<string, any> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|')
  
  return `excel:${type}:${fileId}:${sortedParams}`
}

// ìºì‹œ TTL ?¤ì •
export const getCacheTTL = (type: CacheKey['type']): number => {
  switch (type) {
    case 'data':
      return 2 * 60 * 1000 // 2ë¶?(?°ì´?°ëŠ” ?ì£¼ ë³€ê²½ë  ???ˆìŒ)
    case 'summary':
      return 10 * 60 * 1000 // 10ë¶?(?”ì•½ ?•ë³´???ë??ìœ¼ë¡??ˆì •??
    case 'search':
      return 5 * 60 * 1000 // 5ë¶?(ê²€??ê²°ê³¼)
    default:
      return 5 * 60 * 1000 // 5ë¶?
  }
}

// ë©”ëª¨ë¦?ìºì‹œ ?¸ìŠ¤?´ìŠ¤
const memoryCache = new MemoryCache()

// ?•ê¸°?ì¸ ìºì‹œ ?•ë¦¬ (5ë¶„ë§ˆ??
setInterval(() => {
  memoryCache.cleanup()
}, 5 * 60 * 1000)

// ìºì‹œ ?¤ì •
export const setCache = async (key: string, data: any, type: CacheKey['type']): Promise<void> => {
  try {
    const ttl = getCacheTTL(type)
    memoryCache.set(key, data, ttl)
  } catch (error) {
    console.error('Cache set error:', error)
  }
}

// ìºì‹œ ì¡°íšŒ
export const getCache = async (key: string): Promise<any | null> => {
  try {
    return memoryCache.get(key)
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

// ìºì‹œ ?? œ
export const deleteCache = async (key: string): Promise<void> => {
  try {
    memoryCache.delete(key)
  } catch (error) {
    console.error('Cache delete error:', error)
  }
}

// ?Œì¼ ê´€??ìºì‹œ ?„ì²´ ?? œ
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

// ìºì‹œ ?µê³„
export const getCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: memoryCache.cache.size,
    keys: Array.from(memoryCache.cache.keys())
  }
}

// ?‘ë‹µ ?°ì´??ìµœì ??(ëª¨ë°”?¼ìš©)
export const optimizeResponse = (data: any, includeMetadata: boolean = false): any => {
  if (Array.isArray(data)) {
    return data.map(item => optimizeResponse(item, includeMetadata))
  }

  if (typeof data === 'object' && data !== null) {
    const optimized: any = {}
    
    for (const [key, value] of Object.entries(data)) {
      // null, undefined ê°??œê±°
      if (value === null || value === undefined) continue
      
      // ? ì§œ ê°ì²´ë¥?ISO ë¬¸ì?´ë¡œ ë³€??
      if (value instanceof Date) {
        optimized[key] = value.toISOString()
        continue
      }
      
      // ì¤‘ì²© ê°ì²´ ?¬ê? ì²˜ë¦¬
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

// ?˜ì´ì§€?¤ì´???‘ë‹µ ìµœì ??
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

// ê²€??ê²°ê³¼ ìºì‹± ???ì„±
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

// ?°ì´??ìºì‹± ???ì„±
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

// ?”ì•½ ?•ë³´ ìºì‹± ???ì„±
export const generateSummaryCacheKey = (fileId: number): string => {
  return generateCacheKey('summary', fileId, {})
}

// ìºì‹œ ë¯¸ë“¤?¨ì–´
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

    // ?ë³¸ ?‘ë‹µ ?€??
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
