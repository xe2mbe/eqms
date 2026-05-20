import { useEffect } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch, ColorPicker, Checkbox,
} from 'antd'
import type { Color } from 'antd/es/color-picker'
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons'
import { useState } from 'react'
import client from '@/api/client'
import type { Evento } from '@/types'

const { Title } = Typography

const DIAS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
]

export default function EventosPage() {
  const [data, setData] = useState<Evento[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Evento | null>(null)
  const [formColor, setFormColor] = useState('#1677ff')
  const [form] = Form.useForm()

  // Watch recurrente to show/hide day selector
  const recurrenteWatch = Form.useWatch('recurrente', form)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await client.get<Evento[]>('/catalogos/eventos')
      setData(res)
    } finally { setLoading(false) }
  }

  const openCreate = () => {
    setEditItem(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true, recurrente: false, dias_semana: [] })
    setFormColor('#1677ff')
    setModalOpen(true)
  }

  const openEdit = (item: Evento) => {
    setEditItem(item)
    form.setFieldsValue({
      tipo:        item.tipo,
      descripcion: item.descripcion,
      is_active:   item.is_active,
      recurrente:  item.recurrente ?? false,
      dias_semana: item.dias_semana ?? [],
    })
    setFormColor(item.color ?? '#1677ff')
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      color:       formColor,
      dias_semana: values.recurrente ? (values.dias_semana ?? []) : [],
    }
    try {
      if (editItem) {
        await client.put(`/catalogos/eventos/${editItem.id}`, payload)
        message.success('Evento actualizado')
      } else {
        await client.post('/catalogos/eventos', payload)
        message.success('Evento creado')
      }
      setModalOpen(false); fetchData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || 'Error al guardar')
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
        return (
          <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 700, fontSize: 13 }}>
            {v}
          </Tag>
        )
      },
    },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    {
      title: 'Recurrencia', key: 'recurrencia', width: 220,
      render: (_: unknown, r: Evento) => {
        if (!r.recurrente) return <Tag color="default">Evento único</Tag>
        const dias = (r.dias_semana ?? [])
        if (!dias.length) return <Tag icon={<SyncOutlined />} color="processing">Recurrente</Tag>
        return (
          <Space size={2} wrap>
            <Tag icon={<SyncOutlined />} color="processing" style={{ marginRight: 4 }}>Semanal</Tag>
            {dias.map(d => (
              <Tag key={d} color="blue" style={{ fontSize: 11, padding: '0 5px' }}>
                {DIAS.find(x => x.value === d)?.label}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Estado', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones', key: 'actions', width: 100,
      render: (_: unknown, r: Evento) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar evento?" okText="Sí" cancelText="No"
            onConfirm={() => handleDelete(r.id)}>
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
        onOk={handleSave} onCancel={() => setModalOpen(false)}
        okText="Guardar" cancelText="Cancelar" width={500}>
        <Form form={form} layout="vertical" initialValues={{ is_active: true, recurrente: false, dias_semana: [] }}>
          <Form.Item label="Tipo / Nombre" name="tipo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Descripción" name="descripcion">
            <Input.TextArea rows={2} />
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
              <Tag style={{ backgroundColor: formColor, borderColor: formColor, color: '#fff', fontWeight: 700, fontSize: 13 }}>
                {form.getFieldValue('tipo') || 'Evento'}
              </Tag>
            </Space>
          </Form.Item>

          <Form.Item label="¿Evento recurrente?" name="recurrente" valuePropName="checked"
            extra={recurrenteWatch
              ? 'Se repite semanalmente en los días seleccionados'
              : 'El evento ocurre solo una vez (o sin periodicidad fija)'}>
            <Switch
              checkedChildren={<><SyncOutlined /> Recurrente</>}
              unCheckedChildren="Evento único"
            />
          </Form.Item>

          {recurrenteWatch && (
            <Form.Item
              label="Días de la semana"
              name="dias_semana"
              rules={[{ type: 'array', min: 1, message: 'Selecciona al menos un día' }]}
            >
              <Checkbox.Group>
                <Space wrap>
                  {DIAS.map(d => (
                    <Checkbox key={d.value} value={d.value} style={{ marginInlineEnd: 0 }}>
                      {d.label}
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Form.Item>
          )}

          <Form.Item label="Activo" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
