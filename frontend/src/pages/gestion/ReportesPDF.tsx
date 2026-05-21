import { useEffect, useState } from 'react'
import {
  Badge, Button, Card, Col, DatePicker, Divider, Drawer, Form, Input,
  InputNumber, Popconfirm, Row, Select, Segmented, Space, Switch,
  Table, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, FilePdfOutlined,
  MailOutlined, PlusOutlined, SendOutlined,
  RadarChartOutlined, GlobalOutlined, TeamOutlined,
  BarChartOutlined, EnvironmentOutlined, StarOutlined,
  LikeOutlined, AppstoreOutlined, TrophyOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { catalogosApi } from '@/api/catalogos'
import {
  reportesPdfApi, DEFAULT_SECCIONES,
  type PlantillaOut, type PlantillaCreate, type SeccionesConfig, type TipoReporte,
} from '@/api/reportesPdf'
import type { Evento } from '@/types'

const { Title, Text } = Typography

const TIPO_LABEL: Record<TipoReporte, string> = { rf: 'RF', rs: 'RS', ambos: 'RF + RS' }
const TIPO_COLOR: Record<TipoReporte, string> = { rf: 'blue', rs: 'purple', ambos: 'gold' }

// ── Definición visual de secciones ───────────────────────────────────────────

interface SeccionDef {
  key: keyof SeccionesConfig
  label: string
  desc: string
  icon: React.ReactNode
  tipo: 'rf' | 'rs'
  hasNumber?: boolean
  numberKey?: keyof SeccionesConfig
  numberLabel?: string
}

const SECCIONES_RF: SeccionDef[] = [
  { key: 'resumen_general', label: 'Resumen General',      desc: 'Totales de QSOs, estaciones y estados',            icon: <BarChartOutlined />,     tipo: 'rf' },
  { key: 'por_zona',        label: 'Actividad por Zona',   desc: 'QSOs y estaciones agrupados por zona FMRE',        icon: <RadarChartOutlined />,   tipo: 'rf' },
  { key: 'por_sistema',     label: 'Actividad por Sistema',desc: 'Distribución por sistema de comunicación',         icon: <GlobalOutlined />,       tipo: 'rf' },
  { key: 'por_estado',      label: 'Actividad por Estado', desc: 'QSOs por estado de la república',                  icon: <EnvironmentOutlined />,  tipo: 'rf' },
  { key: 'primera_vez',     label: 'Nuevas Estaciones',    desc: 'Indicativos con primera aparición en el periodo',  icon: <StarOutlined />,         tipo: 'rf' },
  { key: 'top_estaciones',  label: 'Top Estaciones RF',    desc: 'Ranking de estaciones con más QSOs',               icon: <TrophyOutlined />,       tipo: 'rf', hasNumber: true, numberKey: 'top_estaciones', numberLabel: 'Top N' },
]

const SECCIONES_RS: SeccionDef[] = [
  { key: 'resumen_plataformas', label: 'Resumen Plataformas',  desc: 'Totales de reportes RS por plataforma',           icon: <AppstoreOutlined />,  tipo: 'rs' },
  { key: 'por_zona_rs',        label: 'Actividad por Zona RS', desc: 'Reportes RS agrupados por zona FMRE',             icon: <RadarChartOutlined />, tipo: 'rs' },
  { key: 'metricas_detalle',   label: 'Métricas Detalladas',   desc: 'Likes, comentarios, alcance, etc. por plataforma',icon: <LikeOutlined />,      tipo: 'rs' },
  { key: 'top_estaciones_rs',  label: 'Top Estaciones RS',     desc: 'Ranking de estaciones con más reportes RS',       icon: <TeamOutlined />,      tipo: 'rs', hasNumber: true, numberKey: 'top_estaciones_rs', numberLabel: 'Top N' },
]

// ── Componente tarjeta de sección ─────────────────────────────────────────────

function SeccionCard({ def, secciones, onChange }: {
  def: SeccionDef
  secciones: SeccionesConfig
  onChange: (patch: Partial<SeccionesConfig>) => void
}) {
  const enabled = def.hasNumber
    ? (secciones[def.key] as number) > 0
    : (secciones[def.key] as boolean)

  const accentColor = def.tipo === 'rf' ? '#1677ff' : '#722ed1'

  return (
    <div style={{
      border: `1.5px solid ${enabled ? accentColor : '#e0e0e0'}`,
      borderRadius: 10,
      padding: '12px 14px',
      background: enabled ? (def.tipo === 'rf' ? '#f0f5ff' : '#f9f0ff') : '#fafafa',
      transition: 'all 0.2s',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minHeight: 90,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space size={6}>
          <span style={{ fontSize: 18, color: enabled ? accentColor : '#bfbfbf' }}>{def.icon}</span>
          <Text strong style={{ fontSize: 13, color: enabled ? '#262626' : '#8c8c8c' }}>{def.label}</Text>
        </Space>
        <Switch
          size="small"
          checked={enabled}
          onChange={checked => {
            if (def.hasNumber && def.numberKey) {
              onChange({ [def.numberKey]: checked ? 10 : 0 })
            } else {
              onChange({ [def.key]: checked })
            }
          }}
          style={{ flexShrink: 0 }}
        />
      </div>
      <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.4 }}>{def.desc}</Text>
      {def.hasNumber && def.numberKey && enabled && (
        <Space size={6} style={{ marginTop: 2 }}>
          <Text style={{ fontSize: 12 }}>{def.numberLabel}:</Text>
          <InputNumber
            size="small"
            min={1} max={50}
            value={secciones[def.numberKey] as number}
            onChange={v => onChange({ [def.numberKey!]: v ?? 10 })}
            style={{ width: 65 }}
          />
        </Space>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ReportesPDFPage() {
  const [plantillas, setPlantillas] = useState<PlantillaOut[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(false)

  // Drawer plantilla
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<PlantillaOut | null>(null)
  const [form] = Form.useForm()
  const [tipo, setTipo] = useState<TipoReporte>('rf')
  const [secciones, setSecciones] = useState<SeccionesConfig>({ ...DEFAULT_SECCIONES })
  const [saving, setSaving] = useState(false)

  // Panel generar / enviar
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const [rango, setRango] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()])
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  // Eventos filtrados según tipo del drawer
  const eventosRF = eventos.filter(e => !e.categoria || e.categoria === 'rf' || e.categoria === 'general')
  const eventosRS = eventos.filter(e => !e.categoria || e.categoria === 'rs' || e.categoria === 'general')

  // Auto-fill rango cuando la plantilla seleccionada tiene evento recurrente
  useEffect(() => {
    if (!selectedPid) return
    const p = plantillas.find(x => x.id === selectedPid)
    if (!p) return
    const tipo = p.tipo || 'rf'
    const evId = tipo === 'rs' ? p.evento_rs_id : p.evento_rf_id
    if (!evId) return
    const ev = eventos.find(e => e.id === evId)
    if (!ev?.recurrente || !ev.dias_semana?.length) return
    for (let i = 0; i <= 7; i++) {
      const c = dayjs().subtract(i, 'day')
      if (ev.dias_semana.includes(c.day())) { setRango([c, c]); break }
    }
  }, [selectedPid, plantillas, eventos])

  const fetchPlantillas = async () => {
    setLoading(true)
    try { const { data } = await reportesPdfApi.list(); setPlantillas(data) }
    catch { message.error('Error al cargar plantillas') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchPlantillas()
    catalogosApi.eventos().then(r => setEventos(r.data))
  }, [])

  // ── Drawer ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setTipo('rf')
    setSecciones({ ...DEFAULT_SECCIONES })
    form.setFieldsValue({
      nombre: '', evento_rf_id: null, evento_rs_id: null,
      destinatarios: [], asunto_email: 'Estadísticas {evento} – {fecha}', activa: true,
    })
    setDrawerOpen(true)
  }

  const openEdit = (p: PlantillaOut) => {
    setEditing(p)
    setTipo(p.tipo || 'rf')
    setSecciones({
      resumen_general:     p.secciones.resumen_general     ?? true,
      por_zona:            p.secciones.por_zona            ?? true,
      por_sistema:         p.secciones.por_sistema         ?? true,
      top_estaciones:      p.secciones.top_estaciones      ?? 10,
      por_estado:          p.secciones.por_estado          ?? true,
      primera_vez:         p.secciones.primera_vez         ?? false,
      resumen_plataformas: p.secciones.resumen_plataformas ?? true,
      top_estaciones_rs:   p.secciones.top_estaciones_rs   ?? 10,
      por_zona_rs:         p.secciones.por_zona_rs         ?? true,
      metricas_detalle:    p.secciones.metricas_detalle    ?? false,
    })
    form.setFieldsValue({
      nombre:        p.nombre,
      evento_rf_id:  p.evento_rf_id,
      evento_rs_id:  p.evento_rs_id,
      destinatarios: p.destinatarios,
      asunto_email:  p.asunto_email,
      activa:        p.activa,
    })
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    try { await form.validateFields() } catch { return }
    const vals = form.getFieldsValue()
    const body: PlantillaCreate = {
      nombre:        vals.nombre,
      tipo,
      evento_rf_id:  vals.evento_rf_id ?? null,
      evento_rs_id:  vals.evento_rs_id ?? null,
      secciones,
      destinatarios: vals.destinatarios || [],
      asunto_email:  vals.asunto_email || null,
      activa:        vals.activa ?? true,
    }
    setSaving(true)
    try {
      if (editing) {
        await reportesPdfApi.update(editing.id, body)
        message.success('Plantilla actualizada')
      } else {
        await reportesPdfApi.create(body)
        message.success('Plantilla creada')
      }
      setDrawerOpen(false)
      fetchPlantillas()
    } catch { message.error('Error al guardar plantilla') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await reportesPdfApi.delete(id)
      message.success('Plantilla eliminada')
      fetchPlantillas()
      if (selectedPid === id) setSelectedPid(null)
    } catch { message.error('Error al eliminar') }
  }

  // ── Generar / Enviar ──────────────────────────────────────────────────────

  const fmtDt = (d: Dayjs, end = false) =>
    end ? d.endOf('day').format('YYYY-MM-DDTHH:mm:ss') : d.startOf('day').format('YYYY-MM-DDTHH:mm:ss')

  const handleGenerar = async () => {
    if (!selectedPid) { message.warning('Selecciona una plantilla'); return }
    setGenerating(true)
    try {
      const res = await reportesPdfApi.generar(selectedPid, fmtDt(rango[0]), fmtDt(rango[1], true))
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      const p = plantillas.find(x => x.id === selectedPid)
      a.download = `qms_${(p?.nombre || 'reporte').replace(/ /g, '_').toLowerCase()}_${rango[0].format('YYYYMMDD')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      message.success('PDF generado')
    } catch { message.error('Error al generar PDF') }
    finally { setGenerating(false) }
  }

  const handleEnviar = async () => {
    if (!selectedPid) { message.warning('Selecciona una plantilla'); return }
    setSending(true)
    try {
      const { data } = await reportesPdfApi.enviar(selectedPid, fmtDt(rango[0]), fmtDt(rango[1], true))
      message.success(`Enviado a: ${data.enviado_a.join(', ')}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error(err?.response?.data?.detail || 'Error al enviar correo')
    } finally { setSending(false) }
  }

  // ── Columnas tabla ────────────────────────────────────────────────────────

  const columns = [
    {
      title: 'Nombre', dataIndex: 'nombre', key: 'nombre',
      render: (v: string, r: PlantillaOut) => (
        <Space>
          <Text strong>{v}</Text>
          {!r.activa && <Tag color="default">Inactiva</Tag>}
        </Space>
      ),
    },
    {
      title: 'Tipo', key: 'tipo', width: 90,
      render: (_: unknown, r: PlantillaOut) => {
        const t = (r.tipo || 'rf') as TipoReporte
        return <Tag color={TIPO_COLOR[t]}>{TIPO_LABEL[t]}</Tag>
      },
    },
    {
      title: 'Evento RF', key: 'ev_rf', width: 160,
      render: (_: unknown, r: PlantillaOut) =>
        r.evento_rf_tipo
          ? <Tag color="blue">📡 {r.evento_rf_tipo}</Tag>
          : <Text type="secondary" style={{ fontSize: 12 }}>Todos</Text>,
    },
    {
      title: 'Evento RS', key: 'ev_rs', width: 160,
      render: (_: unknown, r: PlantillaOut) => {
        if (r.tipo === 'rf') return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        return r.evento_rs_tipo
          ? <Tag color="purple">📱 {r.evento_rs_tipo}</Tag>
          : <Text type="secondary" style={{ fontSize: 12 }}>Todos</Text>
      },
    },
    {
      title: 'Secciones', key: 'secciones',
      render: (_: unknown, r: PlantillaOut) => {
        const s = r.secciones
        const rf: string[] = []
        const rs: string[] = []
        if (s.resumen_general)     rf.push('Resumen')
        if (s.por_zona)            rf.push('Zona')
        if (s.por_sistema)         rf.push('Sistema')
        if (s.top_estaciones > 0)  rf.push(`Top ${s.top_estaciones}`)
        if (s.por_estado)          rf.push('Estado')
        if (s.primera_vez)         rf.push('1ª Vez')
        if (s.resumen_plataformas) rs.push('Plataformas')
        if (s.top_estaciones_rs > 0) rs.push(`Top ${s.top_estaciones_rs} RS`)
        if (s.por_zona_rs)         rs.push('Zona RS')
        if (s.metricas_detalle)    rs.push('Métricas')
        return (
          <Space size={3} wrap>
            {rf.map(t => <Tag key={t} color="blue" style={{ fontSize: 11 }}>{t}</Tag>)}
            {rs.map(t => <Tag key={t} color="purple" style={{ fontSize: 11 }}>{t}</Tag>)}
          </Space>
        )
      },
    },
    {
      title: 'Dest.', dataIndex: 'destinatarios', key: 'dest', width: 70,
      render: (v: string[]) => v.length
        ? <Badge count={v.length} color="#1A569E" />
        : <Text type="secondary">—</Text>,
    },
    {
      title: '', key: 'actions', width: 80,
      render: (_: unknown, r: PlantillaOut) => (
        <Space>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="¿Eliminar plantilla?" okText="Sí" cancelText="No"
            onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const selectedPlantilla = plantillas.find(p => p.id === selectedPid)

  return (
    <div className="page-container">
      <Title level={4} style={{ margin: '0 0 16px' }}>Reportes PDF</Title>

      {/* ── Plantillas ─────────────────────────────────────────────────── */}
      <Card className="card-shadow"
        title={<strong>Plantillas</strong>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Nueva plantilla</Button>}
        style={{ marginBottom: 16 }}>
        <Table
          dataSource={plantillas} columns={columns} rowKey="id"
          loading={loading} size="small" pagination={false}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedPid ? [selectedPid] : [],
            onChange: keys => setSelectedPid((keys[0] as number) ?? null),
          }}
          onRow={r => ({ onClick: () => setSelectedPid(r.id), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* ── Generar / Enviar ────────────────────────────────────────────── */}
      <Card className="card-shadow" title={<strong>Generar / Enviar</strong>}>
        <Row gutter={16} align="middle" wrap>
          <Col xs={24} sm={8}>
            <Form.Item label="Plantilla" style={{ marginBottom: 8 }}>
              <Select
                placeholder="Selecciona una plantilla"
                value={selectedPid} onChange={setSelectedPid} allowClear
                options={plantillas.filter(p => p.activa).map(p => ({
                  value: p.id,
                  label: <Space size={6}><Tag color={TIPO_COLOR[p.tipo as TipoReporte]}>{TIPO_LABEL[p.tipo as TipoReporte]}</Tag>{p.nombre}</Space>,
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item label="Rango de fechas" style={{ marginBottom: 8 }}>
              <DatePicker.RangePicker
                value={rango} onChange={v => v && setRango(v as [Dayjs, Dayjs])}
                format="DD/MM/YYYY" allowClear={false} style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Space style={{ marginTop: 4 }}>
              <Button icon={<FilePdfOutlined />} onClick={handleGenerar}
                loading={generating} disabled={!selectedPid}>
                Descargar
              </Button>
              <Tooltip title={selectedPlantilla && !selectedPlantilla.destinatarios.length
                ? 'Sin destinatarios configurados' : ''}>
                <Button type="primary" icon={<SendOutlined />} onClick={handleEnviar}
                  loading={sending}
                  disabled={!selectedPid || !selectedPlantilla?.destinatarios.length}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                  Enviar
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>
        {selectedPlantilla && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <MailOutlined style={{ marginRight: 4 }} />
            {selectedPlantilla.destinatarios.length
              ? selectedPlantilla.destinatarios.join(', ')
              : <em>Sin destinatarios configurados</em>}
          </Text>
        )}
      </Card>

      {/* ── Drawer crear / editar ────────────────────────────────────────── */}
      <Drawer
        title={editing ? `Editar — ${editing.nombre}` : 'Nueva Plantilla'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={820}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>Guardar</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">

          {/* ── Fila superior: nombre, activa ── */}
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item label="Nombre de la plantilla" name="nombre"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="Ej: Boletín Dominical FMRE" size="large" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Activa" name="activa" valuePropName="checked">
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Tipo de reporte ── */}
          <Form.Item label="Tipo de reporte">
            <Segmented
              value={tipo}
              onChange={v => setTipo(v as TipoReporte)}
              options={[
                { label: '📡 RF (Radio)',            value: 'rf' },
                { label: '📱 RS (Redes Sociales)',   value: 'rs' },
                { label: '📡📱 Ambos (RF + RS)',     value: 'ambos' },
              ]}
              block
            />
          </Form.Item>

          {/* ── Selectores de evento ── */}
          <Row gutter={16}>
            {(tipo === 'rf' || tipo === 'ambos') && (
              <Col span={tipo === 'ambos' ? 12 : 24}>
                <Form.Item
                  label={<Space><Tag color="blue">📡 Evento RF</Tag><span>filtrado a eventos RF</span></Space>}
                  name="evento_rf_id">
                  <Select
                    placeholder="Todos los eventos RF"
                    allowClear showSearch optionFilterProp="label"
                    options={eventosRF.map(e => ({ value: e.id, label: e.tipo }))}
                    optionRender={opt => {
                      const ev = eventosRF.find(e => e.id === opt.value)
                      const c = ev?.color ?? '#1677ff'
                      return (
                        <Space size={6}>
                          <Tag style={{ background: c, borderColor: c, color: '#fff', margin: 0 }}>{ev?.tipo}</Tag>
                          {ev?.recurrente && <Tag color="processing" style={{ fontSize: 11 }}>Recurrente</Tag>}
                        </Space>
                      )
                    }}
                  />
                </Form.Item>
              </Col>
            )}
            {(tipo === 'rs' || tipo === 'ambos') && (
              <Col span={tipo === 'ambos' ? 12 : 24}>
                <Form.Item
                  label={<Space><Tag color="purple">📱 Evento RS</Tag><span>filtrado a eventos RS</span></Space>}
                  name="evento_rs_id">
                  <Select
                    placeholder="Todos los eventos RS"
                    allowClear showSearch optionFilterProp="label"
                    options={eventosRS.map(e => ({ value: e.id, label: e.tipo }))}
                    optionRender={opt => {
                      const ev = eventosRS.find(e => e.id === opt.value)
                      const c = ev?.color ?? '#722ed1'
                      return (
                        <Space size={6}>
                          <Tag style={{ background: c, borderColor: c, color: '#fff', margin: 0 }}>{ev?.tipo}</Tag>
                          {ev?.recurrente && <Tag color="processing" style={{ fontSize: 11 }}>Recurrente</Tag>}
                        </Space>
                      )
                    }}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* ── Constructor visual de secciones ── */}
          {(tipo === 'rf' || tipo === 'ambos') && (
            <>
              <Divider orientation="left">
                <Tag color="blue">📡 Secciones RF</Tag>
              </Divider>
              <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                {SECCIONES_RF.map(def => (
                  <Col span={12} key={String(def.key)}>
                    <SeccionCard
                      def={def} secciones={secciones}
                      onChange={patch => setSecciones(s => ({ ...s, ...patch }))}
                    />
                  </Col>
                ))}
              </Row>
            </>
          )}

          {(tipo === 'rs' || tipo === 'ambos') && (
            <>
              <Divider orientation="left">
                <Tag color="purple">📱 Secciones RS</Tag>
              </Divider>
              <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                {SECCIONES_RS.map(def => (
                  <Col span={12} key={String(def.key)}>
                    <SeccionCard
                      def={def} secciones={secciones}
                      onChange={patch => setSecciones(s => ({ ...s, ...patch }))}
                    />
                  </Col>
                ))}
              </Row>
            </>
          )}

          {/* ── Correo ── */}
          <Divider orientation="left">Correo electrónico</Divider>
          <Form.Item label="Destinatarios" name="destinatarios"
            help="Escribe un correo y presiona Enter para agregar">
            <Select mode="tags" placeholder="correo@ejemplo.com"
              tokenSeparators={[',']} open={false} />
          </Form.Item>
          <Form.Item label="Asunto" name="asunto_email"
            help="Variables disponibles: {evento}, {fecha}">
            <Input placeholder="Estadísticas {evento} – {fecha}" />
          </Form.Item>

        </Form>
      </Drawer>
    </div>
  )
}
