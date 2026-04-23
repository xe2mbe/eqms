import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Card, Form, Select, DatePicker, Button, Table, Typography,
  Space, InputNumber, Input, message, Popconfirm, Modal, Alert,
  Row, Col, AutoComplete, Divider, Tag, Tooltip,
} from 'antd'
import type { InputRef } from 'antd'
import {
  SaveOutlined, DeleteOutlined, EditOutlined, ReloadOutlined,
  CheckCircleOutlined, WarningOutlined, CalendarOutlined, PlusOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import client from '@/api/client'
import { catalogosApi } from '@/api/catalogos'
import { libretaRSApi, type EstadisticaRSPayload, type ReporteRSPayload } from '@/api/libretaRS'
import type { PlataformaRS, MetricaRS, EstadisticaRSRecord, ReporteRS, Evento, Zona, Estado, Estacion } from '@/types'

const { Title, Text } = Typography

// ── Validación de indicativo (igual que Libreta RF) ──────────────────────────
const INDICATIVO_RE = /^[A-Z0-9]{1,3}[0-9][A-Z]{1,3}$/
function validarIndicativo(ind: string): boolean {
  const cs = ind.trim().toUpperCase()
  return cs === 'SWL' || INDICATIVO_RE.test(cs)
}
const normalizarRST = (val: string) => val.replace(/[^0-9]/g, '').slice(0, 3)

// ── Tipo fila libreta RS ──────────────────────────────────────────────────────
interface FilaRS {
  key: string
  indicativo: string
  nombre_completo: string
  municipio: string
  estado: string
  zona: string
  pais: string
  rst: string
  status: 'ok' | 'notfound'
}

export default function LibretaRSPage() {
  const [plataformas, setPlataformas] = useState<PlataformaRS[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [estaciones, setEstaciones] = useState<Estacion[]>([])

  // ── Sesión ──
  const [platSeleccionada, setPlatSeleccionada] = useState<PlataformaRS | undefined>()
  const [metricasActivas, setMetricasActivas] = useState<MetricaRS[]>([])
  const [sesionFecha, setSesionFecha] = useState<dayjs.Dayjs>(dayjs())
  const [sesionEvento, setSesionEvento] = useState<string | undefined>()
  const [sesionEstacion, setSesionEstacion] = useState<string | undefined>()
  const [dateModalOpen, setDateModalOpen] = useState(true)
  const [fechaTmp, setFechaTmp] = useState<dayjs.Dayjs>(dayjs())

  // ── Métricas ──
  const [metricasForm] = Form.useForm()
  const [savingMetricas, setSavingMetricas] = useState(false)
  const [metricasGuardadas, setMetricasGuardadas] = useState<EstadisticaRSRecord[]>([])
  const [totalMetricas, setTotalMetricas] = useState(0)
  const [pageMetricas, setPageMetricas] = useState(1)
  const [loadingMetricas, setLoadingMetricas] = useState(false)

  // ── Libreta de captura ──
  const [filas, setFilas] = useState<FilaRS[]>([])
  const [inputIndicativo, setInputIndicativo] = useState('')
  const [inputRst, setInputRst] = useState('59')
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const inputRef = useRef<InputRef>(null)

  // ── Reportes guardados ──
  const [reportes, setReportes] = useState<ReporteRS[]>([])
  const [totalReportes, setTotalReportes] = useState(0)
  const [pageReportes, setPageReportes] = useState(1)
  const [loadingReportes, setLoadingReportes] = useState(false)

  // ── Modales edición ──
  const [editMetricaModal, setEditMetricaModal] = useState(false)
  const [editMetricaRecord, setEditMetricaRecord] = useState<EstadisticaRSRecord | null>(null)
  const [editMetricaForm] = Form.useForm()
  const [editReporteModal, setEditReporteModal] = useState(false)
  const [editReporteRecord, setEditReporteRecord] = useState<ReporteRS | null>(null)
  const [editReporteForm] = Form.useForm()

  // ── Colores por zona ──
  const zonaColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    zonas.forEach(z => { m[z.codigo] = z.color || '#999' })
    return m
  }, [zonas])
  const zonaColor = (codigo: string) => zonaColorMap[codigo] || '#999'

  const zonaExtranjero = useMemo(
    () => zonas.find(z => z.codigo.toLowerCase().includes('ext') || z.nombre.toLowerCase().includes('extranj'))?.codigo || 'Extranjero',
    [zonas]
  )

  useEffect(() => {
    catalogosApi.plataformasRS().then(({ data }) => setPlataformas(data))
    catalogosApi.eventos().then(({ data }) => setEventos(data))
    catalogosApi.zonas().then(({ data }) => setZonas(data))
    catalogosApi.estados().then(({ data }) => setEstados(data))
    catalogosApi.estaciones().then(({ data }) => setEstaciones(data))
  }, [])

  const onPlatChange = (pid: number) => {
    const plat = plataformas.find(p => p.id === pid)
    setPlatSeleccionada(plat)
    setMetricasActivas((plat?.metricas || []).filter(m => m.is_active).sort((a, b) => a.orden - b.orden))
    metricasForm.resetFields()
    setFilas([])
  }

  // ── Fetch métricas guardadas ──
  const fetchMetricas = useCallback(async (p = pageMetricas) => {
    if (!platSeleccionada) return
    setLoadingMetricas(true)
    try {
      const { data } = await libretaRSApi.listEstadisticas({ page: p, page_size: 20, plataforma_id: platSeleccionada.id })
      setMetricasGuardadas(data.items)
      setTotalMetricas(data.total)
    } finally { setLoadingMetricas(false) }
  }, [pageMetricas, platSeleccionada])

  useEffect(() => { fetchMetricas() }, [fetchMetricas])

  // ── Fetch reportes guardados ──
  const fetchReportes = useCallback(async (p = pageReportes) => {
    if (!platSeleccionada) return
    setLoadingReportes(true)
    try {
      const { data } = await libretaRSApi.listReportes({
        page: p, page_size: 50,
        plataforma_id: platSeleccionada.id,
        fecha_inicio: sesionFecha.startOf('day').toISOString(),
        fecha_fin: sesionFecha.endOf('day').toISOString(),
      })
      setReportes(data.items)
      setTotalReportes(data.total)
    } finally { setLoadingReportes(false) }
  }, [pageReportes, platSeleccionada, sesionFecha])

  useEffect(() => { fetchReportes() }, [fetchReportes])

  // ── Guardar métricas ──
  const handleGuardarMetricas = async () => {
    if (!platSeleccionada) return
    if (!sesionEvento?.trim()) { message.warning('Selecciona un evento antes de guardar'); return }
    const values = await metricasForm.validateFields()
    setSavingMetricas(true)
    try {
      const valores: Record<string, number> = {}
      for (const m of metricasActivas) valores[m.slug] = values[`m_${m.slug}`] ?? 0
      const payload: EstadisticaRSPayload = {
        plataforma_id: platSeleccionada.id,
        valores,
        fecha_reporte: sesionFecha.toISOString(),
        observaciones: values.observaciones,
      }
      await libretaRSApi.createEstadistica(payload)
      message.success('Métricas guardadas')
      metricasForm.resetFields()
      fetchMetricas(1); setPageMetricas(1)
      setTimeout(() => inputRef.current?.focus?.(), 150)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar métricas')
    } finally { setSavingMetricas(false) }
  }

  // ── Agregar indicativo a la libreta ──
  const buscarYAgregar = async () => {
    const cs = inputIndicativo.trim().toUpperCase()
    if (!cs) return
    if (!platSeleccionada) { message.warning('Selecciona una plataforma'); return }
    if (!sesionEvento?.trim()) { message.warning('Selecciona un evento'); return }
    if (!validarIndicativo(cs)) {
      message.error(`"${cs}" no es un indicativo válido`)
      return
    }
    if (filas.some(f => f.indicativo === cs)) {
      message.warning(`${cs} ya está en la libreta`)
      return
    }
    setBuscando(true)
    setInputIndicativo('')
    setTimeout(() => inputRef.current?.focus(), 50)

    const [opRes, prefixRes] = await Promise.allSettled([
      client.get(`/operadores/buscar/${encodeURIComponent(cs)}`),
      catalogosApi.lookupPrefijo(cs),
    ])

    setBuscando(false)

    const op = opRes.status === 'fulfilled' ? opRes.value.data : null
    const prefix = prefixRes.status === 'fulfilled' ? prefixRes.value.data : null

    let zona = zonaExtranjero
    let pais = prefix?.pais || 'Desconocido'

    if (prefix?.zona_codigo) {
      const zonaDB = zonas.find(z => z.codigo === prefix.zona_codigo)
      zona = zonaDB ? zonaDB.codigo : zonaExtranjero
    }

    // Derivar zona desde estado si se conoce
    const estadoVal = op?.estado || ''
    if (estadoVal && prefix?.zona_codigo) {
      const estDB = estados.find(e => e.nombre === estadoVal)
      if (estDB?.zona) {
        const zonaDB = zonas.find(z => z.codigo === estDB.zona)
        if (zonaDB) zona = zonaDB.codigo
      }
    }

    const fila: FilaRS = {
      key: `${cs}-${Date.now()}`,
      indicativo: cs,
      nombre_completo: op?.nombre_completo || '',
      municipio: op?.municipio || '',
      estado: estadoVal,
      zona,
      pais,
      rst: inputRst || '59',
      status: op ? 'ok' : 'notfound',
    }

    setFilas(prev => [...prev, fila])
    if (!op) message.info(`${cs} no está en el catálogo. Puedes editar los datos en la tabla.`)
  }

  const actualizarFila = (key: string, campo: keyof FilaRS, valor: string) =>
    setFilas(prev => prev.map(f => f.key === key ? { ...f, [campo]: valor } : f))

  const eliminarFila = (key: string) => setFilas(prev => prev.filter(f => f.key !== key))

  // ── Guardar todo ──
  const guardarTodo = async () => {
    if (!platSeleccionada || filas.length === 0) { message.warning('No hay registros en la libreta'); return }
    if (!sesionEvento?.trim()) { message.warning('Selecciona un evento'); return }
    setGuardando(true)
    try {
      await Promise.all(filas.map(fila => {
        const payload: ReporteRSPayload = {
          indicativo: fila.indicativo,
          operador: fila.nombre_completo,
          senal: parseInt(fila.rst) || 59,
          plataforma_id: platSeleccionada.id,
          estado: fila.estado,
          ciudad: fila.municipio,
          zona: fila.zona,
          pais: fila.pais,
          tipo_reporte: sesionEvento,
          qrz_station: sesionEstacion,
          fecha_reporte: sesionFecha.toISOString(),
        }
        return libretaRSApi.createReporte(payload)
      }))
      message.success(`${filas.length} reporte(s) guardados`)
      setFilas([])
      fetchReportes(1); setPageReportes(1)
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (e: any) {
      message.error('Error al guardar: ' + (e?.response?.data?.detail || e?.message || 'desconocido'))
    } finally { setGuardando(false) }
  }

  // ── Edición de métricas ──
  const openEditMetrica = (r: EstadisticaRSRecord) => {
    setEditMetricaRecord(r)
    const plat = plataformas.find(p => p.id === r.plataforma_id)
    const ms = (plat?.metricas || []).filter(m => m.is_active).sort((a, b) => a.orden - b.orden)
    const fields: Record<string, unknown> = { fecha_reporte: dayjs(r.fecha_reporte), observaciones: r.observaciones }
    for (const m of ms) fields[`m_${m.slug}`] = r.valores?.[m.slug] ?? 0
    editMetricaForm.setFieldsValue(fields)
    setEditMetricaModal(true)
  }

  const getEditMetricasActivas = () => {
    if (!editMetricaRecord) return []
    const plat = plataformas.find(p => p.id === editMetricaRecord.plataforma_id)
    return (plat?.metricas || []).filter(m => m.is_active).sort((a, b) => a.orden - b.orden)
  }

  const handleSaveEditMetrica = async () => {
    if (!editMetricaRecord) return
    const values = await editMetricaForm.validateFields()
    try {
      const ms = getEditMetricasActivas()
      const valores: Record<string, number> = {}
      for (const m of ms) valores[m.slug] = values[`m_${m.slug}`] ?? 0
      await libretaRSApi.updateEstadistica(editMetricaRecord.id, {
        plataforma_id: editMetricaRecord.plataforma_id,
        valores,
        fecha_reporte: values.fecha_reporte.toISOString(),
        observaciones: values.observaciones,
      })
      message.success('Actualizado')
      setEditMetricaModal(false)
      fetchMetricas()
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Error') }
  }

  // ── Edición de reportes ──
  const openEditReporte = (r: ReporteRS) => {
    setEditReporteRecord(r)
    editReporteForm.setFieldsValue({ ...r, fecha_reporte: dayjs(r.fecha_reporte) })
    setEditReporteModal(true)
  }

  const handleSaveEditReporte = async () => {
    if (!editReporteRecord) return
    const values = await editReporteForm.validateFields()
    try {
      await libretaRSApi.updateReporte(editReporteRecord.id, {
        ...values,
        indicativo: values.indicativo.toUpperCase().trim(),
        plataforma_id: editReporteRecord.plataforma_id,
        fecha_reporte: values.fecha_reporte.toISOString(),
      })
      message.success('Actualizado')
      setEditReporteModal(false)
      fetchReportes()
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Error') }
  }

  const tiposEvento = eventos.map(e => ({ value: e.tipo, label: e.tipo }))
  const estacionOptions = estaciones.filter(e => e.is_active).map(e => ({ value: e.qrz, label: e.qrz }))

  // ── Columnas libreta captura ──
  const libroColumns = [
    {
      title: '', dataIndex: 'status', width: 32,
      render: (v: FilaRS['status']) => (
        <Tooltip title={v === 'ok' ? 'En catálogo' : 'No encontrado en catálogo'}>
          {v === 'ok'
            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
            : <WarningOutlined style={{ color: '#fa8c16' }} />}
        </Tooltip>
      ),
    },
    {
      title: 'Indicativo', dataIndex: 'indicativo', width: 110,
      render: (v: string, row: FilaRS) => (
        <Input size="small" value={v} variant="borderless"
          onChange={e => actualizarFila(row.key, 'indicativo', e.target.value.toUpperCase())}
          style={{ fontWeight: 700, color: '#1A569E', fontSize: 14 }} />
      ),
    },
    {
      title: 'RST', dataIndex: 'rst', width: 70,
      render: (v: string, row: FilaRS) => (
        <Input size="small" value={v} variant="borderless" style={{ width: 60 }}
          onChange={e => actualizarFila(row.key, 'rst', normalizarRST(e.target.value))} />
      ),
    },
    {
      title: 'Nombre', dataIndex: 'nombre_completo', width: 180,
      render: (v: string, row: FilaRS) => (
        <Input size="small" value={v} variant="borderless" placeholder="Nombre"
          onChange={e => actualizarFila(row.key, 'nombre_completo', e.target.value)} />
      ),
    },
    {
      title: 'Ciudad', dataIndex: 'municipio', width: 130,
      render: (v: string, row: FilaRS) => (
        <Input size="small" value={v} variant="borderless" placeholder="Ciudad"
          onChange={e => actualizarFila(row.key, 'municipio', e.target.value)} />
      ),
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 160,
      render: (v: string, row: FilaRS) => (
        <Select size="small" value={v || undefined} placeholder="Estado"
          showSearch allowClear optionFilterProp="label" style={{ width: '100%' }}
          options={estados.map(e => ({ value: e.nombre, label: e.nombre }))}
          onChange={val => {
            actualizarFila(row.key, 'estado', val || '')
            const est = estados.find(e => e.nombre === val)
            if (est?.zona) {
              const zonaDB = zonas.find(z => z.codigo === est.zona)
              if (zonaDB) actualizarFila(row.key, 'zona', zonaDB.codigo)
            }
          }} />
      ),
    },
    {
      title: 'Zona', dataIndex: 'zona', width: 100,
      render: (v: string, row: FilaRS) => {
        const color = zonaColor(v)
        return (
          <Select size="small" value={v} style={{ width: '100%' }}
            onChange={val => actualizarFila(row.key, 'zona', val)}
            labelRender={({ value }) => (
              <span style={{ color, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{value as string}</span>
            )}
            optionRender={option => {
              const c = zonaColor(option.value as string)
              return <span style={{ color: c, fontWeight: 700 }}>{option.value as string}</span>
            }}
            options={zonas.filter(z => z.is_active).map(z => ({ value: z.codigo, label: z.codigo }))}
          />
        )
      },
    },
    {
      title: 'País', dataIndex: 'pais', width: 110,
      render: (v: string, row: FilaRS) => (
        <Input size="small" value={v} variant="borderless" placeholder="País"
          onChange={e => actualizarFila(row.key, 'pais', e.target.value)} />
      ),
    },
    {
      title: '', key: 'del', width: 40,
      render: (_: unknown, row: FilaRS) => (
        <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => eliminarFila(row.key)} />
      ),
    },
  ]

  // ── Columnas métricas ──
  const metricasColumns = [
    {
      title: 'Métricas', key: 'valores',
      render: (_: unknown, r: EstadisticaRSRecord) => (
        <Space wrap size={4}>
          {Object.entries(r.valores || {}).map(([k, v]) => (
            <span key={k}><Text type="secondary" style={{ fontSize: 11 }}>{k}:</Text> <strong>{Number(v).toLocaleString()}</strong></span>
          ))}
        </Space>
      ),
    },
    { title: 'Observaciones', dataIndex: 'observaciones', key: 'obs', render: (v: string) => v || '—' },
    {
      title: 'Fecha', dataIndex: 'fecha_reporte', key: 'fecha', width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Capturado por', dataIndex: 'capturado_por_nombre', key: 'cap', width: 110,
      render: (v: string) => v || '—',
    },
    {
      title: '', key: 'acc', width: 70,
      render: (_: unknown, r: EstadisticaRSRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditMetrica(r)} />
          <Popconfirm title="¿Eliminar?" okText="Sí" cancelText="No"
            onConfirm={async () => { await libretaRSApi.deleteEstadistica(r.id); fetchMetricas() }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Columnas reportes guardados ──
  const reportesColumns = [
    {
      title: 'Indicativo', dataIndex: 'indicativo', key: 'ind',
      render: (v: string) => <strong style={{ color: '#1A569E' }}>{v}</strong>,
    },
    { title: 'RST', dataIndex: 'senal', key: 'rst', width: 60 },
    { title: 'Operador', dataIndex: 'operador', key: 'op', render: (v: string) => v || '—' },
    {
      title: 'Zona', dataIndex: 'zona', key: 'zona', width: 80,
      render: (v: string) => v
        ? <Tag color={zonaColor(v)} style={{ color: '#fff', fontWeight: 700 }}>{v}</Tag>
        : '—',
    },
    { title: 'Estado', dataIndex: 'estado', key: 'est', render: (v: string) => v || '—' },
    { title: 'Ciudad', dataIndex: 'ciudad', key: 'ciu', render: (v: string) => v || '—' },
    { title: 'País', dataIndex: 'pais', key: 'pais', render: (v: string) => v || '—' },
    {
      title: 'URL', dataIndex: 'url_publicacion', key: 'url',
      render: (v: string) => v
        ? <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>Ver</a>
        : '—',
    },
    {
      title: 'Hora', dataIndex: 'created_at', key: 'hora', width: 70,
      render: (v: string) => dayjs(v).format('HH:mm'),
    },
    {
      title: 'Cap. por', dataIndex: 'capturado_por_nombre', key: 'cap', width: 90,
      render: (v: string) => v || '—',
    },
    {
      title: '', key: 'acc', width: 70,
      render: (_: unknown, r: ReporteRS) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditReporte(r)} />
          <Popconfirm title="¿Eliminar?" okText="Sí" cancelText="No"
            onConfirm={async () => { await libretaRSApi.deleteReporte(r.id); fetchReportes() }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Libreta RS — Redes Sociales</Title>
      </div>

      {/* ── Configuración de sesión ── */}
      <Card className="card-shadow" style={{ marginBottom: 12 }} size="small">
        <Row gutter={16} align="top">
          <Col xs={24} sm={8} md={7}>
            <Form.Item label="Plataforma" style={{ margin: 0 }}>
              <Select placeholder="Selecciona plataforma..." showSearch optionFilterProp="label"
                style={{ width: '100%' }}
                options={plataformas.map(p => ({ value: p.id, label: p.nombre }))}
                onChange={onPlatChange} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={7}>
            <Form.Item
              label="Evento"
              style={{ margin: 0 }}
              required
              validateStatus={sesionEvento ? '' : 'warning'}
              help={sesionEvento ? undefined : 'Requerido antes de capturar'}
            >
              <AutoComplete placeholder="Selecciona o escribe el evento..." options={tiposEvento}
                value={sesionEvento} onChange={setSesionEvento} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8} md={5}>
            <Form.Item label="Estación" style={{ margin: 0 }}>
              <Select placeholder="Estación..." showSearch allowClear optionFilterProp="label"
                style={{ width: '100%' }} options={estacionOptions}
                value={sesionEstacion} onChange={setSesionEstacion} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={`Registros de esta sesión con fecha: ${sesionFecha.format('DD/MM/YYYY')}`}
        action={
          <Button size="small" icon={<CalendarOutlined />}
            onClick={() => { setFechaTmp(sesionFecha); setDateModalOpen(true) }}>
            Cambiar
          </Button>
        }
      />

      {platSeleccionada ? (
        <>
          {/* ── Métricas ── */}
          <Card className="card-shadow" style={{ marginBottom: 16 }}
            title={`Métricas — ${platSeleccionada.nombre}`}>
            <Form form={metricasForm} layout="inline">
              {metricasActivas.length > 0 ? metricasActivas.map(m => (
                <Form.Item key={m.id} label={m.nombre} name={`m_${m.slug}`} initialValue={0}>
                  <InputNumber min={0} style={{ width: 120 }} />
                </Form.Item>
              )) : (
                <Text type="warning">Sin métricas activas. Configúralas en Gestión &gt; Redes Sociales.</Text>
              )}
              <Form.Item label="Observaciones" name="observaciones">
                <Input placeholder="Opcional..." style={{ width: 200 }} />
              </Form.Item>
            </Form>
            <div style={{ marginTop: 12 }}>
              <Button type="primary" icon={<SaveOutlined />} loading={savingMetricas}
                onClick={handleGuardarMetricas} disabled={metricasActivas.length === 0}>
                Guardar métricas
              </Button>
            </div>
            {metricasGuardadas.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Table dataSource={metricasGuardadas} columns={metricasColumns} rowKey="id"
                  loading={loadingMetricas} size="small" pagination={{
                    current: pageMetricas, pageSize: 20, total: totalMetricas,
                    onChange: p => { setPageMetricas(p); fetchMetricas(p) },
                    showTotal: t => `${t} registros`,
                  }} />
              </div>
            )}
          </Card>

          <Divider>Toma de reportes — Estaciones vía {platSeleccionada.nombre}</Divider>

          {/* ── Libreta estilo RF ── */}
          <Card className="card-shadow" style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Row gutter={12} align="middle">
              <Col>
                <Text strong>Indicativo:</Text>{' '}
                <Input
                  ref={inputRef}
                  value={inputIndicativo}
                  onChange={e => setInputIndicativo(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarYAgregar() } }}
                  placeholder="XE2MBE / SWL"
                  style={{ width: 130 }}
                  suffix={buscando ? <ReloadOutlined spin style={{ fontSize: 11 }} /> : undefined}
                />
              </Col>
              <Col>
                <Text strong>RST:</Text>{' '}
                <Input
                  value={inputRst}
                  onChange={e => setInputRst(normalizarRST(e.target.value))}
                  style={{ width: 60, textAlign: 'center' }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarYAgregar() } }}
                />
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} loading={buscando} onClick={buscarYAgregar}>
                  Agregar
                </Button>
              </Col>
              <Col flex="auto" style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {filas.length > 0 ? `${filas.length} registro(s) en libreta` : 'Escribe el indicativo y presiona Enter para agregar rápidamente'}
                </Text>
              </Col>
            </Row>

            {filas.length > 0 && (
              <>
                <div style={{ marginTop: 12 }}>
                  <Table
                    dataSource={filas}
                    columns={libroColumns}
                    rowKey="key"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                  />
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Popconfirm title="¿Limpiar la libreta?" okText="Sí" cancelText="No"
                    onConfirm={() => setFilas([])}>
                    <Button danger>Limpiar</Button>
                  </Popconfirm>
                  <Button type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardarTodo}>
                    Guardar todo ({filas.length})
                  </Button>
                </div>
              </>
            )}
          </Card>

          {/* ── Reportes guardados hoy ── */}
          <Card className="card-shadow"
            title={`Reportes del ${sesionFecha.format('DD/MM/YYYY')} — ${platSeleccionada.nombre} (${totalReportes})`}>
            <Table dataSource={reportes} columns={reportesColumns} rowKey="id"
              loading={loadingReportes} size="small" pagination={{
                current: pageReportes, pageSize: 50, total: totalReportes,
                onChange: p => { setPageReportes(p); fetchReportes(p) },
                showTotal: t => `${t} reportes`,
              }} scroll={{ x: 'max-content' }} />
          </Card>
        </>
      ) : (
        <Card className="card-shadow">
          <Text type="secondary">Selecciona una plataforma para comenzar la sesión.</Text>
        </Card>
      )}

      {/* ── Modal selección de fecha ── */}
      <Modal
        title={<><CalendarOutlined style={{ marginRight: 8 }} />Fecha de captura</>}
        open={dateModalOpen} closable={false} maskClosable={false}
        onOk={() => { setSesionFecha(fechaTmp); setDateModalOpen(false) }}
        okText="Continuar"
        onCancel={() => setDateModalOpen(false)} cancelText="Cancelar"
        width={340}
      >
        <div style={{ padding: '16px 0' }}>
          <DatePicker format="DD/MM/YYYY" value={fechaTmp}
            onChange={v => v && setFechaTmp(v)} style={{ width: '100%' }} allowClear={false} />
        </div>
      </Modal>

      {/* ── Modal editar métricas ── */}
      <Modal title="Editar métricas" open={editMetricaModal} onOk={handleSaveEditMetrica}
        onCancel={() => setEditMetricaModal(false)} okText="Guardar" width={600}>
        <Form form={editMetricaForm} layout="vertical">
          <Form.Item label="Fecha" name="fecha_reporte" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            {getEditMetricasActivas().map(m => (
              <Col span={12} key={m.id}>
                <Form.Item label={m.nombre} name={`m_${m.slug}`}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Form.Item label="Observaciones" name="observaciones">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal editar reporte ── */}
      <Modal title="Editar reporte" open={editReporteModal} onOk={handleSaveEditReporte}
        onCancel={() => setEditReporteModal(false)} okText="Guardar" width={620}>
        <Form form={editReporteForm} layout="vertical">
          <Row gutter={12}>
            <Col span={6}><Form.Item label="Indicativo" name="indicativo" rules={[{ required: true }]}>
              <Input style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
            <Col span={6}><Form.Item label="Operador" name="operador"><Input /></Form.Item></Col>
            <Col span={4}><Form.Item label="RST" name="senal"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Fecha" name="fecha_reporte" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Estado" name="estado"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item label="Ciudad" name="ciudad"><Input /></Form.Item></Col>
            <Col span={4}><Form.Item label="Zona" name="zona"><Input /></Form.Item></Col>
            <Col span={4}><Form.Item label="País" name="pais"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item label="URL publicación" name="url_publicacion"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item label="Observaciones" name="observaciones">
              <Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
