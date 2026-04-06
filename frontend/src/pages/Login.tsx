import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const onFinish = async ({ username, password }: { username: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Error al iniciar sesión'
      setError(msg)
    } finally {
      setLoading(false)
    }
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
