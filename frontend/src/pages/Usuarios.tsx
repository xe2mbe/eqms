import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  Typography, Card, Popconfirm, message, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { Usuario } from '@/types'
import { useAuthStore } from '@/store/authStore'

const { Title } = Typography

export default function UsuariosPage() {
  const { user: me } = useAuthStore()
  const [data, setData] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Usuario[]>('/usuarios')
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => { setEditUser(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (u: Usuario) => {
    setEditUser(u)
    form.setFieldsValue({ ...u, password: undefined })
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editUser) {
        await client.put(`/usuarios/${editUser.id}`, values)
        message.success('Usuario actualizado')
      } else {
        await client.post('/usuarios', values)
        message.success('Usuario creado')
      }
      setModalOpen(false)
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/usuarios/${id}`)
      message.success('Usuario eliminado')
      fetchData()
    } catch { message.error('Error al eliminar') }
  }

  const handleResetPassword = async (id: number) => {
    const pwd = prompt('Nueva contraseña temporal:')
    if (!pwd) return
    try {
      await client.post(`/usuarios/${id}/reset-password`, { new_password: pwd })
      message.success('Contraseña reseteada. El usuario debe cambiarla al próximo login.')
    } catch { message.error('Error al resetear contraseña') }
  }

  const columns = [
    { title: 'Usuario', dataIndex: 'username', key: 'username',
      render: (v: string) => <strong>{v}</strong> },
    { title: 'Nombre', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Indicativo', dataIndex: 'indicativo', key: 'indicativo' },
    { title: 'Rol', dataIndex: 'role', key: 'role',
      render: (v: string) => <Tag color={v === 'admin' ? 'red' : 'blue'}>{v}</Tag> },
    { title: 'Estado', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag> },
    {
      title: 'Acciones', key: 'actions',
      render: (_: unknown, record: Usuario) => (
        <Space>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>
          <Tooltip title="Resetear contraseña">
            <Button size="small" icon={<LockOutlined />} onClick={() => handleResetPassword(record.id)} />
          </Tooltip>
          {record.id !== me?.id && (
            <Popconfirm
              title={`¿Eliminar a ${record.full_name}?`}
              okText="Eliminar" okButtonProps={{ danger: true }} cancelText="Cancelar"
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="Eliminar"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Gestión de Usuarios</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Usuario</Button>
      </div>

      <Card className="card-shadow">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>

      <Modal
        title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Usuario" name="username" rules={[{ required: !editUser, message: 'Requerido' }]}>
            <Input disabled={Boolean(editUser)} />
          </Form.Item>
          {!editUser && (
            <Form.Item label="Contraseña" name="password" rules={[{ required: true, min: 8 }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="Nombre completo" name="full_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input type="email" />
          </Form.Item>
          <Form.Item label="Indicativo" name="indicativo">
            <Input style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item label="Rol" name="role" rules={[{ required: true }]}>
            <Select options={[{ value: 'operador', label: 'Operador' }, { value: 'admin', label: 'Administrador' }]} />
          </Form.Item>
          <Form.Item label="Estado" name="is_active" initialValue={true}>
            <Select options={[{ value: true, label: 'Activo' }, { value: false, label: 'Inactivo' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
