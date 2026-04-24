import { useEffect, useState } from 'react'
import {
  Table, Button, Space, DatePicker, Input, Select,
  Typography, Card, Tag, Popconfirm, message, Tooltip,
} from 'antd'
import {
  SearchOutlined, ClearOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { libretaRSApi } from '@/api/libretaRS'
import { catalogosApi } from '@/api/catalogos'
import { useAuthStore } from '@/store/authStore'
import { useColPrefs } from '@/components/common/ColSettings'
import type { ReporteRS, Evento, Zona, PlataformaRS } from '@/types'

const { Title } = Typography
const { RangePicker } = DatePicker

const ALL_COL_KEYS = [
  'id', 'indicativo', 'senal', 'plataforma', 'pais', 'estado', 'zona',
  'tipo_reporte', 'qrz_station', 'fecha_reporte',
] as const
type ColKey = typeof ALL_COL_KEYS[number]

const COL_LABELS: Record<ColKey, string> = {
  id: 'ID', indicativo: 'Indicativo', senal: 'RST', plataforma: 'Red Social',
  pais: 'País', estado: 'Estado', zona: 'Zona',
  tipo_reporte: 'Tipo', qrz_station: 'Estación', fecha_reporte: 'Fecha',
}

const LOCKED_KEYS: ColKey[] = ['indicativo']

interface Filters {
  fecha_inicio?: string
  fecha_fin?: string
  evento_id?: number
  plataforma_id?: number
  indicativo?: string
  page: number
  page_size: number
}

export default function ReportesRSPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ReporteRS[]>([])
  const [total, setTotal] = useState(0)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [plataformas, setPlataformas] = useState<PlataformaRS[]>([])
  const [filters, setFilters] = useState<Filters>({ page: 1, page_size: 50 })
  const [tempFilters, setTempFilters] = useState<Partial<Filters>>({})

  const { colOrder, colVisible, colSettingsButton } = useColPrefs(
    'reportes_rs', user?.id, ALL_COL_KEYS, LOCKED_KEYS, COL_LABELS,
  )

  useEffect(() => {
    catalogosApi.eventos().then(r => setEventos(r.data))
    catalogosApi.zonas().then(r => setZonas(r.data))
    catalogosApi.plataformasRS().then(r => setPlataformas(r.data))
  }, [])

  useEffect(() => { fetchData() }, [filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await libretaRSApi.listReportes({
        page: filters.page,
        page_size: filters.page_size,
        plataforma_id: filters.plataforma_id,
        indicativo: filters.indicativo,
        evento_id: filters.evento_id,
        fecha_inicio: filters.fecha_inicio,
        fecha_fin: filters.fecha_fin,
      })
      setData(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => setFilters({ ...tempFilters, page: 1, page_size: filters.page_size })
  const handleClear = () => { setTempFilters({}); setFilters({ page: 1, page_size: 50 }) }

  const handleDelete = async (id: number) => {
    try {
      await libretaRSApi.deleteReporte(id)
      message.success('Reporte eliminado')
      fetchData()
    } catch {
      message.error('Error al eliminar el reporte')
    }
  }

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
    plataforma: {
      title: 'Red Social', dataIndex: 'plataforma', width: 130,
      render: (p: PlataformaRS) => {
        if (!p) return null
        const c = p.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{p.nombre}</Tag>
      },
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
    tipo_reporte: {
      title: 'Tipo', dataIndex: 'tipo_reporte', width: 160,
      render: (v: string, record: ReporteRS) => {
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
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
    },
    fecha_reporte: {
      title: 'Fecha', dataIndex: 'fecha_reporte', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
  }

  const actionCol = {
    title: '', width: 70, fixed: 'right' as const,
    render: (_: unknown, record: ReporteRS) => (
      <Space>
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />} disabled />
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

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Registros RS — Redes Sociales</Title>
        <Space>{colSettingsButton}</Space>
      </div>

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
            placeholder="Red social"
            allowClear style={{ width: 160 }}
            options={plataformas.map(p => {
              const c = p.color ?? '#1677ff'
              return { value: p.id, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{p.nombre}</Tag> }
            })}
            labelRender={({ value }) => {
              const p = plataformas.find(p => p.id === value)
              const c = p?.color ?? '#1677ff'
              return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{p?.nombre ?? String(value)}</Tag>
            }}
            onChange={(v) => setTempFilters(prev => ({ ...prev, plataforma_id: v }))}
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

      <Card className="card-shadow">
        <Table
          dataSource={data}
          columns={columns as any}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          size="small"
          pagination={{
            current: filters.page,
            pageSize: filters.page_size,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200'],
            showTotal: (t) => `${t} reportes`,
            onChange: (page, page_size) => setFilters(prev => ({ ...prev, page, page_size })),
          }}
        />
      </Card>
    </div>
  )
}
