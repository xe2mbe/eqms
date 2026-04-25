import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select,
  Typography, Card, Popconfirm, message, Tooltip, Row, Col,
  Alert, Checkbox, Segmented,
} from 'antd'
import {
  PlusOutlined, EditOutlined, LockOutlined,
  MailOutlined, StopOutlined, CheckCircleOutlined, CopyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import client from '@/api/client'
import type { Usuario } from '@/types'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

export default function UsuariosPage() {
  const { user: me } = useAuthStore()
  const [data, setData] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [resetModal, setResetModal] = useState<Usuario | null>(null)
  const [resetMode, setResetMode] = useState<'auto' | 'manual'>('auto')
  const [resetPwd, setResetPwd] = useState('')
  const [resetMustChange, setResetMustChange] = useState(true)
  const [resetSendEmail, setResetSendEmail] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Usuario[]>('/usuarios')
      setData(res)
    } finally { setLoading(false) }
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
      setModalOpen(false); fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDesactivar = async (u: Usuario) => {
    try {
      await client.patch(`/usuarios/${u.id}/desactivar`)
      message.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error')
    }
  }

  const handleReenviarCorreo = async (u: Usuario) => {
    try {
      await client.post(`/usuarios/${u.id}/reenviar-correo`)
      message.success(`Correo enviado a ${u.email}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al enviar correo')
    }
  }

  const openResetModal = (u: Usuario) => {
    setResetModal(u)
    setResetMode('auto')
    setResetPwd('')
    setResetMustChange(true)
    setResetSendEmail(false)
    setResetResult(null)
  }

  const closeResetModal = () => {
    setResetModal(null)
    setResetResult(null)
  }

  const handleResetPassword = async () => {
    if (!resetModal) return
    if (resetMode === 'manual' && resetPwd.length < 8) {
      message.warning('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setResetLoading(true)
    try {
      const { data } = await client.post<{ ok: boolean; password: string }>(
        `/usuarios/${resetModal.id}/reset-password`,
        {
          new_password: resetMode === 'manual' ? resetPwd : '',
          must_change_password: resetMustChange,
          enviar_correo: resetSendEmail,
        }
      )
      setResetResult(data.password)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al resetear contraseña')
    } finally {
      setResetLoading(false)
    }
  }

  const fmt = (iso?: string) => iso ? dayjs(iso).format('DD/MM/YY HH:mm') : '—'

  const columns = [
    {
      title: 'Usuario / Nombre', key: 'nombre',
      render: (_: unknown, r: Usuario) => (
        <div>
          <strong>{r.username}</strong>
          <div style={{ fontSize: 12, color: '#666' }}>{r.full_name}</div>
        </div>
      ),
    },
    {
      title: 'Contacto', key: 'contacto',
      render: (_: unknown, r: Usuario) => (
        <div style={{ fontSize: 12 }}>
          {r.email && <div><MailOutlined style={{ marginRight: 4 }} />{r.email}</div>}
          {r.telefono && <div>📞 {r.telefono}</div>}
          {r.indicativo && <Tag color="blue" style={{ marginTop: 2 }}>{r.indicativo}</Tag>}
        </div>
      ),
    },
    {
      title: 'Rol', dataIndex: 'role', key: 'role', width: 100,
      render: (v: string) => <Tag color={v === 'admin' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: 'Estado', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Creación', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
    },
    {
      title: 'Último login', dataIndex: 'last_login', key: 'last_login', width: 110,
      render: (v?: string) => <Text style={{ fontSize: 12 }}>{fmt(v)}</Text>,
    },
    {
      title: 'Acciones', key: 'actions', width: 140,
      render: (_: unknown, r: Usuario) => (
        <Space size={4}>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Resetear contraseña">
            <Button size="small" icon={<LockOutlined />}
              onClick={() => openResetModal(r)} />
          </Tooltip>
          <Tooltip title={r.email ? 'Reenviar correo de bienvenida' : 'Sin correo registrado'}>
            <Button size="small" icon={<MailOutlined />}
              disabled={!r.email}
              onClick={() => handleReenviarCorreo(r)} />
          </Tooltip>
          {r.id !== me?.id && (
            <Popconfirm
              title={r.is_active
                ? `¿Desactivar a ${r.full_name}?`
                : `¿Activar a ${r.full_name}?`}
              okText="Sí" cancelText="No"
              okButtonProps={{ danger: r.is_active }}
              onConfirm={() => handleDesactivar(r)}
            >
              <Tooltip title={r.is_active ? 'Desactivar' : 'Activar'}>
                <Button size="small"
                  danger={r.is_active}
                  icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Usuarios</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Usuario</Button>
      </div>

      <Card className="card-shadow">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>

      {/* Modal crear / editar */}
      <Modal
        title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar" cancelText="Cancelar"
        width={560}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Usuario" name="username"
                rules={[{ required: !editUser, message: 'Requerido' }]}>
                <Input disabled={Boolean(editUser)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              {!editUser && (
                <Form.Item label="Contraseña" name="password"
                  rules={[{ required: true, min: 8, message: 'Mínimo 8 caracteres' }]}>
                  <Input.Password />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Form.Item label="Nombre completo" name="full_name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Correo electrónico" name="email">
                <Input type="email" prefix={<MailOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Teléfono" name="telefono">
                <Input placeholder="+52 55 1234 5678" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Indicativo" name="indicativo">
                <Input style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Rol" name="role" rules={[{ required: true }]}
                initialValue="operador">
                <Select options={[
                  { value: 'operador', label: 'Operador' },
                  { value: 'admin', label: 'Administrador' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          {editUser && (
            <Form.Item label="Estado" name="is_active">
              <Select options={[
                { value: true, label: 'Activo' },
                { value: false, label: 'Inactivo' },
              ]} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Modal reset contraseña */}
      <Modal
        title={`Resetear contraseña — ${resetModal?.full_name}`}
        open={Boolean(resetModal)}
        onCancel={closeResetModal}
        footer={resetResult ? (
          <Button onClick={closeResetModal}>Cerrar</Button>
        ) : (
          <Space>
            <Button onClick={closeResetModal}>Cancelar</Button>
            <Button
              type="primary"
              loading={resetLoading}
              disabled={resetMode === 'manual' && resetPwd.length < 8}
              onClick={handleResetPassword}
            >
              Resetear
            </Button>
          </Space>
        )}
      >
        {resetResult ? (
          <Alert
            type="success"
            message="Contraseña reseteada"
            description={
              <div>
                <div style={{ marginBottom: 8 }}>La nueva contraseña es:</div>
                <Input
                  value={resetResult}
                  readOnly
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                  addonAfter={
                    <CopyOutlined
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult!)
                        message.success('Contraseña copiada')
                      }}
                    />
                  }
                />
                {resetSendEmail && (
                  <div style={{ marginTop: 8, color: '#52c41a' }}>
                    Correo enviado a {resetModal?.email}
                  </div>
                )}
              </div>
            }
          />
        ) : (
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item label="Modo de generación">
              <Segmented
                block
                options={[
                  { label: 'Auto-generar', value: 'auto' },
                  { label: 'Manual', value: 'manual' },
                ]}
                value={resetMode}
                onChange={(v) => { setResetMode(v as 'auto' | 'manual'); setResetPwd('') }}
              />
            </Form.Item>
            {resetMode === 'manual' && (
              <Form.Item label="Nueva contraseña" extra="Mínimo 8 caracteres">
                <Input.Password
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  placeholder="Nueva contraseña..."
                />
              </Form.Item>
            )}
            <Form.Item>
              <Space direction="vertical" size={8}>
                <Checkbox
                  checked={resetMustChange}
                  onChange={e => setResetMustChange(e.target.checked)}
                >
                  Solicitar cambio de contraseña en el próximo inicio de sesión
                </Checkbox>
                <Checkbox
                  checked={resetSendEmail}
                  onChange={e => setResetSendEmail(e.target.checked)}
                  disabled={!resetModal?.email}
                >
                  Enviar correo con la nueva contraseña
                  {!resetModal?.email && (
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                      (sin correo registrado)
                    </Text>
                  )}
                </Checkbox>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
