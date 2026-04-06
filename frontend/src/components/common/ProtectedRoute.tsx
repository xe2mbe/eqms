import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Redirigir a cambio de contraseña obligatorio
  if (user?.must_change_password) return <Navigate to="/cambiar-contrasena" replace />

  return <Outlet />
}
