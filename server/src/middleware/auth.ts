import { Request, Response, NextFunction } from 'express'
import { extractUserFromToken } from '../utils/jwt'
import { UserWithoutPassword } from '../types/auth'

// Request ?¸í„°?˜ì´???•ì¥
declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword
      token?: string
    }
  }
}

// JWT ? í° ì¶”ì¶œ ë¯¸ë“¤?¨ì–´
export const extractToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    req.token = token
  }
  
  next()
}

// ?¸ì¦ ë¯¸ë“¤?¨ì–´
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.token || req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: '?¸ì¦ ? í°???„ìš”?©ë‹ˆ??'
      })
      return
    }

    const user = await extractUserFromToken(token)
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ??'
      })
      return
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    res.status(401).json({
      success: false,
      message: '?¸ì¦???¤íŒ¨?ˆìŠµ?ˆë‹¤.'
    })
  }
}

// ?¹ì¸???¬ìš©?ë§Œ ?ˆìš©
export const requireApproved = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '?¸ì¦???„ìš”?©ë‹ˆ??'
    })
    return
  }

  if (req.user.status !== 'approved') {
    res.status(403).json({
      success: false,
      message: '?¹ì¸???¬ìš©?ë§Œ ?‘ê·¼?????ˆìŠµ?ˆë‹¤.'
    })
    return
  }

  next()
}

// ê´€ë¦¬ì ê¶Œí•œ ì²´í¬
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '?¸ì¦???„ìš”?©ë‹ˆ??'
    })
    return
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'ê´€ë¦¬ì ê¶Œí•œ???„ìš”?©ë‹ˆ??'
    })
    return
  }

  next()
}

// ê´€ë¦¬ì ?ëŠ” ë³¸ì¸ ì²´í¬
export const requireAdminOrSelf = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '?¸ì¦???„ìš”?©ë‹ˆ??'
    })
    return
  }

  const targetUserId = parseInt(req.params.userId || req.params.id)
  
  if (req.user.role === 'admin' || req.user.id === targetUserId) {
    next()
  } else {
    res.status(403).json({
      success: false,
      message: 'ê¶Œí•œ???†ìŠµ?ˆë‹¤.'
    })
  }
}

// ? íƒ???¸ì¦ (? í°???ˆìœ¼ë©??¬ìš©???•ë³´ ì¶”ê?)
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
    // ? í°??? íš¨?˜ì? ?Šì•„??ê³„ì† ì§„í–‰
    next()
  }
}

// ??• ë³?ê¶Œí•œ ì²´í¬
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '?¸ì¦???„ìš”?©ë‹ˆ??'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: '?„ìš”??ê¶Œí•œ???†ìŠµ?ˆë‹¤.'
      })
      return
    }

    next()
  }
}

// ?íƒœë³?ê¶Œí•œ ì²´í¬
export const requireStatus = (statuses: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '?¸ì¦???„ìš”?©ë‹ˆ??'
      })
      return
    }

    if (!statuses.includes(req.user.status)) {
      res.status(403).json({
        success: false,
        message: '?„ìš”???íƒœê°€ ?„ë‹™?ˆë‹¤.'
      })
      return
    }

    next()
  }
}

// ?ëŸ¬ ?¸ë“¤ë§?ë¯¸ë“¤?¨ì–´
export const authErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('Auth middleware error:', error)
  
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: '? íš¨?˜ì? ?Šì? ? í°?…ë‹ˆ??'
    })
  } else if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: '? í°??ë§Œë£Œ?˜ì—ˆ?µë‹ˆ??'
    })
  } else {
    res.status(500).json({
      success: false,
      message: '?¸ì¦ ì²˜ë¦¬ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.'
    })
  }
} 
