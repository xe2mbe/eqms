import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { Sistema } from '@/types'

const { Title } = Typography

export default function SistemasPage() {
  const [data, setData] = useState<Sistema[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Sistema | null>(null)
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Sistema[]>('/catalogos/sistemas')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => { setEditItem(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (item: Sistema) => { setEditItem(item); form.setFieldsValue(item); setModalOpen(true) }

  const handleSave = async () => {
    const values = await form.validateFields()
    try {
      if (editItem) {
        await client.put(`/catalogos/sistemas/${editItem.id}`, values)
        message.success('Sistema actualizado')
      } else {
        await client.post('/catalogos/sistemas', values)
        message.success('Sistema creado')
      }
      setModalOpen(false); fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/catalogos/sistemas/${id}`)
      message.success('Sistema eliminado')
      fetchData()
    } catch { message.error('Error al eliminar') }
  }

  const columns = [
    { title: 'Código', dataIndex: 'codigo', key: 'codigo',
      render: (v: string) => <Tag color="blue"><strong>{v}</strong></Tag> },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    { title: 'Estado', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag> },
    {
      title: 'Acciones', key: 'actions', width: 100,
      render: (_: unknown, r: Sistema) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar sistema?" okText="Sí" cancelText="No" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Sistemas</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nuevo Sistema</Button>
      </div>
      <Card className="card-shadow">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} size="small" />
      </Card>
      <Modal title={editItem ? 'Editar Sistema' : 'Nuevo Sistema'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} okText="Guardar" cancelText="Cancelar">
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item label="Código (ej. DMR-1)" name="codigo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Nombre" name="nombre" rules={[{ required: true }]}>
            <Input placeholder="Red DMR Nacional" />
          </Form.Item>
          <Form.Item label="Activo" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
