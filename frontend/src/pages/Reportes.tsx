import { useEffect, useState } from 'react'
import {
  Table, Button, Space, DatePicker, Input, Select,
  Typography, Card, Tag, Popconfirm, message, Tooltip, Badge,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ClearOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { reportesApi } from '@/api/reportes'
import { catalogosApi } from '@/api/catalogos'
import { useAuthStore } from '@/store/authStore'
import { useColPrefs } from '@/components/common/ColSettings'
import type { Reporte, ReporteFilters, Evento, Sistema, Zona, Estacion } from '@/types'

const { Title } = Typography
const { RangePicker } = DatePicker

// ─── Column definitions ───────────────────────────────────────────────────────

const ALL_COL_KEYS = [
  'id', 'indicativo', 'senal', 'pais', 'estado', 'zona',
  'sistema', 'tipo_reporte', 'qrz_station', 'fecha_reporte',
] as const
type ColKey = typeof ALL_COL_KEYS[number]

const COL_LABELS: Record<ColKey, string> = {
  id: 'ID',
  indicativo: 'Indicativo',
  senal: 'RST',
  pais: 'País',
  estado: 'Estado',
  zona: 'Zona',
  sistema: 'Sistema',
  tipo_reporte: 'Tipo',
  qrz_station: 'Estación',
  fecha_reporte: 'Fecha',
}

const LOCKED_KEYS: ColKey[] = ['indicativo']

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Reporte[]>([])
  const [total, setTotal] = useState(0)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [sistemas, setSistemas] = useState<Sistema[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [filters, setFilters] = useState<ReporteFilters>({ page: 1, page_size: 50 })
  const [tempFilters, setTempFilters] = useState<ReporteFilters>({})
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [deletingBulk, setDeletingBulk] = useState(false)

  const { colOrder, colVisible, colSettingsButton } = useColPrefs(
    'reportes', user?.id, ALL_COL_KEYS, LOCKED_KEYS, COL_LABELS,
  )

  useEffect(() => {
    catalogosApi.eventos().then(r => setEventos(r.data))
    catalogosApi.sistemas().then(r => setSistemas(r.data))
    catalogosApi.zonas().then(r => setZonas(r.data))
    catalogosApi.estaciones().then(r => setEstaciones(r.data))
  }, [])

  useEffect(() => { fetchData() }, [filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await reportesApi.list(filters)
      setData(res.items)
      setTotal(res.total)
      setSelectedKeys([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setFilters({ ...tempFilters, page: 1, page_size: filters.page_size })
  }

  const handleClear = () => {
    setTempFilters({})
    setFilters({ page: 1, page_size: 50 })
  }

  const handleDelete = async (id: number) => {
    try {
      await reportesApi.delete(id)
      message.success('Reporte eliminado')
      fetchData()
    } catch {
      message.error('Error al eliminar el reporte')
    }
  }

  const handleDeleteSelected = async () => {
    setDeletingBulk(true)
    try {
      await Promise.all(selectedKeys.map(id => reportesApi.delete(id)))
      message.success(`${selectedKeys.length} reporte(s) eliminados`)
      fetchData()
    } catch {
      message.error('Error al eliminar algunos reportes')
      fetchData()
    } finally {
      setDeletingBulk(false)
    }
  }

  // ─── Column defs ─────────────────────────────────────────────────────────────

  const colDefs: Record<ColKey, object> = {
    id: { title: 'ID', dataIndex: 'id', width: 65 },
    indicativo: {
      title: 'Indicativo', dataIndex: 'indicativo', width: 110, fixed: 'left' as const,
      render: (v: string) => <strong style={{ color: '#1A569E' }}>{v}</strong>,
    },
    senal: {
      title: 'RST', dataIndex: 'senal', width: 70,
      render: (v: number) => <strong>{v}</strong>,
    },
    pais: {
      title: 'País', dataIndex: 'pais', width: 140,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
    },
    estado: { title: 'Estado', dataIndex: 'estado', width: 130 },
    zona: {
      title: 'Zona', dataIndex: 'zona', width: 80, align: 'center' as const,
      render: (v: string) => {
        if (!v) return null
        const z = zonas.find(z => z.codigo === v)
        return <Tag color={z?.color ?? '#1677ff'} style={{ fontWeight: 600 }}>{v}</Tag>
      },
    },
    sistema: {
      title: 'Sistema', dataIndex: 'sistema', width: 100,
      render: (v: string) => {
        if (!v) return null
        const s = sistemas.find(s => s.codigo === v)
        const c = s?.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{v}</Tag>
      },
    },
    tipo_reporte: {
      title: 'Tipo', dataIndex: 'tipo_reporte', width: 160,
      render: (v: string, record: Reporte) => {
        const ev = record.evento_id
          ? eventos.find(e => e.id === record.evento_id)
          : eventos.find(e => e.tipo === v)
        const label = ev?.tipo ?? v
        if (!label) return null
        const c = ev?.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{label}</Tag>
      },
    },
    qrz_station: {
      title: 'Estación', dataIndex: 'qrz_station', width: 110,
      render: (v: string) => {
        if (!v) return null
        const est = estaciones.find(e => e.qrz === v)
        const c = est?.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{v}</Tag>
      },
    },
    fecha_reporte: {
      title: 'Fecha', dataIndex: 'fecha_reporte', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
  }

  const actionCol = {
    title: '', width: 90, fixed: 'right' as const,
    render: (_: unknown, record: Reporte) => (
      <Space>
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/reportes/nuevo?id=${record.id}`)} />
        </Tooltip>
        <Popconfirm
          title="¿Eliminar este reporte?"
          description={`Indicativo: ${record.indicativo}`}
          okText="Sí, eliminar" cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDelete(record.id)}
        >
          <Tooltip title="Eliminar">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  }

  const columns = [
    ...colOrder.filter(k => colVisible.includes(k)).map(k => colDefs[k]),
    actionCol,
  ]

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Reportes Tradicionales</Title>
        <Space>
          {colSettingsButton}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/reportes/nuevo')}>
            Nuevo Reporte
          </Button>
        </Space>
      </div>

      {/* Filtros */}
      <Card className="card-shadow" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            placeholder={['Fecha inicio', 'Fecha fin']}
            onChange={(d) => setTempFilters(prev => ({
              ...prev,
              fecha_inicio: d?.[0]?.format('YYYY-MM-DDTHH:mm:ss'),
              fecha_fin: d?.[1]?.format('YYYY-MM-DDTHH:mm:ss'),
            }))}
          />
          <Select
            placeholder="Tipo de evento"
            allowClear style={{ width: 200 }}
            labelRender={({ value }) => {
              const ev = eventos.find(e => e.id === value)
              const c = ev?.color ?? '#1677ff'
              return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{ev?.tipo ?? String(value)}</Tag>
            }}
            options={eventos.map(e => {
              const c = e.color ?? '#1677ff'
              return { value: e.id, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.tipo}</Tag> }
            })}
            onChange={(v) => setTempFilters(prev => ({ ...prev, evento_id: v }))}
          />
          <Select
            placeholder="Sistema"
            allowClear style={{ width: 140 }}
            options={sistemas.map(s => ({ value: s.codigo, label: s.codigo }))}
            onChange={(v) => setTempFilters(prev => ({ ...prev, sistema: v }))}
          />
          <Input
            placeholder="Indicativo"
            style={{ width: 130 }}
            onChange={(e) => setTempFilters(prev => ({ ...prev, indicativo: e.target.value }))}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>Buscar</Button>
          <Button icon={<ClearOutlined />} onClick={handleClear}>Limpiar</Button>
        </Space>
      </Card>

      {/* Barra de selección */}
      {selectedKeys.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#1A569E', fontWeight: 600 }}>
            {selectedKeys.length} seleccionado(s)
          </span>
          <Popconfirm
            title={`¿Eliminar ${selectedKeys.length} reporte(s)?`}
            description="Esta acción no se puede deshacer."
            okText="Sí, eliminar" cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            onConfirm={handleDeleteSelected}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={deletingBulk}>
              Eliminar seleccionados
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedKeys([])}>Deseleccionar</Button>
        </div>
      )}

      <Card className="card-shadow">
        <Table
          dataSource={data}
          columns={columns as any}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          size="small"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys as number[]),
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          pagination={{
            total,
            pageSize: filters.page_size,
            current: filters.page,
            showTotal: (t) => `${t} registros`,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100'],
            onChange: (page, page_size) => setFilters(prev => ({ ...prev, page, page_size })),
          }}
          title={() =>
            <span style={{ fontWeight: 700 }}>
              Registros <Badge count={total} color="#1A569E" style={{ marginLeft: 8 }} />
            </span>
          }
        />
      </Card>
    </div>
  )
}
