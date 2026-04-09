import { useEffect, useState, useMemo } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Typography, Card, Popconfirm, message, Switch,
  Drawer, Select, Tooltip, Badge, Divider, ColorPicker,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  EnvironmentOutlined, SaveOutlined,
} from '@ant-design/icons'
import type { Color } from 'antd/es/color-picker'
import client from '@/api/client'
import type { Zona, Estado } from '@/types'

const { Title, Text } = Typography

// Usa el color guardado en la zona; fallback gris
const zonaColor = (z?: Zona | null, fallback = '#999') => z?.color || fallback

interface EstadoConZona extends Estado {
  zona?: string
  _dirty?: boolean   // marcado para guardar
}

export default function ZonasPage() {
  const [zonas, setZonas] = useState<Zona[]>([])
  const [estados, setEstados] = useState<EstadoConZona[]>([])
  const [loadingZonas, setLoadingZonas] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Zona | null>(null)
  const [form] = Form.useForm()

  // Drawer de asignación
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formColor, setFormColor] = useState('#1677ff')

  useEffect(() => { fetchZonas(); fetchEstados() }, [])

  const fetchZonas = async () => {
    setLoadingZonas(true)
    try {
      const { data } = await client.get<Zona[]>('/catalogos/zonas')
      setZonas(data)
    } finally { setLoadingZonas(false) }
  }

  const fetchEstados = async () => {
    const { data } = await client.get<EstadoConZona[]>('/catalogos/estados')
    setEstados(data.map(e => ({ ...e, _dirty: false })))
  }

  // Conteo de estados por zona para mostrar en la tabla
  const conteoEstados = useMemo(() => {
    const m: Record<string, number> = {}
    estados.forEach(e => { if (e.zona) m[e.zona] = (m[e.zona] || 0) + 1 })
    return m
  }, [estados])

  const openCreate = () => {
    setEditItem(null); form.resetFields()
    setFormColor('#1677ff'); setModalOpen(true)
  }
  const openEdit = (item: Zona) => {
    setEditItem(item); form.setFieldsValue(item)
    setFormColor(item.color || '#1677ff'); setModalOpen(true)
  }

  const handleSaveZona = async () => {
    const values = await form.validateFields()
    const payload = { ...values, color: formColor }
    try {
      if (editItem) {
        await client.put(`/catalogos/zonas/${editItem.id}`, payload)
        message.success('Zona actualizada')
      } else {
        await client.post('/catalogos/zonas', payload)
        message.success('Zona creada')
      }
      setModalOpen(false); fetchZonas()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    }
  }

  const handleDeleteZona = async (id: number) => {
    try {
      await client.delete(`/catalogos/zonas/${id}`)
      message.success('Zona eliminada')
      fetchZonas()
    } catch { message.error('Error al eliminar') }
  }

  // Cambiar zona de un estado (solo en memoria hasta guardar)
  const cambiarZonaEstado = (estadoId: number, nuevaZona: string | null) => {
    setEstados(prev => prev.map(e =>
      e.id === estadoId ? { ...e, zona: nuevaZona ?? undefined, _dirty: true } : e
    ))
  }

  const guardarAsignaciones = async () => {
    const dirty = estados.filter(e => e._dirty)
    if (!dirty.length) { message.info('Sin cambios pendientes'); return }
    setGuardando(true)
    try {
      await client.post('/catalogos/estados/asignar-zonas', {
        asignaciones: dirty.map(e => ({ estado_id: e.id, zona: e.zona ?? null })),
      })
      message.success(`${dirty.length} estado(s) actualizados`)
      setEstados(prev => prev.map(e => ({ ...e, _dirty: false })))
      fetchZonas()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const dirtyCount = estados.filter(e => e._dirty).length

  // ── Tabla de zonas ──
  const columns = [
    {
      title: 'Código', dataIndex: 'codigo', key: 'codigo', width: 120,
      render: (v: string, r: Zona) => (
        <Tag
          style={{
            backgroundColor: zonaColor(r),
            borderColor: zonaColor(r),
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {v}
        </Tag>
      ),
    },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Estados asignados', key: 'estados', width: 150,
      render: (_: unknown, r: Zona) => (
        <Badge
          count={conteoEstados[r.codigo] || 0}
          style={{ backgroundColor: conteoEstados[r.codigo] ? '#1A569E' : '#d9d9d9' }}
          showZero
        />
      ),
    },
    {
      title: 'Estado', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag>,
    },
    {
      title: 'Acciones', key: 'actions', width: 100,
      render: (_: unknown, r: Zona) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="¿Eliminar zona?" okText="Sí" cancelText="No"
            onConfirm={() => handleDeleteZona(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Columnas del drawer de estados ──
  const estadoColumns = [
    {
      title: 'Estado / Entidad', dataIndex: 'nombre', key: 'nombre',
      render: (v: string, r: EstadoConZona) => (
        <span>
          {v}
          {r._dirty && <Text type="warning" style={{ marginLeft: 6, fontSize: 11 }}>● modificado</Text>}
        </span>
      ),
    },
    {
      title: 'Zona asignada', key: 'zona', width: 180,
      render: (_: unknown, r: EstadoConZona) => (
        <Select
          size="small"
          value={r.zona || null}
          onChange={val => cambiarZonaEstado(r.id, val)}
          allowClear
          placeholder="Sin zona"
          style={{ width: 160 }}
          options={zonas.map(z => ({
            value: z.codigo,
            label: (
              <Tag style={{
                backgroundColor: zonaColor(z),
                borderColor: zonaColor(z),
                color: '#fff',
              }}>
                {z.codigo}
              </Tag>
            ),
          }))}
        />
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Zonas</Title>
        <Space>
          <Button
            icon={<EnvironmentOutlined />}
            onClick={() => setDrawerOpen(true)}
          >
            Asignar Estados a Zonas
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva Zona</Button>
        </Space>
      </div>

      <Card className="card-shadow">
        <Table
          dataSource={zonas}
          columns={columns}
          rowKey="id"
          loading={loadingZonas}
          size="small"
        />
      </Card>

      {/* ── Modal crear/editar zona ── */}
      <Modal
        title={editItem ? 'Editar Zona' : 'Nueva Zona'}
        open={modalOpen}
        onOk={handleSaveZona}
        onCancel={() => setModalOpen(false)}
        okText="Guardar" cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <Form.Item label="Código (ej. XE4)" name="codigo" rules={[{ required: true }]}>
            <Input style={{ textTransform: 'uppercase' }} maxLength={10} />
          </Form.Item>
          <Form.Item label="Nombre" name="nombre" rules={[{ required: true }]}>
            <Input placeholder="Zona 4 – Noroeste" />
          </Form.Item>
          <Form.Item label="Color de la zona">
            <Space align="center">
              <ColorPicker
                value={formColor}
                onChange={(c: Color) => setFormColor(c.toHexString())}
                showText
                presets={[{
                  label: 'Sugeridos',
                  colors: [
                    '#1677ff','#52c41a','#fa8c16','#722ed1',
                    '#eb2f96','#f5222d','#13c2c2','#faad14',
                    '#2f54eb','#389e0d','#d46b08','#531dab',
                  ],
                }]}
              />
              <Tag style={{
                backgroundColor: formColor,
                borderColor: formColor,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
              }}>
                {form.getFieldValue('codigo') || 'XE?'}
              </Tag>
            </Space>
          </Form.Item>
          <Form.Item label="Activa" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer asignación estados ── */}
      <Drawer
        title="Asignación de Estados por Zona"
        placement="right"
        width={560}
        open={drawerOpen}
        onClose={() => {
          if (dirtyCount > 0) {
            Modal.confirm({
              title: 'Hay cambios sin guardar',
              content: `Tienes ${dirtyCount} estado(s) modificados. ¿Descartar cambios?`,
              okText: 'Descartar', cancelText: 'Seguir editando',
              okButtonProps: { danger: true },
              onOk: () => { fetchEstados(); setDrawerOpen(false) },
            })
          } else {
            setDrawerOpen(false)
          }
        }}
        extra={
          <Tooltip title={dirtyCount === 0 ? 'Sin cambios pendientes' : `Guardar ${dirtyCount} cambio(s)`}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={guardando}
              disabled={dirtyCount === 0}
              onClick={guardarAsignaciones}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Guardar {dirtyCount > 0 ? `(${dirtyCount})` : ''}
            </Button>
          </Tooltip>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Selecciona la zona correspondiente a cada estado. Los cambios se guardan
          al presionar <strong>Guardar</strong>.
        </Text>
        <Divider style={{ margin: '8px 0 12px' }} />

        {/* Resumen por zona */}
        <Space wrap style={{ marginBottom: 16 }}>
          {zonas.map(z => (
            <Tag key={z.codigo} style={{
              backgroundColor: zonaColor(z),
              borderColor: zonaColor(z),
              color: '#fff',
            }}>
              {z.codigo}: {estados.filter(e => e.zona === z.codigo).length} estados
            </Tag>
          ))}
          <Tag color="default">
            Sin zona: {estados.filter(e => !e.zona).length}
          </Tag>
        </Space>

        <Table
          dataSource={estados}
          columns={estadoColumns}
          rowKey="id"
          size="small"
          pagination={false}
          rowClassName={r => r._dirty ? 'ant-table-row-selected' : ''}
          scroll={{ y: 'calc(100vh - 280px)' }}
        />
      </Drawer>
    </div>
  )
}
