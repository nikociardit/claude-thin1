import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

interface DashboardStats {
  totalDevices: number
  onlineDevices: number
  activeImages: number
  totalDeployments: number
  onlinePercentage: number
}

interface DeviceInfo {
  id: string
  name: string
  ip: string
  location: string
  status: 'online' | 'offline' | 'warning'
  lastSeen: string
}

interface SystemMetrics {
  cpu: number
  memory: number
  network: number
  storage: number
}

class DashboardController {
  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      // Mock dashboard data
      const stats: DashboardStats = {
        totalDevices: 24,
        onlineDevices: 22,
        activeImages: 5,
        totalDeployments: 48,
        onlinePercentage: 92
      }

      const recentDevices: DeviceInfo[] = [
        {
          id: '1',
          name: 'Workstation-001',
          ip: '192.168.1.101',
          location: 'Office Floor 1',
          status: 'online',
          lastSeen: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Workstation-002',
          ip: '192.168.1.102',
          location: 'Office Floor 1',
          status: 'online',
          lastSeen: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Workstation-003',
          ip: '192.168.1.103',
          location: 'Office Floor 2',
          status: 'offline',
          lastSeen: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '4',
          name: 'Workstation-004',
          ip: '192.168.1.104',
          location: 'Office Floor 2',
          status: 'warning',
          lastSeen: new Date().toISOString()
        }
      ]

      const systemMetrics: SystemMetrics = {
        cpu: Math.floor(Math.random() * 50) + 30, // 30-80%
        memory: Math.floor(Math.random() * 40) + 50, // 50-90%
        network: Math.floor(Math.random() * 20) + 5, // 5-25 MB/s
        storage: Math.floor(Math.random() * 30) + 60 // 60-90%
      }

      logger.info('Dashboard stats requested')

      res.json({
        success: true,
        data: {
          stats,
          recentDevices,
          systemMetrics
        }
      })
    } catch (error) {
      next(error)
    }
  }

  async getSystemHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const health = {
        status: 'healthy',
        services: {
          database: 'connected',
          redis: 'connected',
          imageBuilder: 'running',
          pxeServer: 'running'
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }

      res.json({
        success: true,
        data: health
      })
    } catch (error) {
      next(error)
    }
  }

  async getRecentActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const activities = [
        {
          id: '1',
          type: 'device_registered',
          description: 'New device Workstation-005 registered',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          severity: 'info'
        },
        {
          id: '2',
          type: 'image_built',
          description: 'Alpine Linux image v1.2.3 built successfully',
          timestamp: new Date(Date.now() - 900000).toISOString(),
          severity: 'success'
        },
        {
          id: '3',
          type: 'deployment_failed',
          description: 'Deployment to Workstation-003 failed',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          severity: 'error'
        }
      ]

      res.json({
        success: true,
        data: activities
      })
    } catch (error) {
      next(error)
    }
  }
}

export const dashboardController = new DashboardController()