import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { Evento } from '@/types'

const { Title } = Typography

export default function EventosPage() {
  const [data, setData] = useState<Evento[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Evento | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Evento[]>('/catalogos/eventos')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditItem(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (item: Evento) => { setEditItem(item); form.setFieldsValue(item); setModalOpen(true) }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editItem) {
        await client.put(`/catalogos/eventos/${editItem.id}`, values)
        message.success('Evento actualizado')
      } else {
        await client.post('/catalogos/eventos', values)
        message.success('Evento creado')
      }
      setModalOpen(false); fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/catalogos/eventos/${id}`)
      message.success('Evento eliminado')
      fetchData()
    } catch { message.error('Error al eliminar') }
  }

  const columns = [
    { title: 'Tipo / Nombre', dataIndex: 'tipo', key: 'tipo',
      render: (v: string) => <strong>{v}</strong> },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    { title: 'Estado', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag> },
    {
      title: 'Acciones', key: 'actions', width: 100,
      render: (_: unknown, r: Evento) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar evento?" okText="Sí" cancelText="No" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Eventos</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Evento</Button>
      </div>
      <Card className="card-shadow">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>
      <Modal title={editItem ? 'Editar Evento' : 'Nuevo Evento'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="Guardar" cancelText="Cancelar">
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item label="Tipo / Nombre" name="tipo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Descripción" name="descripcion">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Activo" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
