import React, { useState } from 'react'
import { Eye, EyeOff, Shield, Server } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { LoginCredentials } from '@/types/auth'

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuthStore()
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<LoginCredentials>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    const newErrors: Partial<LoginCredentials> = {}
    if (!credentials.email) newErrors.email = 'Email is required'
    if (!credentials.password) newErrors.password = 'Password is required'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setErrors({})
    
    try {
      await login(credentials)
    } catch (error) {
      // Error handling is done in the store
    }
  }

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-xl mb-4">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">
            VDI Management Platform
          </h1>
          <p className="text-secondary-600">
            Sign in to manage your virtual desktop infrastructure
          </p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`form-input ${errors.email ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="Enter your email"
                value={credentials.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-danger-600">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`form-input pr-10 ${errors.password ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-secondary-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-secondary-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-600">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg w-full"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="loading-spinner w-4 h-4 mr-2" />
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Sign In
                </div>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-secondary-50 rounded-lg">
            <p className="text-xs text-secondary-600 mb-2">Demo Credentials:</p>
            <div className="text-xs text-secondary-700 space-y-1">
              <div>Admin: admin@vdi.com / admin123</div>
              <div>Operator: operator@vdi.com / operator123</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-secondary-500">
            Secure access to your VDI infrastructure management
          </p>
        </div>
      </div>
    </div>
  )
}