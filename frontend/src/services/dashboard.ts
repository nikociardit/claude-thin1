import { api } from './api'

export interface DashboardStats {
  totalDevices: number
  onlineDevices: number
  activeImages: number
  totalDeployments: number
  onlinePercentage: number
}

export interface DeviceInfo {
  id: string
  name: string
  ip: string
  location: string
  status: 'online' | 'offline' | 'warning'
  lastSeen: string
}

export interface SystemMetrics {
  cpu: number
  memory: number
  network: number
  storage: number
}

export interface DashboardData {
  stats: DashboardStats
  recentDevices: DeviceInfo[]
  systemMetrics: SystemMetrics
}

class DashboardService {
  async getDashboardStats(): Promise<DashboardData> {
    try {
      const response = await api.get<DashboardData>('/dashboard/stats')
      return response.data
    } catch (error) {
      // Return mock data for development
      console.warn('Dashboard API not available, using mock data')
      return {
        stats: {
          totalDevices: 24,
          onlineDevices: 22,
          activeImages: 5,
          totalDeployments: 48,
          onlinePercentage: 92
        },
        recentDevices: [
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
        ],
        systemMetrics: {
          cpu: 45,
          memory: 68,
          network: 12.5,
          storage: 78
        }
      }
    }
  }

  async getSystemHealth() {
    const response = await api.get('/dashboard/health')
    return response.data
  }

  async getRecentActivity() {
    const response = await api.get('/dashboard/activity')
    return response.data
  }
}

export const dashboardService = new DashboardService()