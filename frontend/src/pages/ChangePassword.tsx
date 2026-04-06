import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

export default function ChangePasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { checkAuth } = useAuthStore()

  const onFinish = async (values: { new_password: string; confirm_password: string }) => {
    setLoading(true)
    setError(null)
    try {
      await authApi.changePassword(values.new_password, values.confirm_password)
      await checkAuth()
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f0f2f5', padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 400, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center', marginBottom: 24 }}>
          <LockOutlined style={{ fontSize: 40, color: '#1A569E' }} />
          <Title level={4} style={{ margin: 0 }}>Cambio de contraseña requerido</Title>
          <Text type="secondary">Debes establecer una nueva contraseña para continuar.</Text>
        </Space>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Nueva contraseña"
            name="new_password"
            rules={[
              { required: true, message: 'Requerido' },
              { min: 8, message: 'Mínimo 8 caracteres' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            label="Confirmar contraseña"
            name="confirm_password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Requerido' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve()
                  return Promise.reject('Las contraseñas no coinciden')
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Cambiar contraseña
          </Button>
        </Form>
      </Card>
    </div>
  )
}
