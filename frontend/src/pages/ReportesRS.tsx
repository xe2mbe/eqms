import { useEffect, useState } from 'react'
import {
  Table, Button, Space, DatePicker, Input, Select, Modal, Form, InputNumber, Row, Col,
  Typography, Card, Tag, Popconfirm, message, Tooltip,
} from 'antd'
import {
  SearchOutlined, ClearOutlined, DeleteOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { libretaRSApi, type ReporteRSPayload } from '@/api/libretaRS'
import { catalogosApi } from '@/api/catalogos'
import { useAuthStore } from '@/store/authStore'
import { useColPrefs } from '@/components/common/ColSettings'
import { textFilterProps, selectFilterProps, uniqueFilterOptions } from '@/utils/tableFilters'
import type { ReporteRS, Evento, PlataformaRS, Zona, Estacion, Estado } from '@/types'

const { Title } = Typography
const { RangePicker } = DatePicker

const ALL_COL_KEYS = [
  'id', 'indicativo', 'operador', 'senal', 'plataforma', 'ciudad', 'pais', 'estado', 'zona',
  'evento', 'estacion', 'fecha_reporte', 'created_at', 'capturado_por_nombre',
] as const
type ColKey = typeof ALL_COL_KEYS[number]

const COL_LABELS: Record<ColKey, string> = {
  id: 'ID', indicativo: 'Indicativo', operador: 'Operador', senal: 'RST', plataforma: 'Red Social',
  ciudad: 'Ciudad', pais: 'País', estado: 'Estado', zona: 'Zona',
  evento: 'Tipo', estacion: 'Estación', fecha_reporte: 'Fecha Evento',
  created_at: 'Fecha Captura', capturado_por_nombre: 'Capturado por',
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
  const [plataformas, setPlataformas] = useState<PlataformaRS[]>([])
  const [filters, setFilters] = useState<Filters>({ page: 1, page_size: 50 })
  const [tempFilters, setTempFilters] = useState<Partial<Filters>>({})

  const [editRecord, setEditRecord] = useState<ReporteRS | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editForm] = Form.useForm()
  const [zonas, setZonas] = useState<Zona[]>([])
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [estados, setEstados] = useState<Estado[]>([])

  const { colOrder, colVisible, colSettingsButton } = useColPrefs(
    'reportes_rs_v5', user?.id, ALL_COL_KEYS, LOCKED_KEYS, COL_LABELS,
  )

  useEffect(() => {
    catalogosApi.eventos().then(r => setEventos(r.data))
    catalogosApi.plataformasRS().then(r => setPlataformas(r.data))
    catalogosApi.zonas().then(r => setZonas(r.data))
    catalogosApi.estaciones().then(r => setEstaciones(r.data))
    catalogosApi.estados().then(r => setEstados(r.data))
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

  const openEdit = (record: ReporteRS) => {
    setEditRecord(record)
    editForm.setFieldsValue({
      indicativo:      record.indicativo,
      senal:           record.senal,
      plataforma_id:   record.plataforma_id,
      evento_id:       record.evento_id ?? null,
      estacion_id:     record.estacion_id ?? null,
      zona_id:         record.zona_id ?? null,
      estado:          record.estado ?? null,
      ciudad:          record.ciudad ?? null,
      observaciones:   record.observaciones ?? null,
      fecha_reporte:   dayjs(record.fecha_reporte),
    })
    setEditModalOpen(true)
  }

  const handleEditSave = async () => {
    let values: Record<string, unknown>
    try { values = await editForm.validateFields() } catch { return }
    setEditLoading(true)
    try {
      const payload: ReporteRSPayload = {
        indicativo:      values.indicativo as string,
        senal:           values.senal as number,
        plataforma_id:   values.plataforma_id as number,
        evento_id:       (values.evento_id as number) ?? undefined,
        estacion_id:     (values.estacion_id as number) ?? undefined,
        zona_id:         (values.zona_id as number) ?? undefined,
        estado:          (values.estado as string) ?? undefined,
        ciudad:          (values.ciudad as string) ?? undefined,
        observaciones:   (values.observaciones as string) ?? undefined,
        fecha_reporte:   (values.fecha_reporte as ReturnType<typeof dayjs>).toISOString(),
      }
      await libretaRSApi.updateReporte(editRecord!.id, payload)
      message.success('Reporte actualizado')
      setEditModalOpen(false)
      fetchData()
    } catch {
      message.error('Error al actualizar el reporte')
    } finally {
      setEditLoading(false)
    }
  }

  const colDefs: Record<ColKey, object> = {
    id: { title: 'ID', dataIndex: 'id', width: 65 },
    indicativo: {
      title: 'Indicativo', dataIndex: 'indicativo', width: 110, fixed: 'left' as const,
      render: (v: string) => <strong style={{ color: '#1A569E' }}>{v}</strong>,
      ...textFilterProps('indicativo'),
    },
    operador: {
      title: 'Operador', dataIndex: 'operador', width: 160,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...textFilterProps('operador'),
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
      ...selectFilterProps(
        plataformas.map(p => ({ text: p.nombre, value: p.nombre })),
        (value, record) => (record).plataforma?.nombre === value,
      ),
    },
    ciudad: {
      title: 'Ciudad', dataIndex: 'ciudad', width: 130,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...textFilterProps('ciudad'),
    },
    pais: {
      title: 'País', dataIndex: 'pais', width: 140,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...selectFilterProps(
        uniqueFilterOptions(data as any, r => (r).pais ?? undefined),
        (value, record) => (record).pais === value,
      ),
    },
    estado: {
      title: 'Estado', dataIndex: 'estado', width: 130,
      ...selectFilterProps(
        uniqueFilterOptions(data as any, r => (r).estado ?? undefined),
        (value, record) => (record).estado === value,
      ),
    },
    zona: {
      title: 'Zona', dataIndex: 'zona', width: 80, align: 'center' as const,
      render: (_: unknown, record: ReporteRS) => {
        const codigo = record.zona?.codigo
        if (!codigo) return null
        const c = record.zona?.color ?? '#1677ff'
        return <Tag color={c} style={{ fontWeight: 600 }}>{codigo}</Tag>
      },
      ...selectFilterProps(
        zonas.map(z => ({ text: z.codigo, value: z.codigo })),
        (value, record) => (record).zona?.codigo === value,
      ),
    },
    evento: {
      title: 'Tipo', dataIndex: 'evento', width: 160,
      render: (_: unknown, record: ReporteRS) => {
        if (!record.evento) return null
        const c = record.evento.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{record.evento.tipo}</Tag>
      },
      ...selectFilterProps(
        eventos.map(e => ({ text: e.tipo, value: e.tipo })),
        (value, record) => (record).evento?.tipo === value,
      ),
    },
    estacion: {
      title: 'Estación', dataIndex: 'estacion', width: 120,
      render: (_: unknown, record: ReporteRS) => {
        if (!record.estacion) return null
        const c = record.estacion.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{record.estacion.qrz}</Tag>
      },
      ...selectFilterProps(
        uniqueFilterOptions(data as any, r => (r).estacion?.qrz ?? undefined),
        (value, record) => (record).estacion?.qrz === value,
      ),
    },
    fecha_reporte: {
      title: 'Fecha Evento', dataIndex: 'fecha_reporte', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    created_at: {
      title: 'Fecha Captura', dataIndex: 'created_at', width: 140,
      render: (v: string) => v
        ? <span style={{ color: '#8c8c8c' }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</span>
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    capturado_por_nombre: {
      title: 'Capturado por', dataIndex: 'capturado_por_nombre', width: 140,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...selectFilterProps(
        uniqueFilterOptions(data as any, r => (r).capturado_por_nombre ?? undefined),
        (value, record) => (record).capturado_por_nombre === value,
      ),
    },
  }

  const actionCol = {
    title: '', width: 70, fixed: 'right' as const,
    render: (_: unknown, record: ReporteRS) => (
      <Space>
        <Tooltip title="Editar">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
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

      <Modal
        title={`Editar reporte RS — ${editRecord?.indicativo}`}
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => setEditModalOpen(false)}
        okText="Guardar" cancelText="Cancelar"
        width={640}
        confirmLoading={editLoading}
      >
        <Form form={editForm} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Indicativo" name="indicativo" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="RST / Señal" name="senal">
                <InputNumber min={1} max={599} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Fecha / Hora" name="fecha_reporte" rules={[{ required: true }]}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Red Social" name="plataforma_id" rules={[{ required: true }]}>
                <Select options={plataformas.map(p => ({ value: p.id, label: p.nombre }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Evento" name="evento_id">
                <Select allowClear showSearch optionFilterProp="label"
                  options={eventos.map(e => ({ value: e.id, label: e.tipo }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Estado" name="estado">
                <Select allowClear showSearch optionFilterProp="label"
                  options={[
                    { value: 'Extranjero', label: 'Extranjero' },
                    ...estados.map(e => ({ value: e.nombre, label: e.nombre })),
                  ]}
                  optionRender={(option) =>
                    option.value === 'Extranjero'
                      ? <span style={{ color: '#1677ff', fontWeight: 700 }}>🌍 Extranjero</span>
                      : <span>{option.label}</span>
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Zona" name="zona_id">
                <Select allowClear showSearch optionFilterProp="label"
                  options={zonas.map(z => ({ value: z.id, label: `${z.codigo} — ${z.nombre}` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ciudad" name="ciudad">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Estación" name="estacion_id">
                <Select allowClear showSearch optionFilterProp="label"
                  options={estaciones.map(e => ({ value: e.id, label: e.qrz }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Observaciones" name="observaciones">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
