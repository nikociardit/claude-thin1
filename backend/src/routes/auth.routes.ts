import { Router } from 'express'
import { authController } from '../controllers/auth.controller'

export const authRoutes = Router()

// POST /api/auth/login
authRoutes.post('/login', authController.login)

// POST /api/auth/logout
authRoutes.post('/logout', authController.logout)

// POST /api/auth/refresh
authRoutes.post('/refresh', authController.refreshToken)

// GET /api/auth/me (protected route)
authRoutes.get('/me', authController.getCurrentUser)