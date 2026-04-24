import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Button } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, FileTextOutlined, BarChartOutlined,
  UserOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  TeamOutlined, BookOutlined, SettingOutlined,
  AppstoreOutlined, CalendarOutlined, RadarChartOutlined,
  ShareAltOutlined, ApiOutlined, AudioOutlined, TrophyOutlined, WifiOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'

const { Sider, Header, Content, Footer } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard',
    children: [
      { key: '/dashboard/rf', icon: <WifiOutlined />,    label: 'Dashboard RF' },
      { key: '/dashboard/rs', icon: <ShareAltOutlined />, label: 'Dashboard RS' },
    ],
  },
  { key: '/toma-reportes', icon: <BookOutlined />, label: 'Toma de Reportes',
    children: [
      { key: '/libreta',    icon: <BookOutlined />,    label: 'Libreta RF' },
      { key: '/libreta-rs', icon: <ShareAltOutlined />, label: 'Libreta RS' },
    ],
  },
  { key: '/registros', icon: <FileTextOutlined />, label: 'Registros',
    children: [
      { key: '/reportes',    icon: <WifiOutlined />,    label: 'Registros RF' },
      { key: '/reportes-rs', icon: <ShareAltOutlined />, label: 'Registros RS' },
    ],
  },
  { key: '/estadisticas', icon: <BarChartOutlined />, label: 'Estadísticas',
    children: [
      { key: '/estadisticas/rf', icon: <WifiOutlined />,    label: 'Estadísticas RF' },
      { key: '/estadisticas/rs', icon: <ShareAltOutlined />, label: 'Estadísticas RS' },
    ],
  },
  { key: '/premios', icon: <TrophyOutlined />, label: 'Premios y Distinciones' },
  {
    key: '/gestion', icon: <AppstoreOutlined />, label: 'Gestión',
    children: [
      { key: '/gestion/usuarios',      icon: <TeamOutlined />,      label: 'Usuarios' },
      { key: '/gestion/eventos',       icon: <CalendarOutlined />,  label: 'Eventos' },
      { key: '/gestion/zonas',         icon: <RadarChartOutlined />,label: 'Zonas' },
      { key: '/gestion/sistemas',      icon: <ApiOutlined />,       label: 'Sistemas' },
      { key: '/gestion/estaciones',    icon: <BookOutlined />,      label: 'Estaciones' },
      { key: '/gestion/redes-sociales',icon: <ShareAltOutlined />,  label: 'Redes Sociales' },
      { key: '/gestion/radioexperimentadores', icon: <AudioOutlined />, label: 'Radioexperimentadores' },
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

  const avatarSrc = user?.avatar ?? undefined

  const userMenu = {
    items: [
      { key: 'perfil', icon: <UserOutlined />, label: 'Mi Perfil',
        onClick: () => navigate('/perfil') },
      { key: 'cambiar', icon: <UserOutlined />, label: 'Cambiar contraseña',
        onClick: () => navigate('/cambiar-contrasena') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Cerrar sesión',
        danger: true, onClick: handleLogout },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={220}
        style={{ display: 'flex', flexDirection: 'column' }}>

        {/* ── Branding ── */}
        <div style={{
          padding: collapsed ? '12px 6px' : '12px 16px',
          borderBottom: '1px solid #ffffff15',
          display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          overflow: 'hidden', transition: 'all .2s',
        }}>
          <img src="/LogoFMRE.png" alt="FMRE"
            style={{ height: collapsed ? 36 : 44, width: 'auto', flexShrink: 0, transition: 'height .2s' }} />
          {!collapsed && (
            <div style={{ color: '#fff', lineHeight: 1.2 }}>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>QMS</div>
              <div style={{ fontWeight: 500, fontSize: 10, opacity: 0.75, whiteSpace: 'nowrap' }}>FMRE</div>
            </div>
          )}
        </div>

        {/* ── Menu ── */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['/dashboard', '/registros', '/toma-reportes', '/estadisticas', '/gestion']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, flex: 1, overflowY: 'auto' }}
        />

        {/* ── IARU logo at bottom ── */}
        <div style={{
          padding: collapsed ? '12px 6px' : '12px 16px',
          borderTop: '1px solid #ffffff15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src="/iaru.png" alt="IARU"
            style={{ height: collapsed ? 28 : 36, width: 'auto', opacity: 0.85, transition: 'height .2s' }} />
          {!collapsed && (
            <span style={{ color: '#ffffff70', fontSize: 10, marginLeft: 8, whiteSpace: 'nowrap' }}>
              Miembro IARU
            </span>
          )}
        </div>
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
              <Avatar
                src={avatarSrc}
                style={{ backgroundColor: '#1A569E' }}
                icon={<UserOutlined />}
              />
              <div style={{ lineHeight: 1.2 }}>
                <Typography.Text strong style={{ display: 'block' }}>{user?.full_name}</Typography.Text>
                {user?.indicativo && (
                  <Typography.Text style={{ fontSize: 11, color: '#1A569E', fontWeight: 700 }}>
                    {user.indicativo}
                  </Typography.Text>
                )}
              </div>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>

        <Footer style={{
          textAlign: 'center', padding: '10px 24px',
          color: '#999', fontSize: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <span>QMS – Federación Mexicana de Radioexperimentadores A.C. © {new Date().getFullYear()}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Diseñado por{' '}
            <a href="https://rcg.org.mx" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#666', textDecoration: 'none' }}>
              <img src="/rcg_small.png" alt="Radio Club Guadiana" style={{ height: 20, width: 'auto' }} />
              Radio Club Guadiana
            </a>
          </span>
        </Footer>
      </Layout>
    </Layout>
  )
}
