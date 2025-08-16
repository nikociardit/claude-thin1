import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Dashboard } from '@/pages/Dashboard'
import { DeviceManagement } from '@/pages/DeviceManagement'
import { ImageManagement } from '@/pages/ImageManagement'
import { Deployment } from '@/pages/Deployment'
import { Monitoring } from '@/pages/Monitoring'
import { Analytics } from '@/pages/Analytics'
import { Settings } from '@/pages/Settings'

function App() {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/devices" element={<DeviceManagement />} />
        <Route path="/images" element={<ImageManagement />} />
        <Route path="/deployment" element={<Deployment />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

export default App