import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/common/ProtectedRoute'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import ReportesPage from '@/pages/Reportes'
import NuevoReportePage from '@/pages/NuevoReporte'
import EstadisticasPage from '@/pages/Estadisticas'
import UsuariosPage from '@/pages/Usuarios'
import ChangePasswordPage from '@/pages/ChangePassword'

export default function App() {
  const { checkAuth, isLoading } = useAuthStore()

  useEffect(() => { checkAuth() }, [checkAuth])

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Cargando..." />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/reportes/nuevo" element={<NuevoReportePage />} />
            <Route path="/estadisticas" element={<EstadisticasPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
