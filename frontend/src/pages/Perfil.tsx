import { useState } from 'react'
import {
  Card, Form, Input, Button, Avatar, Upload, Typography,
  Space, message, Divider, Tag,
} from 'antd'
import {
  UserOutlined, SaveOutlined, UploadOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

export default function PerfilPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const avatarSrc = previewUrl ?? user?.avatar ?? undefined

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const { data } = await authApi.updateMe(values)
      setUser(data)
      message.success('Perfil actualizado')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const beforeUpload = async (file: RcFile) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      message.error('Solo se permiten imágenes JPG, PNG o WebP')
      return false
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('La imagen no debe superar 2 MB')
      return false
    }

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (e) => setPreviewUrl(e.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to server
    setUploadingAvatar(true)
    try {
      const { data } = await authApi.uploadAvatar(file)
      setUser(data)
      message.success('Foto de perfil actualizada')
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al subir la imagen')
      setPreviewUrl(null)
    } finally {
      setUploadingAvatar(false)
    }
    return false // prevent antd default upload
  }

  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Volver</Button>
        <Title level={4} style={{ margin: 0 }}>Mi Perfil</Title>
      </Space>

      <Card className="card-shadow">
        {/* ── Avatar section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <Avatar
            size={96}
            src={avatarSrc}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1A569E', marginBottom: 12 }}
          />
          <Upload
            showUploadList={false}
            beforeUpload={beforeUpload}
            accept="image/jpeg,image/png,image/webp"
          >
            <Button icon={<UploadOutlined />} loading={uploadingAvatar} size="small">
              Cambiar foto
            </Button>
          </Upload>
          <Text type="secondary" style={{ fontSize: 11, marginTop: 6 }}>
            JPG, PNG o WebP · máx 2 MB
          </Text>
        </div>

        <Divider style={{ margin: '0 0 20px' }} />

        {/* ── Info de sólo lectura ── */}
        <Space style={{ marginBottom: 20, flexWrap: 'wrap' as const }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>Usuario</Text>
            <div><Text strong>{user?.username}</Text></div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>Rol</Text>
            <div>
              <Tag color={user?.role === 'admin' ? 'red' : 'blue'}>
                {user?.role === 'admin' ? 'Administrador' : 'Operador'}
              </Tag>
            </div>
          </div>
        </Space>

        {/* ── Editable form ── */}
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            full_name: user?.full_name,
            email: user?.email,
            telefono: user?.telefono,
            indicativo: user?.indicativo,
          }}
          onFinish={handleSave}
        >
          <Form.Item label="Nombre completo" name="full_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item label="Indicativo" name="indicativo">
            <Input
              placeholder="XE2MBE"
              style={{ textTransform: 'uppercase', fontWeight: 700 }}
              onChange={(e) => form.setFieldValue('indicativo', e.target.value.toUpperCase())}
            />
          </Form.Item>

          <Form.Item label="Correo electrónico" name="email">
            <Input type="email" />
          </Form.Item>

          <Form.Item label="Teléfono" name="telefono">
            <Input />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Guardar cambios
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
