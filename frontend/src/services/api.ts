import axios, { AxiosInstance, AxiosError } from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://45.15.178.63:3001/api'

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage)
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
      } catch (error) {
        console.error('Error parsing auth storage:', error)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    // Handle 401 errors
    if (error.response?.status === 401 && originalRequest && !originalRequest.url?.includes('/auth/')) {
      // Clear auth storage and redirect to login
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Handle network errors
    if (!error.response) {
      toast.error('Network error. Please check your connection.')
      return Promise.reject(error)
    }

    // Handle server errors
    if (error.response.status >= 500) {
      toast.error('Server error. Please try again later.')
      return Promise.reject(error)
    }

    // Handle client errors
    if (error.response.status >= 400 && error.response.status < 500) {
      const message = (error.response.data as any)?.message || 'Request failed'
      if (!originalRequest?.url?.includes('/auth/')) {
        toast.error(message)
      }
    }

    return Promise.reject(error)
  }
)

export default api
