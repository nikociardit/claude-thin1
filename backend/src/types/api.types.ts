export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: any
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
}

declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}