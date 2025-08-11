import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Monitor,
  HardDrive,
  Rocket,
  Activity,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Server
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Devices', href: '/devices', icon: Monitor },
  { name: 'Images', href: '/images', icon: HardDrive },
  { name: 'Deployment', href: '/deployment', icon: Rocket },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings }
]

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-secondary-900/50" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-secondary-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b border-secondary-200">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-primary-600 rounded-lg mr-3">
                <Server className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-secondary-900">VDI Platform</h1>
                <p className="text-xs text-secondary-500">Management Console</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-secondary-400 hover:text-secondary-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              const Icon = item.icon
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
                    ${isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary-600' : 'text-secondary-400'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="border-t border-secondary-200 p-4">
            <div className="flex items-center mb-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary-100 rounded-full mr-3">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-secondary-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${user?.role === 'admin' ? 'bg-success-100 text-success-800' :
                  user?.role === 'operator' ? 'bg-warning-100 text-warning-800' :
                  'bg-secondary-100 text-secondary-800'}
              `}>
                {user?.role}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-xs text-secondary-500 hover:text-danger-600 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-secondary-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-secondary-400 hover:text-secondary-600 mr-4"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-secondary-900">
                {navigation.find(item => item.href === location.pathname)?.name || 'Dashboard'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center text-sm text-secondary-500">
                Last login: {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="container-wide py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}