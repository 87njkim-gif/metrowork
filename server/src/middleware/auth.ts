import { Request, Response, NextFunction } from 'express'
import { extractUserFromToken } from '../utils/jwt'
import { UserWithoutPassword } from '../types/auth'

// Request ?�터?�이???�장
declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword
      token?: string
    }
  }
}

// JWT ?�큰 추출 미들?�어
export const extractToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    req.token = token
  }
  
  next()
}

// ?�증 미들?�어
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.token || req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: '?�증 ?�큰???�요?�니??'
      })
      return
    }

    const user = await extractUserFromToken(token)
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '?�효?��? ?��? ?�큰?�니??'
      })
      return
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({
      success: false,
      message: '?�증???�패?�습?�다.'
    })
  }
}

// ?�인???�용?�만 ?�용
export const requireApproved = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '?�증???�요?�니??'
    })
    return
  }

  if (req.user.status !== 'approved') {
    res.status(403).json({
      success: false,
      message: '?�인???�용?�만 ?�근?????�습?�다.'
    })
    return
  }

  next()
}

// 관리자 권한 체크
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '?�증???�요?�니??'
    })
    return
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: '관리자 권한???�요?�니??'
    })
    return
  }

  next()
}

// 관리자 ?�는 본인 체크
export const requireAdminOrSelf = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '?�증???�요?�니??'
    })
    return
  }

  const targetUserId = parseInt(req.params.userId || req.params.id)
  
  if (req.user.role === 'admin' || req.user.id === targetUserId) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: '권한???�습?�다.'
    })
  }
}

// ?�택???�증 (?�큰???�으�??�용???�보 추�?)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.token || req.headers.authorization?.replace('Bearer ', '')
    
    if (token) {
      const user = await extractUserFromToken(token)
      if (user) {
        req.user = user
      }
    }
    
    next()
  } catch (error) {
    // ?�큰???�효?��? ?�아??계속 진행
    next()
  }
}

// ??���?권한 체크
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '?�증???�요?�니??'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: '?�요??권한???�습?�다.'
      })
      return
    }

    next()
  }
}

// ?�태�?권한 체크
export const requireStatus = (statuses: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '?�증???�요?�니??'
      })
      return
    }

    if (!statuses.includes(req.user.status)) {
      res.status(403).json({
        success: false,
        message: '?�요???�태가 ?�닙?�다.'
      })
      return
    }

    next()
  }
}

// ?�러 ?�들�?미들?�어
export const authErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Auth middleware error:', error)
  
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: '?�효?��? ?��? ?�큰?�니??'
    })
  } else if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: '?�큰??만료?�었?�니??'
    })
  } else {
    res.status(500).json({
      success: false,
      message: '?�증 처리 �??�류가 발생?�습?�다.'
    })
  }
} 
