import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Monitor,
  HardDrive,
  TrendingUp,
  CheckCircle,
  Cpu,
  MemoryStick,
  Wifi,
  Download
} from 'lucide-react'
import { dashboardService } from '@/services/dashboard'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  loading?: boolean
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon, 
  loading = false 
}) => {
  const changeColor = {
    positive: 'text-success-600',
    negative: 'text-danger-600',
    neutral: 'text-secondary-600'
  }[changeType]

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="skeleton h-4 w-24 mb-2" />
            <div className="skeleton h-8 w-16 mb-1" />
            <div className="skeleton h-3 w-16" />
          </div>
          <div className="skeleton h-12 w-12 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-secondary-900 mb-1">{value}</p>
          {change && (
            <p className={`text-sm ${changeColor} flex items-center`}>
              <TrendingUp className="w-3 h-3 mr-1" />
              {change}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center w-12 h-12 bg-primary-50 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
      </div>
    </div>
  )
}

interface DeviceStatusProps {
  devices: any[]
  loading?: boolean
}

const DeviceStatus: React.FC<DeviceStatusProps> = ({ devices, loading }) => {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
              <div className="flex items-center">
                <div className="skeleton h-8 w-8 rounded-lg mr-3" />
                <div>
                  <div className="skeleton h-4 w-24 mb-1" />
                  <div className="skeleton h-3 w-32" />
                </div>
              </div>
              <div className="skeleton h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-secondary-900">Recent Device Activity</h3>
      </div>
      <div className="space-y-3">
        {devices.slice(0, 5).map((device, index) => (
          <div key={device.id || index} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-white rounded-lg mr-3">
                <Monitor className="w-4 h-4 text-secondary-600" />
              </div>
              <div>
                <p className="font-medium text-secondary-900">{device.name}</p>
                <p className="text-sm text-secondary-500">{device.ip} • {device.location}</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className={`status-dot mr-2 ${
                device.status === 'online' ? 'status-online' :
                device.status === 'offline' ? 'status-offline' :
                'status-warning'
              }`} />
              <span className={`badge ${
                device.status === 'online' ? 'badge-success' :
                device.status === 'offline' ? 'badge-secondary' :
                'badge-warning'
              }`}>
                {device.status}
              </span>
            </div>
          </div>
        ))}
        {devices.length === 0 && (
          <div className="text-center py-8">
            <Monitor className="w-12 h-12 text-secondary-400 mx-auto mb-3" />
            <p className="text-secondary-600">No devices registered yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface SystemMetricsProps {
  metrics: any
  loading?: boolean
}

const SystemMetrics: React.FC<SystemMetricsProps> = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="text-center p-4">
              <div className="skeleton h-8 w-8 mx-auto mb-2 rounded-full" />
              <div className="skeleton h-4 w-16 mx-auto mb-1" />
              <div className="skeleton h-3 w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const metricItems = [
    { label: 'CPU Usage', value: `${metrics?.cpu || 0}%`, icon: Cpu, color: 'text-primary-600' },
    { label: 'Memory', value: `${metrics?.memory || 0}%`, icon: MemoryStick, color: 'text-success-600' },
    { label: 'Network', value: `${metrics?.network || 0} MB/s`, icon: Wifi, color: 'text-warning-600' },
    { label: 'Storage', value: `${metrics?.storage || 0}%`, icon: HardDrive, color: 'text-secondary-600' }
  ]

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-secondary-900">System Metrics</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {metricItems.map((item, index) => (
          <div key={index} className="text-center p-4">
            <div className="flex items-center justify-center w-8 h-8 bg-secondary-50 rounded-full mx-auto mb-2">
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <p className="font-semibold text-secondary-900">{item.value}</p>
            <p className="text-sm text-secondary-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export const Dashboard: React.FC = () => {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getDashboardStats(),
    refetchInterval: 30000
  })

  interface DashboardStats {
    totalDevices: number
    onlineDevices: number
    onlinePercentage: number
    activeImages: number
    totalDeployments: number
  }

  const stats: DashboardStats = dashboardData?.stats || {
    totalDevices: 0,
    onlineDevices: 0,
    onlinePercentage: 0,
    activeImages: 0,
    totalDeployments: 0
  }
  const devices = dashboardData?.recentDevices || []
  const metrics = dashboardData?.systemMetrics || {}

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Devices"
          value={stats.totalDevices || 0}
          change="+2 this week"
          changeType="positive"
          icon={Monitor}
          loading={isLoading}
        />
        <StatCard
          title="Online Devices"
          value={stats.onlineDevices || 0}
          change={`${stats.onlinePercentage || 0}% uptime`}
          changeType="positive"
          icon={CheckCircle}
          loading={isLoading}
        />
        <StatCard
          title="Active Images"
          value={stats.activeImages || 0}
          change="3 updated today"
          changeType="neutral"
          icon={HardDrive}
          loading={isLoading}
        />
        <StatCard
          title="Deployments"
          value={stats.totalDeployments || 0}
          change="+5 this month"
          changeType="positive"
          icon={Download}
          loading={isLoading}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Status */}
        <div className="lg:col-span-2">
          <DeviceStatus devices={devices} loading={isLoading} />
        </div>

        {/* System Metrics */}
        <div>
          <SystemMetrics metrics={metrics} loading={isLoading} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn btn-outline btn-md flex items-center justify-center">
            <Monitor className="w-4 h-4 mr-2" />
            Register Device
          </button>
          <button className="btn btn-outline btn-md flex items-center justify-center">
            <HardDrive className="w-4 h-4 mr-2" />
            Build Image
          </button>
          <button className="btn btn-outline btn-md flex items-center justify-center">
            <Download className="w-4 h-4 mr-2" />
            Deploy Update
          </button>
        </div>
      </div>
    </div>
  )
}