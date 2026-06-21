import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Card, Form, Select, AutoComplete, DatePicker, Button, Table,
  Typography, Space, Divider, Input, message, Tooltip, notification,
  Row, Col, Badge, Popconfirm, Checkbox, Modal, Alert, Spin, Collapse, Tag, Switch,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import {
  SaveOutlined, DeleteOutlined, PlusOutlined,
  CheckCircleOutlined, WarningOutlined,
  SettingOutlined, CalendarOutlined, BellOutlined,
  EditOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { reportesApi } from '@/api/reportes'
import { estadisticasApi } from '@/api/estadisticas'
import { catalogosApi } from '@/api/catalogos'
import { operadoresApi, type Operador } from '@/api/operadores'
import { libretaApi, type CheckIndicativoResult } from '@/api/libreta'
import { configuracionApi, type NodeConfig } from '@/api/configuracion'
import client from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useColPrefs } from '@/components/common/ColSettings'
import type { Evento, Sistema, Estacion, Estado, Zona, Reporte } from '@/types'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import SystemStatusWidget from '@/components/common/SystemStatusWidget'
import { io as socketIo } from 'socket.io-client'

const { Title, Text } = Typography
const { Panel } = Collapse

function StatusPill({ label, color, pulse }: { label: string; color: string; pulse?: boolean }) {
  return (
    <span style={{
      background: color, color: '#fff', fontWeight: 700, fontSize: 10,
      padding: '2px 8px', borderRadius: 10, letterSpacing: 0.4, whiteSpace: 'nowrap',
      animation: pulse ? 'pulse-red 0.8s ease-in-out infinite' : undefined,
    }}>● {label}</span>
  )
}

// ─── Validación de indicativo (ITU) ──────────────────────────────────────────
// Formato: prefijo (1-3 alfanuméricos, al menos una letra) + 1 dígito + sufijo (1-3 letras)
// Ej válidos: XE2MBE, W1AW, EA8EE, XF2MC, K0RCA, JA1ABC
// Ej inválidos: XE2EEEE (sufijo 4 letras), 123ABC (sin letra en prefijo), XE (sin dígito+sufijo)
// SWL válidos: SWL, SWL001, SWL-XE2-001, SWL/XE2MBE, XE2-SWL-1234
const INDICATIVO_RE = /^[A-Z0-9]{1,3}[0-9][A-Z]{1,3}$/
function validarIndicativo(ind: string): boolean {
  const cs = ind.trim().toUpperCase()
  return cs === 'SWL' || INDICATIVO_RE.test(cs)
}
function esSWL(ind: string): boolean {
  return ind.trim().toUpperCase() === 'SWL'
}

// ─── Validación RST ──────────────────────────────────────────────────────────
function validarRST(val: string): boolean {
  const v = (val || '').trim()
  if (v.length === 2) return parseInt(v[0]) >= 1 && parseInt(v[0]) <= 5 && parseInt(v[1]) >= 1 && parseInt(v[1]) <= 9
  if (v.length === 3) return parseInt(v[0]) >= 1 && parseInt(v[0]) <= 5 && parseInt(v[1]) >= 1 && parseInt(v[1]) <= 9 && parseInt(v[2]) >= 1 && parseInt(v[2]) <= 9
  return false
}
const normalizarRST = (val: string) => val.replace(/[^0-9]/g, '').slice(0, 3)

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

// ── Celda editable de indicativo (estado local — no re-renderiza al padre durante tipeo) ──
function IndicativoCell({ value, rowKey, onCommit }: {
  value: string
  rowKey: string
  onCommit: (key: string, nuevo: string, anterior: string) => void
}) {
  const [local, setLocal] = useState(value)
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

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface FilaLibreta {
  key: string
  indicativo: string
  nombre_completo: string
  municipio: string
  estado: string
  zona: string
  pais: string
  rst: string
  sistema: string
  status: 'ok' | 'notfound'
  ultimaAparicion?: string | null
}

// ─── Resumen table column config ─────────────────────────────────────────────

const RESUMEN_COL_KEYS = [
  'indicativo', 'operador', 'ciudad', 'estado', 'zona',
  'sistema', 'senal', 'capturado_por_nombre', 'created_at',
] as const
type ResumenColKey = typeof RESUMEN_COL_KEYS[number]

const RESUMEN_COL_LABELS: Record<ResumenColKey, string> = {
  indicativo: 'Indicativo',
  operador: 'Operador',
  ciudad: 'Ciudad',
  estado: 'Estado',
  zona: 'Zona',
  sistema: 'Sistema',
  senal: 'RST',
  capturado_por_nombre: 'Capturado por',
  created_at: 'Hora',
}

const RESUMEN_LOCKED: ResumenColKey[] = ['indicativo']

// ─── Component ───────────────────────────────────────────────────────────────

export default function LibretaPage() {
  const { user } = useAuthStore()
  const [sesionForm] = Form.useForm()
  const [nuevoHamForm] = Form.useForm()

  const { colOrder: resColOrder, colVisible: resColVisible, colSettingsButton: resColSettingsBtn } =
    useColPrefs('libreta_resumen', user?.id, RESUMEN_COL_KEYS, RESUMEN_LOCKED, RESUMEN_COL_LABELS)

  const [filas, setFilas] = useState<FilaLibreta[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [sistemas, setSistemas] = useState<Sistema[]>([])
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [paises, setPaises] = useState<string[]>([])

  // Color por zona, calculado desde la BD
  const zonaColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    zonas.forEach(z => { m[z.codigo] = z.color || '#999' })
    return m
  }, [zonas])

  const zonaColor = (codigo: string) => zonaColorMap[codigo] || '#999'

  // Zona "Extranjero" del catálogo
  const zonaExtranjero = useMemo(
    () => zonas.find(z => z.codigo.toLowerCase().includes('ext') || z.nombre.toLowerCase().includes('extranj'))?.codigo || 'Extranjero',
    [zonas]
  )

  const [sesionActiva, setSesionActiva] = useState(false)
  const [considerarSwl, setConsiderarSwl] = useState(false)
  const [configVisible, setConfigVisible] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  const [anunciarPrimeraVez, setAnunciarPrimeraVez] = useState(false)
  const [anunciarReaparicion, setAnunciarReaparicion] = useState(false)
  const [zonaSwlDefault, setZonaSwlDefault] = useState<string | undefined>()

  const [nodeConfigForm] = Form.useForm()
  const [savingNodeConfig, setSavingNodeConfig] = useState(false)

  const [roipMonitorando, setRoipMonitorando] = useState(false)
  const [roipAvanzado, setRoipAvanzado] = useState(false)
  const [aslStatus, setAslStatus] = useState<{ online: boolean; cos_keyed: boolean; tx_keyed: boolean; on_air: boolean; connections: number; nodes: { node: string; name: string; url?: string; link?: string; cos_keyed: boolean; tx_keyed: boolean }[] } | null>(null)
  const [irlpStatus, setIrlpStatus] = useState<{ online: boolean; on_air: boolean; cos: boolean; ptt: boolean; connections: number; nodes: { node: string; name: string; url?: string; warning: boolean }[] } | null>(null)
  const [nodeCfg, setNodeCfg] = useState({ asl_hub_id: '', asl_boletin_node: '', irlp_reflector_id: '', irlp_boletin_node: '', bm_tgs: '33450,334' })
  const [dmrStatus, setDmrStatus] = useState<{ connected: boolean; active: boolean; callsign: string; tg: number; tgName: string }>({ connected: false, active: false, callsign: '', tg: 0, tgName: '' })
  const dmrSocketRef = useRef<any>(null)

  const [inputRst, setInputRst] = useState('59')
  const [inputSistema, setInputSistema] = useState<string | undefined>()
  const [inputIndicativo, setInputIndicativo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<any>(null)

  const [sesionConfig, setSesionConfig] = useState<{
    tipo_evento: string; estacion?: string
    sistema_default?: string; rst_default: string; fecha: string
    estado_default?: string; ciudad_default?: string; zona_swl_default?: string
  } | null>(null)

  // Ranking del evento y estadísticas de sesión
  type RankingEntry = { fecha: string; total_reportes: number; total_estaciones: number; posicion: number }
  type MiRankingEntry = { fecha: string; total: number; posicion: number }
  type RankingOpEntry = { usuario_id: number; nombre: string; total: number; posicion: number }
  const [rankingEvento, setRankingEvento] = useState<RankingEntry[]>([])
  const [miRankingPersonal, setMiRankingPersonal] = useState<MiRankingEntry[]>([])
  const [rankingOpHistorico, setRankingOpHistorico] = useState<RankingOpEntry[]>([])
  const prevPosicionRef = useRef<number | null>(null)

  // Tabla resumen de reportes guardados
  const [resumen, setResumen] = useState<Reporte[]>([])
  const [loadingResumen, setLoadingResumen] = useState(false)
  const resumenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [dateModalOpen, setDateModalOpen] = useState(true)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<dayjs.Dayjs>(dayjs())
  const [warnModalOpen, setWarnModalOpen] = useState(false)

  // Modal primera vez
  const [primeraVezModal, setPrimeraVezModal] = useState(false)
  const [primeraVezIndicativo, setPrimeraVezIndicativo] = useState('')
  const [guardandoHam, setGuardandoHam] = useState(false)
  const pendienteRef = useRef<{ indicativo: string; op: Operador | null; pais: string; zona: string; zonaEsNacional: boolean; ultimaAparicion: string | null } | null>(null)
  const registrarHamBtnRef = useRef<HTMLButtonElement>(null)
  const continuarCapturaBtnRef = useRef<HTMLButtonElement>(null)

  // Modal reaparición
  const [reaparicionModal, setReaparicionModal] = useState(false)
  const [reaparicionInfo, setReaparicionInfo] = useState<CheckIndicativoResult | null>(null)
  const [reaparicionIndicativo, setReaparicionIndicativo] = useState('')

  // Tabla resumen — selección y acciones
  const [resumenSelectedKeys, setResumenSelectedKeys] = useState<number[]>([])
  const [deletingResumen, setDeletingResumen] = useState(false)

  // Modal editar reporte (resumen)
  const [editReporteModal, setEditReporteModal] = useState(false)
  const [editReporteRecord, setEditReporteRecord] = useState<Reporte | null>(null)
  const [editReporteForm] = Form.useForm()
  const [savingReporte, setSavingReporte] = useState(false)

  // Modal día no permitido
  const [diaEventoModal, setDiaEventoModal] = useState<{ fecha: dayjs.Dayjs; tipoEvento: string; diasConfig: number[] } | null>(null)

  // Modal editar operador (click en indicativo)
  const [editOpModal, setEditOpModal] = useState(false)
  const [editOpIndicativo, setEditOpIndicativo] = useState('')
  const [editOpForm] = Form.useForm()
  const [savingOp, setSavingOp] = useState(false)
  const [loadingOp, setLoadingOp] = useState(false)

  // Número de ocurrencia del día en el año (ej. 20 → "Domingo #20 del año")
  const ocurrenciaEvento = useMemo<{ numero: number; dia: number } | null>(() => {
    if (!sesionConfig) return null
    const evento = eventos.find(e => e.tipo === sesionConfig.tipo_evento)
    if (!evento?.recurrente || !evento.dias_semana?.length) return null
    const fecha = dayjs(sesionConfig.fecha)
    const dia = fecha.day()
    if (!evento.dias_semana.includes(dia)) return null
    const inicioAnio = fecha.startOf('year')
    const diasHastaFecha = fecha.diff(inicioAnio, 'day')
    const diasHastaPrimero = (dia - inicioAnio.day() + 7) % 7
    const numero = Math.floor((diasHastaFecha - diasHastaPrimero) / 7) + 1
    return { numero, dia }
  }, [sesionConfig, eventos])

  // ── Validación día de evento recurrente ──────────────────────────────────
  const verificarDiaEvento = useCallback((fecha: dayjs.Dayjs, tipoEvento: string): boolean => {
    const evento = eventos.find(e => e.tipo === tipoEvento)
    if (!evento?.recurrente || !evento.dias_semana?.length) return true
    if (evento.dias_semana.includes(fecha.day())) return true
    setDiaEventoModal({ fecha, tipoEvento, diasConfig: evento.dias_semana })
    return false
  }, [eventos])

  // ── Cargar catálogos + config ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      catalogosApi.eventos().then(r => setEventos(r.data)),
      catalogosApi.sistemas().then(r => setSistemas(r.data)),
      catalogosApi.estaciones().then(r => setEstaciones(r.data)),
      catalogosApi.estados().then(r => setEstados(r.data)),
      catalogosApi.zonas().then(r => setZonas(r.data)),
      catalogosApi.listPaises().then(r => setPaises(r.data)),
    ]).then(() => {
      libretaApi.getConfig().then(({ data: cfg }) => {
        if (cfg) {
          sesionForm.setFieldsValue({
            tipo_evento: cfg.tipo_evento ?? undefined,
            estacion: cfg.estacion ?? undefined,
            sistema_default: cfg.sistema_default ?? undefined,
            estado_default: cfg.estado_default ?? undefined,
            ciudad_default: cfg.ciudad_default ?? undefined,
          })
          if (cfg.considerar_swl) setConsiderarSwl(true)
          if (cfg.sistema_default) setInputSistema(cfg.sistema_default)
          if (cfg.rst_default) setInputRst(cfg.rst_default)
          if (cfg.anunciar_primera_vez) setAnunciarPrimeraVez(true)
          if (cfg.anunciar_reaparicion) setAnunciarReaparicion(true)
          if (cfg.zona_swl_default) setZonaSwlDefault(cfg.zona_swl_default)
          setNodeCfg({
            asl_hub_id: cfg.asl_hub_id ?? '',
            asl_boletin_node: cfg.asl_boletin_node ?? '',
            irlp_reflector_id: cfg.irlp_reflector_id ?? '',
            irlp_boletin_node: cfg.irlp_boletin_node ?? '',
            bm_tgs: cfg.bm_tgs ?? '33450,334',
          })
          if (cfg.roip_monitorando) setRoipMonitorando(true)
          if (cfg.roip_avanzado) setRoipAvanzado(true)
          nodeConfigForm.setFieldsValue({
            asl_hub_id: cfg.asl_hub_id,
            asl_host: cfg.asl_host,
            asl_port: cfg.asl_port,
            asl_boletin_node: cfg.asl_boletin_node,
            irlp_reflector_id: cfg.irlp_reflector_id,
            irlp_ref_url: cfg.irlp_ref_url,
            irlp_user: cfg.irlp_user,
            irlp_password: cfg.irlp_password,
            irlp_boletin_node: cfg.irlp_boletin_node,
            irlp_host: cfg.irlp_host,
            irlp_port: cfg.irlp_port,
          })
        }
      }).finally(() => setLoadingConfig(false))
    })
  }, [])

  // ── Polling monitoreo RoIP ────────────────────────────────────────────────
  useEffect(() => {
    if (!roipMonitorando) { setAslStatus(null); setIrlpStatus(null); return }
    const poll = () => {
      client.get('/public/node-status').then(r => setAslStatus(r.data)).catch(() => setAslStatus(null))
      client.get('/public/irlp-status').then(r => setIrlpStatus(r.data)).catch(() => setIrlpStatus(null))
    }
    poll()
    const t = setInterval(poll, 5_000)
    return () => clearInterval(t)
  }, [roipMonitorando])

  // ── Socket.IO DMR / Brandmeister ─────────────────────────────────────────
  useEffect(() => {
    if (!roipMonitorando) {
      dmrSocketRef.current?.disconnect()
      dmrSocketRef.current = null
      setDmrStatus({ connected: false, active: false, callsign: '', tg: 0, tgName: '' })
      return
    }
    const socket = socketIo('https://api.brandmeister.network', {
      path: '/lh/socket.io',
      transports: ['websocket'],
      reconnectionDelay: 5000,
    })
    socket.on('connect', () => {
      setDmrStatus(d => ({ ...d, connected: true }))
      const tgs = (nodeCfg.bm_tgs || '33450,334').split(',').map((s: string) => s.trim()).filter(Boolean)
      tgs.forEach((tg: string) => socket.emit('subscribe', `dst_${tg}`))
    })
    socket.on('disconnect', () => setDmrStatus(d => ({ ...d, connected: false, active: false })))
    socket.on('mqtt', (p: { DestinationID: number; DestinationName: string; SourceCall: string; Stop: number }) => {
      if (p.Stop === 0) {
        setDmrStatus(d => ({ ...d, active: true, callsign: p.SourceCall, tg: p.DestinationID, tgName: p.DestinationName }))
      } else {
        setDmrStatus(d => ({ ...d, active: false }))
      }
    })
    dmrSocketRef.current = socket
    return () => { socket.disconnect() }
  }, [roipMonitorando, nodeCfg.bm_tgs])

  // ── Resumen de reportes guardados ────────────────────────────────────────
  const fetchResumen = useCallback(async (cfg: typeof sesionConfig) => {
    if (!cfg) return
    setLoadingResumen(true)
    try {
      const fecha = dayjs(cfg.fecha)
      const eventoId = eventos.find(e => e.tipo === cfg.tipo_evento)?.id
      const [reportesRes, rankingRes, miRankingRes, rankingOpRes] = await Promise.all([
        reportesApi.list({
          fecha_inicio: fecha.startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
          fecha_fin: fecha.endOf('day').format('YYYY-MM-DDTHH:mm:ss'),
          evento_id: eventoId,
          page_size: 200,
        }),
        eventoId ? estadisticasApi.rankingEvento(eventoId) : Promise.resolve({ data: [] as any }),
        eventoId ? estadisticasApi.miRankingEvento(eventoId) : Promise.resolve({ data: [] as any }),
        eventoId ? estadisticasApi.rankingOperadores(eventoId) : Promise.resolve({ data: [] as any }),
      ])
      setResumen(reportesRes.data.items)
      setRankingEvento(rankingRes.data)
      setMiRankingPersonal(miRankingRes.data)
      setRankingOpHistorico(rankingOpRes.data)
    } catch { /* silencioso */ } finally {
      setLoadingResumen(false)
    }
  }, [eventos])

  // Arrancar/detener polling cada 30s cuando la sesión está activa
  useEffect(() => {
    if (sesionConfig) {
      fetchResumen(sesionConfig)
      resumenIntervalRef.current = setInterval(() => fetchResumen(sesionConfig), 30_000)
    } else {
      setResumen([])
      if (resumenIntervalRef.current) clearInterval(resumenIntervalRef.current)
    }
    return () => { if (resumenIntervalRef.current) clearInterval(resumenIntervalRef.current) }
  }, [sesionConfig, fetchResumen])

  // ── Estadísticas de sesión y ranking ────────────────────────────────────
  const fechaActual = sesionConfig ? dayjs(sesionConfig.fecha).format('YYYY-MM-DD') : null

  const statsActuales = useMemo(() => {
    const totalQSOs = resumen.length
    const estacionesUnicas = new Set(resumen.map(r => r.indicativo)).size
    if (rankingEvento.length === 0) return { totalQSOs, estacionesUnicas, posicion: null as number | null, totalSesiones: 0, esRecordQSOs: false, esRecordEstaciones: false }
    const hoy = rankingEvento.find(r => r.fecha === fechaActual)
    const posicion = hoy?.posicion ?? null
    const totalSesiones = rankingEvento.length
    const maxEstaciones = Math.max(...rankingEvento.map(r => r.total_estaciones))
    const esRecordQSOs = posicion === 1
    const esRecordEstaciones = estacionesUnicas > 0 && (hoy?.total_estaciones ?? 0) >= maxEstaciones
    return { totalQSOs, estacionesUnicas, posicion, totalSesiones, esRecordQSOs, esRecordEstaciones }
  }, [resumen, rankingEvento, fechaActual])

  // Ranking de operadores de la misma fecha+evento (client-side)
  const rankingOpSesion = useMemo(() => {
    const counts: Record<number, { usuario_id: number; nombre: string; total: number }> = {}
    for (const r of resumen) {
      if (!r.capturado_por) continue
      if (!counts[r.capturado_por])
        counts[r.capturado_por] = { usuario_id: r.capturado_por, nombre: r.capturado_por_nombre || `Op#${r.capturado_por}`, total: 0 }
      counts[r.capturado_por].total++
    }
    return Object.values(counts)
      .sort((a, b) => b.total - a.total)
      .map((e, i) => ({ ...e, posicion: i + 1 }))
  }, [resumen])

  useEffect(() => {
    const { posicion, totalQSOs, estacionesUnicas } = statsActuales
    if (posicion === null || totalQSOs === 0) return
    if (posicion === 1 && prevPosicionRef.current !== 1 && rankingEvento.length > 1) {
      notification.success({
        message: '🏆 ¡Récord del evento!',
        description: `Con ${totalQSOs} QSOs y ${estacionesUnicas} estaciones únicas, esta sesión es la mejor en la historia del evento. ¡Anúncialo en el aire!`,
        duration: 10,
        placement: 'top',
      })
    }
    prevPosicionRef.current = posicion
  }, [statsActuales, rankingEvento.length])

  // ── Acciones tabla resumen ───────────────────────────────────────────────
  const handleDeleteResumenSelected = async () => {
    setDeletingResumen(true)
    try {
      await Promise.all(resumenSelectedKeys.map(id => reportesApi.delete(id)))
      message.success(`${resumenSelectedKeys.length} reporte(s) eliminados`)
      setResumenSelectedKeys([])
      if (sesionConfig) fetchResumen(sesionConfig)
    } catch {
      message.error('Error al eliminar reportes')
    } finally { setDeletingResumen(false) }
  }

  const handleDeleteResumenOne = async (id: number) => {
    try {
      await reportesApi.delete(id)
      message.success('Reporte eliminado')
      if (sesionConfig) fetchResumen(sesionConfig)
    } catch { message.error('Error al eliminar') }
  }

  const handleEditReporte = (record: Reporte) => {
    setEditReporteRecord(record)
    editReporteForm.setFieldsValue({
      indicativo: record.indicativo,
      operador: record.operador,
      ciudad: record.ciudad,
      estado: record.estado,
      zona_id: record.zona_id,
      sistema_id: record.sistema_id,
      senal: record.senal,
      observaciones: record.observaciones,
    })
    setEditReporteModal(true)
  }

  const handleSaveReporte = async () => {
    if (!editReporteRecord) return
    setSavingReporte(true)
    try {
      await reportesApi.update(editReporteRecord.id, editReporteForm.getFieldsValue())
      message.success('Reporte actualizado')
      setEditReporteModal(false)
      if (sesionConfig) fetchResumen(sesionConfig)
    } catch { message.error('Error al guardar') }
    finally { setSavingReporte(false) }
  }

  const handleOpenEditOp = async (indicativo: string) => {
    setEditOpIndicativo(indicativo)
    setEditOpModal(true)
    setLoadingOp(true)
    try {
      const { data: op } = await operadoresApi.buscar(indicativo)
      editOpForm.setFieldsValue({
        indicativo: op.indicativo,
        nombre_completo: op.nombre_completo || '',
        municipio: op.municipio || '',
        estado: op.estado || '',
        pais: op.pais || 'México',
        tipo_licencia: op.tipo_licencia || '',
        tipo_ham: op.tipo_ham || '',
        activo: op.activo ?? true,
      })
    } catch {
      editOpForm.setFieldsValue({ indicativo, nombre_completo: '', municipio: '', estado: '', pais: 'México', tipo_licencia: '', tipo_ham: '', activo: true })
    } finally { setLoadingOp(false) }
  }

  const handleSaveOp = async () => {
    setSavingOp(true)
    try {
      await operadoresApi.update(editOpIndicativo, editOpForm.getFieldsValue())
      message.success(`${editOpIndicativo} actualizado`)
      setEditOpModal(false)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar operador')
    } finally { setSavingOp(false) }
  }

  // Refrescar después de guardar
  const guardarTodoYRefrescar = async () => {
    await guardarTodo()
    if (sesionConfig) setTimeout(() => fetchResumen(sesionConfig), 500)
  }

  // ── Modal fecha ───────────────────────────────────────────────────────────
  const handleDateConfirm = () => {
    if (!fechaSeleccionada) { message.warning('Selecciona una fecha'); return }
    sesionForm.setFieldValue('fecha_hora', fechaSeleccionada)
    if (!fechaSeleccionada.startOf('day').isSame(dayjs().startOf('day'))) {
      setDateModalOpen(false); setWarnModalOpen(true)
    } else {
      setDateModalOpen(false)
    }
  }

  const activarSesion = async (vals: any, fechaISO: string) => {
    try {
      await libretaApi.saveConfig({
        tipo_evento: vals.tipo_evento ?? null,
        estacion: vals.estacion ?? null,
        sistema_default: vals.sistema_default ?? null,
        considerar_swl: considerarSwl,
        estado_default: vals.estado_default ?? null,
        ciudad_default: vals.ciudad_default ?? null,
        rst_default: inputRst || '59',
        anunciar_primera_vez: anunciarPrimeraVez,
        anunciar_reaparicion: anunciarReaparicion,
        zona_swl_default: zonaSwlDefault ?? null,
      })
    } catch { /* non-critical */ }
    if (vals.sistema_default) setInputSistema(vals.sistema_default)
    setSesionConfig({
      tipo_evento: vals.tipo_evento,
      estacion: vals.estacion,
      sistema_default: vals.sistema_default,
      rst_default: inputRst || '59',
      fecha: fechaISO,
      estado_default: vals.estado_default || undefined,
      ciudad_default: vals.ciudad_default || undefined,
      zona_swl_default: zonaSwlDefault || undefined,
    })
    setSesionActiva(true); setConfigVisible(false); setFilas([])
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const guardarNodeConfig = async () => {
    setSavingNodeConfig(true)
    try {
      const vals = nodeConfigForm.getFieldsValue()
      await libretaApi.saveConfig({
        asl_hub_id: vals.asl_hub_id,
        asl_host: vals.asl_host,
        asl_port: vals.asl_port,
        asl_boletin_node: vals.asl_boletin_node,
        irlp_reflector_id: vals.irlp_reflector_id,
        irlp_ref_url: vals.irlp_ref_url,
        irlp_user: vals.irlp_user,
        irlp_password: vals.irlp_password,
        irlp_boletin_node: vals.irlp_boletin_node,
        irlp_host: vals.irlp_host,
        irlp_port: vals.irlp_port,
        bm_tgs: nodeCfg.bm_tgs,
      })
      setNodeCfg(prev => ({
        ...prev,
        asl_hub_id: vals.asl_hub_id ?? '',
        asl_boletin_node: vals.asl_boletin_node ?? '',
        irlp_reflector_id: vals.irlp_reflector_id ?? '',
        irlp_boletin_node: vals.irlp_boletin_node ?? '',
      }))
      message.success('Configuración de nodos guardada')
    } catch {
      message.error('Error al guardar configuración de nodos')
    } finally {
      setSavingNodeConfig(false)
    }
  }

  const iniciarSesion = async () => {
    try { await sesionForm.validateFields() } catch { return }
    const vals = sesionForm.getFieldsValue()
    const fecha = vals.fecha_hora as dayjs.Dayjs
    if (!verificarDiaEvento(fecha, vals.tipo_evento)) return
    await activarSesion(vals, fecha.format('YYYY-MM-DDTHH:mm:ss'))
  }

  const handleCapturaDirecta = () => {
    setWarnModalOpen(false)
    const vals = sesionForm.getFieldsValue()
    if (!vals.tipo_evento) { setConfigVisible(true); return }
    if (!verificarDiaEvento(fechaSeleccionada, vals.tipo_evento)) return
    activarSesion(vals, fechaSeleccionada.format('YYYY-MM-DDTHH:mm:ss'))
  }

  const handleIrAConfig = () => {
    setWarnModalOpen(false); setConfigVisible(true); setSesionActiva(false)
  }

  // ── Agregar indicativo ────────────────────────────────────────────────────
  const buscarYAgregar = async () => {
    const cs = inputIndicativo.trim().toUpperCase()
    if (!cs) return
    if (!validarIndicativo(cs)) {
      message.error(`"${cs}" no es un indicativo válido. Formatos aceptados: ITU (XE2MBE, W1AW) o SWL (SWL, SWL-XE2-001)`)
      return
    }
    // SWL puede repetirse; para indicativos normales no permitir duplicados
    if (!esSWL(cs) && filas.some(f => f.indicativo === cs)) { message.warning(`${cs} ya está en esta sesión`); return }
    setBuscando(true)

    const swl = esSWL(cs)

    // SWL: solo buscar operador y prefijo, omitir check de primera vez/reaparición
    const [opRes, checkRes, prefixRes] = await Promise.allSettled([
      operadoresApi.buscar(cs),
      swl ? Promise.resolve({ data: null }) : libretaApi.checkIndicativo(cs),
      catalogosApi.lookupPrefijo(cs),
    ])

    setBuscando(false)
    setInputIndicativo('')
    setTimeout(() => inputRef.current?.focus(), 50)

    const op = opRes.status === 'fulfilled' ? opRes.value.data : null
    const check = (!swl && checkRes.status === 'fulfilled') ? (checkRes.value as any).data : null
    const prefix = prefixRes.status === 'fulfilled' ? prefixRes.value.data : null

    // Estimar zona y país desde prefijo (SWL siempre México)
    let zona = zonaExtranjero
    let pais = swl ? 'México' : (prefix?.pais || 'Desconocido')
    let zonaEsNacional = false

    if (prefix?.zona_codigo) {
      const zonaDB = zonas.find(z => z.codigo === prefix.zona_codigo)
      zona = zonaDB ? zonaDB.codigo : zonaExtranjero
      zonaEsNacional = !!zonaDB
    }

    const ultimaAparicion = check?.ultima_aparicion ?? null

    // Modales de recordatorio — nunca para SWL
    if (!swl && anunciarPrimeraVez && check?.es_primera_vez) {
      pendienteRef.current = { indicativo: cs, op, pais, zona, zonaEsNacional, ultimaAparicion }
      setPrimeraVezIndicativo(cs)
      nuevoHamForm.setFieldsValue({
        nombre_completo: op?.nombre_completo || '',
        municipio: op?.municipio || '',
        estado: op?.estado || '',
      })
      setPrimeraVezModal(true)
      return
    }
    if (!swl && anunciarReaparicion && check?.es_reaparicion) {
      pendienteRef.current = { indicativo: cs, op, pais, zona, zonaEsNacional, ultimaAparicion }
      setReaparicionInfo(check)
      setReaparicionIndicativo(cs)
      setReaparicionModal(true)
      return
    }

    agregarFilaDirecta(cs, op, pais, zona, zonaEsNacional, ultimaAparicion)
    if (!op) {
      const msg = swl
        ? `${cs} agregado como SWL. Puedes editar nombre, ciudad y estado en la tabla.`
        : `${cs} no está en el catálogo. Registrado sin datos.`
      message.info(msg)
    }
  }

  const agregarFilaDirecta = (
    indicativo: string,
    op: Operador | null,
    pais: string,
    zonaEstimada: string,
    zonaEsNacional: boolean,   // true si el prefijo tiene zona_codigo asignada (es mexicano)
    ultimaAparicion: string | null
  ) => {
    if (!sesionConfig) return

    const swl = esSWL(indicativo)

    // Para SWL: siempre usar defaults si considerarSwl activo
    // Para Ham: usar datos del operador, luego defaults si considerarSwl activo
    const estadoVal = op?.estado
      || (considerarSwl ? sesionConfig.estado_default || '' : '')
    const municipioVal = op?.municipio
      || (considerarSwl ? sesionConfig.ciudad_default || '' : '')

    // Calcular zona:
    // - SWL: usar zona_swl_default si está configurada; si hay estado, derivar de él
    // - Ham nacional: derivar del estado si está disponible
    let zona = zonaEstimada
    if (swl) {
      zona = sesionConfig.zona_swl_default || zonaEstimada
      if (estadoVal) {
        const estDB = estados.find(e => e.nombre === estadoVal)
        if (estDB?.zona) {
          const zonaDB = zonas.find(z => z.codigo === estDB.zona)
          if (zonaDB) zona = zonaDB.codigo
        }
      }
    } else if (zonaEsNacional && estadoVal) {
      const estDB = estados.find(e => e.nombre === estadoVal)
      if (estDB?.zona) {
        const zonaDB = zonas.find(z => z.codigo === estDB.zona)
        if (zonaDB) zona = zonaDB.codigo
      }
    }

    const fila: FilaLibreta = {
      key: `${indicativo}-${Date.now()}`,
      indicativo,
      nombre_completo: op?.nombre_completo || '',
      municipio: municipioVal,
      estado: estadoVal,
      zona,
      pais,
      rst: inputRst || sesionConfig.rst_default || '59',
      sistema: inputSistema || sesionConfig.sistema_default || '',
      status: op ? 'ok' : 'notfound',
      ultimaAparicion,
    }
    setFilas(prev => [fila, ...prev])
  }

  // ── Modal primera vez ─────────────────────────────────────────────────────
  const handleGuardarNuevoHam = async () => {
    const vals = nuevoHamForm.getFieldsValue()
    setGuardandoHam(true)
    try {
      await libretaApi.nuevoHam({
        indicativo: primeraVezIndicativo,
        nombre_completo: vals.nombre_completo || undefined,
        municipio: vals.municipio || undefined,
        estado: vals.estado || undefined,
      })
      message.success(`${primeraVezIndicativo} registrado en HAMs`)
    } catch (e: any) {
      message.error('Error al guardar HAM: ' + (e?.response?.data?.detail || e?.message))
    } finally { setGuardandoHam(false) }
    setPrimeraVezModal(false)
    if (pendienteRef.current) {
      const { indicativo, op, pais, zona, zonaEsNacional, ultimaAparicion } = pendienteRef.current
      const opConDatos: any = {
        ...(op || {}),
        nombre_completo: vals.nombre_completo || op?.nombre_completo || '',
        municipio: vals.municipio || op?.municipio || '',
        estado: vals.estado || op?.estado || '',
      }
      agregarFilaDirecta(indicativo, opConDatos, pais, zona, zonaEsNacional, ultimaAparicion)
      pendienteRef.current = null
    }
  }

  const handleOmitirNuevoHam = () => {
    setPrimeraVezModal(false)
    if (pendienteRef.current) {
      const { indicativo, op, pais, zona, zonaEsNacional, ultimaAparicion } = pendienteRef.current
      agregarFilaDirecta(indicativo, op, pais, zona, zonaEsNacional, ultimaAparicion)
      pendienteRef.current = null
    }
  }

  const handleContinuarReaparicion = () => {
    setReaparicionModal(false)
    if (pendienteRef.current) {
      const { indicativo, op, pais, zona, zonaEsNacional, ultimaAparicion } = pendienteRef.current
      agregarFilaDirecta(indicativo, op, pais, zona, zonaEsNacional, ultimaAparicion)
      pendienteRef.current = null
    }
  }

  // ── Edición tabla ─────────────────────────────────────────────────────────
  const actualizarFila = (key: string, campo: keyof FilaLibreta, valor: any) =>
    setFilas(prev => prev.map(f => f.key === key ? { ...f, [campo]: valor } : f))

  const eliminarFila = (key: string) => setFilas(prev => prev.filter(f => f.key !== key))

  // ── Re-lookup al corregir indicativo ─────────────────────────────────────
  const relookupFila = async (key: string, nuevoIndicativo: string) => {
    const cs = nuevoIndicativo.trim().toUpperCase()
    if (!cs || !validarIndicativo(cs)) return

    const swl = esSWL(cs)
    const [opRes, prefixRes, checkRes] = await Promise.allSettled([
      operadoresApi.buscar(cs),
      catalogosApi.lookupPrefijo(cs),
      swl ? Promise.resolve({ data: null }) : libretaApi.checkIndicativo(cs),
    ])
    const op = opRes.status === 'fulfilled' ? opRes.value.data : null
    const prefix = prefixRes.status === 'fulfilled' ? prefixRes.value.data : null
    const check = checkRes.status === 'fulfilled' ? (checkRes.value as any).data : null

    let zona = zonaExtranjero
    const pais = swl ? 'México' : (prefix?.pais || 'Desconocido')
    let zonaEsNacional = false
    if (prefix?.zona_codigo) {
      const zonaDB = zonas.find(z => z.codigo === prefix.zona_codigo)
      zona = zonaDB ? zonaDB.codigo : zonaExtranjero
      zonaEsNacional = !!zonaDB
    }

    const estadoVal = op?.estado
      || (considerarSwl && sesionConfig ? sesionConfig.estado_default || '' : '')
    const municipioVal = op?.municipio
      || (considerarSwl && sesionConfig ? sesionConfig.ciudad_default || '' : '')

    if (swl && sesionConfig?.zona_swl_default) zona = sesionConfig.zona_swl_default
    if ((zonaEsNacional || swl) && estadoVal) {
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
      municipio: municipioVal,
      estado: estadoVal,
      zona,
      pais,
      sistema: check?.ultimo_sistema || f.sistema,
      ultimaAparicion: check?.ultima_aparicion ?? null,
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

  const eliminarSeleccionados = () => {
    setFilas(prev => prev.filter(f => !selectedKeys.includes(f.key)))
    setSelectedKeys([])
  }

  // ── Guardar reportes ──────────────────────────────────────────────────────
  const guardarTodo = async () => {
    if (!sesionConfig || filas.length === 0) { message.warning('No hay registros en la libreta'); return }
    setGuardando(true)
    try {
      await Promise.all(filas.map(fila =>
        reportesApi.create({
          indicativo: fila.indicativo,
          operador: fila.nombre_completo,
          senal: parseInt(fila.rst) || 59,
          estado: fila.estado,
          ciudad: fila.municipio,
          zona_id: zonas.find(z => z.codigo === fila.zona)?.id,
          sistema_id: sistemas.find(s => s.codigo === (fila.sistema || sesionConfig.sistema_default))?.id,
          evento_id: eventos.find(e => e.tipo === sesionConfig.tipo_evento)?.id,
          estacion_id: estaciones.find(e => e.qrz === sesionConfig.estacion)?.id,
          fecha_reporte: sesionConfig.fecha,
        })
      ))
      message.success(`${filas.length} reporte(s) guardados correctamente`)
      setFilas([])
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (e: any) {
      message.error('Error al guardar: ' + (e?.response?.data?.detail || e?.message || 'desconocido'))
    } finally { setGuardando(false) }
  }

  // ── Columnas tabla ────────────────────────────────────────────────────────
  const INITIAL_WIDTHS = [32, 150, 180, 130, 160, 100, 130, 110, 70, 110, 40]
  const { applyWidths, components } = useResizableColumns(INITIAL_WIDTHS)

  const baseColumns = [
    {
      title: '', dataIndex: 'status', width: 32,
      render: (v: FilaLibreta['status']) => (
        <Tooltip title={v === 'ok' ? 'En catálogo' : 'No encontrado en catálogo'}>
          {v === 'ok'
            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
            : <WarningOutlined style={{ color: '#fa8c16' }} />}
        </Tooltip>
      ),
    },
    {
      title: 'Indicativo', dataIndex: 'indicativo', width: 140,
      render: (v: string, row: FilaLibreta) => (
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
      title: 'Nombre', dataIndex: 'nombre_completo', width: 180,
      render: (v: string, row: FilaLibreta) => (
        <Input size="small" value={v} variant="borderless" placeholder="Nombre"
          onChange={e => actualizarFila(row.key, 'nombre_completo', e.target.value)} />
      ),
    },
    {
      title: 'Ciudad', dataIndex: 'municipio', width: 130,
      render: (v: string, row: FilaLibreta) => (
        <Input size="small" value={v} variant="borderless" placeholder="Ciudad"
          onChange={e => actualizarFila(row.key, 'municipio', e.target.value)} />
      ),
    },
    {
      title: 'Estado', dataIndex: 'estado', width: 160,
      render: (v: string, row: FilaLibreta) => (
        <Select size="small" value={v || undefined} placeholder="Estado"
          showSearch allowClear optionFilterProp="label" style={{ width: '100%' }}
          options={estados.map(e => ({ value: e.nombre, label: e.nombre }))}
          onChange={val => {
            actualizarFila(row.key, 'estado', val)
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
      render: (v: string, row: FilaLibreta) => {
        const color = zonaColor(v)
        return (
          <Select size="small" value={v} style={{ width: '100%' }}
            onChange={val => actualizarFila(row.key, 'zona', val)}
            labelRender={({ value }) => (
              <span style={{ color, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{value}</span>
            )}
            optionRender={option => {
              const c = zonaColor(option.value as string)
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: c }}>{option.value}</span>
                </span>
              )
            }}
            options={zonas.map(z => ({ value: z.codigo }))}
          />
        )
      },
    },
    {
      title: 'País', dataIndex: 'pais', width: 130,
      render: (v: string, row: FilaLibreta) => (
        <Select size="small" value={v || undefined} placeholder="País"
          showSearch allowClear optionFilterProp="label" style={{ width: '100%' }}
          options={paises.map(p => ({ value: p, label: p }))}
          onChange={val => actualizarFila(row.key, 'pais', val ?? '')} />
      ),
    },
    {
      title: 'Sistema', dataIndex: 'sistema', width: 110,
      render: (v: string, row: FilaLibreta) => (
        <Select size="small" value={v || undefined} placeholder="Sistema" allowClear style={{ width: '100%' }}
          labelRender={({ value }) => {
            const s = sistemas.find(s => s.codigo === value)
            if (!s) return <span>{String(value)}</span>
            const c = s.color ?? '#1677ff'
            return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>
          }}
          options={sistemas.map(s => {
            const c = s.color ?? '#1677ff'
            return {
              value: s.codigo,
              label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>,
            }
          })}
          onChange={val => actualizarFila(row.key, 'sistema', val)} />
      ),
    },
    {
      title: 'RST', dataIndex: 'rst', width: 70,
      render: (v: string, row: FilaLibreta) => (
        <Tooltip title={!validarRST(v) ? 'RST inválido — Ej: 59 o 599' : ''}>
          <Input size="small" value={v} variant="borderless" maxLength={3}
            onChange={e => actualizarFila(row.key, 'rst', normalizarRST(e.target.value))}
            style={{ textAlign: 'center', fontWeight: 700, color: validarRST(v) ? undefined : '#ff4d4f' }} />
        </Tooltip>
      ),
    },
    {
      title: 'Último Registro', dataIndex: 'ultimaAparicion', width: 110,
      render: (v: string | null | undefined) => {
        if (v === undefined) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
        if (!v) return <Tag color="blue" style={{ fontSize: 10 }}>Primera vez</Tag>
        return <Text style={{ fontSize: 11 }}>{dayjs(v).format('DD/MM/YY')}</Text>
      },
    },
    {
      title: '', width: 40,
      render: (_: any, row: FilaLibreta) => (
        <Popconfirm title="¿Quitar de la libreta?" okText="Sí" cancelText="No"
          onConfirm={() => eliminarFila(row.key)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const columns = applyWidths(baseColumns)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      <Title level={4} style={{ margin: '0 0 16px' }}>Libreta</Title>

      {/* Modal: selección de fecha */}
      <Modal title={<><CalendarOutlined style={{ marginRight: 8 }} />Fecha de captura</>}
        open={dateModalOpen} closable={false} maskClosable={false}
        onOk={handleDateConfirm} okText="Continuar"
        onCancel={() => setDateModalOpen(false)} cancelText="Cancelar"
        width={340}>
        <Spin spinning={loadingConfig}>
          <div style={{ padding: '16px 0' }}>
            <DatePicker format="DD/MM/YYYY" value={fechaSeleccionada}
              onChange={v => {
                if (!v) return
                setFechaSeleccionada(v)
                const tipoEvento = sesionForm.getFieldValue('tipo_evento') as string | undefined
                if (tipoEvento) verificarDiaEvento(v, tipoEvento)
              }}
              style={{ width: '100%' }} allowClear={false} />
          </div>
        </Spin>
      </Modal>

      {/* Modal: advertencia fecha distinta */}
      <Modal title={<><WarningOutlined style={{ color: '#fa8c16', marginRight: 8 }} />Fecha diferente al día de hoy</>}
        open={warnModalOpen} closable={false} maskClosable={false}
        footer={[
          <Button key="config" onClick={handleIrAConfig}>Configurar libreta</Button>,
          <Button key="capture" type="primary" onClick={handleCapturaDirecta}>Capturar registros</Button>,
        ]} width={420}>
        <Alert type="warning" showIcon
          message={`Los registros se guardarán con fecha: ${fechaSeleccionada?.format('DD/MM/YYYY')}`}
          description="¿Deseas capturar registros con esta fecha o revisar primero la configuración?"
          style={{ marginTop: 8 }} />
      </Modal>

      {/* Modal: primera vez */}
      <Modal
        open={primeraVezModal}
        closable={false}
        maskClosable={false}
        footer={null}
        width={520}
        styles={{ body: { padding: 0 } }}
        afterOpenChange={open => { if (open) registrarHamBtnRef.current?.focus() }}
      >
        {/* Cabecera con gradiente */}
        <div style={{
          background: 'linear-gradient(135deg, #1A569E 0%, #1677ff 60%, #40a9ff 100%)',
          borderRadius: '8px 8px 0 0',
          padding: '32px 32px 24px',
          textAlign: 'center',
          color: '#fff',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 36,
            border: '3px solid rgba(255,255,255,0.5)',
          }}>
            🎙️
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, marginBottom: 4 }}>
            {primeraVezIndicativo}
          </div>
          <div style={{ fontSize: 15, opacity: 0.9, fontWeight: 600 }}>
            ¡Primera aparición registrada!
          </div>
          <div style={{
            marginTop: 12, fontSize: 13, opacity: 0.8,
            background: 'rgba(0,0,0,0.15)', borderRadius: 20,
            padding: '6px 16px', display: 'inline-block',
          }}>
            Esta estación no tiene registros previos en el sistema
          </div>
        </div>

        {/* Invitación */}
        <div style={{
          background: '#fffbe6', borderBottom: '1px solid #ffe58f',
          padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>📡</span>
          <span style={{ fontSize: 13, color: '#614700' }}>
            <strong>¡Bienvenido a la red FMRE!</strong> Invitamos a <strong>{primeraVezIndicativo}</strong> a
            seguir reportándose y ser parte activa de nuestra comunidad de radioaficionados.
          </span>
        </div>

        {/* Formulario de datos */}
        <div style={{ padding: '20px 24px 8px' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
            Registra los datos del operador para enriquecer el catálogo de HAMs:
          </div>
          <Form form={nuevoHamForm} layout="vertical">
            <Form.Item label="Nombre completo" name="nombre_completo" style={{ marginBottom: 12 }}>
              <Input prefix={<span>👤</span>} placeholder="Nombre del operador" size="large" />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item label="Ciudad / Municipio" name="municipio" style={{ marginBottom: 12 }}>
                  <Input prefix={<span>🏙️</span>} placeholder="Ciudad" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Estado" name="estado" style={{ marginBottom: 12 }}>
                  <Select placeholder="Estado" showSearch allowClear optionFilterProp="label"
                    options={estados.map(e => ({ value: e.nombre, label: e.nombre }))} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px 20px',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Button onClick={handleOmitirNuevoHam} size="large">
            Omitir
          </Button>
          <Button ref={registrarHamBtnRef} type="primary" icon={<SaveOutlined />} size="large"
            loading={guardandoHam} onClick={handleGuardarNuevoHam}
            style={{ background: '#1A569E', borderColor: '#1A569E' }}>
            Registrar en HAMs
          </Button>
        </div>
      </Modal>

      {/* Modal: reaparición */}
      <Modal
        title={<><BellOutlined style={{ color: '#fa8c16', marginRight: 8 }} />Reaparición: {reaparicionIndicativo}</>}
        open={reaparicionModal} closable={false} maskClosable={false}
        footer={
          <Button ref={continuarCapturaBtnRef} type="primary" onClick={handleContinuarReaparicion}>
            Continuar captura
          </Button>
        }
        width={420}
        afterOpenChange={open => { if (open) continuarCapturaBtnRef.current?.focus() }}>
        {reaparicionInfo && (
          <Alert type="warning" showIcon
            message={`${reaparicionIndicativo} no ha aparecido en ${reaparicionInfo.dias_sin_aparecer} días`}
            description={<span>Última aparición: <strong>
              {reaparicionInfo.ultima_aparicion ? dayjs(reaparicionInfo.ultima_aparicion).format('DD/MM/YYYY') : 'desconocida'}
            </strong> (umbral: {reaparicionInfo.dias_reaparicion} días)</span>}
            style={{ marginTop: 8 }} />
        )}
      </Modal>

      {/* Configuración de sesión */}
      {(!sesionActiva || configVisible) && (
        <Card className="card-shadow" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
          <Form form={sesionForm} layout="vertical" initialValues={{ fecha_hora: dayjs() }}>
            <Collapse defaultActiveKey={['evento', 'estaciones', 'recordatorio', 'nodos']} ghost style={{ marginBottom: 8 }}>

              <Panel header={<strong>Evento</strong>} key="evento">
                <Row gutter={16}>
                  <Col xs={24} sm={12} md={6}>
                    <Form.Item label="Evento" name="tipo_evento" rules={[{ required: true, message: 'Requerido' }]}>
                      <Select placeholder="Tipo de evento" disabled={sesionActiva}
                        labelRender={({ value }) => {
                          const ev = eventos.find(e => e.tipo === value)
                          const c = ev?.color ?? '#1677ff'
                          return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{String(value)}</Tag>
                        }}
                        options={eventos.map(e => {
                          const c = e.color ?? '#1677ff'
                          return { value: e.tipo, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.tipo}</Tag> }
                        })} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={5}>
                    <Form.Item label="Estación" name="estacion">
                      <Select placeholder="QRZ operando" disabled={sesionActiva} allowClear
                        labelRender={({ value }) => {
                          const est = estaciones.find(e => e.qrz === value)
                          const c = est?.color ?? '#1677ff'
                          return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{String(value)}</Tag>
                        }}
                        options={estaciones.map(e => {
                          const c = e.color ?? '#1677ff'
                          return { value: e.qrz, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.qrz}</Tag> }
                        })} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={5}>
                    <Form.Item label="Sistema preferido" name="sistema_default">
                      <Select placeholder="Sistema" disabled={sesionActiva} allowClear
                        labelRender={({ value }) => {
                          const s = sistemas.find(s => s.codigo === value)
                          if (!s) return <span>{String(value)}</span>
                          const c = s.color ?? '#1677ff'
                          return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>
                        }}
                        options={sistemas.map(s => {
                          const c = s.color ?? '#1677ff'
                          return {
                            value: s.codigo,
                            label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>,
                          }
                        })} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={5}>
                    <Form.Item label="Fecha" name="fecha_hora" rules={[{ required: true }]}>
                      <DatePicker format="DD/MM/YYYY" disabled={sesionActiva} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              <Panel header={<strong>Estaciones</strong>} key="estaciones">
                <Row gutter={16} align="bottom">
                  <Col xs={12} sm={6} md={4}>
                    <Form.Item
                      label={<Tooltip title="R(1-5) S(1-9) T(1-9 opcional). Ej: 59 o 599">
                        RST por defecto <span style={{ color: '#999', fontSize: 11 }}>(?)</span>
                      </Tooltip>}
                      style={{ marginBottom: 0 }}
                      validateStatus={!validarRST(inputRst) ? 'error' : ''}
                      help={!validarRST(inputRst) ? 'Ej: 59 o 599' : ''}
                    >
                      <Input value={inputRst} maxLength={3} disabled={sesionActiva}
                        onChange={e => setInputRst(normalizarRST(e.target.value))}
                        style={{ width: 80, textAlign: 'center', fontWeight: 700 }} placeholder="59" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <Checkbox checked={considerarSwl} disabled={sesionActiva}
                      onChange={e => {
                        setConsiderarSwl(e.target.checked)
                        if (!e.target.checked) sesionForm.setFieldsValue({ estado_default: undefined, ciudad_default: undefined })
                      }}>
                      <strong>Considerar SWL</strong>
                    </Checkbox>
                  </Col>
                  {considerarSwl && (
                    <>
                      <Col xs={24} sm={8}>
                        <Form.Item label="Estado por defecto" name="estado_default" style={{ marginBottom: 0 }}>
                          <Select placeholder="Estado" disabled={sesionActiva} allowClear showSearch
                            optionFilterProp="label"
                            options={estados.map(e => ({ value: e.nombre, label: e.nombre }))} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Form.Item label="Ciudad por defecto" name="ciudad_default" style={{ marginBottom: 0 }}>
                          <Input placeholder="Ciudad" disabled={sesionActiva} />
                        </Form.Item>
                      </Col>
                    </>

                  )}
                </Row>
              </Panel>

              <Panel header={<strong>Recordatorio</strong>} key="recordatorio"
                extra={<BellOutlined style={{ color: '#fa8c16' }} />}>
                <Space direction="vertical" size={8}>
                  <Checkbox checked={anunciarPrimeraVez} disabled={sesionActiva}
                    onChange={e => setAnunciarPrimeraVez(e.target.checked)}>
                    <strong>Anunciar Primera Vez</strong>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      — Abre formulario para registrar datos del operador si es su primera aparición
                    </Text>
                  </Checkbox>
                  <Checkbox checked={anunciarReaparicion} disabled={sesionActiva}
                    onChange={e => setAnunciarReaparicion(e.target.checked)}>
                    <strong>Anunciar Reaparición</strong>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      — Muestra la última fecha de aparición si superó el umbral configurado
                    </Text>
                  </Checkbox>
                </Space>
              </Panel>

              <Panel header={<strong>Monitoreo Sistemas RoIP</strong>} key="nodos"
                extra={<SettingOutlined style={{ color: '#1677ff' }} />}>

                {/* Toggle de monitoreo */}
                <Space align="center" style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 13 }}>Monitoreo Sistemas RoIP</Text>
                  <Switch checked={roipMonitorando} onChange={v => {
                    setRoipMonitorando(v)
                    if (!v) setRoipAvanzado(false)
                    libretaApi.saveConfig({ roip_monitorando: v, roip_avanzado: v ? roipAvanzado : false })
                  }} />
                  {roipMonitorando && (
                    <>
                      <Text type="secondary" style={{ fontSize: 11 }}>actualizando cada 5 s</Text>
                      <Text strong style={{ fontSize: 13, marginLeft: 8 }}>Avanzado</Text>
                      <Switch checked={roipAvanzado} onChange={v => {
                        setRoipAvanzado(v)
                        libretaApi.saveConfig({ roip_avanzado: v })
                      }} />
                    </>
                  )}
                </Space>

                {/* TalkGroups DMR — siempre visible para configurar */}
                <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>DMR Brandmeister — TalkGroups a monitorear</Text>
                  <Space.Compact style={{ marginTop: 6, width: '100%', maxWidth: 360 }}>
                    <Input
                      size="small"
                      value={nodeCfg.bm_tgs}
                      onChange={e => setNodeCfg(prev => ({ ...prev, bm_tgs: e.target.value }))}
                      placeholder="33450,334"
                      style={{ fontSize: 12 }}
                    />
                    <Button size="small" type="primary" icon={<SaveOutlined />}
                      onClick={async () => {
                        try {
                          await libretaApi.saveConfig({ bm_tgs: nodeCfg.bm_tgs })
                          message.success('TGs guardados')
                        } catch { message.error('Error al guardar') }
                      }}
                    >Guardar</Button>
                  </Space.Compact>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 3 }}>
                    Separados por coma — ej: 33450,334
                  </Text>
                </div>

                {roipMonitorando && (<>

                  {/* Indicadores de estado */}
                  <Row gutter={12} style={{ marginBottom: 12 }}>

                    {/* ── Hub ASL ── */}
                    <Col xs={24} sm={12} style={{ marginBottom: 8 }}>
                      <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px' }}>
                        {/* Fila 1: título + ONLINE/OFFLINE */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#389e0d' }}>
                            Hub ASL: #{nodeCfg.asl_hub_id || '—'}
                          </span>
                          {!aslStatus
                            ? <StatusPill label="..." color="#d9d9d9" />
                            : aslStatus.online
                              ? <StatusPill label="ONLINE" color="#52c41a" />
                              : <StatusPill label="OFFLINE" color="#ff4d4f" />
                          }
                        </div>
                        {/* Fila 2: dot boletín + número + actividad (solo si conectado) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                            background: !aslStatus || !aslStatus.online ? '#8c8c8c' : aslStatus.on_air ? '#52c41a' : '#8c8c8c',
                            boxShadow: aslStatus?.on_air ? '0 0 0 3px rgba(82,196,26,0.3)' : 'none',
                          }} />
                          <span style={{ fontSize: 11, color: '#595959', fontWeight: 600 }}>
                            Nodo Boletín {nodeCfg.asl_boletin_node || '—'}
                          </span>
                          {aslStatus?.online && aslStatus?.on_air && (
                            aslStatus.tx_keyed
                              ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                              : aslStatus.cos_keyed
                                ? <StatusPill label="RX ACTIVO" color="#52c41a" />
                                : <StatusPill label="IDLE" color="#595959" />
                          )}
                        </div>
                        {/* Lista de nodos conectados al Hub */}
                        {roipAvanzado && aslStatus?.online && !!aslStatus.nodes?.length && (
                          <div style={{ marginTop: 8, borderTop: '1px solid #d9f7be', paddingTop: 6, maxHeight: 140, overflowY: 'auto' }}>
                            {(aslStatus.nodes as any[]).map(n => (
                              <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11 }}>
                                <span style={{
                                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                                  background: n.tx_keyed ? '#ff4d4f' : n.cos_keyed ? '#52c41a' : '#389e0d',
                                }} />
                                <span style={{ color: '#389e0d', fontWeight: 700 }}>#{n.node}</span>
                                {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                                {n.tx_keyed && <StatusPill label="TX" color="#ff4d4f" pulse />}
                                {!n.tx_keyed && n.cos_keyed && <StatusPill label="RX" color="#52c41a" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Col>

                    {/* ── Reflector IRLP ── */}
                    <Col xs={24} sm={12} style={{ marginBottom: 8 }}>
                      <div style={{ background: '#e6f7ff', border: '1px solid #91caff', borderRadius: 8, padding: '10px 14px' }}>
                        {/* Fila 1: título + ONLINE/OFFLINE */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2' }}>
                            Reflector IRLP: #{nodeCfg.irlp_reflector_id || '—'}
                          </span>
                          {!irlpStatus
                            ? <StatusPill label="..." color="#d9d9d9" />
                            : irlpStatus.online
                              ? <StatusPill label="ONLINE" color="#52c41a" />
                              : <StatusPill label="OFFLINE" color="#ff4d4f" />
                          }
                        </div>
                        {/* Fila 2: dot nodo boletín + actividad (solo si conectado) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                            background: !irlpStatus || !irlpStatus.online ? '#8c8c8c' : irlpStatus.on_air ? '#52c41a' : '#8c8c8c',
                            boxShadow: irlpStatus?.on_air ? '0 0 0 3px rgba(82,196,26,0.3)' : 'none',
                          }} />
                          <span style={{ fontSize: 11, color: '#595959', fontWeight: 600 }}>
                            Nodo Boletín {nodeCfg.irlp_boletin_node || '—'}
                          </span>
                          {irlpStatus?.online && irlpStatus?.on_air && (
                            irlpStatus.ptt
                              ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                              : irlpStatus.cos
                                ? <StatusPill label="RX ACTIVO" color="#52c41a" />
                                : <StatusPill label="IDLE" color="#595959" />
                          )}
                        </div>
                        {/* Lista de nodos en el Reflector */}
                        {roipAvanzado && irlpStatus?.online && !!irlpStatus.nodes?.length && (
                          <div style={{ marginTop: 8, borderTop: '1px solid #bae0ff', paddingTop: 6, maxHeight: 140, overflowY: 'auto' }}>
                            {(irlpStatus.nodes as any[]).map(n => (
                              <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11 }}>
                                <span style={{
                                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                                  background: n.warning ? '#faad14' : '#52c41a',
                                }} />
                                <span style={{ color: '#0891b2', fontWeight: 700 }}>#{n.node}</span>
                                {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                                {n.warning && <StatusPill label="!" color="#faad14" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Col>

                    {/* ── DMR / Brandmeister ── */}
                    <Col xs={24} sm={12} style={{ marginBottom: 8 }}>
                      <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>DMR Brandmeister</span>
                          {!dmrStatus.connected
                            ? <StatusPill label="Conectando…" color="#d9d9d9" />
                            : <StatusPill label="ONLINE" color="#7c3aed" />
                          }
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                            background: dmrStatus.active ? '#ff4d4f' : dmrStatus.connected ? '#7c3aed' : '#8c8c8c',
                            boxShadow: dmrStatus.active ? '0 0 0 3px rgba(255,77,79,0.3)' : dmrStatus.connected ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none',
                            animation: dmrStatus.active ? 'pulse-red 0.8s ease-in-out infinite' : 'none',
                          }} />
                          {dmrStatus.connected && (
                            dmrStatus.active
                              ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                              : <StatusPill label="IDLE" color="#595959" />
                          )}
                        </div>
                        {dmrStatus.active && dmrStatus.callsign && (
                          <div style={{ marginTop: 8, borderTop: '1px solid #ddd6fe', paddingTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: '#ff4d4f' }} />
                            <span style={{ color: '#7c3aed', fontWeight: 700 }}>{dmrStatus.callsign}</span>
                            <span style={{ color: '#8c8c8c' }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </Col>

                  </Row>

                  <Divider style={{ margin: '4px 0 10px' }} />

                  {/* Parámetros de configuración */}
                  <Form form={nodeConfigForm} layout="vertical" size="small">
                    <Divider orientation="left" plain style={{ fontSize: 12, color: '#389e0d', margin: '0 0 8px' }}>AllStarLink (AllScan)</Divider>
                    <Row gutter={12}>
                      <Col xs={8} sm={4}>
                        <Form.Item label="# Hub" name="asl_hub_id">
                          <Input placeholder="299081" />
                        </Form.Item>
                      </Col>
                      <Col xs={16} sm={14}>
                        <Form.Item label="IP / URL del Hub" name="asl_host">
                          <Input placeholder="stn8422.ip.irlp.net" />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={3}>
                        <Form.Item label="Puerto" name="asl_port">
                          <Input placeholder="8081" />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={3}>
                        <Form.Item label="Nodo Boletín" name="asl_boletin_node">
                          <Input placeholder="299080" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Divider orientation="left" plain style={{ fontSize: 12, color: '#0891b2', margin: '4px 0 8px' }}>IRLP</Divider>
                    <Row gutter={12}>
                      <Col xs={8} sm={4}>
                        <Form.Item label="# Reflector" name="irlp_reflector_id">
                          <Input placeholder="0077" />
                        </Form.Item>
                      </Col>
                      <Col xs={16} sm={20}>
                        <Form.Item label="URL página del Reflector" name="irlp_ref_url">
                          <Input placeholder="http://85.8.149.218/Chan_Zero_Node_Numbers.html" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={5}>
                        <Form.Item label="Usuario CGI" name="irlp_user">
                          <Input placeholder="xe2mbe" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={5}>
                        <Form.Item label="Contraseña CGI" name="irlp_password">
                          <Input.Password placeholder="••••••" />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={4}>
                        <Form.Item label="# Nodo Boletín" name="irlp_boletin_node">
                          <Input placeholder="8422" />
                        </Form.Item>
                      </Col>
                      <Col xs={16} sm={7}>
                        <Form.Item label="IP / URL Nodo Boletín" name="irlp_host">
                          <Input placeholder="stn8422.ip.irlp.net" />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={3}>
                        <Form.Item label="Puerto CGI" name="irlp_port">
                          <Input placeholder="8080" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button
                      type="primary" size="small" icon={<SaveOutlined />}
                      loading={savingNodeConfig}
                      onClick={guardarNodeConfig}
                    >
                      Guardar configuración de nodos
                    </Button>
                  </Form>
                </>)}
              </Panel>

            </Collapse>

            <Row style={{ marginTop: 8 }}>
              <Col>
                {!sesionActiva ? (
                  <Button type="primary" onClick={iniciarSesion} icon={<PlusOutlined />}>
                    Iniciar Toma de Reporte
                  </Button>
                ) : (
                  <Button onClick={() => {
                    setSesionActiva(false); setSesionConfig(null)
                    setFilas([]); setConsiderarSwl(false); setConfigVisible(true)
                  }}>
                    Nueva Toma de Reporte
                  </Button>
                )}
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      {/* Widgets RoIP */}
      {roipMonitorando && (
        <Row gutter={8} style={{ marginBottom: 8 }}>
          <Col xs={24} sm={12} style={{ marginBottom: 4 }}>
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '4px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#389e0d' }}>Hub ASL: #{nodeCfg.asl_hub_id || '—'}</span>
                {!aslStatus ? <StatusPill label="..." color="#d9d9d9" />
                  : aslStatus.online ? <StatusPill label="ONLINE" color="#52c41a" />
                  : <StatusPill label="OFFLINE" color="#ff4d4f" />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: !aslStatus || !aslStatus.online ? '#8c8c8c' : aslStatus.on_air ? '#52c41a' : '#8c8c8c',
                  boxShadow: aslStatus?.on_air ? '0 0 0 2px rgba(82,196,26,0.3)' : 'none' }} />
                <span style={{ fontSize: 10, color: '#595959', fontWeight: 600 }}>Nodo Boletín {nodeCfg.asl_boletin_node || '—'}</span>
                {aslStatus?.online && aslStatus?.on_air && (aslStatus.tx_keyed
                  ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                  : aslStatus.cos_keyed ? <StatusPill label="RX ACTIVO" color="#52c41a" />
                  : <StatusPill label="IDLE" color="#595959" />)}
              </div>
              {roipAvanzado && aslStatus?.online && !!aslStatus.nodes?.length && (
                <div style={{ marginTop: 4, borderTop: '1px solid #d9f7be', paddingTop: 3, maxHeight: 100, overflowY: 'auto' }}>
                  {aslStatus.nodes.map(n => (
                    <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0', fontSize: 10 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                        background: n.tx_keyed ? '#ff4d4f' : n.cos_keyed ? '#52c41a' : '#389e0d' }} />
                      <span style={{ color: '#389e0d', fontWeight: 700 }}>#{n.node}</span>
                      {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                      {n.tx_keyed && <StatusPill label="TX" color="#ff4d4f" pulse />}
                      {!n.tx_keyed && n.cos_keyed && <StatusPill label="RX" color="#52c41a" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12} style={{ marginBottom: 4 }}>
            <div style={{ background: '#e6f7ff', border: '1px solid #91caff', borderRadius: 6, padding: '4px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2' }}>Reflector IRLP: #{nodeCfg.irlp_reflector_id || '—'}</span>
                {!irlpStatus ? <StatusPill label="..." color="#d9d9d9" />
                  : irlpStatus.online ? <StatusPill label="ONLINE" color="#52c41a" />
                  : <StatusPill label="OFFLINE" color="#ff4d4f" />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: !irlpStatus || !irlpStatus.online ? '#8c8c8c' : irlpStatus.on_air ? '#52c41a' : '#8c8c8c',
                  boxShadow: irlpStatus?.on_air ? '0 0 0 2px rgba(82,196,26,0.3)' : 'none' }} />
                <span style={{ fontSize: 10, color: '#595959', fontWeight: 600 }}>Nodo Boletín {nodeCfg.irlp_boletin_node || '—'}</span>
                {irlpStatus?.online && irlpStatus?.on_air && (irlpStatus.ptt
                  ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                  : irlpStatus.cos ? <StatusPill label="RX ACTIVO" color="#52c41a" />
                  : <StatusPill label="IDLE" color="#595959" />)}
              </div>
              {roipAvanzado && irlpStatus?.online && !!irlpStatus.nodes?.length && (
                <div style={{ marginTop: 4, borderTop: '1px solid #bae0ff', paddingTop: 3, maxHeight: 100, overflowY: 'auto' }}>
                  {irlpStatus.nodes.map(n => (
                    <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0', fontSize: 10 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                        background: n.warning ? '#faad14' : '#52c41a' }} />
                      <span style={{ color: '#0891b2', fontWeight: 700 }}>#{n.node}</span>
                      {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                      {n.warning && <StatusPill label="!" color="#faad14" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Col>
          <Col xs={24} sm={12} style={{ marginBottom: 4 }}>
            <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 6, padding: '4px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>DMR Brandmeister</span>
                {!dmrStatus.connected
                  ? <StatusPill label="Conectando…" color="#d9d9d9" />
                  : <StatusPill label="ONLINE" color="#7c3aed" />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: dmrStatus.active ? '#ff4d4f' : dmrStatus.connected ? '#7c3aed' : '#8c8c8c',
                  animation: dmrStatus.active ? 'pulse-red 0.8s ease-in-out infinite' : 'none' }} />
                <span style={{ fontSize: 10, color: '#595959', fontWeight: 600 }}>TGs: {nodeCfg.bm_tgs || '—'}</span>
                {dmrStatus.connected && (dmrStatus.active
                  ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                  : <StatusPill label="IDLE" color="#595959" />)}
              </div>
              {dmrStatus.active && dmrStatus.callsign && (
                <div style={{ marginTop: 3, borderTop: '1px solid #ddd6fe', paddingTop: 3, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: '#ff4d4f' }} />
                  <span style={{ color: '#7c3aed', fontWeight: 700 }}>{dmrStatus.callsign}</span>
                  <span style={{ color: '#8c8c8c' }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
                </div>
              )}
            </div>
          </Col>
        </Row>
      )}

      {/* Panel de captura */}
      {sesionActiva && (
        <Card className="card-shadow" style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}
          title={sesionConfig && (
            <Space size={6} wrap>
              <Tag color="processing" style={{ fontWeight: 700, fontSize: 13 }}>
                📡 {sesionConfig.tipo_evento}
              </Tag>
              <Tag color="blue" style={{ fontWeight: 600 }}>
                {dayjs(sesionConfig.fecha).format('DD/MM/YYYY')}
              </Tag>
              {ocurrenciaEvento && (
                <Tag color="purple" style={{ fontWeight: 700 }}>
                  {NOMBRES_DIA[ocurrenciaEvento.dia]} #{ocurrenciaEvento.numero} del año
                </Tag>
              )}
            </Space>
          )}
          extra={
            <Tooltip title={configVisible ? 'Ocultar configuración' : 'Editar configuración'}>
              <Button size="small" icon={<SettingOutlined />}
                onClick={() => setConfigVisible(v => !v)}
                type={configVisible ? 'primary' : 'default'}>
                {configVisible ? 'Ocultar config.' : 'Editar config.'}
              </Button>
            </Tooltip>
          }>
          <Row gutter={12} align="middle" wrap>
            <Col><Text strong>Indicativo:</Text></Col>
            <Col>
              <Input ref={inputRef} value={inputIndicativo}
                onChange={e => setInputIndicativo(e.target.value.toUpperCase())}
                onPressEnter={buscarYAgregar}
                placeholder="XE2MBE / SWL"
                maxLength={20}
                status={inputIndicativo && !validarIndicativo(inputIndicativo) ? 'error' : ''}
                style={{ width: 130, textTransform: 'uppercase', fontWeight: 700, fontSize: 15 }} />
            </Col>
            <Col><Text strong>RST:</Text></Col>
            <Col>
              <Tooltip title="R(1-5) S(1-9) T(1-9 opcional)">
                <Input value={inputRst} maxLength={3}
                  onChange={e => setInputRst(normalizarRST(e.target.value))}
                  style={{ width: 60, textAlign: 'center', fontWeight: 700, borderColor: validarRST(inputRst) ? undefined : '#ff4d4f' }}
                  placeholder="59" />
              </Tooltip>
            </Col>
            <Col><Text strong>Sistema:</Text></Col>
            <Col>
              <Select value={inputSistema} onChange={setInputSistema} placeholder="Sistema"
                style={{ width: 130 }} allowClear
                labelRender={({ value }) => {
                  const s = sistemas.find(s => s.codigo === value)
                  if (!s) return <span>{String(value)}</span>
                  const c = s.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>
                }}
                options={sistemas.map(s => {
                  const c = s.color ?? '#1677ff'
                  return {
                    value: s.codigo,
                    label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>,
                  }
                })} />
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={buscarYAgregar} loading={buscando}
                onMouseDown={e => e.preventDefault()}>
                Agregar
              </Button>
            </Col>
            <Col>
              <SystemStatusWidget />
            </Col>
            <Col flex="auto" style={{ textAlign: 'right' }}>
              <Space>
                <Badge count={filas.length} color="#1A569E" />
                <Text type="secondary">registros en libreta</Text>
              </Space>
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            💡 Escribe el indicativo y presiona <kbd>Enter</kbd> para agregar rápidamente
          </Text>
        </Card>
      )}

      {/* Anuncio: edición de indicativo */}
      <Alert
        type="info"
        showIcon
        message="Ya puedes editar el indicativo de cualquier registro antes de guardarlo. Al modificarlo se actualizan automáticamente nombre, ciudad, estado, sistema y último registro."
        style={{ marginBottom: 16 }}
      />

      {/* Tabla de registros */}
      {filas.length > 0 && (
        <Card className="card-shadow"
          title={<span style={{ fontWeight: 700 }}>Registros <Badge count={filas.length} color="#1A569E" style={{ marginLeft: 8 }} /></span>}
          styles={{ header: { fontWeight: 700 } }}>
          {selectedKeys.length > 0 && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#1A569E', fontWeight: 600 }}>{selectedKeys.length} seleccionado(s)</span>
              <Popconfirm title={`¿Eliminar ${selectedKeys.length} registro(s)?`}
                okText="Sí" cancelText="No" onConfirm={eliminarSeleccionados}>
                <Button size="small" danger icon={<DeleteOutlined />}>Eliminar seleccionados</Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedKeys([])}>Deseleccionar</Button>
            </div>
          )}
          <Table<FilaLibreta>
            dataSource={filas} columns={columns as any} components={components}
            rowKey="key" size="small" pagination={false} scroll={{ x: 1100 }}
            rowClassName={row => row.status === 'notfound' ? 'ant-table-row-warning' : ''}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: keys => setSelectedKeys(keys as string[]) }}
          />
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" size="large" icon={<SaveOutlined />} onClick={guardarTodoYRefrescar}
              loading={guardando} disabled={filas.length === 0}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              Guardar {filas.length} Reporte(s)
            </Button>
          </div>
        </Card>
      )}

      {sesionActiva && filas.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <PlusOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <div>Escribe un indicativo y presiona Enter para comenzar</div>
        </Card>
      )}

      {/* Tabla resumen de reportes guardados */}
      {sesionConfig && (
        <Card
          className="card-shadow"
          style={{ marginTop: 16 }}
          title={
            <Space size={6} wrap>
              <span style={{ fontWeight: 700 }}>Reportes guardados —</span>
              <Tag color="processing" style={{ fontWeight: 700, fontSize: 13 }}>
                📡 {sesionConfig.tipo_evento}
              </Tag>
              {ocurrenciaEvento
                ? <Tag color="purple" style={{ fontWeight: 700 }}>#{ocurrenciaEvento.numero} del año</Tag>
                : null}
              <span style={{ fontWeight: 600 }}>con fecha</span>
              <Tag color="blue" style={{ fontWeight: 600 }}>
                {dayjs(sesionConfig.fecha).format('DD/MM/YYYY')}
              </Tag>
              <Badge count={resumen.length} color="#1A569E" />
            </Space>
          }
          extra={
            <Space size={8}>
              {resColSettingsBtn}
              <Tooltip title="Actualizar">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={loadingResumen}
                  onClick={() => fetchResumen(sesionConfig)}
                >
                  Actualizar
                </Button>
              </Tooltip>
            </Space>
          }
          styles={{ header: { fontWeight: 700 } }}
        >
          {/* ── Estadísticas de sesión ── */}
          {(statsActuales.totalQSOs > 0 || statsActuales.posicion !== null) && (
            <Row gutter={[6, 6]} style={{ marginBottom: 16, alignItems: 'stretch' }}>
              <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
                <div style={{
                  background: statsActuales.esRecordQSOs
                    ? 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)'
                    : 'linear-gradient(135deg, #1A569E 0%, #1677ff 100%)',
                  borderRadius: 8, padding: '8px 10px', color: '#fff',
                  boxShadow: statsActuales.esRecordQSOs
                    ? '0 4px 16px rgba(250,173,20,0.55)'
                    : '0 4px 12px rgba(22,119,255,0.3)',
                  transition: 'all 0.4s ease', height: '100%',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                    {statsActuales.esRecordQSOs ? '🏆 Récord QSOs' : '📡 QSOs guardados'}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                    {statsActuales.totalQSOs}
                  </div>
                  {statsActuales.esRecordQSOs && rankingEvento.length > 1 && (
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95, fontWeight: 700, letterSpacing: 0.3 }}>
                      ¡Mejor sesión del evento!
                    </div>
                  )}
                </div>
              </Col>
              <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
                <div style={{
                  background: statsActuales.esRecordEstaciones
                    ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                    : 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
                  borderRadius: 8, padding: '8px 10px', color: '#fff',
                  boxShadow: statsActuales.esRecordEstaciones
                    ? '0 4px 16px rgba(82,196,26,0.45)'
                    : '0 4px 12px rgba(19,194,194,0.3)',
                  transition: 'all 0.4s ease', height: '100%',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                    {statsActuales.esRecordEstaciones ? '🏆 Récord Estaciones' : '👥 Estaciones únicas'}
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                    {statsActuales.estacionesUnicas}
                  </div>
                  {statsActuales.esRecordEstaciones && rankingEvento.length > 1 && (
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95, fontWeight: 700, letterSpacing: 0.3 }}>
                      ¡Más estaciones del evento!
                    </div>
                  )}
                </div>
              </Col>
              {statsActuales.posicion !== null && (
                <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
                  <div style={{
                    background: statsActuales.posicion === 1
                      ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)'
                      : statsActuales.posicion <= 3
                        ? 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)'
                        : 'linear-gradient(135deg, #595959 0%, #434343 100%)',
                    borderRadius: 8, padding: '8px 10px', color: '#fff',
                    boxShadow: statsActuales.posicion === 1
                      ? '0 4px 16px rgba(250,173,20,0.55)'
                      : '0 4px 12px rgba(0,0,0,0.2)',
                    transition: 'all 0.4s ease', height: '100%',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                      📊 Posición del evento
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                      {statsActuales.posicion === 1 ? '🥇' : statsActuales.posicion === 2 ? '🥈' : statsActuales.posicion === 3 ? '🥉' : `#${statsActuales.posicion}`}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                      {rankingEvento.length === 1
                        ? 'Primera sesión del evento'
                        : statsActuales.posicion === 1
                          ? `de ${statsActuales.totalSesiones} sesiones — ¡la mejor!`
                          : `de ${statsActuales.totalSesiones} sesiones`}
                    </div>
                  </div>
                </Col>
              )}
              {/* Tarjeta 4: récord personal del operador en este evento */}
              {miRankingPersonal.length > 0 && (() => {
                const hoy = miRankingPersonal.find(r => r.fecha === fechaActual)
                if (!hoy || hoy.total === 0) return null
                const esPrimero = hoy.posicion === 1
                const esTop3 = hoy.posicion <= 3
                const mejor = miRankingPersonal[0]
                return (
                  <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
                    <div style={{
                      background: esPrimero
                        ? 'linear-gradient(135deg, #ff7a45 0%, #d4380d 100%)'
                        : esTop3
                          ? 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)'
                          : 'linear-gradient(135deg, #531dab 0%, #391085 100%)',
                      borderRadius: 8, padding: '8px 10px', color: '#fff',
                      boxShadow: esPrimero
                        ? '0 4px 16px rgba(212,56,13,0.45)'
                        : '0 4px 12px rgba(83,29,171,0.3)',
                      transition: 'all 0.4s ease', height: '100%',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                        🏅 Mi récord personal
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                        {hoy.posicion === 1 ? '🥇' : hoy.posicion === 2 ? '🥈' : hoy.posicion === 3 ? '🥉' : `#${hoy.posicion}`}
                      </div>
                      <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                        {`de ${miRankingPersonal.length} ses. · ${hoy.total} QSOs hoy`}
                      </div>
                      {!esPrimero && (
                        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75, fontWeight: 500 }}>
                          {`Récord: ${dayjs(mejor.fecha).format('DD/MM/YY')} · ${mejor.total} QSOs`}
                        </div>
                      )}
                    </div>
                  </Col>
                )
              })()}
              {/* Tarjeta 5: ranking de operadores en esta fecha+evento */}
              {rankingOpSesion.length > 0 && (() => {
                const miOp = rankingOpSesion.find(r => r.usuario_id === user?.id)
                const totalOps = rankingOpSesion.length + (miOp ? 0 : 1)
                const posicion = miOp?.posicion ?? totalOps
                const total = miOp?.total ?? 0
                const esPrimero = posicion === 1
                const esTop3 = posicion <= 3
                return (
                  <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
                    <div style={{
                      background: esPrimero
                        ? 'linear-gradient(135deg, #096dd9 0%, #0050b3 100%)'
                        : esTop3
                          ? 'linear-gradient(135deg, #13c2c2 0%, #006d75 100%)'
                          : 'linear-gradient(135deg, #434343 0%, #262626 100%)',
                      borderRadius: 8, padding: '8px 10px', color: '#fff',
                      boxShadow: esPrimero
                        ? '0 4px 16px rgba(9,109,217,0.45)'
                        : '0 4px 12px rgba(0,0,0,0.25)',
                      transition: 'all 0.4s ease', height: '100%',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                        👥 Ops en esta fecha
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                        {posicion === 1 ? '🥇' : posicion === 2 ? '🥈' : posicion === 3 ? '🥉' : `#${posicion}`}
                      </div>
                      <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                        {`de ${totalOps} ops · ${total} QSOs hoy`}
                      </div>
                    </div>
                  </Col>
                )
              })()}
              {/* Tarjeta 6: ranking histórico de operadores del evento */}
              {rankingOpHistorico.length > 0 && (() => {
                const miOp = rankingOpHistorico.find(r => r.usuario_id === user?.id)
                if (!miOp) return null
                const esPrimero = miOp.posicion === 1
                const esTop3 = miOp.posicion <= 3
                return (
                  <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
                    <div style={{
                      background: esPrimero
                        ? 'linear-gradient(135deg, #389e0d 0%, #237804 100%)'
                        : esTop3
                          ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                          : 'linear-gradient(135deg, #595959 0%, #3d3d3d 100%)',
                      borderRadius: 8, padding: '8px 10px', color: '#fff',
                      boxShadow: esPrimero
                        ? '0 4px 16px rgba(56,158,13,0.45)'
                        : '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'all 0.4s ease', height: '100%',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                        📈 Ranking histórico ops
                      </div>
                      <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                        {miOp.posicion === 1 ? '🥇' : miOp.posicion === 2 ? '🥈' : miOp.posicion === 3 ? '🥉' : `#${miOp.posicion}`}
                      </div>
                      <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                        {`de ${rankingOpHistorico.length} ops · ${miOp.total} QSOs totales`}
                      </div>
                    </div>
                  </Col>
                )
              })()}
            </Row>
          )}

          {resumenSelectedKeys.length > 0 && (
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#1A569E', fontWeight: 600 }}>{resumenSelectedKeys.length} seleccionado(s)</span>
              <Popconfirm
                title={`¿Eliminar ${resumenSelectedKeys.length} reporte(s)?`}
                okText="Sí, eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }}
                onConfirm={handleDeleteResumenSelected}
              >
                <Button size="small" danger icon={<DeleteOutlined />} loading={deletingResumen}>
                  Eliminar seleccionados
                </Button>
              </Popconfirm>
              <Button size="small" onClick={() => setResumenSelectedKeys([])}>Deseleccionar</Button>
            </div>
          )}
          {(() => {
            const resColDefs: Record<ResumenColKey, object> = {
              indicativo: {
                title: 'Indicativo', dataIndex: 'indicativo', width: 120, fixed: 'left' as const,
                render: (v: string) => (
                  <Tooltip title="Editar operador">
                    <Button type="link" size="small" icon={<UserOutlined />}
                      style={{ fontWeight: 700, color: '#1A569E', padding: 0 }}
                      onClick={() => handleOpenEditOp(v)}>
                      {v}
                    </Button>
                  </Tooltip>
                ),
              },
              operador: { title: 'Operador', dataIndex: 'operador', width: 160, ellipsis: true,
                render: (v: string) => v || <Text type="secondary">—</Text> },
              ciudad: { title: 'Ciudad', dataIndex: 'ciudad', width: 120, ellipsis: true,
                render: (v: string) => v || <Text type="secondary">—</Text> },
              estado: { title: 'Estado', dataIndex: 'estado', width: 120, ellipsis: true,
                render: (v: string) => v || <Text type="secondary">—</Text> },
              zona: {
                title: 'Zona', dataIndex: 'zona', width: 80,
                render: (_: unknown, record: Reporte) => {
                  const codigo = record.zona?.codigo
                  const color = zonaColor(codigo ?? '')
                  return codigo
                    ? <Tag style={{ backgroundColor: color, borderColor: color, color: '#fff', fontWeight: 700 }}>{codigo}</Tag>
                    : <Text type="secondary">—</Text>
                },
              },
              sistema: {
                title: 'Sistema', dataIndex: 'sistema', width: 85,
                render: (_: unknown, record: Reporte) => {
                  if (!record.sistema) return <Text type="secondary">—</Text>
                  const c = record.sistema.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{record.sistema.codigo}</Tag>
                },
              },
              senal: { title: 'RST', dataIndex: 'senal', width: 55, align: 'center' as const,
                render: (v: number) => <strong>{v}</strong> },
              capturado_por_nombre: {
                title: 'Capturado por', dataIndex: 'capturado_por_nombre', width: 130,
                render: (v: string) => v ? <Tag color="geekblue">👤 {v}</Tag> : <Text type="secondary">—</Text>,
              },
              created_at: {
                title: 'Hora', dataIndex: 'created_at', width: 70, align: 'center' as const,
                render: (v: string) => <Text style={{ fontSize: 11 }}>{dayjs(v).format('HH:mm')}</Text>,
              },
            }
            const resActionCol = {
              title: '', width: 70, fixed: 'right' as const,
              render: (_: unknown, record: Reporte) => (
                <Space size={4}>
                  <Tooltip title="Editar reporte">
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEditReporte(record)} />
                  </Tooltip>
                  <Popconfirm
                    title="¿Eliminar este reporte?" okText="Sí" cancelText="No"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDeleteResumenOne(record.id)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            }
            const resColumns = [
              ...resColOrder.filter(k => resColVisible.includes(k)).map(k => resColDefs[k]),
              resActionCol,
            ]
            return (
              <Table<Reporte>
                dataSource={resumen}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20, showTotal: t => `${t} registros`, size: 'small' }}
                loading={loadingResumen}
                scroll={{ x: 'max-content' }}
                rowSelection={{
                  selectedRowKeys: resumenSelectedKeys,
                  onChange: keys => setResumenSelectedKeys(keys as number[]),
                  selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
                }}
                columns={resColumns as any}
              />
            )
          })()}
        </Card>
      )}

      {/* Modal: editar reporte */}
      <Modal
        title={<><EditOutlined style={{ marginRight: 8 }} />Editar Reporte — {editReporteRecord?.indicativo}</>}
        open={editReporteModal}
        onOk={handleSaveReporte}
        onCancel={() => setEditReporteModal(false)}
        okText="Guardar" cancelText="Cancelar"
        confirmLoading={savingReporte}
        width={480}
      >
        <Form form={editReporteForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Indicativo" name="indicativo">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Operador" name="operador">
                <Input placeholder="Nombre del operador" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ciudad" name="ciudad">
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
              <Form.Item label="Zona" name="zona_id">
                <Select placeholder="Zona" allowClear
                  labelRender={({ value }) => {
                    const z = zonas.find(z => z.id === value)
                    if (!z) return <span>{String(value)}</span>
                    const c = z.color ?? '#1677ff'
                    return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{z.codigo}</Tag>
                  }}
                  options={zonas.map(z => {
                    const c = z.color ?? '#1677ff'
                    return {
                      value: z.id,
                      label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{z.codigo}</Tag>,
                    }
                  })} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Sistema" name="sistema_id">
                <Select placeholder="Sistema" allowClear
                  labelRender={({ value }) => {
                    const s = sistemas.find(s => s.id === value)
                    if (!s) return <span>{String(value)}</span>
                    const c = s.color ?? '#1677ff'
                    return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>
                  }}
                  options={sistemas.map(s => {
                    const c = s.color ?? '#1677ff'
                    return {
                      value: s.id,
                      label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>,
                    }
                  })} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="RST" name="senal">
                <Input style={{ width: 80, textAlign: 'center', fontWeight: 700 }} maxLength={3} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Observaciones" name="observaciones">
                <Input.TextArea rows={2} placeholder="Observaciones" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal: editar operador (click en indicativo) */}
      <Modal
        title={<><UserOutlined style={{ marginRight: 8 }} />Editar Radioexperimentador — {editOpIndicativo}</>}
        open={editOpModal}
        onOk={handleSaveOp}
        onCancel={() => setEditOpModal(false)}
        okText="Guardar" cancelText="Cancelar"
        confirmLoading={savingOp}
        width={560}
      >
        <Spin spinning={loadingOp}>
          <Form form={editOpForm} layout="vertical" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Indicativo" name="indicativo">
                  <Input disabled style={{ fontWeight: 700, color: '#1A569E' }} />
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
        </Spin>
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
          {/* Cabecera con gradiente */}
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

          {/* Fecha intentada */}
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

          {/* Días de la semana */}
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
                    transition: 'all 0.2s',
                  }}>
                    {esConfig && '✓ '}{esIntentado && !esConfig && '✗ '}{nombre.slice(0, 3)}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Aviso administrador */}
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

          {/* Footer */}
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
