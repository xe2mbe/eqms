import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Card, Form, Select, Button, Table,
  Typography, Space, Divider, Input, message, Tooltip, notification,
  Row, Col, Badge, Popconfirm, Alert, Tag,
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import {
  SaveOutlined, DeleteOutlined, PlusOutlined,
  CheckCircleOutlined, WarningOutlined,
  SettingOutlined,
  EditOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { reportesApi } from '@/api/reportes'
import { estadisticasApi } from '@/api/estadisticas'
import { catalogosApi } from '@/api/catalogos'
import { operadoresApi, type Operador } from '@/api/operadores'
import { libretaApi, type CheckIndicativoResult } from '@/api/libreta'
import { useAuthStore } from '@/store/authStore'
import { useColPrefs } from '@/components/common/ColSettings'
import type { Evento, Sistema, Estacion, Estado, Zona, Reporte } from '@/types'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { useZonaHelpers } from '@/hooks/useZonaHelpers'
import { useVerificarDiaEvento, useOcurrenciaEvento } from '@/hooks/useEventoRecurrente'
import SystemStatusWidget from '@/components/common/SystemStatusWidget'
import { validarIndicativo, normalizarRST, validarRST, NOMBRES_DIA, deriveZonaFromEstado } from '@/utils/libretaShared'
import IndicativoCell from '@/components/libreta/IndicativoCell'
import FechaNoPermitidaModal from '@/components/libreta/FechaNoPermitidaModal'
import StatsCardsRow from '@/components/libreta/StatsCardsRow'
import RoipStatusWidgets from '@/components/libreta/RoipStatusWidgets'
import { useRoipMonitor } from '@/hooks/useRoipMonitor'
import EditarReporteModal from '@/components/libreta/EditarReporteModal'
import EditarOperadorModal from '@/components/libreta/EditarOperadorModal'
import PrimeraVezModal from '@/components/libreta/PrimeraVezModal'
import ReaparicionModal from '@/components/libreta/ReaparicionModal'
import ConfiguracionSesionCard from '@/components/libreta/ConfiguracionSesionCard'
import SeleccionFechaModal from '@/components/libreta/SeleccionFechaModal'
import AdvertenciaFechaModal from '@/components/libreta/AdvertenciaFechaModal'

const { Title, Text } = Typography

function esSWL(ind: string): boolean {
  return ind.trim().toUpperCase() === 'SWL'
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

  const { zonaColor, zonaExtranjero } = useZonaHelpers(zonas)

  const [sesionActiva, setSesionActiva] = useState(false)
  const [considerarSwl, setConsiderarSwl] = useState(false)
  const [configVisible, setConfigVisible] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  const [anunciarPrimeraVez, setAnunciarPrimeraVez] = useState(false)
  const [anunciarReaparicion, setAnunciarReaparicion] = useState(false)
  const [zonaSwlDefault, setZonaSwlDefault] = useState<string | undefined>()

  const roip = useRoipMonitor()

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
  const ocurrenciaEvento = useOcurrenciaEvento(sesionConfig?.fecha, sesionConfig?.tipo_evento, eventos)

  // ── Validación día de evento recurrente ──────────────────────────────────
  const verificarDiaEvento = useVerificarDiaEvento(eventos, setDiaEventoModal)

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
          roip.hydrateFromConfig(cfg)
        }
      }).finally(() => setLoadingConfig(false))
    })
  }, [])

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
      if (estadoVal) zona = deriveZonaFromEstado(estadoVal, estados, zonas) ?? zona
    } else if (zonaEsNacional && estadoVal) {
      zona = deriveZonaFromEstado(estadoVal, estados, zonas) ?? zona
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
    if ((zonaEsNacional || swl) && estadoVal) zona = deriveZonaFromEstado(estadoVal, estados, zonas) ?? zona

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
            const zonaCodigo = deriveZonaFromEstado(val, estados, zonas)
            if (zonaCodigo) actualizarFila(row.key, 'zona', zonaCodigo)
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

      <SeleccionFechaModal
        open={dateModalOpen} loading={loadingConfig} fecha={fechaSeleccionada}
        onFechaChange={v => {
          setFechaSeleccionada(v)
          const tipoEvento = sesionForm.getFieldValue('tipo_evento') as string | undefined
          if (tipoEvento) verificarDiaEvento(v, tipoEvento)
        }}
        onConfirm={handleDateConfirm} onCancel={() => setDateModalOpen(false)}
      />

      <AdvertenciaFechaModal
        open={warnModalOpen} fecha={fechaSeleccionada}
        onConfigurar={handleIrAConfig} onCapturar={handleCapturaDirecta}
      />

      <PrimeraVezModal
        open={primeraVezModal} indicativo={primeraVezIndicativo} form={nuevoHamForm} saving={guardandoHam}
        estados={estados} onGuardar={handleGuardarNuevoHam} onOmitir={handleOmitirNuevoHam}
      />

      <ReaparicionModal
        open={reaparicionModal} indicativo={reaparicionIndicativo} info={reaparicionInfo}
        onContinuar={handleContinuarReaparicion}
      />

      {/* Configuración de sesión */}
      {(!sesionActiva || configVisible) && (
        <ConfiguracionSesionCard
          form={sesionForm} sesionActiva={sesionActiva}
          eventos={eventos} estaciones={estaciones} sistemas={sistemas} estados={estados}
          inputRst={inputRst} onInputRstChange={setInputRst}
          considerarSwl={considerarSwl} onConsiderarSwlChange={setConsiderarSwl}
          anunciarPrimeraVez={anunciarPrimeraVez} onAnunciarPrimeraVezChange={setAnunciarPrimeraVez}
          anunciarReaparicion={anunciarReaparicion} onAnunciarReaparicionChange={setAnunciarReaparicion}
          roip={roip} onIniciar={iniciarSesion}
          onNueva={() => {
            setSesionActiva(false); setSesionConfig(null)
            setFilas([]); setConsiderarSwl(false); setConfigVisible(true)
          }}
        />
      )}

      {/* Widgets RoIP */}
      {roip.roipMonitorando && <RoipStatusWidgets roip={roip} />}

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
          <StatsCardsRow
            totalQSOs={statsActuales.totalQSOs}
            estacionesUnicas={statsActuales.estacionesUnicas}
            posicion={statsActuales.posicion}
            totalSesiones={statsActuales.totalSesiones}
            esRecordQSOs={statsActuales.esRecordQSOs}
            esRecordEstaciones={statsActuales.esRecordEstaciones}
            totalSesionesHistoricas={rankingEvento.length}
            miRecordPersonal={(() => {
              const hoy = miRankingPersonal.find(r => r.fecha === fechaActual)
              if (!hoy || hoy.total === 0) return undefined
              const mejor = miRankingPersonal[0]
              return {
                posicion: hoy.posicion,
                totalSesiones: miRankingPersonal.length,
                totalHoy: hoy.total,
                esPrimero: hoy.posicion === 1,
                mejorFecha: dayjs(mejor.fecha).format('DD/MM/YY'),
                mejorTotal: mejor.total,
              }
            })()}
            opsEnFecha={(() => {
              if (rankingOpSesion.length === 0) return undefined
              const miOp = rankingOpSesion.find(r => r.usuario_id === user?.id)
              const totalOps = rankingOpSesion.length + (miOp ? 0 : 1)
              return {
                posicion: miOp?.posicion ?? totalOps,
                totalOps,
                totalHoy: miOp?.total ?? 0,
              }
            })()}
            rankingHistorico={(() => {
              const miOp = rankingOpHistorico.find(r => r.usuario_id === user?.id)
              if (!miOp) return undefined
              return {
                posicion: miOp.posicion,
                totalOps: rankingOpHistorico.length,
                totalGeneral: miOp.total,
              }
            })()}
          />

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

      <EditarReporteModal
        open={editReporteModal} record={editReporteRecord} form={editReporteForm} saving={savingReporte}
        estados={estados} zonas={zonas} sistemas={sistemas}
        onSave={handleSaveReporte} onCancel={() => setEditReporteModal(false)}
      />

      <EditarOperadorModal
        open={editOpModal} indicativo={editOpIndicativo} form={editOpForm} saving={savingOp} loading={loadingOp}
        estados={estados} paises={paises}
        onSave={handleSaveOp} onCancel={() => setEditOpModal(false)}
      />

      <FechaNoPermitidaModal diaEventoModal={diaEventoModal} onClose={() => setDiaEventoModal(null)} />
    </div>
  )
}
