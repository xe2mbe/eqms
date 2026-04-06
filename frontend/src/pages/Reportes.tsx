import { useEffect, useState } from 'react'
import {
  Table, Button, Space, DatePicker, Input, Select,
  Typography, Card, Tag, Popconfirm, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, SearchOutlined, ClearOutlined,
  EditOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { reportesApi } from '@/api/reportes'
import { catalogosApi } from '@/api/catalogos'
import type { Reporte, ReporteFilters, Evento, Sistema } from '@/types'

const { Title } = Typography
const { RangePicker } = DatePicker

const SIGNAL_COLOR: Record<number, string> = {
  59: 'green', 57: 'blue', 55: 'orange', 53: 'red',
}

export default function ReportesPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Reporte[]>([])
  const [total, setTotal] = useState(0)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [sistemas, setSistemas] = useState<Sistema[]>([])
  const [filters, setFilters] = useState<ReporteFilters>({ page: 1, page_size: 50 })
  const [tempFilters, setTempFilters] = useState<ReporteFilters>({})

  useEffect(() => {
    catalogosApi.eventos().then(r => setEventos(r.data))
    catalogosApi.sistemas().then(r => setSistemas(r.data))
  }, [])

  useEffect(() => { fetchData() }, [filters])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await reportesApi.list(filters)
      setData(res.items)
      setTotal(res.total)
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

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 65 },
    { title: 'Indicativo', dataIndex: 'indicativo', width: 110,
      render: (v: string) => <strong style={{ color: '#1A569E' }}>{v}</strong> },
    { title: 'Señal', dataIndex: 'senal', width: 80,
      render: (v: number) => <Tag color={SIGNAL_COLOR[v] || 'default'}>{v}</Tag> },
    { title: 'Estado', dataIndex: 'estado', width: 130 },
    { title: 'Zona', dataIndex: 'zona', width: 80 },
    { title: 'Sistema', dataIndex: 'sistema', width: 100,
      render: (v: string) => v ? <Tag>{v}</Tag> : null },
    { title: 'Tipo', dataIndex: 'tipo_reporte', width: 160,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : null },
    { title: 'Estación', dataIndex: 'qrz_station', width: 100 },
    { title: 'Fecha', dataIndex: 'fecha_reporte', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    {
      title: 'Acciones', width: 90, fixed: 'right' as const,
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
    },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Reportes Tradicionales</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/reportes/nuevo')}>
          Nuevo Reporte
        </Button>
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
            options={eventos.map(e => ({ value: e.tipo, label: e.tipo }))}
            onChange={(v) => setTempFilters(prev => ({ ...prev, tipo_reporte: v }))}
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

      <Card className="card-shadow">
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
          size="small"
          pagination={{
            total,
            pageSize: filters.page_size,
            current: filters.page,
            showTotal: (t) => `${t} registros`,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100'],
            onChange: (page, page_size) => setFilters(prev => ({ ...prev, page, page_size })),
          }}
        />
      </Card>
    </div>
  )
}
