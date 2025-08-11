import { LoginCredentials, AuthResponse } from '@/types/auth'
import { api } from './api'

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials)
    
    // Set token for future requests
    if (response.data.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`
    }
    
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      // Clear token regardless of API success
      delete api.defaults.headers.common['Authorization']
      localStorage.removeItem('auth-storage')
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/refresh')
    
    // Update token for future requests
    if (response.data.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`
    }
    
    return response.data
  }

  async getCurrentUser() {
    const response = await api.get('/auth/me')
    return response.data
  }

  setToken(token: string | null) {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common['Authorization']
    }
  }
}

export const authService = new AuthService()