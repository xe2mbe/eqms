import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch, ColorPicker,
} from 'antd'
import type { Color } from 'antd/es/color-picker'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { Evento } from '@/types'

const { Title } = Typography

export default function EventosPage() {
  const [data, setData] = useState<Evento[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Evento | null>(null)
  const [formColor, setFormColor] = useState('#1677ff')
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Evento[]>('/catalogos/eventos')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => {
    setEditItem(null); form.resetFields()
    setFormColor('#1677ff'); setModalOpen(true)
  }

  const openEdit = (item: Evento) => {
    setEditItem(item); form.setFieldsValue(item)
    setFormColor(item.color ?? '#1677ff'); setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = { ...values, color: formColor }
    try {
      if (editItem) {
        await client.put(`/catalogos/eventos/${editItem.id}`, payload)
        message.success('Evento actualizado')
      } else {
        await client.post('/catalogos/eventos', payload)
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
    {
      title: 'Tipo / Nombre', dataIndex: 'tipo', key: 'tipo', width: 200,
      render: (v: string, r: Evento) => {
        const c = r.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 700, fontSize: 13 }}>{v}</Tag>
      },
    },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    {
      title: 'Estado', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
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
          <Form.Item label="Color del evento">
            <Space align="center">
              <ColorPicker
                value={formColor}
                onChange={(c: Color) => setFormColor(c.toHexString())}
                showText
                presets={[{
                  label: 'Sugeridos',
                  colors: [
                    '#1677ff', '#52c41a', '#fa8c16', '#722ed1',
                    '#eb2f96', '#f5222d', '#13c2c2', '#faad14',
                    '#2f54eb', '#389e0d', '#d46b08', '#531dab',
                  ],
                }]}
              />
              <Tag style={{
                backgroundColor: formColor, borderColor: formColor,
                color: '#fff', fontWeight: 700, fontSize: 13,
              }}>
                {form.getFieldValue('tipo') || 'Evento'}
              </Tag>
            </Space>
          </Form.Item>
          <Form.Item label="Activo" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
