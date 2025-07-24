import jwt from 'jsonwebtoken'
import { JwtPayload, UserWithoutPassword } from '../types/auth'
import { getPool } from '../config/database'
import crypto from 'crypto'

const pool = getPool()

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const REFRESH_TOKEN_EXPIRES_IN = '30d'

// JWT ? í° ?ì„±
export const generateToken = (user: UserWithoutPassword): string => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000)
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

// ë¦¬í”„?ˆì‹œ ? í° ?ì„±
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString('hex')
}

// JWT ? í° ê²€ì¦?
export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    return decoded
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// ë¦¬í”„?ˆì‹œ ? í° ?€??
export const saveRefreshToken = async (userId: number, refreshToken: string): Promise<void> => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days

  await pool.query(
    'INSERT INTO user_sessions (user_id, refresh_token, expires_at) VALUES (?, ?, ?)',
    [userId, refreshToken, expiresAt]
  )
}

// ë¦¬í”„?ˆì‹œ ? í° ê²€ì¦?
export const verifyRefreshToken = async (refreshToken: string): Promise<UserWithoutPassword | null> => {
  try {
    const [sessions] = await pool.query(
      'SELECT user_id, expires_at FROM user_sessions WHERE refresh_token = ? AND is_active = TRUE',
      [refreshToken]
    ) as any[]

    if (sessions.length === 0) {
      return null
    }

    const session = sessions[0]
    if (new Date() > new Date(session.expires_at)) {
      // ë§Œë£Œ??? í° ë¹„í™œ?±í™”
      await pool.query(
        'UPDATE user_sessions SET is_active = FALSE WHERE refresh_token = ?',
        [refreshToken]
      )
      return null
    }

    // ?¬ìš©???•ë³´ ì¡°íšŒ
    const [users] = await pool.query(
      'SELECT id, email, name, role, status, phone, department, position, profile_image, last_login_at, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason FROM users WHERE id = ?',
      [session.user_id]
    ) as any[]

    if (users.length === 0) {
      return null
    }

    return users[0] as UserWithoutPassword
  } catch (error) {
    console.error('Error verifying refresh token:', error)
    return null
  }
}

// ë¦¬í”„?ˆì‹œ ? í° ë¬´íš¨??
export const invalidateRefreshToken = async (refreshToken: string): Promise<void> => {
  await pool.query(
    'UPDATE user_sessions SET is_active = FALSE WHERE refresh_token = ?',
    [refreshToken]
  )
}

// ?¬ìš©?ì˜ ëª¨ë“  ?¸ì…˜ ë¬´íš¨??
export const invalidateAllUserSessions = async (userId: number): Promise<void> => {
  await pool.query(
    'UPDATE user_sessions SET is_active = FALSE WHERE user_id = ?',
    [userId]
  )
}

// ë§Œë£Œ???¸ì…˜ ?•ë¦¬
export const cleanupExpiredSessions = async (): Promise<void> => {
  await pool.query(
    'UPDATE user_sessions SET is_active = FALSE WHERE expires_at < NOW()'
  )
}

// ? í°?ì„œ ?¬ìš©???•ë³´ ì¶”ì¶œ (ë¯¸ë“¤?¨ì–´??
export const extractUserFromToken = async (token: string): Promise<UserWithoutPassword | null> => {
  try {
    const decoded = verifyToken(token)
    
    const [users] = await pool.query(
      'SELECT id, email, name, role, status, phone, department, position, profile_image, last_login_at, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by, rejection_reason FROM users WHERE id = ? AND status = ?',
      [decoded.userId, 'approved']
    ) as any[]

    if (users.length === 0) {
      return null
    }

    return users[0] as UserWithoutPassword
  } catch (error) {
    return null
  }
}

// ? í° ë§Œë£Œ ?œê°„ ê³„ì‚°
export const getTokenExpirationTime = (): number => {
  const expiresIn = JWT_EXPIRES_IN
  if (expiresIn.includes('d')) {
    return parseInt(expiresIn) * 24 * 60 * 60 * 1000
  } else if (expiresIn.includes('h')) {
    return parseInt(expiresIn) * 60 * 60 * 1000
  } else if (expiresIn.includes('m')) {
    return parseInt(expiresIn) * 60 * 1000
  } else {
    return parseInt(expiresIn) * 1000
  }
} 
