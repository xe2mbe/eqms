import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch, ColorPicker,
} from 'antd'
import type { Color } from 'antd/es/color-picker'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import client from '@/api/client'
import type { Sistema } from '@/types'

const { Title } = Typography

export default function SistemasPage() {
  const [data, setData] = useState<Sistema[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Sistema | null>(null)
  const [formColor, setFormColor] = useState('#1677ff')
  const [form] = Form.useForm()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Sistema[]>('/catalogos/sistemas')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => {
    setEditItem(null)
    form.resetFields()
    setFormColor('#1677ff')
    setModalOpen(true)
  }

  const openEdit = (item: Sistema) => {
    setEditItem(item)
    form.setFieldsValue(item)
    setFormColor(item.color ?? '#1677ff')
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = { ...values, color: formColor }
    try {
      if (editItem) {
        await client.put(`/catalogos/sistemas/${editItem.id}`, payload)
        message.success('Sistema actualizado')
      } else {
        await client.post('/catalogos/sistemas', payload)
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
    {
      title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 140,
      render: (v: string, r: Sistema) => {
        const c = r.color ?? '#1677ff'
        return (
          <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {v}
          </Tag>
        )
      },
    },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Estado', dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
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

      <Modal
        title={editItem ? 'Editar Sistema' : 'Nuevo Sistema'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar" cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item label="Código (ej. DMR-1)" name="codigo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Nombre" name="nombre" rules={[{ required: true }]}>
            <Input placeholder="Red DMR Nacional" />
          </Form.Item>
          <Form.Item label="Color del sistema">
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
                {form.getFieldValue('codigo') || 'SIS'}
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
