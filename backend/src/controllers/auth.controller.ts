import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { config } from '../config/config'
import { logger } from '../utils/logger'
import { createError } from '../middleware/errorHandler'

interface LoginRequest {
  email: string
  password: string
}

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  passwordHash?: string
  lastLogin: string
  permissions: Array<{
    resource: string
    actions: string[]
  }>
}

// Mock users for development
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@vdi.com',
    name: 'Administrator',
    role: 'admin',
    passwordHash: '$2a$10$8K1p/a0dclxKoNqXqrLMW.O1R9n1HJHh9ZoF1k6zNyY7.xJ8a9m5K', // admin123
    lastLogin: new Date().toISOString(),
    permissions: [
      { resource: 'devices', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'images', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'deployments', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] }
    ]
  },
  {
    id: '2',
    email: 'operator@vdi.com',
    name: 'Operator',
    role: 'operator',
    passwordHash: '$2a$10$8K1p/a0dclxKoNqXqrLMW.O1R9n1HJHh9ZoF1k6zNyY7.xJ8a9m5K', // operator123
    lastLogin: new Date().toISOString(),
    permissions: [
      { resource: 'devices', actions: ['read', 'update'] },
      { resource: 'images', actions: ['read'] },
      { resource: 'deployments', actions: ['create', 'read'] }
    ]
  }
]

const generateTokens = (userId: string) => {
  const token = jwt.sign({ userId, type: 'access' }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  })
  
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  })
  
  return { token, refreshToken }
}

class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password }: LoginRequest = req.body

      if (!email || !password) {
        throw createError('Email and password are required', 400, 'MISSING_CREDENTIALS')
      }

      // Find user
      const user = mockUsers.find(u => u.email === email)
      if (!user) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }

      // Verify password (in development, accept both hashed and plain passwords)
      let isValidPassword = false
      if (user.passwordHash) {
        isValidPassword = await bcrypt.compare(password, user.passwordHash)
      }
      
      // Fallback for development - accept plain passwords
      if (!isValidPassword) {
        const plainPasswords: Record<string, string> = {
          'admin@vdi.com': 'admin123',
          'operator@vdi.com': 'operator123'
        }
        isValidPassword = plainPasswords[email] === password
      }

      if (!isValidPassword) {
        throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }

      // Generate tokens
      const { token, refreshToken } = generateTokens(user.id)

      // Update last login
      user.lastLogin = new Date().toISOString()

      logger.info(`User logged in: ${user.email}`)

      // Return user data without password hash
      const { passwordHash, ...userResponse } = user

      res.json({
        success: true,
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      })
    } catch (error) {
      next(error)
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // In a real implementation, you would invalidate the token
      // For now, just return success
      logger.info('User logged out')
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      })
    } catch (error) {
      next(error)
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        throw createError('Refresh token is required', 400, 'MISSING_REFRESH_TOKEN')
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any
      
      if (decoded.type !== 'refresh') {
        throw createError('Invalid token type', 401, 'INVALID_TOKEN_TYPE')
      }

      // Find user
      const user = mockUsers.find(u => u.id === decoded.userId)
      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND')
      }

      // Generate new tokens
      const tokens = generateTokens(user.id)

      // Return user data without password hash
      const { passwordHash, ...userResponse } = user

      res.json({
        success: true,
        data: {
          user: userResponse,
          token: tokens.token,
          refreshToken: tokens.refreshToken
        }
      })
    } catch (error) {
      next(error)
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      // This would normally extract user from JWT middleware
      // For now, return mock data
      const user = mockUsers[0]
      const { passwordHash, ...userResponse } = user

      res.json({
        success: true,
        data: userResponse
      })
    } catch (error) {
      next(error)
    }
  }
}

export const authController = new AuthController()