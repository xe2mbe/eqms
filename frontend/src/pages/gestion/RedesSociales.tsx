import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { PlataformaRS } from '@/types'

const { Title } = Typography

export default function RedesSocialesPage() {
  const [data, setData] = useState<PlataformaRS[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<PlataformaRS | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<PlataformaRS[]>('/catalogos/plataformas-rs')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditItem(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (item: PlataformaRS) => { setEditItem(item); form.setFieldsValue(item); setModalOpen(true) }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editItem) {
        await client.put(`/catalogos/plataformas-rs/${editItem.id}`, values)
        message.success('Plataforma actualizada')
      } else {
        await client.post('/catalogos/plataformas-rs', values)
        message.success('Plataforma creada')
      }
      setModalOpen(false); fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/catalogos/plataformas-rs/${id}`)
      message.success('Plataforma eliminada')
      fetchData()
    } catch { message.error('Error al eliminar') }
  }

  const columns = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre',
      render: (v: string) => <strong>{v}</strong> },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    { title: 'Estado', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag> },
    {
      title: 'Acciones', key: 'actions', width: 100,
      render: (_: unknown, r: PlataformaRS) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar plataforma?" okText="Sí" cancelText="No" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Redes Sociales</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva Plataforma</Button>
      </div>
      <Card className="card-shadow">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>
      <Modal title={editItem ? 'Editar Plataforma' : 'Nueva Plataforma'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="Guardar" cancelText="Cancelar">
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item label="Nombre" name="nombre" rules={[{ required: true }]}>
            <Input placeholder="Facebook, Instagram, YouTube..." />
          </Form.Item>
          <Form.Item label="Descripción" name="descripcion">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Activa" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
