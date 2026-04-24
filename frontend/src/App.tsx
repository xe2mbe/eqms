import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/common/ProtectedRoute'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import DashboardRSPage from '@/pages/DashboardRS'
import ReportesPage from '@/pages/Reportes'
import NuevoReportePage from '@/pages/NuevoReporte'
import EstadisticasPage from '@/pages/Estadisticas'
import EstadisticasRSPage from '@/pages/EstadisticasRS'
import ChangePasswordPage from '@/pages/ChangePassword'
import LibretaPage from '@/pages/Libreta'
import LibretaRSPage from '@/pages/LibretaRS'
import ConfiguracionPage from '@/pages/Configuracion'
import UsuariosPage from '@/pages/gestion/Usuarios'
import EventosPage from '@/pages/gestion/Eventos'
import ZonasPage from '@/pages/gestion/Zonas'
import SistemasPage from '@/pages/gestion/Sistemas'
import EstacionesPage from '@/pages/gestion/Estaciones'
import RedesSocialesPage from '@/pages/gestion/RedesSociales'
import RadioexperimentadoresPage from '@/pages/gestion/Radioexperimentadores'
import PerfilPage from '@/pages/Perfil'
import PremiosPage from '@/pages/Premios'

export default function App() {
  const { checkAuth, isLoading } = useAuthStore()

  useEffect(() => { checkAuth() }, [checkAuth])

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large">
          <div style={{ padding: 32, color: '#999' }}>Cargando...</div>
        </Spin>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard/rf" replace />} />
            <Route path="/dashboard" element={<Navigate to="/dashboard/rf" replace />} />
            <Route path="/dashboard/rf" element={<DashboardPage />} />
            <Route path="/dashboard/rs" element={<DashboardRSPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/reportes/nuevo" element={<NuevoReportePage />} />
            <Route path="/libreta" element={<LibretaPage />} />
            <Route path="/libreta-rs" element={<LibretaRSPage />} />
            <Route path="/estadisticas" element={<Navigate to="/estadisticas/rf" replace />} />
            <Route path="/estadisticas/rf" element={<EstadisticasPage />} />
            <Route path="/estadisticas/rs" element={<EstadisticasRSPage />} />
            <Route path="/gestion/usuarios"       element={<UsuariosPage />} />
            <Route path="/gestion/eventos"        element={<EventosPage />} />
            <Route path="/gestion/zonas"          element={<ZonasPage />} />
            <Route path="/gestion/sistemas"       element={<SistemasPage />} />
            <Route path="/gestion/estaciones"     element={<EstacionesPage />} />
            <Route path="/gestion/redes-sociales" element={<RedesSocialesPage />} />
            <Route path="/gestion/radioexperimentadores" element={<RadioexperimentadoresPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/premios" element={<PremiosPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
