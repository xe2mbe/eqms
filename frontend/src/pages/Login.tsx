import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

// ─── Splash de bienvenida ─────────────────────────────────────────────────────

function WelcomeSplash({ nombre, onDone }: { nombre: string; onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out'),  2200)
    const t3 = setTimeout(onDone,                 2900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const opacity   = phase === 'out' ? 0 : 1
  const scale     = phase === 'in'  ? 0.7 : phase === 'hold' ? 1 : 1.05
  const logoBlur  = phase === 'in'  ? 12  : 0
  const transition = phase === 'in'
    ? 'opacity .6s ease, transform .6s cubic-bezier(.34,1.56,.64,1), filter .6s ease'
    : 'opacity .7s ease, transform .7s ease'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #001529 0%, #1A569E 60%, #0d3d73 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: `opacity .7s ease`,
      opacity,
    }}>
      {/* Anillos de radio animados */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 120 + i * 140,
            height: 120 + i * 140,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.08)',
            animation: `ripple ${1.4 + i * 0.5}s ease-out ${i * 0.3}s infinite`,
          }} />
        ))}
      </div>

      {/* Logo + texto */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
        transform: `scale(${scale})`,
        filter: `blur(${logoBlur}px)`,
        transition,
      }}>
        {/* Halo detrás del logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <img
            src="/LogoFMRE.png"
            alt="FMRE"
            style={{
              height: 110,
              width: 'auto',
              filter: 'drop-shadow(0 0 20px rgba(100,180,255,0.7)) drop-shadow(0 0 40px rgba(100,180,255,0.4))',
              position: 'relative',
              zIndex: 1,
            }}
          />
        </div>

        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, letterSpacing: 5,
            color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', marginBottom: 6,
          }}>
            Federación Mexicana de Radioexperimentadores
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3, marginBottom: 4 }}>
            QMS
          </div>
          <div style={{
            fontSize: 14, color: 'rgba(255,255,255,0.75)',
            fontStyle: 'italic', letterSpacing: 1,
          }}>
            Bienvenido, <span style={{ fontWeight: 700, fontStyle: 'normal', color: '#7dd3fc' }}>
              {nombre}
            </span>
          </div>
        </div>

        {/* Indicador de carga */}
        <div style={{
          width: 180, height: 2,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 2, overflow: 'hidden',
          marginTop: 8,
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #38bdf8, #818cf8, #38bdf8)',
            backgroundSize: '200% 100%',
            borderRadius: 2,
            animation: 'shimmer 1.5s linear infinite',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes ripple {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: .6; }
          100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0;  }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1);    opacity: .8; }
          50%       { transform: scale(1.15); opacity: .4; }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

// ─── Login page ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [splash, setSplash] = useState<string | null>(null)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async ({ username, password }: { username: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      const store = useAuthStore.getState()
      const nombre = store.user?.full_name || store.user?.username || username
      setSplash(nombre)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Error al iniciar sesión'
      setError(msg)
      setLoading(false)
    }
  }

  if (splash !== null) {
    return <WelcomeSplash nombre={splash} onDone={() => navigate('/')} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #001529 0%, #1A569E 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 420, borderRadius: 12 }}
        styles={{ body: { padding: '40px 36px' } }}>
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="FMRE" height={64}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <Title level={3} style={{ margin: 0, color: '#1A569E' }}>
            Sistema de Gestión QSO
          </Title>
          <Text type="secondary">Federación Mexicana de Radioexperimentadores A.C.</Text>
        </Space>

        {error && (
          <Alert type="error" message={error} showIcon closable
            onClose={() => setError(null)} style={{ marginBottom: 16 }} />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Ingresa tu usuario' }]}>
            <Input prefix={<UserOutlined />} placeholder="Usuario" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" block loading={loading} size="large">
              Iniciar sesión
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
