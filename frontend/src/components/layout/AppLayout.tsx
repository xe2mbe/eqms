import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Button } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, FileTextOutlined, BarChartOutlined,
  UserOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  TeamOutlined, BookOutlined, SettingOutlined,
  AppstoreOutlined, CalendarOutlined, RadarChartOutlined,
  WifiOutlined, ShareAltOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'

const { Sider, Header, Content, Footer } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/toma-reportes', icon: <BookOutlined />, label: 'Toma de Reportes',
    children: [
      { key: '/libreta', icon: <BookOutlined />, label: 'Libreta' },
    ],
  },
  { key: '/reportes', icon: <FileTextOutlined />, label: 'Registros' },
  { key: '/estadisticas', icon: <BarChartOutlined />, label: 'Estadísticas' },
  {
    key: '/gestion', icon: <AppstoreOutlined />, label: 'Gestión',
    children: [
      { key: '/gestion/usuarios',      icon: <TeamOutlined />,      label: 'Usuarios' },
      { key: '/gestion/eventos',       icon: <CalendarOutlined />,  label: 'Eventos' },
      { key: '/gestion/zonas',         icon: <RadarChartOutlined />,label: 'Zonas' },
      { key: '/gestion/sistemas',      icon: <WifiOutlined />,      label: 'Sistemas' },
      { key: '/gestion/estaciones',    icon: <BookOutlined />,      label: 'Estaciones' },
      { key: '/gestion/redes-sociales',icon: <ShareAltOutlined />,  label: 'Redes Sociales' },
      { key: '/gestion/radioexperimentadores', icon: <WifiOutlined />, label: 'Radioexperimentadores' },
    ],
  },
  { key: '/configuracion', icon: <SettingOutlined />, label: 'Configuración' },
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userMenu = {
    items: [
      { key: 'cambiar', icon: <UserOutlined />, label: 'Cambiar contraseña',
        onClick: () => navigate('/cambiar-contrasena') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Cerrar sesión',
        danger: true, onClick: handleLogout },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={220}>
        <div style={{
          padding: collapsed ? '16px 8px' : '16px 24px',
          color: '#fff', fontWeight: 700,
          fontSize: collapsed ? 12 : 16,
          borderBottom: '1px solid #ffffff15',
          whiteSpace: 'nowrap', overflow: 'hidden',
          transition: 'all .2s',
        }}>
          {collapsed ? 'QMS' : 'QMS – FMRE'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['/reportes', '/toma-reportes', '/gestion']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,.1)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1A569E' }} icon={<UserOutlined />} />
              <Typography.Text strong>{user?.full_name}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>

        <Footer style={{ textAlign: 'center', padding: '12px 24px', color: '#999', fontSize: 12 }}>
          QMS – Federación Mexicana de Radioexperimentadores A.C. © {new Date().getFullYear()}
        </Footer>
      </Layout>
    </Layout>
  )
}
