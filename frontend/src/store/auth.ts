import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthState, User, LoginCredentials, AuthResponse } from '@/types/auth'
import { authService } from '@/services/auth'
import toast from 'react-hot-toast'

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
  refreshToken: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        try {
          set({ isLoading: true })
          const response: AuthResponse = await authService.login(credentials)
          
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false
          })

          toast.success(`Welcome back, ${response.user.name}!`)
        } catch (error: any) {
          set({ isLoading: false })
          const message = error.response?.data?.message || 'Login failed'
          toast.error(message)
          throw error
        }
      },

      logout: () => {
        try {
          authService.logout()
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false
          })
          toast.success('Logged out successfully')
        } catch (error) {
          console.error('Logout error:', error)
        }
      },

      setUser: (user: User) => {
        set({ user })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      refreshToken: async () => {
        try {
          const response = await authService.refreshToken()
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true
          })
        } catch (error) {
          // If refresh fails, logout user
          get().logout()
          throw error
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)