import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Table, Button, Input, Select, AutoComplete, Card, Typography, Space,
  Modal, Form, Row, Col, Popconfirm, message, Tag, Tooltip, Badge, Switch,
  Popover, Checkbox,
} from 'antd'
import {
  SearchOutlined, ClearOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, ReloadOutlined, SettingOutlined,
  HolderOutlined,
} from '@ant-design/icons'
import client from '@/api/client'
import { catalogosApi } from '@/api/catalogos'
import { useAuthStore } from '@/store/authStore'
import type { Estado, Zona } from '@/types'

const { Title } = Typography

// ─── Types ───────────────────────────────────────────────────────────────────

interface Operador {
  id: number
  indicativo: string
  nombre_completo?: string
  municipio?: string
  estado?: string
  zona?: string
  pais?: string
  tipo_licencia?: string
  tipo_ham?: string
  activo: boolean
}

interface Paginated {
  items: Operador[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ─── Column definitions ───────────────────────────────────────────────────────

const ALL_COL_KEYS = [
  'indicativo', 'nombre_completo', 'municipio', 'estado', 'zona',
  'pais', 'tipo_licencia', 'tipo_ham', 'activo',
] as const
type ColKey = typeof ALL_COL_KEYS[number]

const COL_LABELS: Record<ColKey, string> = {
  indicativo: 'Indicativo',
  nombre_completo: 'Nombre',
  municipio: 'Ciudad',
  estado: 'Estado',
  zona: 'Zona',
  pais: 'País',
  tipo_licencia: 'Licencia',
  tipo_ham: 'Tipo',
  activo: 'Activo',
}

// Indicativo is always visible and always first (fixed left)
const LOCKED_KEYS: ColKey[] = ['indicativo']

// ─── API ─────────────────────────────────────────────────────────────────────

const operadoresApi = {
  list: (params: Record<string, any>) =>
    client.get<Paginated>('/operadores', { params }),
  create: (data: Partial<Operador>) =>
    client.post<Operador>('/operadores', data),
  update: (indicativo: string, data: Partial<Operador>) =>
    client.put<Operador>(`/operadores/${indicativo}`, data),
  delete: (indicativo: string) =>
    client.delete(`/operadores/${indicativo}`),
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function storageKey(userId: number) {
  return `radioexp_col_prefs_${userId}`
}

interface ColPrefs {
  order: ColKey[]
  visible: ColKey[]
}

function loadPrefs(userId: number): ColPrefs {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw) {
      const parsed = JSON.parse(raw) as ColPrefs
      // Validate keys still exist
      const validOrder = parsed.order.filter(k => ALL_COL_KEYS.includes(k as ColKey))
      // Add any new keys not stored yet
      const missing = ALL_COL_KEYS.filter(k => !validOrder.includes(k))
      return {
        order: [...validOrder, ...missing] as ColKey[],
        visible: parsed.visible.filter(k => ALL_COL_KEYS.includes(k as ColKey)) as ColKey[],
      }
    }
  } catch { /* ignore */ }
  return {
    order: [...ALL_COL_KEYS],
    visible: [...ALL_COL_KEYS],
  }
}

function savePrefs(userId: number, prefs: ColPrefs) {
  localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
}

// ─── Column Settings Popover ──────────────────────────────────────────────────

interface ColSettingsProps {
  order: ColKey[]
  visible: ColKey[]
  onChange: (order: ColKey[], visible: ColKey[]) => void
}

function ColSettings({ order, visible, onChange }: ColSettingsProps) {
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const handleDragStart = (idx: number) => { dragItem.current = idx }
  const handleDragEnter = (idx: number) => { dragOver.current = idx }

  const handleDrop = () => {
    if (dragItem.current === null || dragOver.current === null) return
    if (dragItem.current === dragOver.current) return
    const newOrder = [...order]
    const dragged = newOrder.splice(dragItem.current, 1)[0]
    newOrder.splice(dragOver.current, 0, dragged)
    // Ensure locked keys stay at start
    const locked = newOrder.filter(k => LOCKED_KEYS.includes(k))
    const free = newOrder.filter(k => !LOCKED_KEYS.includes(k))
    dragItem.current = null
    dragOver.current = null
    onChange([...locked, ...free], visible)
  }

  const toggleVisible = (key: ColKey, checked: boolean) => {
    if (LOCKED_KEYS.includes(key)) return
    const newVisible = checked
      ? [...visible, key]
      : visible.filter(k => k !== key)
    onChange(order, newVisible)
  }

  return (
    <div style={{ width: 220 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Arrastra para reordenar · marca para mostrar
      </div>
      {order.map((key, idx) => {
        const locked = LOCKED_KEYS.includes(key)
        return (
          <div
            key={key}
            draggable={!locked}
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 4px', borderRadius: 4, cursor: locked ? 'default' : 'grab',
              background: 'transparent',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <HolderOutlined style={{ color: locked ? '#ddd' : '#aaa', fontSize: 13 }} />
            <Checkbox
              checked={visible.includes(key)}
              disabled={locked}
              onChange={e => toggleVisible(key, e.target.checked)}
            />
            <span style={{ fontSize: 13, color: locked ? '#999' : undefined }}>
              {COL_LABELS[key]}
              {locked && <span style={{ fontSize: 11, color: '#bbb', marginLeft: 4 }}>(fijo)</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RadioexperimentadoresPage() {
  const { user } = useAuthStore()

  // Column prefs — loaded from localStorage once user is known
  const [colOrder, setColOrder] = useState<ColKey[]>([...ALL_COL_KEYS])
  const [colVisible, setColVisible] = useState<ColKey[]>([...ALL_COL_KEYS])
  const [colSettingsOpen, setColSettingsOpen] = useState(false)
  const prefsLoaded = useRef(false)

  useEffect(() => {
    if (user && !prefsLoaded.current) {
      const prefs = loadPrefs(user.id)
      setColOrder(prefs.order)
      setColVisible(prefs.visible)
      prefsLoaded.current = true
    }
  }, [user])

  const handleColChange = (newOrder: ColKey[], newVisible: ColKey[]) => {
    setColOrder(newOrder)
    setColVisible(newVisible)
    if (user) savePrefs(user.id, { order: newOrder, visible: newVisible })
  }

  // Data & filters
  const [data, setData] = useState<Operador[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [estados, setEstados] = useState<Estado[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [paises, setPaises] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<string | undefined>()
  const [filterZona, setFilterZona] = useState<string | undefined>()
  const [filterPais, setFilterPais] = useState<string | undefined>()

  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<Operador | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    catalogosApi.estados().then(r => setEstados(r.data))
    catalogosApi.zonas().then(r => setZonas(r.data))
    catalogosApi.listPaises().then(r => setPaises(r.data))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res } = await operadoresApi.list({
        page, page_size: pageSize,
        q: search || undefined,
        estado: filterEstado || undefined,
        zona: filterZona || undefined,
        pais: filterPais || undefined,
      })
      setData(res.items)
      setTotal(res.total)
    } finally { setLoading(false) }
  }, [page, pageSize, search, filterEstado, filterZona, filterPais])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    form.setFieldsValue({ pais: 'México', activo: true })
    setModalOpen(true)
  }

  const openEdit = (record: Operador) => {
    setEditRecord(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleSave = async () => {
    await form.validateFields()
    const vals = form.getFieldsValue()
    setSaving(true)
    try {
      if (editRecord) {
        await operadoresApi.update(editRecord.indicativo, vals)
        message.success('Registro actualizado')
      } else {
        await operadoresApi.create(vals)
        message.success('Registro creado')
      }
      setModalOpen(false)
      fetchData()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (indicativo: string) => {
    try {
      await operadoresApi.delete(indicativo)
      message.success('Registro eliminado')
      fetchData()
    } catch { message.error('Error al eliminar') }
  }

  // ─── Column definitions ─────────────────────────────────────────────────────

  const colDefs: Record<ColKey, object> = {
    indicativo: {
      title: 'Indicativo', dataIndex: 'indicativo', width: 110, fixed: 'left' as const,
      render: (v: string) => <strong style={{ color: '#1A569E', fontSize: 13 }}>{v}</strong>,
    },
    nombre_completo: {
      title: 'Nombre', dataIndex: 'nombre_completo', width: 220, ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    municipio: {
      title: 'Ciudad', dataIndex: 'municipio', width: 140, ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    estado: {
      title: 'Estado', dataIndex: 'estado', width: 160, ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    zona: {
      title: 'Zona', dataIndex: 'zona', width: 80, align: 'center' as const,
      render: (v: string) => {
        if (!v) return <span style={{ color: '#bbb' }}>—</span>
        const z = zonas.find(z => z.codigo === v)
        return <Tag color={z?.color ?? '#1677ff'} style={{ fontWeight: 600 }}>{v}</Tag>
      },
    },
    pais: {
      title: 'País', dataIndex: 'pais', width: 110, ellipsis: true,
      render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
    },
    tipo_licencia: {
      title: 'Licencia', dataIndex: 'tipo_licencia', width: 90,
      render: (v: string) => v ? <Tag>{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    tipo_ham: {
      title: 'Tipo', dataIndex: 'tipo_ham', width: 90,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    activo: {
      title: 'Activo', dataIndex: 'activo', width: 75, align: 'center' as const,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Sí' : 'No'}</Tag>,
    },
  }

  const actionCol = {
    title: '', width: 80, fixed: 'right' as const,
    render: (_: unknown, record: Operador) => (
      <Space size={4}>
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
        </Tooltip>
        <Popconfirm
          title={`¿Eliminar ${record.indicativo}?`}
          okText="Sí" cancelText="No" okButtonProps={{ danger: true }}
          onConfirm={() => handleDelete(record.indicativo)}
        >
          <Tooltip title="Eliminar">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  }

  const columns = [
    ...colOrder
      .filter(k => colVisible.includes(k))
      .map(k => colDefs[k]),
    actionCol,
  ]

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Radioexperimentadores <Badge count={total} color="#1A569E" style={{ marginLeft: 8 }} />
        </Title>
        <Space>
          <Popover
            open={colSettingsOpen}
            onOpenChange={setColSettingsOpen}
            trigger="click"
            placement="bottomRight"
            title="Columnas visibles y orden"
            content={
              <ColSettings
                order={colOrder}
                visible={colVisible}
                onChange={handleColChange}
              />
            }
          >
            <Tooltip title="Configurar columnas">
              <Button icon={<SettingOutlined />} />
            </Tooltip>
          </Popover>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Nuevo
          </Button>
        </Space>
      </div>

      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Indicativo o nombre"
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            allowClear
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          <Select
            placeholder="Filtrar por estado"
            allowClear style={{ width: 180 }}
            showSearch optionFilterProp="label"
            options={estados.map(e => ({ value: e.nombre, label: e.nombre }))}
            value={filterEstado}
            onChange={v => { setFilterEstado(v); setPage(1) }}
          />
          <Select
            placeholder="Zona"
            allowClear style={{ width: 150 }}
            showSearch optionFilterProp="label"
            value={filterZona}
            onChange={v => { setFilterZona(v); setPage(1) }}
            options={zonas.map(z => ({
              value: z.codigo,
              label: (
                <Space size={6}>
                  <span style={{
                    display: 'inline-block', width: 10, height: 10,
                    borderRadius: '50%', background: z.color ?? '#1677ff', flexShrink: 0,
                  }} />
                  {z.codigo} – {z.nombre}
                </Space>
              ),
            }))}
          />
          <AutoComplete
            placeholder="País"
            allowClear style={{ width: 150 }}
            options={paises.map(p => ({ value: p }))}
            filterOption={(input, opt) =>
              (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
            value={filterPais}
            onChange={v => { setFilterPais(v || undefined); setPage(1) }}
          />
          <Button icon={<ClearOutlined />} onClick={() => {
            setSearch(''); setFilterEstado(undefined)
            setFilterZona(undefined); setFilterPais(undefined); setPage(1)
          }}>
            Limpiar
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} />
        </Space>
      </Card>

      <Card className="card-shadow">
        <Table
          dataSource={data}
          columns={columns as any}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            total, current: page, pageSize,
            showTotal: t => `${t} registros`,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100', '200'],
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </Card>

      {/* Modal crear / editar */}
      <Modal
        title={editRecord ? `Editar — ${editRecord.indicativo}` : 'Nuevo Radioexperimentador'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar" cancelText="Cancelar"
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Indicativo" name="indicativo"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input
                  placeholder="XE2MBE"
                  disabled={!!editRecord}
                  style={{ textTransform: 'uppercase', fontWeight: 700 }}
                  onChange={e => form.setFieldValue('indicativo', e.target.value.toUpperCase())}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nombre completo" name="nombre_completo">
                <Input placeholder="Nombre del operador" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ciudad / Municipio" name="municipio">
                <Input placeholder="Ciudad" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Estado" name="estado">
                <Select placeholder="Estado" allowClear showSearch optionFilterProp="label"
                  options={estados.map(e => ({ value: e.nombre, label: e.nombre }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="País" name="pais">
                <AutoComplete
                  placeholder="México"
                  allowClear
                  options={paises.map(p => ({ value: p }))}
                  filterOption={(input, opt) =>
                    (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tipo de licencia" name="tipo_licencia">
                <Input placeholder="Ej: Novato, General, Extra" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tipo HAM" name="tipo_ham">
                <Input placeholder="Ej: Fijo, Móvil" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Activo" name="activo" valuePropName="checked">
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
