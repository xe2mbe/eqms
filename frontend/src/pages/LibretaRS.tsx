import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Card, Form, Select, DatePicker, Button, Table, Typography,
  Space, InputNumber, Input, message, Popconfirm, Modal, notification,
  Row, Col, Divider, Tag, Tooltip, Badge, Alert,
} from 'antd'
import type { InputRef } from 'antd'
import {
  SaveOutlined, DeleteOutlined, EditOutlined, ReloadOutlined,
  CheckCircleOutlined, WarningOutlined, CalendarOutlined, PlusOutlined,
  LikeOutlined, MessageOutlined, ShareAltOutlined, PlayCircleOutlined,
  TeamOutlined, EyeOutlined, HeartOutlined, StarOutlined, BarChartOutlined,
  TagOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import client from '@/api/client'
import { catalogosApi } from '@/api/catalogos'
import { estadisticasApi } from '@/api/estadisticas'
import { libretaRSApi, type EstadisticaRSPayload, type ReporteRSPayload } from '@/api/libretaRS'
import type { PlataformaRS, MetricaRS, EstadisticaRSRecord, ReporteRS, Evento, Zona, Estado, Estacion } from '@/types'
import { useColPrefs } from '@/components/common/ColSettings'
import { useAuthStore } from '@/store/authStore'

const { Title, Text } = Typography

// ── Columnas configurables tabla reportes ─────────────────────────────────────
const REPORTE_COL_KEYS = ['indicativo', 'rst', 'operador', 'zona', 'estado', 'ciudad', 'pais', 'url', 'fecha_reporte', 'created_at', 'cap'] as const
type ReporteColKey = typeof REPORTE_COL_KEYS[number]
const REPORTE_COL_LABELS: Record<ReporteColKey, string> = {
  indicativo: 'Indicativo', rst: 'RST', operador: 'Operador', zona: 'Zona',
  estado: 'Estado', ciudad: 'Ciudad', pais: 'País', url: 'URL',
  fecha_reporte: 'Fecha Evento', created_at: 'Fecha Captura', cap: 'Cap. por',
}
const REPORTE_COL_LOCKED: ReporteColKey[] = ['indicativo']

// ── Mapa de iconos y colores por slug de métrica ─────────────────────────────
const METRICA_META: Record<string, { icon: React.ReactNode; color: string }> = {
  me_gusta:       { icon: <LikeOutlined />,        color: '#1677ff' },
  comentarios:    { icon: <MessageOutlined />,      color: '#52c41a' },
  compartidos:    { icon: <ShareAltOutlined />,     color: '#722ed1' },
  reproducciones: { icon: <PlayCircleOutlined />,   color: '#f5222d' },
  seguidores:     { icon: <TeamOutlined />,         color: '#fa8c16' },
  alcance:        { icon: <EyeOutlined />,          color: '#13c2c2' },
  impresiones:    { icon: <BarChartOutlined />,     color: '#eb2f96' },
  reacciones:     { icon: <HeartOutlined />,        color: '#ff4d4f' },
  guardados:      { icon: <StarOutlined />,         color: '#faad14' },
}
const getMetricaMeta = (slug: string) => METRICA_META[slug] ?? { icon: <TagOutlined />, color: '#8c8c8c' }

// ── Validación de indicativo (igual que Libreta RF) ──────────────────────────
const INDICATIVO_RE = /^[A-Z0-9]{1,3}[0-9][A-Z]{1,3}$/
function validarIndicativo(ind: string): boolean {
  const cs = ind.trim().toUpperCase()
  return cs === 'SWL' || INDICATIVO_RE.test(cs)
}
const normalizarRST = (val: string) => val.replace(/[^0-9]/g, '').slice(0, 3)
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// ── Celda editable de indicativo (estado local — no re-renderiza al padre durante tipeo) ──
function IndicativoCell({ value, rowKey, onCommit }: {
  value: string
  rowKey: string
  onCommit: (key: string, nuevo: string, anterior: string) => void
}) {
  const [local, setLocal] = React.useState(value)
  const originalRef = useRef(value)
  useEffect(() => { setLocal(value); originalRef.current = value }, [value])
  return (
    <Input
      size="small"
      value={local}
      variant="borderless"
      onChange={e => setLocal(e.target.value.toUpperCase())}
      onBlur={() => onCommit(rowKey, local.trim().toUpperCase(), originalRef.current)}
      style={{ fontWeight: 700, color: '#1A569E', fontSize: 14 }}
    />
  )
}

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
  const { user } = useAuthStore()
  const { colOrder, colVisible, colSettingsButton } =
    useColPrefs('libreta_rs_reportes', user?.id, REPORTE_COL_KEYS, REPORTE_COL_LOCKED, REPORTE_COL_LABELS)

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

  // ── Ranking RS y estadísticas ──
  type RankingEntry = { fecha: string; total_reportes: number; total_estaciones: number; posicion: number }
  type MiRankingEntry = { fecha: string; total: number; posicion: number }
  type RankingOpEntry = { usuario_id: number; nombre: string; total: number; posicion: number }
  const [rankingRS, setRankingRS] = useState<RankingEntry[]>([])
  const [miRankingRS, setMiRankingRS] = useState<MiRankingEntry[]>([])
  const [rankingOpHistoricoRS, setRankingOpHistoricoRS] = useState<RankingOpEntry[]>([])
  const prevPosicionRSRef = useRef<number | null>(null)

  // ── Reportes guardados ──
  const [reportes, setReportes] = useState<ReporteRS[]>([])
  const [totalReportes, setTotalReportes] = useState(0)
  const [pageReportes, setPageReportes] = useState(1)
  const [loadingReportes, setLoadingReportes] = useState(false)

  // ── Modal sobreescritura métricas ──
  const [overwriteModal, setOverwriteModal] = useState(false)
  const [pendingMetricasPayload, setPendingMetricasPayload] = useState<{ payload: EstadisticaRSPayload; existingId: number } | null>(null)

  // ── Modal día no permitido ──
  const [diaEventoModal, setDiaEventoModal] = useState<{ fecha: dayjs.Dayjs; tipoEvento: string; diasConfig: number[] } | null>(null)

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

  const verificarDiaEvento = useCallback((fecha: dayjs.Dayjs, tipoEvento: string): boolean => {
    const evento = eventos.find(e => e.tipo === tipoEvento)
    if (!evento?.recurrente || !evento.dias_semana?.length) return true
    if (evento.dias_semana.includes(fecha.day())) return true
    setDiaEventoModal({ fecha, tipoEvento, diasConfig: evento.dias_semana })
    return false
  }, [eventos])

  const ocurrenciaEvento = useMemo<{ numero: number; dia: number } | null>(() => {
    if (!sesionEvento) return null
    const evento = eventos.find(e => e.tipo === sesionEvento)
    if (!evento?.recurrente || !evento.dias_semana?.length) return null
    const dia = sesionFecha.day()
    if (!evento.dias_semana.includes(dia)) return null
    const inicioAnio = sesionFecha.startOf('year')
    const diasHastaFecha = sesionFecha.diff(inicioAnio, 'day')
    const diasHastaPrimero = (dia - inicioAnio.day() + 7) % 7
    const numero = Math.floor((diasHastaFecha - diasHastaPrimero) / 7) + 1
    return { numero, dia }
  }, [sesionFecha, sesionEvento, eventos])

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
      const { data } = await libretaRSApi.listEstadisticas({
        page: p,
        page_size: 20,
        plataforma_id: platSeleccionada.id,
        fecha_inicio: sesionFecha.startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        fecha_fin: sesionFecha.endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
      })
      setMetricasGuardadas(data.items)
      setTotalMetricas(data.total)
    } finally { setLoadingMetricas(false) }
  }, [pageMetricas, platSeleccionada, sesionFecha])

  useEffect(() => { fetchMetricas() }, [fetchMetricas])

  // ── Fetch reportes guardados ──
  const fetchReportes = useCallback(async (p = pageReportes) => {
    if (!platSeleccionada) return
    setLoadingReportes(true)
    try {
      const eventoId = eventos.find(e => e.tipo === sesionEvento)?.id
      const [reportesRes, rankingRes, miRankingRes, rankingOpRes] = await Promise.all([
        libretaRSApi.listReportes({
          page: p, page_size: 50,
          plataforma_id: platSeleccionada.id,
          fecha_inicio: sesionFecha.startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
          fecha_fin: sesionFecha.endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
        }),
        eventoId
          ? estadisticasApi.rsRankingEvento({ evento_id: eventoId, plataforma_id: platSeleccionada.id })
          : Promise.resolve({ data: [] as any }),
        eventoId
          ? estadisticasApi.rsMiRankingEvento({ evento_id: eventoId, plataforma_id: platSeleccionada.id })
          : Promise.resolve({ data: [] as any }),
        eventoId
          ? estadisticasApi.rsRankingOperadores(eventoId)
          : Promise.resolve({ data: [] as any }),
      ])
      setReportes(reportesRes.data.items)
      setTotalReportes(reportesRes.data.total)
      setRankingRS(rankingRes.data)
      setMiRankingRS(miRankingRes.data)
      setRankingOpHistoricoRS(rankingOpRes.data)
    } finally { setLoadingReportes(false) }
  }, [pageReportes, platSeleccionada, sesionFecha, sesionEvento, eventos])

  useEffect(() => { fetchReportes() }, [fetchReportes])

  // ── Guardar métricas ──
  const handleGuardarMetricas = async () => {
    if (!platSeleccionada) return
    if (!sesionEvento?.trim()) { message.warning('Selecciona un evento antes de guardar'); return }
    if (!verificarDiaEvento(sesionFecha, sesionEvento)) return
    const values = await metricasForm.validateFields()
    const valores: Record<string, number> = {}
    for (const m of metricasActivas) valores[m.slug] = values[`m_${m.slug}`] ?? 0
    const payload: EstadisticaRSPayload = {
      plataforma_id: platSeleccionada.id,
      valores,
      fecha_reporte: sesionFecha.format('YYYY-MM-DDTHH:mm:ss'),
      observaciones: values.observaciones,
    }
    // Verificar si ya existe un registro para esta plataforma y fecha
    const existente = metricasGuardadas.find(r =>
      r.plataforma_id === platSeleccionada.id &&
      dayjs(r.fecha_reporte).isSame(sesionFecha, 'day')
    )
    if (existente) {
      setPendingMetricasPayload({ payload, existingId: existente.id })
      setOverwriteModal(true)
      return
    }
    await doGuardarMetricas(payload, null)
  }

  const doGuardarMetricas = async (payload: EstadisticaRSPayload, existingId: number | null) => {
    setSavingMetricas(true)
    try {
      if (existingId) {
        await libretaRSApi.updateEstadistica(existingId, payload)
        message.success('Métricas actualizadas')
      } else {
        await libretaRSApi.createEstadistica(payload)
        message.success('Métricas guardadas')
      }
      metricasForm.resetFields()
      fetchMetricas(1); setPageMetricas(1)
      setTimeout(() => inputRef.current?.focus?.(), 150)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar métricas')
    } finally { setSavingMetricas(false) }
  }

  const handleConfirmOverwrite = async () => {
    if (!pendingMetricasPayload) return
    setOverwriteModal(false)
    await doGuardarMetricas(pendingMetricasPayload.payload, pendingMetricasPayload.existingId)
    setPendingMetricasPayload(null)
  }

  // ── Agregar indicativo a la libreta ──
  const buscarYAgregar = async () => {
    const cs = inputIndicativo.trim().toUpperCase()
    if (!cs) return
    if (!platSeleccionada) { message.warning('Selecciona una plataforma'); return }
    if (!sesionEvento?.trim()) { message.warning('Selecciona un evento'); return }
    if (!verificarDiaEvento(sesionFecha, sesionEvento)) return
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

    const [opRes, prefixRes] = await Promise.allSettled([
      client.get(`/operadores/buscar/${encodeURIComponent(cs)}`),
      catalogosApi.lookupPrefijo(cs),
    ])

    setBuscando(false)
    setTimeout(() => inputRef.current?.focus(), 50)

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

  const relookupFila = async (key: string, nuevoIndicativo: string) => {
    const cs = nuevoIndicativo.trim().toUpperCase()
    if (!cs || !validarIndicativo(cs)) return

    const [opRes, prefixRes] = await Promise.allSettled([
      client.get(`/operadores/buscar/${encodeURIComponent(cs)}`),
      catalogosApi.lookupPrefijo(cs),
    ])
    const op = opRes.status === 'fulfilled' ? opRes.value.data : null
    const prefix = prefixRes.status === 'fulfilled' ? prefixRes.value.data : null

    let zona = zonaExtranjero
    let pais = prefix?.pais || 'Desconocido'
    if (prefix?.zona_codigo) {
      const zonaDB = zonas.find(z => z.codigo === prefix.zona_codigo)
      zona = zonaDB ? zonaDB.codigo : zonaExtranjero
    }
    const estadoVal = op?.estado || ''
    if (estadoVal) {
      const estDB = estados.find(e => e.nombre === estadoVal)
      if (estDB?.zona) {
        const zonaDB = zonas.find(z => z.codigo === estDB.zona)
        if (zonaDB) zona = zonaDB.codigo
      }
    }

    setFilas(prev => prev.map(f => f.key === key ? {
      ...f,
      indicativo: cs,
      nombre_completo: op?.nombre_completo || '',
      municipio: op?.municipio || '',
      estado: estadoVal,
      zona,
      pais,
      status: op ? 'ok' : 'notfound',
    } : f))
    if (!op) message.info(`${cs} no está en el catálogo. Puedes editar los datos en la tabla.`)
  }

  const onCommitIndicativo = (key: string, nuevo: string, anterior: string) => {
    if (!validarIndicativo(nuevo)) return
    if (nuevo === anterior) return
    actualizarFila(key, 'indicativo', nuevo)
    relookupFila(key, nuevo)
  }

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
          zona_id: zonas.find(z => z.codigo === fila.zona)?.id,
          pais: fila.pais,
          evento_id: eventos.find(e => e.tipo === sesionEvento)?.id,
          estacion_id: estaciones.find(e => e.qrz === sesionEstacion)?.id,
          fecha_reporte: sesionFecha.format('YYYY-MM-DDTHH:mm:ss'),
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
    const fields: Record<string, unknown> = { observaciones: r.observaciones }
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
        fecha_reporte: dayjs(editMetricaRecord.fecha_reporte).format('YYYY-MM-DDTHH:mm:ss'),
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
    editReporteForm.setFieldsValue({
      indicativo: r.indicativo,
      operador: r.operador,
      senal: r.senal,
      estado: r.estado,
      ciudad: r.ciudad,
      zona_id: r.zona_id,
      pais: r.pais,
      url_publicacion: r.url_publicacion,
      observaciones: r.observaciones,
      fecha_reporte: dayjs(r.fecha_reporte),
    })
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
        fecha_reporte: values.fecha_reporte.format('YYYY-MM-DDTHH:mm:ss'),
      })
      message.success('Actualizado')
      setEditReporteModal(false)
      fetchReportes()
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Error') }
  }

  // ── Estadísticas RS de sesión ────────────────────────────────────────────
  const fechaActualRS = sesionFecha.format('YYYY-MM-DD')

  const statsRS = useMemo(() => {
    if (rankingRS.length === 0) return { totalQSOs: totalReportes, estacionesUnicas: 0, posicion: null as number | null, totalSesiones: 0, esRecordQSOs: false, esRecordEstaciones: false }
    const hoy = rankingRS.find(r => r.fecha === fechaActualRS)
    const posicion = hoy?.posicion ?? null
    const totalSesiones = rankingRS.length
    const maxEstaciones = Math.max(...rankingRS.map(r => r.total_estaciones))
    const esRecordQSOs = posicion === 1
    const esRecordEstaciones = (hoy?.total_estaciones ?? 0) > 0 && (hoy?.total_estaciones ?? 0) >= maxEstaciones
    return {
      totalQSOs: hoy?.total_reportes ?? totalReportes,
      estacionesUnicas: hoy?.total_estaciones ?? 0,
      posicion, totalSesiones, esRecordQSOs, esRecordEstaciones,
    }
  }, [rankingRS, fechaActualRS, totalReportes])

  // Ranking de operadores de la misma fecha+evento (client-side)
  const rankingOpSesionRS = useMemo(() => {
    const counts: Record<string, { nombre: string; total: number }> = {}
    for (const r of reportes) {
      const nombre = r.capturado_por_nombre || '—'
      if (!counts[nombre]) counts[nombre] = { nombre, total: 0 }
      counts[nombre].total++
    }
    return Object.values(counts)
      .sort((a, b) => b.total - a.total)
      .map((e, i) => ({ ...e, posicion: i + 1 }))
  }, [reportes])

  useEffect(() => {
    const { posicion, totalQSOs, estacionesUnicas } = statsRS
    if (posicion === null || totalQSOs === 0) return
    if (posicion === 1 && prevPosicionRSRef.current !== 1 && rankingRS.length > 1) {
      notification.success({
        message: '🏆 ¡Récord del evento!',
        description: `Con ${totalQSOs} QSOs y ${estacionesUnicas} estaciones únicas vía ${platSeleccionada?.nombre ?? 'RS'}, esta sesión es la mejor en la historia del evento. ¡Anúncialo!`,
        duration: 10,
        placement: 'top',
      })
    }
    prevPosicionRSRef.current = posicion
  }, [statsRS, rankingRS.length, platSeleccionada?.nombre])

  const tiposEvento = eventos.map(e => ({
    value: e.tipo,
    label: (
      <Tag style={{ backgroundColor: e.color ?? '#1677ff', borderColor: e.color ?? '#1677ff', color: '#fff', fontWeight: 600, marginRight: 0 }}>
        {e.tipo}
      </Tag>
    ),
  }))
  const estacionOptions = estaciones.filter(e => e.is_active).map(e => ({
    value: e.qrz,
    label: (
      <Tag style={{ backgroundColor: e.color ?? '#1677ff', borderColor: e.color ?? '#1677ff', color: '#fff', fontWeight: 600, marginRight: 0 }}>
        {e.qrz}
      </Tag>
    ),
  }))

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
      title: 'Indicativo', dataIndex: 'indicativo', width: 150,
      render: (v: string, row: FilaRS) => (
        <Space size={0}>
          <IndicativoCell value={v} rowKey={row.key} onCommit={onCommitIndicativo} />
          <Tooltip title="Re-buscar datos del indicativo">
            <Button
              size="small" type="text" icon={<ReloadOutlined />}
              onClick={() => { if (validarIndicativo(row.indicativo)) relookupFila(row.key, row.indicativo) }}
              style={{ color: '#8c8c8c', padding: '0 4px' }}
            />
          </Tooltip>
        </Space>
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
      render: (_: unknown, r: EstadisticaRSRecord) => {
        const orden = metricasActivas.length > 0
          ? metricasActivas.map(m => m.slug)
          : Object.keys(r.valores || {})
        const slugsOrdenados = [
          ...orden.filter(s => s in (r.valores || {})),
          ...Object.keys(r.valores || {}).filter(s => !orden.includes(s)),
        ]
        return (
          <Space wrap size={4}>
            {slugsOrdenados.map(k => {
              const { icon, color } = getMetricaMeta(k)
              return (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginRight: 8 }}>
                  <span style={{ color, fontSize: 13 }}>{icon}</span>
                  <strong style={{ color, fontSize: 13 }}>{Number((r.valores || {})[k]).toLocaleString()}</strong>
                </span>
              )
            })}
          </Space>
        )
      },
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

  // ── Columnas reportes guardados (configurables) ──
  const reporteColDefs: Record<ReporteColKey, object> = {
    indicativo: { title: 'Indicativo', dataIndex: 'indicativo', key: 'indicativo',
      render: (v: string) => <strong style={{ color: '#1A569E' }}>{v}</strong> },
    rst:        { title: 'RST', dataIndex: 'senal', key: 'rst', width: 60 },
    operador:   { title: 'Operador', dataIndex: 'operador', key: 'operador', render: (v: string) => v || '—' },
    zona:       { title: 'Zona', dataIndex: 'zona', key: 'zona', width: 80,
      render: (_: unknown, record: ReporteRS) => {
        const codigo = record.zona?.codigo
        return codigo
          ? <Tag color={zonaColor(codigo)} style={{ color: '#fff', fontWeight: 700 }}>{codigo}</Tag>
          : '—'
      } },
    estado:     { title: 'Estado', dataIndex: 'estado', key: 'estado', render: (v: string) => v || '—' },
    ciudad:     { title: 'Ciudad', dataIndex: 'ciudad', key: 'ciudad', render: (v: string) => v || '—' },
    pais:       { title: 'País', dataIndex: 'pais', key: 'pais', render: (v: string) => v || '—' },
    url:        { title: 'URL', dataIndex: 'url_publicacion', key: 'url',
      render: (v: string) => v
        ? <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>Ver</a>
        : '—' },
    fecha_reporte: { title: 'Fecha Evento', dataIndex: 'fecha_reporte', key: 'fecha_reporte', width: 135,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
    created_at: { title: 'Fecha Captura', dataIndex: 'created_at', key: 'created_at', width: 135,
      render: (v: string) => v
        ? <span style={{ color: '#8c8c8c' }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</span>
        : '—' },
    cap:        { title: 'Cap. por', dataIndex: 'capturado_por_nombre', key: 'cap', width: 90,
      render: (v: string) => v || '—' },
  }

  const reportesColumns = [
    ...colOrder.filter(k => colVisible.includes(k)).map(k => reporteColDefs[k]),
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
                options={plataformas.map(p => ({
                  value: p.id,
                  label: (
                    <Tag style={{ backgroundColor: p.color ?? '#1677ff', borderColor: p.color ?? '#1677ff', color: '#fff', fontWeight: 600, marginRight: 0 }}>
                      {p.nombre}
                    </Tag>
                  ),
                }))}
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
              <Select
                placeholder="Selecciona o escribe el evento..."
                showSearch allowClear optionFilterProp="label"
                style={{ width: '100%' }}
                value={sesionEvento}
                onChange={setSesionEvento}
                labelRender={({ value }) => {
                  const ev = eventos.find(e => e.tipo === value)
                  const c = ev?.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{String(value)}</Tag>
                }}
                options={tiposEvento}
              />
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

      <Card className="card-shadow" style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }} size="small">
        <Space size={6} wrap align="center">
          {sesionEvento ? (
            <Tag color="processing" style={{ fontWeight: 700, fontSize: 13 }}>📡 {sesionEvento}</Tag>
          ) : (
            <Tag color="default" style={{ fontWeight: 600 }}>Sin evento</Tag>
          )}
          {ocurrenciaEvento && (
            <Tag color="purple" style={{ fontWeight: 700 }}>#{ocurrenciaEvento.numero} del año</Tag>
          )}
          <span style={{ fontWeight: 600 }}>con fecha</span>
          <Tag color="blue" style={{ fontWeight: 600 }}>{sesionFecha.format('DD/MM/YYYY')}</Tag>
          <Button size="small" icon={<CalendarOutlined />}
            onClick={() => { setFechaTmp(sesionFecha); setDateModalOpen(true) }}>
            Cambiar
          </Button>
        </Space>
      </Card>

      {platSeleccionada && sesionEvento?.trim() && sesionEstacion ? (
        <>
          {/* ── Métricas ── */}
          <Card className="card-shadow" style={{ marginBottom: 16 }}
            title={`Métricas — ${platSeleccionada.nombre}`}>
            <Form form={metricasForm} layout="inline">
              {metricasActivas.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {metricasActivas.map(m => {
                    const { icon, color } = getMetricaMeta(m.slug)
                    return (
                      <div key={m.id} style={{
                        border: `1.5px solid ${color}`,
                        borderRadius: 8,
                        padding: '6px 10px',
                        minWidth: 100,
                        background: `${color}10`,
                        textAlign: 'center',
                      }}>
                        <div style={{ color, fontSize: 16, marginBottom: 2 }}>{icon}</div>
                        <div style={{ color, fontWeight: 600, fontSize: 11, marginBottom: 4, whiteSpace: 'nowrap' }}>
                          {m.nombre}
                        </div>
                        <Form.Item name={`m_${m.slug}`} initialValue={0} style={{ margin: 0 }}>
                          <InputNumber
                            min={0}
                            size="small"
                            style={{ width: '100%', borderColor: color }}
                          />
                        </Form.Item>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <Text type="warning">Sin métricas activas. Configúralas en Gestión &gt; Redes Sociales.</Text>
              )}
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
                <Button type="primary" icon={<PlusOutlined />} loading={buscando} onClick={buscarYAgregar}
                  onMouseDown={e => e.preventDefault()}>
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

          {/* Anuncio: edición de indicativo */}
          <Alert
            type="info"
            showIcon
            message="Ya puedes editar el indicativo de cualquier registro antes de guardarlo. Al modificarlo se actualizan automáticamente nombre, ciudad, estado y zona."
            style={{ marginBottom: 16 }}
          />

          {/* ── Estadísticas de sesión RS ── */}
          {(statsRS.totalQSOs > 0 || statsRS.posicion !== null) && (
            <Row gutter={[12, 12]} style={{ marginBottom: 12, alignItems: 'stretch' }}>
              <Col xs={12} sm={8} md={6} style={{ display: 'flex' }}>
                <div style={{
                  background: statsRS.esRecordQSOs
                    ? 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)'
                    : 'linear-gradient(135deg, #1A569E 0%, #1677ff 100%)',
                  borderRadius: 10, padding: '14px 18px', color: '#fff',
                  boxShadow: statsRS.esRecordQSOs
                    ? '0 4px 16px rgba(250,173,20,0.55)'
                    : '0 4px 12px rgba(22,119,255,0.3)',
                  transition: 'all 0.4s ease', height: '100%',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    {statsRS.esRecordQSOs ? '🏆 Récord QSOs' : '📡 QSOs guardados'}
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                    {statsRS.totalQSOs}
                  </div>
                  {statsRS.esRecordQSOs && rankingRS.length > 1 && (
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95, fontWeight: 700 }}>
                      ¡Mejor sesión del evento!
                    </div>
                  )}
                </div>
              </Col>
              <Col xs={12} sm={8} md={6} style={{ display: 'flex' }}>
                <div style={{
                  background: statsRS.esRecordEstaciones
                    ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                    : 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
                  borderRadius: 10, padding: '14px 18px', color: '#fff',
                  boxShadow: statsRS.esRecordEstaciones
                    ? '0 4px 16px rgba(82,196,26,0.45)'
                    : '0 4px 12px rgba(19,194,194,0.3)',
                  transition: 'all 0.4s ease', height: '100%',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                    {statsRS.esRecordEstaciones ? '🏆 Récord Estaciones' : '👥 Estaciones únicas'}
                  </div>
                  <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                    {statsRS.estacionesUnicas}
                  </div>
                  {statsRS.esRecordEstaciones && rankingRS.length > 1 && (
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95, fontWeight: 700 }}>
                      ¡Más estaciones del evento!
                    </div>
                  )}
                </div>
              </Col>
              {statsRS.posicion !== null && (
                <Col xs={12} sm={8} md={6} style={{ display: 'flex' }}>
                  <div style={{
                    background: statsRS.posicion === 1
                      ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)'
                      : statsRS.posicion <= 3
                        ? 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)'
                        : 'linear-gradient(135deg, #595959 0%, #434343 100%)',
                    borderRadius: 10, padding: '14px 18px', color: '#fff',
                    boxShadow: statsRS.posicion === 1
                      ? '0 4px 16px rgba(250,173,20,0.55)'
                      : '0 4px 12px rgba(0,0,0,0.2)',
                    transition: 'all 0.4s ease', height: '100%',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                      📊 Posición del evento
                    </div>
                    <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                      {statsRS.posicion === 1 ? '🥇' : statsRS.posicion === 2 ? '🥈' : statsRS.posicion === 3 ? '🥉' : `#${statsRS.posicion}`}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>
                      {rankingRS.length === 1
                        ? 'Primera sesión del evento'
                        : statsRS.posicion === 1
                          ? `de ${statsRS.totalSesiones} sesiones — ¡la mejor!`
                          : `de ${statsRS.totalSesiones} sesiones`}
                    </div>
                  </div>
                </Col>
              )}
              {/* Tarjeta 4: récord personal del operador en este evento */}
              {miRankingRS.length > 0 && (() => {
                const hoy = miRankingRS.find(r => r.fecha === fechaActualRS)
                if (!hoy || hoy.total === 0) return null
                const esPrimero = hoy.posicion === 1
                const esTop3 = hoy.posicion <= 3
                return (
                  <Col xs={12} sm={8} md={6} style={{ display: 'flex' }}>
                    <div style={{
                      background: esPrimero
                        ? 'linear-gradient(135deg, #ff7a45 0%, #d4380d 100%)'
                        : esTop3
                          ? 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)'
                          : 'linear-gradient(135deg, #531dab 0%, #391085 100%)',
                      borderRadius: 10, padding: '14px 18px', color: '#fff',
                      boxShadow: esPrimero
                        ? '0 4px 16px rgba(212,56,13,0.45)'
                        : '0 4px 12px rgba(83,29,171,0.3)',
                      transition: 'all 0.4s ease', height: '100%',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                        🏅 Mi récord personal
                      </div>
                      <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                        {hoy.posicion === 1 ? '🥇' : hoy.posicion === 2 ? '🥈' : hoy.posicion === 3 ? '🥉' : `#${hoy.posicion}`}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>
                        {`de ${miRankingRS.length} ses. · ${hoy.total} QSOs hoy`}
                      </div>
                    </div>
                  </Col>
                )
              })()}
              {/* Tarjeta 5: ranking de operadores en esta fecha+evento */}
              {rankingOpSesionRS.length > 0 && (() => {
                const miNombre = user?.indicativo || user?.full_name
                const miOp = miNombre ? rankingOpSesionRS.find(r => r.nombre === miNombre) : undefined
                const totalOps = rankingOpSesionRS.length + (miOp ? 0 : 1)
                const posicion = miOp?.posicion ?? totalOps
                const total = miOp?.total ?? 0
                const esPrimero = posicion === 1
                const esTop3 = posicion <= 3
                return (
                  <Col xs={12} sm={8} md={6} style={{ display: 'flex' }}>
                    <div style={{
                      background: esPrimero
                        ? 'linear-gradient(135deg, #096dd9 0%, #0050b3 100%)'
                        : esTop3
                          ? 'linear-gradient(135deg, #13c2c2 0%, #006d75 100%)'
                          : 'linear-gradient(135deg, #434343 0%, #262626 100%)',
                      borderRadius: 10, padding: '14px 18px', color: '#fff',
                      boxShadow: esPrimero
                        ? '0 4px 16px rgba(9,109,217,0.45)'
                        : '0 4px 12px rgba(0,0,0,0.25)',
                      transition: 'all 0.4s ease', height: '100%',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                        👥 Ops en esta fecha
                      </div>
                      <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                        {posicion === 1 ? '🥇' : posicion === 2 ? '🥈' : posicion === 3 ? '🥉' : `#${posicion}`}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>
                        {`de ${totalOps} ops · ${total} QSOs hoy`}
                      </div>
                    </div>
                  </Col>
                )
              })()}
              {/* Tarjeta 6: ranking histórico de operadores del evento */}
              {rankingOpHistoricoRS.length > 0 && (() => {
                const miOp = rankingOpHistoricoRS.find(r => r.usuario_id === user?.id)
                if (!miOp) return null
                const esPrimero = miOp.posicion === 1
                const esTop3 = miOp.posicion <= 3
                return (
                  <Col xs={12} sm={8} md={6} style={{ display: 'flex' }}>
                    <div style={{
                      background: esPrimero
                        ? 'linear-gradient(135deg, #389e0d 0%, #237804 100%)'
                        : esTop3
                          ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                          : 'linear-gradient(135deg, #595959 0%, #3d3d3d 100%)',
                      borderRadius: 10, padding: '14px 18px', color: '#fff',
                      boxShadow: esPrimero
                        ? '0 4px 16px rgba(56,158,13,0.45)'
                        : '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'all 0.4s ease', height: '100%',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                        📈 Ranking histórico ops
                      </div>
                      <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1 }}>
                        {miOp.posicion === 1 ? '🥇' : miOp.posicion === 2 ? '🥈' : miOp.posicion === 3 ? '🥉' : `#${miOp.posicion}`}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85, fontWeight: 600 }}>
                        {`de ${rankingOpHistoricoRS.length} ops · ${miOp.total} QSOs totales`}
                      </div>
                    </div>
                  </Col>
                )
              })()}
            </Row>
          )}

          {/* ── Reportes guardados hoy ── */}
          <Card className="card-shadow"
            title={
              <Space size={6} wrap>
                <span style={{ fontWeight: 700 }}>Reportes guardados —</span>
                <Tag color="processing" style={{ fontWeight: 700, fontSize: 13 }}>📡 {sesionEvento}</Tag>
                {ocurrenciaEvento && (
                  <Tag color="purple" style={{ fontWeight: 700 }}>#{ocurrenciaEvento.numero} del año</Tag>
                )}
                <span style={{ fontWeight: 600 }}>con fecha</span>
                <Tag color="blue" style={{ fontWeight: 600 }}>{sesionFecha.format('DD/MM/YYYY')}</Tag>
                <Tag style={{ fontWeight: 600 }}>{platSeleccionada.nombre}</Tag>
                <Badge count={totalReportes} color="#1A569E" />
              </Space>
            }
            extra={colSettingsButton}>
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
          <Text type="secondary">Selecciona Plataforma, Evento y Estación para comenzar la sesión.</Text>
        </Card>
      )}

      {/* ── Modal sobreescritura de métricas ── */}
      <Modal
        title={<><WarningOutlined style={{ color: '#fa8c16', marginRight: 8 }} />Métricas ya registradas</>}
        open={overwriteModal}
        onOk={handleConfirmOverwrite}
        onCancel={() => { setOverwriteModal(false); setPendingMetricasPayload(null) }}
        okText="Sí, sobreescribir"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
      >
        <p>
          Ya existe un registro de métricas para <strong>{platSeleccionada?.nombre}</strong> en la fecha{' '}
          <strong>{sesionFecha.format('DD/MM/YYYY')}</strong>.
        </p>
        <p>¿Deseas sobreescribir los valores existentes con los nuevos?</p>
      </Modal>

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
            onChange={v => {
              if (!v) return
              setFechaTmp(v)
              if (sesionEvento) verificarDiaEvento(v, sesionEvento)
            }}
            style={{ width: '100%' }} allowClear={false} />
        </div>
      </Modal>

      {/* ── Modal editar métricas ── */}
      <Modal title="Editar métricas" open={editMetricaModal} onOk={handleSaveEditMetrica}
        onCancel={() => setEditMetricaModal(false)} okText="Guardar" width={600}>
        <Form form={editMetricaForm} layout="vertical">
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
            <Col span={4}><Form.Item label="Zona" name="zona_id">
              <Select allowClear placeholder="Zona"
                options={zonas.filter(z => z.is_active).map(z => {
                  const c = z.color ?? '#1677ff'
                  return { value: z.id, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{z.codigo}</Tag> }
                })} />
            </Form.Item></Col>
            <Col span={4}><Form.Item label="País" name="pais"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item label="URL publicación" name="url_publicacion"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item label="Observaciones" name="observaciones">
              <Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Modal: Fecha no permitida para evento recurrente ── */}
      {diaEventoModal && (
        <Modal
          open
          footer={null}
          onCancel={() => setDiaEventoModal(null)}
          width={460}
          styles={{ body: { padding: 0 }, content: { overflow: 'hidden', borderRadius: 12, padding: 0 } }}
          closable={false}
          centered
        >
          <div style={{
            background: 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 55%, #ff7a45 100%)',
            borderRadius: '12px 12px 0 0',
            padding: '28px 28px 20px',
            textAlign: 'center',
            color: '#fff',
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              fontSize: 36,
              border: '3px solid rgba(255,255,255,0.4)',
            }}>
              📅
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
              Fecha no permitida
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.22)', borderRadius: 20,
              padding: '4px 18px', display: 'inline-block',
              fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
            }}>
              {diaEventoModal.tipoEvento}
            </div>
          </div>

          <div style={{
            background: '#fff2e8', borderBottom: '1px solid #ffbb96',
            padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 26 }}>🗓️</span>
            <div>
              <div style={{ fontSize: 11, color: '#874d00', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Fecha intentada
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d4380d', marginTop: 2 }}>
                {NOMBRES_DIA[diaEventoModal.fecha.day()]} — {diaEventoModal.fecha.format('DD/MM/YYYY')}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 22px 14px' }}>
            <div style={{ fontSize: 11, color: '#595959', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Días configurados para este evento
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NOMBRES_DIA.map((nombre, idx) => {
                const esConfig = diaEventoModal.diasConfig.includes(idx)
                const esIntentado = idx === diaEventoModal.fecha.day()
                return (
                  <div key={idx} style={{
                    padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: esIntentado && !esConfig ? '#ff4d4f' : esConfig ? '#52c41a' : '#f5f5f5',
                    color: esIntentado && !esConfig ? '#fff' : esConfig ? '#fff' : '#bfbfbf',
                    border: `2px solid ${esIntentado && !esConfig ? '#cf1322' : esConfig ? '#389e0d' : '#e0e0e0'}`,
                  }}>
                    {esConfig && '✓ '}{esIntentado && !esConfig && '✗ '}{nombre.slice(0, 3)}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{
            background: '#fffbe6', borderTop: '1px solid #ffe58f',
            padding: '12px 22px', display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1.6 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#614700', lineHeight: 1.6 }}>
              Cambia la fecha seleccionada para que coincida con un día configurado en este evento,
              o para habilitar capturas en{' '}
              <strong>{NOMBRES_DIA[diaEventoModal.fecha.day()]}</strong>,
              contacta a un administrador para agregar este día al evento.
            </span>
          </div>

          <div style={{ padding: '14px 22px 18px', display: 'flex', justifyContent: 'center' }}>
            <Button
              type="primary" danger size="large"
              onClick={() => setDiaEventoModal(null)}
              style={{ minWidth: 140, fontWeight: 700, borderRadius: 8 }}
            >
              Entendido
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
