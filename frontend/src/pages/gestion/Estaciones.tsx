import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { Estacion } from '@/types'

const { Title } = Typography

export default function EstacionesPage() {
  const [data, setData] = useState<Estacion[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Estacion | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Estacion[]>('/catalogos/estaciones')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditItem(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (item: Estacion) => { setEditItem(item); form.setFieldsValue(item); setModalOpen(true) }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editItem) {
        await client.put(`/catalogos/estaciones/${editItem.id}`, values)
        message.success('Estación actualizada')
      } else {
        await client.post('/catalogos/estaciones', values)
        message.success('Estación creada')
      }
      setModalOpen(false); fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/catalogos/estaciones/${id}`)
      message.success('Estación eliminada')
      fetchData()
    } catch { message.error('Error al eliminar') }
  }

  const columns = [
    { title: 'QRZ / Indicativo', dataIndex: 'qrz', key: 'qrz',
      render: (v: string) => <strong style={{ color: '#1A569E', fontSize: 15 }}>{v}</strong> },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    { title: 'Estado', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag> },
    {
      title: 'Acciones', key: 'actions', width: 100,
      render: (_: unknown, r: Estacion) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar estación?" okText="Sí" cancelText="No" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Estaciones</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva Estación</Button>
      </div>
      <Card className="card-shadow">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>
      <Modal title={editItem ? 'Editar Estación' : 'Nueva Estación'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="Guardar" cancelText="Cancelar">
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item label="QRZ / Indicativo" name="qrz" rules={[{ required: true }]}>
            <Input style={{ textTransform: 'uppercase', fontWeight: 700 }} maxLength={20} />
          </Form.Item>
          <Form.Item label="Descripción" name="descripcion">
            <Input.TextArea rows={3} placeholder="Estación base FMRE región norte..." />
          </Form.Item>
          <Form.Item label="Activa" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
