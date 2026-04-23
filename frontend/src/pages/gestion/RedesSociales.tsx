import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch,
  Divider, Tooltip,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SettingOutlined, CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons'
import client from '@/api/client'
import { catalogosApi } from '@/api/catalogos'
import type { PlataformaRS, MetricaRS } from '@/types'

const { Title, Text } = Typography

export default function RedesSocialesPage() {
  const [data, setData] = useState<PlataformaRS[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<PlataformaRS | null>(null)
  const [form] = Form.useForm()

  // Panel de métricas
  const [metricasModal, setMetricasModal] = useState(false)
  const [metricasPlat, setMetricasPlat] = useState<PlataformaRS | null>(null)
  const [metricas, setMetricas] = useState<MetricaRS[]>([])
  const [metricaForm] = Form.useForm()
  const [addMetricaModal, setAddMetricaModal] = useState(false)
  const [loadingMetricas, setLoadingMetricas] = useState(false)

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

  // ── Métricas ──
  const openMetricas = async (plat: PlataformaRS) => {
    setMetricasPlat(plat)
    setMetricasModal(true)
    await fetchMetricas(plat.id)
  }

  const fetchMetricas = async (pid: number) => {
    setLoadingMetricas(true)
    try {
      const { data } = await catalogosApi.metricas(pid)
      setMetricas(data)
    } finally { setLoadingMetricas(false) }
  }

  const toggleMetrica = async (m: MetricaRS) => {
    try {
      await catalogosApi.updateMetrica(m.plataforma_id, m.id, { is_active: !m.is_active })
      fetchMetricas(m.plataforma_id)
    } catch { message.error('Error al actualizar métrica') }
  }

  const handleAddMetrica = async () => {
    const values = await metricaForm.validateFields()
    if (!metricasPlat) return
    try {
      const slug = values.nombre.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      await catalogosApi.createMetrica(metricasPlat.id, {
        nombre: values.nombre,
        slug,
        is_active: true,
        orden: metricas.length + 1,
      })
      message.success('Métrica agregada')
      metricaForm.resetFields()
      setAddMetricaModal(false)
      fetchMetricas(metricasPlat.id)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al agregar métrica')
    }
  }

  const handleDeleteMetrica = async (m: MetricaRS) => {
    try {
      await catalogosApi.deleteMetrica(m.plataforma_id, m.id)
      fetchMetricas(m.plataforma_id)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al eliminar')
    }
  }

  const metricaColumns = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre',
      render: (v: string, r: MetricaRS) => (
        <Space>
          <Text>{v}</Text>
          {r.is_default && <Tag color="blue" style={{ fontSize: 10 }}>default</Tag>}
        </Space>
      ),
    },
    { title: 'Slug (clave)', dataIndex: 'slug', key: 'slug',
      render: (v: string) => <Text code>{v}</Text> },
    { title: 'Activa', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean, r: MetricaRS) => (
        <Tooltip title={v ? 'Desactivar' : 'Activar'}>
          <Button
            size="small"
            icon={v ? <CheckCircleOutlined /> : <StopOutlined />}
            type={v ? 'primary' : 'default'}
            onClick={() => toggleMetrica(r)}
          />
        </Tooltip>
      ),
    },
    { title: '', key: 'actions', width: 60,
      render: (_: unknown, r: MetricaRS) => (
        !r.is_default ? (
          <Popconfirm title="¿Eliminar métrica?" okText="Sí" cancelText="No"
            onConfirm={() => handleDeleteMetrica(r)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : (
          <Tooltip title="Las métricas predeterminadas no se pueden eliminar, solo desactivar">
            <Button size="small" disabled icon={<DeleteOutlined />} />
          </Tooltip>
        )
      ),
    },
  ]

  const columns = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre',
      render: (v: string) => <strong>{v}</strong> },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
    { title: 'Métricas activas', key: 'metricas',
      render: (_: unknown, r: PlataformaRS) => {
        const activas = (r.metricas || []).filter(m => m.is_active)
        return activas.length > 0
          ? activas.map(m => <Tag key={m.id} color="geekblue">{m.nombre}</Tag>)
          : <Text type="secondary">Sin métricas activas</Text>
      },
    },
    { title: 'Estado', dataIndex: 'is_active', key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag> },
    {
      title: 'Acciones', key: 'actions', width: 120,
      render: (_: unknown, r: PlataformaRS) => (
        <Space>
          <Tooltip title="Configurar métricas">
            <Button size="small" icon={<SettingOutlined />} onClick={() => openMetricas(r)} />
          </Tooltip>
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

      {/* Modal plataforma */}
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

      {/* Modal métricas */}
      <Modal
        title={`Métricas — ${metricasPlat?.nombre}`}
        open={metricasModal}
        onCancel={() => setMetricasModal(false)}
        footer={null}
        width={620}
      >
        <Table
          dataSource={metricas}
          columns={metricaColumns}
          rowKey="id"
          loading={loadingMetricas}
          size="small"
          pagination={false}
        />
        <Divider />
        <Button icon={<PlusOutlined />} type="dashed" block onClick={() => setAddMetricaModal(true)}>
          Agregar métrica personalizada
        </Button>
      </Modal>

      {/* Modal nueva métrica */}
      <Modal
        title="Nueva métrica personalizada"
        open={addMetricaModal}
        onOk={handleAddMetrica}
        onCancel={() => { setAddMetricaModal(false); metricaForm.resetFields() }}
        okText="Agregar"
        cancelText="Cancelar"
      >
        <Form form={metricaForm} layout="vertical">
          <Form.Item label="Nombre de la métrica" name="nombre" rules={[{ required: true }]}
            help="El slug (clave) se generará automáticamente">
            <Input placeholder="Ej: Alcance orgánico, Stories vistas..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
