export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'user'
  status: 'pending' | 'approved' | 'rejected' | 'inactive'
  phone?: string
  department?: string
  position?: string
  profile_image?: string
  last_login_at?: Date
  created_at: Date
  updated_at: Date
  approved_at?: Date
  approved_by?: number
  rejected_at?: Date
  rejected_by?: number
  rejection_reason?: string
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  phone?: string
  department?: string
  position?: string
}

export interface LoginRequest {
  name: string
  password: string
}

export interface AuthResponse {
  user: UserWithoutPassword
  token: string
  refreshToken: string
  expiresIn: number
}

export interface JwtPayload {
  userId: number
  email: string
  role: string
  iat: number
  exp?: number
}

export interface ApproveUserRequest {
  status: 'approved' | 'rejected'
  rejection_reason?: string
}

export interface AuthMiddlewareRequest extends Request {
  user?: UserWithoutPassword
  token?: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
} 