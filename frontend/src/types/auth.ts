export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  avatar?: string
  lastLogin: string
  permissions: Permission[]
}

export interface Permission {
  resource: string
  actions: string[]
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}