import { Router } from 'express'
import { dashboardController } from '../controllers/dashboard.controller'

export const dashboardRoutes = Router()

// GET /api/dashboard/stats
dashboardRoutes.get('/stats', dashboardController.getDashboardStats)

// GET /api/dashboard/health
dashboardRoutes.get('/health', dashboardController.getSystemHealth)

// GET /api/dashboard/activity
dashboardRoutes.get('/activity', dashboardController.getRecentActivity)