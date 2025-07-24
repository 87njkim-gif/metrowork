import { Request, Response, NextFunction } from 'express'
import { extractUserFromToken } from '../utils/jwt'
import { UserWithoutPassword } from '../types/auth'

// Request 인터페이스 확장
declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword
      token?: string
    }
  }
}

// JWT 토큰 추출 미들웨어
export const extractToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    req.token = token
  }
  
  next()
}

// 인증 미들웨어
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.token || req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      })
      return
    }

    const user = await extractUserFromToken(token)
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      })
      return
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({
      success: false,
      message: '인증에 실패했습니다.'
    })
  }
}

// 승인된 사용자만 사용
export const requireApproved = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '인증이 필요합니다.'
    })
    return
  }

  if (req.user.status !== 'approved') {
    res.status(403).json({
      success: false,
      message: '승인된 사용자만 접근 가능합니다.'
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
      message: '인증이 필요합니다.'
    })
    return
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: '관리자 권한이 필요합니다.'
    })
    return
  }

  next()
}

// 관리자 또는 본인 체크
export const requireAdminOrSelf = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '인증이 필요합니다.'
    })
    return
  }

  const targetUserId = parseInt(req.params.userId || req.params.id)
  
  if (req.user.role === 'admin' || req.user.id === targetUserId) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: '권한이 없습니다.'
    })
  }
}

// 선택적 인증 (토큰이 있으면 사용자 정보 추출)
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
    // 토큰이 유효하지 않아도 계속 진행
    next()
  }
}

// 특정 권한 체크
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '인증이 필요합니다.'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: '필요한 권한이 없습니다.'
      })
      return
    }

    next()
  }
}

// 특정 상태 권한 체크
export const requireStatus = (statuses: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '인증이 필요합니다.'
      })
      return
    }

    if (!statuses.includes(req.user.status)) {
      res.status(403).json({
        success: false,
        message: '필요한 상태가 아닙니다.'
      })
      return
    }

    next()
  }
}

// 에러 핸들러 미들웨어
export const authErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Auth middleware error:', error)
  
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.'
    })
  } else if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: '토큰이 만료되었습니다.'
    })
  } else {
    res.status(500).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.'
    })
  }
} 
