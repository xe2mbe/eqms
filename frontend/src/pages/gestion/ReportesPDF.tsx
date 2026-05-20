import { useEffect, useState } from 'react'
import {
  Button, Card, Checkbox, Col, DatePicker, Divider, Form, Input,
  InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Switch,
  Table, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  DeleteOutlined, EditOutlined, FilePdfOutlined,
  MailOutlined, PlusOutlined, SendOutlined,
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

export default function ReportesPDFPage() {
  const [plantillas, setPlantillas] = useState<PlantillaOut[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(false)

  // Modal plantilla
  const [modalOpen, setModalOpen] = useState(false)
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

  // Auto-fill rango cuando la plantilla tiene evento recurrente
  useEffect(() => {
    if (!selectedPid) return
    const plantilla = plantillas.find(p => p.id === selectedPid)
    if (!plantilla?.evento_id) return
    const evento = eventos.find(e => e.id === plantilla.evento_id)
    if (!evento?.recurrente || !evento.dias_semana?.length) return
    const dias = evento.dias_semana
    for (let i = 0; i <= 7; i++) {
      const candidato = dayjs().subtract(i, 'day')
      if (dias.includes(candidato.day())) {
        setRango([candidato, candidato])
        break
      }
    }
  }, [selectedPid, plantillas, eventos])

  const fetchPlantillas = async () => {
    setLoading(true)
    try {
      const { data } = await reportesPdfApi.list()
      setPlantillas(data)
    } catch { message.error('Error al cargar plantillas') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchPlantillas()
    catalogosApi.eventos().then(r => setEventos(r.data))
  }, [])

  // ── Modal ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setTipo('rf')
    setSecciones({ ...DEFAULT_SECCIONES })
    form.setFieldsValue({
      nombre: '',
      evento_id: null,
      destinatarios: [],
      asunto_email: 'Estadísticas {evento} – {fecha}',
      activa: true,
    })
    setModalOpen(true)
  }

  const openEdit = (p: PlantillaOut) => {
    setEditing(p)
    setTipo(p.tipo || 'rf')
    const sec: SeccionesConfig = {
      resumen_general:    p.secciones.resumen_general    ?? true,
      por_zona:           p.secciones.por_zona           ?? true,
      por_sistema:        p.secciones.por_sistema        ?? true,
      top_estaciones:     p.secciones.top_estaciones     ?? 10,
      por_estado:         p.secciones.por_estado         ?? true,
      primera_vez:        p.secciones.primera_vez        ?? false,
      resumen_plataformas: p.secciones.resumen_plataformas ?? true,
      top_estaciones_rs:  p.secciones.top_estaciones_rs  ?? 10,
      por_zona_rs:        p.secciones.por_zona_rs        ?? true,
      metricas_detalle:   p.secciones.metricas_detalle   ?? false,
    }
    setSecciones(sec)
    form.setFieldsValue({
      nombre:        p.nombre,
      evento_id:     p.evento_id,
      destinatarios: p.destinatarios,
      asunto_email:  p.asunto_email,
      activa:        p.activa,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try { await form.validateFields() } catch { return }
    const vals = form.getFieldsValue()
    const body: PlantillaCreate = {
      nombre:        vals.nombre,
      tipo,
      evento_id:     vals.evento_id ?? null,
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
      setModalOpen(false)
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

  const fmtDt = (d: Dayjs, endOfDay = false) =>
    endOfDay
      ? d.endOf('day').format('YYYY-MM-DDTHH:mm:ss')
      : d.startOf('day').format('YYYY-MM-DDTHH:mm:ss')

  const handleGenerar = async () => {
    if (!selectedPid) { message.warning('Selecciona una plantilla'); return }
    setGenerating(true)
    try {
      const res = await reportesPdfApi.generar(selectedPid, fmtDt(rango[0]), fmtDt(rango[1], true))
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      const p = plantillas.find(x => x.id === selectedPid)
      link.download = `qms_${(p?.evento_tipo || 'reporte').replace(/ /g, '_').toLowerCase()}_${rango[0].format('YYYYMMDD')}.pdf`
      link.click()
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
      title: 'Tipo', key: 'tipo', width: 80,
      render: (_: unknown, r: PlantillaOut) => {
        const t = (r.tipo || 'rf') as TipoReporte
        return <Tag color={TIPO_COLOR[t]}>{TIPO_LABEL[t]}</Tag>
      },
    },
    {
      title: 'Evento', dataIndex: 'evento_tipo', key: 'evento',
      render: (v: string | null) => v
        ? <Tag color="blue">{v}</Tag>
        : <Text type="secondary">Todos</Text>,
    },
    {
      title: 'Secciones', key: 'secciones',
      render: (_: unknown, r: PlantillaOut) => {
        const s = r.secciones
        const tags: string[] = []
        // RF
        if (s.resumen_general)  tags.push('Resumen')
        if (s.por_zona)         tags.push('Zona')
        if (s.por_sistema)      tags.push('Sistema')
        if (s.top_estaciones)   tags.push(`Top ${s.top_estaciones}`)
        if (s.por_estado)       tags.push('Estado')
        if (s.primera_vez)      tags.push('1ª Vez')
        // RS
        if (s.resumen_plataformas) tags.push('Plataformas')
        if (s.top_estaciones_rs)   tags.push(`Top ${s.top_estaciones_rs} RS`)
        if (s.por_zona_rs)         tags.push('Zona RS')
        if (s.metricas_detalle)    tags.push('Métricas')
        return <Space size={4} wrap>{tags.map(t => <Tag key={t} color="geekblue">{t}</Tag>)}</Space>
      },
    },
    {
      title: 'Destinatarios', dataIndex: 'destinatarios', key: 'dest',
      render: (v: string[]) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v.length ? `${v.length} correo(s)` : '—'}
        </Text>
      ),
    },
    {
      title: '', key: 'actions', width: 100,
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

      {/* Plantillas */}
      <Card
        className="card-shadow"
        title={<strong>Plantillas</strong>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Nueva plantilla
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={plantillas}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedPid ? [selectedPid] : [],
            onChange: keys => setSelectedPid(keys[0] as number ?? null),
          }}
          onRow={r => ({ onClick: () => setSelectedPid(r.id), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* Generar / Enviar */}
      <Card className="card-shadow" title={<strong>Generar / Enviar</strong>}>
        <Row gutter={16} align="middle" wrap>
          <Col xs={24} sm={8}>
            <Form.Item label="Plantilla" style={{ marginBottom: 8 }}>
              <Select
                placeholder="Selecciona una plantilla"
                value={selectedPid}
                onChange={setSelectedPid}
                allowClear
                options={plantillas.filter(p => p.activa).map(p => ({
                  value: p.id,
                  label: p.nombre,
                }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item label="Rango de fechas" style={{ marginBottom: 8 }}>
              <DatePicker.RangePicker
                value={rango}
                onChange={v => v && setRango(v as [Dayjs, Dayjs])}
                format="DD/MM/YYYY"
                allowClear={false}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Space style={{ marginTop: 4 }}>
              <Button
                icon={<FilePdfOutlined />}
                onClick={handleGenerar}
                loading={generating}
                disabled={!selectedPid}
              >
                Descargar PDF
              </Button>
              <Tooltip title={
                selectedPlantilla && !selectedPlantilla.destinatarios.length
                  ? 'La plantilla no tiene destinatarios configurados'
                  : ''
              }>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleEnviar}
                  loading={sending}
                  disabled={!selectedPid || !selectedPlantilla?.destinatarios.length}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Enviar por correo
                </Button>
              </Tooltip>
            </Space>
          </Col>
        </Row>

        {selectedPlantilla && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MailOutlined style={{ marginRight: 4 }} />
              Destinatarios: {selectedPlantilla.destinatarios.length
                ? selectedPlantilla.destinatarios.join(', ')
                : <em>ninguno configurado</em>}
            </Text>
          </div>
        )}
      </Card>

      {/* Modal crear / editar plantilla */}
      <Modal
        title={editing ? `Editar — ${editing.nombre}` : 'Nueva Plantilla'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        width={620}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="Nombre" name="nombre"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="Ej: Boletín Dominical FMRE" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Activa" name="activa" valuePropName="checked">
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Tipo de reporte">
            <Segmented
              value={tipo}
              onChange={v => setTipo(v as TipoReporte)}
              options={[
                { label: 'RF (Radio)',           value: 'rf' },
                { label: 'RS (Redes Sociales)',  value: 'rs' },
                { label: 'Ambos (RF + RS)',       value: 'ambos' },
              ]}
              block
            />
          </Form.Item>

          <Form.Item label="Evento" name="evento_id">
            <Select
              placeholder="Todos los eventos"
              allowClear
              options={eventos.map(e => ({ value: e.id, label: e.tipo }))}
            />
          </Form.Item>

          {/* Secciones RF */}
          {(tipo === 'rf' || tipo === 'ambos') && (
            <>
              <Divider orientation="left" style={{ fontSize: 13 }}>
                {tipo === 'ambos' ? 'Secciones RF' : 'Secciones del reporte'}
              </Divider>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.resumen_general}
                    onChange={e => setSecciones(s => ({ ...s, resumen_general: e.target.checked }))}>
                    Resumen General
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.por_zona}
                    onChange={e => setSecciones(s => ({ ...s, por_zona: e.target.checked }))}>
                    Actividad por Zona
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.por_sistema}
                    onChange={e => setSecciones(s => ({ ...s, por_sistema: e.target.checked }))}>
                    Actividad por Sistema
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.por_estado}
                    onChange={e => setSecciones(s => ({ ...s, por_estado: e.target.checked }))}>
                    Actividad por Estado
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.primera_vez}
                    onChange={e => setSecciones(s => ({ ...s, primera_vez: e.target.checked }))}>
                    Nuevas Estaciones (1ª vez)
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Space align="center">
                    <Checkbox
                      checked={secciones.top_estaciones > 0}
                      onChange={e => setSecciones(s => ({
                        ...s, top_estaciones: e.target.checked ? 10 : 0,
                      }))}>
                      Top estaciones RF
                    </Checkbox>
                    {secciones.top_estaciones > 0 && (
                      <InputNumber
                        min={1} max={50} size="small"
                        value={secciones.top_estaciones}
                        onChange={v => setSecciones(s => ({ ...s, top_estaciones: v ?? 10 }))}
                        style={{ width: 60 }}
                      />
                    )}
                  </Space>
                </Col>
              </Row>
            </>
          )}

          {/* Secciones RS */}
          {(tipo === 'rs' || tipo === 'ambos') && (
            <>
              <Divider orientation="left" style={{ fontSize: 13 }}>
                {tipo === 'ambos' ? 'Secciones RS' : 'Secciones del reporte'}
              </Divider>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.resumen_plataformas}
                    onChange={e => setSecciones(s => ({ ...s, resumen_plataformas: e.target.checked }))}>
                    Resumen por Plataforma
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.por_zona_rs}
                    onChange={e => setSecciones(s => ({ ...s, por_zona_rs: e.target.checked }))}>
                    Actividad por Zona (RS)
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={secciones.metricas_detalle}
                    onChange={e => setSecciones(s => ({ ...s, metricas_detalle: e.target.checked }))}>
                    Métricas detalladas
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Space align="center">
                    <Checkbox
                      checked={secciones.top_estaciones_rs > 0}
                      onChange={e => setSecciones(s => ({
                        ...s, top_estaciones_rs: e.target.checked ? 10 : 0,
                      }))}>
                      Top estaciones RS
                    </Checkbox>
                    {secciones.top_estaciones_rs > 0 && (
                      <InputNumber
                        min={1} max={50} size="small"
                        value={secciones.top_estaciones_rs}
                        onChange={v => setSecciones(s => ({ ...s, top_estaciones_rs: v ?? 10 }))}
                        style={{ width: 60 }}
                      />
                    )}
                  </Space>
                </Col>
              </Row>
            </>
          )}

          <Divider orientation="left" style={{ fontSize: 13 }}>Correo electrónico</Divider>
          <Form.Item label="Destinatarios" name="destinatarios"
            help="Escribe un correo y presiona Enter para agregar">
            <Select
              mode="tags"
              placeholder="correo@ejemplo.com"
              tokenSeparators={[',']}
              open={false}
            />
          </Form.Item>
          <Form.Item label="Asunto" name="asunto_email"
            help="Variables: {evento}, {fecha}">
            <Input placeholder="Estadísticas {evento} – {fecha}" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
