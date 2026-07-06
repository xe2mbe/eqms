import { useEffect, useRef, useState } from 'react'
import {
  Badge, Button, Card, Col, DatePicker, Divider, Drawer, Form,
  Row, Select, Space, Switch, Tag, TimePicker, Tooltip,
  Typography, message, Empty, Spin, Segmented,
} from 'antd'
import {
  CalendarOutlined, FilePdfOutlined,
  FileWordOutlined, MailOutlined, SendOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import axios from 'axios'
import {
  reportesPdfApi,
  type PlantillaOut,
  type ProgramacionUpdate,
  type UltimoEventoOut,
  type UltimoCluster,
  type OrigenCluster,
} from '@/api/reportesPdf'

const { Title, Text } = Typography

const TIPO_COLOR: Record<string, string> = { rf: 'blue', rs: 'purple', ambos: 'gold' }
const TIPO_LABEL: Record<string, string> = { rf: 'RF', rs: 'RS', ambos: 'RF + RS' }

const DIAS_SEMANA = [
  { value: 0, label: 'Lunes' }, { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' }, { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' }, { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
]

/** Extrae el detalle de error del backend de un catch, si viene de una llamada axios. */
function getErrorDetail(e: unknown): string | undefined {
  return axios.isAxiosError(e) ? e.response?.data?.detail : undefined
}

type DateMode = 'ultimo' | 'rango'

interface CardDateState {
  mode: DateMode
  range: [string, string]
  ultimo: UltimoEventoOut | null
  loadingUltimo: boolean
}

const DEFAULT_RANGO: [string, string] = [
  dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
  dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
]

function initCardDate(): CardDateState {
  return { mode: 'ultimo', range: DEFAULT_RANGO, ultimo: null, loadingUltimo: false }
}

function OrigenBlock({ origen }: { origen: OrigenCluster }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Tag color={origen.color} style={{ margin: 0, fontSize: 11 }}>{origen.nombre}</Tag>
        <Text type="secondary" style={{ fontSize: 11 }}>{origen.total} registros</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {dayjs(origen.fi).format('DD/MM/YY')}
          {origen.fi !== origen.ff && ` — ${dayjs(origen.ff).format('DD/MM/YY')}`}
        </Text>
      </div>
      <div style={{ paddingLeft: 10, borderLeft: `2px solid ${origen.color}` }}>
        {origen.fechas.map(f => (
          <div key={f.fecha} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: '20px' }}>
            <Text style={{ fontSize: 12 }}>{dayjs(f.fecha).format('DD/MM/YYYY')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{f.count}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClusterSection({ cluster, tipoLabel, tipoColor }: {
  cluster: UltimoCluster
  tipoLabel: string
  tipoColor: string
}) {
  const total = cluster.origenes.reduce((s, o) => s + o.total, 0)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Tag color={tipoColor} style={{ margin: 0, fontWeight: 600 }}>{tipoLabel}</Tag>
        {cluster.evento_nombre && (
          <Text strong style={{ fontSize: 13 }}>{cluster.evento_nombre}</Text>
        )}
        <Text type="secondary" style={{ fontSize: 11 }}>· {total} registros</Text>
      </div>
      <div style={{ paddingLeft: 8 }}>
        {cluster.origenes.map(o => (
          <OrigenBlock key={o.nombre} origen={o} />
        ))}
        {cluster.origenes.length === 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>Sin registros por origen</Text>
        )}
      </div>
    </div>
  )
}

export default function EstadisticasReportesPage() {
  const [loading, setLoading]         = useState(true)
  const [plantillas, setPlantillas]   = useState<PlantillaOut[]>([])
  const [selected, setSelected]       = useState<PlantillaOut | null>(null)
  const [drawerOpen, setDrawerOpen]   = useState(false)
  const [sending, setSending]         = useState<number | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)

  // Per-card date state
  const [cardDates, setCardDates] = useState<Record<number, CardDateState>>({})

  const [form] = Form.useForm()

  // Track which plantillas have had their "último evento" fetched to avoid double-fetch
  const fetchedRef = useRef<Set<number>>(new Set())

  useEffect(() => { load() }, [])

  const fetchUltimo = async (p: PlantillaOut) => {
    if (fetchedRef.current.has(p.id)) return
    fetchedRef.current.add(p.id)
    setCardDates(prev => ({
      ...prev,
      [p.id]: { ...prev[p.id], loadingUltimo: true },
    }))
    try {
      const { data } = await reportesPdfApi.ultimoEvento(p.id)
      setCardDates(prev => ({
        ...prev,
        [p.id]: {
          ...prev[p.id],
          ultimo: data,
          loadingUltimo: false,
          range: data.fi && data.ff ? [data.fi, data.ff] : prev[p.id].range,
        },
      }))
    } catch {
      fetchedRef.current.delete(p.id)
      setCardDates(prev => ({
        ...prev,
        [p.id]: { ...prev[p.id], loadingUltimo: false },
      }))
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await reportesPdfApi.list()
      const active = data.filter(p => p.activa)
      setPlantillas(active)
      const initial: Record<number, CardDateState> = {}
      active.forEach(p => { initial[p.id] = initCardDate() })
      setCardDates(initial)
      active.forEach(p => fetchUltimo(p))
    } finally {
      setLoading(false)
    }
  }

  const setMode = (id: number, mode: DateMode) => {
    setCardDates(prev => ({ ...prev, [id]: { ...prev[id], mode } }))
    if (mode === 'ultimo') {
      fetchedRef.current.delete(id)
      fetchUltimo(plantillas.find(p => p.id === id)!)
    }
  }

  const setRange = (id: number, range: [string, string]) => {
    setCardDates(prev => ({ ...prev, [id]: { ...prev[id], range } }))
  }

  const getEffectiveRange = (id: number): [string, string] => {
    const cd = cardDates[id]
    if (!cd) return DEFAULT_RANGO
    if (cd.mode === 'ultimo' && cd.ultimo?.fi && cd.ultimo?.ff)
      return [cd.ultimo.fi, cd.ultimo.ff]
    return cd.range
  }

  const openConfig = (p: PlantillaOut) => {
    setSelected(p)
    form.setFieldsValue({
      destinatarios: p.destinatarios ?? [],
      prog_hora: p.prog_hora ? dayjs(p.prog_hora, 'HH:mm') : null,
      prog_dia_semana: p.prog_dia_semana ?? null,
      prog_activo: p.prog_activo ?? false,
    })
    setDrawerOpen(true)
  }

  const saveConfig = async () => {
    if (!selected) return
    try {
      const vals = await form.validateFields()
      const body: ProgramacionUpdate = {
        destinatarios: vals.destinatarios ?? [],
        prog_hora: vals.prog_hora ? dayjs(vals.prog_hora).format('HH:mm') : null,
        prog_dia_semana: vals.prog_dia_semana ?? null,
        prog_activo: vals.prog_activo ?? false,
      }
      const { data } = await reportesPdfApi.updateProgramacion(selected.id, body)
      setPlantillas(prev => prev.map(p => p.id === data.id ? data : p))
      message.success('Configuración guardada')
      setDrawerOpen(false)
    } catch (e: unknown) {
      message.error(getErrorDetail(e) ?? 'Error al guardar')
    }
  }

  const toDateRangeParams = (fi: string, ff: string): [string, string] => [
    dayjs(fi).startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
    dayjs(ff).endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
  ]

  const handleEnviar = async (p: PlantillaOut) => {
    const [fi, ff] = toDateRangeParams(...getEffectiveRange(p.id))
    setSending(p.id)
    try {
      await reportesPdfApi.enviar(p.id, fi, ff)
      message.success(`Reporte enviado a ${p.destinatarios.join(', ')}`)
    } catch (e: unknown) {
      message.error(getErrorDetail(e) ?? 'Error al enviar')
    } finally {
      setSending(null)
    }
  }

  const handleDescargar = async (p: PlantillaOut, formato: 'pdf' | 'word') => {
    const [fi, ff] = toDateRangeParams(...getEffectiveRange(p.id))
    setDownloading(p.id)
    try {
      const res = formato === 'pdf'
        ? await reportesPdfApi.generar(p.id, fi, ff)
        : await reportesPdfApi.generarWord(p.id, fi, ff)
      const ext  = formato === 'pdf' ? 'pdf' : 'docx'
      const mime = formato === 'pdf' ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const url  = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `reporte_${p.nombre.replace(/\s+/g, '_')}_${fi}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Error al generar el archivo')
    } finally {
      setDownloading(null)
    }
  }

  const progActivo = Form.useWatch('prog_activo', form)

  const borderColor = (tipo: string) =>
    tipo === 'rf' ? '#1677ff' : tipo === 'rs' ? '#722ed1' : '#faad14'

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Reportes</Title>
      </div>

      <Spin spinning={loading}>
        {plantillas.length === 0 && !loading && (
          <Empty description="No tienes reportes asignados" image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 80 }} />
        )}
        <Row gutter={[16, 16]}>
          {plantillas.map(p => {
            const cd = cardDates[p.id] ?? initCardDate()

            return (
              <Col key={p.id} xs={24} lg={12}>
                <Card
                  className="card-shadow"
                  styles={{ header: { borderLeft: `4px solid ${borderColor(p.tipo)}` } }}
                  title={
                    <Space>
                      <Tag color={TIPO_COLOR[p.tipo]}>{TIPO_LABEL[p.tipo]}</Tag>
                      <Text strong>{p.nombre}</Text>
                    </Space>
                  }
                  extra={
                    <Tooltip title="Configurar buzones y programación">
                      <Button icon={<SettingOutlined />} size="small" onClick={() => openConfig(p)} />
                    </Tooltip>
                  }
                >
                  {/* Info evento */}
                  {(p.eventos_rf_tipos?.length || p.eventos_rs_tipos?.length) ? (
                    <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                      <CalendarOutlined style={{ marginRight: 4 }} />
                      {[...(p.eventos_rf_tipos ?? []), ...(p.eventos_rs_tipos ?? [])].join(' + ')}
                    </div>
                  ) : null}

                  {/* Programación activa */}
                  {p.prog_activo && p.prog_hora && p.prog_dia_semana != null ? (
                    <Badge status="processing" color="green"
                      text={
                        <Text style={{ fontSize: 12 }}>
                          Envío automático —{' '}
                          {DIAS_SEMANA.find(d => d.value === p.prog_dia_semana)?.label} a las <strong>{p.prog_hora}</strong>
                          {p.prog_ultima_ejecucion
                            ? <Text type="secondary" style={{ fontSize: 11 }}> · último: {dayjs(p.prog_ultima_ejecucion).format('DD/MM/YYYY HH:mm')}</Text>
                            : null}
                        </Text>
                      }
                    />
                  ) : (
                    <Badge status="default" text={<Text type="secondary" style={{ fontSize: 12 }}>Sin programación activa</Text>} />
                  )}

                  {/* Destinatarios */}
                  {p.destinatarios.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <MailOutlined style={{ marginRight: 4, color: '#888' }} />
                      {p.destinatarios.map(d => <Tag key={d} style={{ fontSize: 11 }}>{d}</Tag>)}
                    </div>
                  )}

                  <Divider style={{ margin: '12px 0' }} />

                  {/* Selector de fechas */}
                  <div style={{ marginBottom: 12 }}>
                    <Segmented
                      size="small"
                      value={cd.mode}
                      onChange={v => setMode(p.id, v as DateMode)}
                      options={[
                        { label: 'Último evento', value: 'ultimo' },
                        { label: 'Rango de fechas', value: 'rango' },
                      ]}
                      style={{ marginBottom: 8 }}
                    />
                    {cd.mode === 'ultimo' ? (
                      cd.loadingUltimo ? (
                        <Spin size="small" />
                      ) : cd.ultimo?.fi ? (
                        <div>
                          {cd.ultimo.rf?.fi && (
                            <ClusterSection cluster={cd.ultimo.rf} tipoLabel="RF" tipoColor="blue" />
                          )}
                          {cd.ultimo.rs?.fi && (
                            <ClusterSection cluster={cd.ultimo.rs} tipoLabel="RS" tipoColor="purple" />
                          )}
                        </div>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>Sin registros en este evento</Text>
                      )
                    ) : (
                      <DatePicker.RangePicker
                        size="small"
                        value={[dayjs(cd.range[0]), dayjs(cd.range[1])]}
                        onChange={dates => {
                          if (dates?.[0] && dates?.[1])
                            setRange(p.id, [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                        }}
                      />
                    )}
                  </div>

                  {/* Acciones */}
                  <Space wrap>
                    <Tooltip title="Enviar por email ahora">
                      <Button
                        icon={<SendOutlined />}
                        size="small"
                        loading={sending === p.id}
                        disabled={!p.destinatarios.length}
                        onClick={() => handleEnviar(p)}
                      >
                        Enviar ahora
                      </Button>
                    </Tooltip>
                    <Tooltip title="Descargar en PDF">
                      <Button
                        icon={<FilePdfOutlined />}
                        size="small"
                        loading={downloading === p.id}
                        onClick={() => handleDescargar(p, 'pdf')}
                      >
                        PDF
                      </Button>
                    </Tooltip>
                    <Tooltip title="Descargar en Word (.docx)">
                      <Button
                        icon={<FileWordOutlined />}
                        size="small"
                        loading={downloading === p.id}
                        onClick={() => handleDescargar(p, 'word')}
                      >
                        Word
                      </Button>
                    </Tooltip>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      </Spin>

      {/* Drawer de configuración */}
      <Drawer
        title={`Configurar: ${selected?.nombre}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={460}
        footer={
          <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" onClick={saveConfig}>Guardar</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">

          <Form.Item
            label="Buzones destinatarios"
            name="destinatarios"
            extra="Emails que recibirán el reporte. Presiona Enter para agregar."
            rules={[
              {
                validator: (_, value) => {
                  if (form.getFieldValue('prog_activo') && (!value || value.length === 0))
                    return Promise.reject('Agrega al menos un buzón para el envío automático')
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Select mode="tags" tokenSeparators={[',']} placeholder="correo@ejemplo.com" style={{ width: '100%' }} />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <Form.Item label="Activar envío automático" name="prog_activo" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="Día de envío"
            name="prog_dia_semana"
            rules={[{ required: !!progActivo, message: 'Selecciona el día de envío' }]}
            extra="El sistema buscará el último evento registrado antes de este día."
          >
            <Select placeholder="Selecciona día" options={DIAS_SEMANA} />
          </Form.Item>

          <Form.Item
            label="Hora de envío"
            name="prog_hora"
            rules={[{ required: !!progActivo, message: 'Indica la hora de envío' }]}
          >
            <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }} placeholder="Selecciona hora" />
          </Form.Item>

        </Form>
      </Drawer>
    </div>
  )
}
