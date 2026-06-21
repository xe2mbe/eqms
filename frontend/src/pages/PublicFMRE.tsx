import { useEffect, useState, useRef, useCallback } from 'react'
import { Row, Col, Card, Tag, Typography, Divider, Spin, Input, Alert, Table, Popover } from 'antd'
import {
  WifiOutlined, GlobalOutlined, TeamOutlined, RiseOutlined,
  StarOutlined, RadarChartOutlined, SearchOutlined, UserOutlined, RightOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

dayjs.locale('es')

const { Title, Text, Paragraph } = Typography

const FMRE_BLUE   = '#1A569E'
const FMRE_DARK   = '#0D2E5F'
const FMRE_LIGHT  = '#E8F0FA'
const FMRE_GOLD   = '#D4A017'

const SISTEMA_COLORS: Record<string, string> = {
  HF: '#1A569E', ASL: '#52c41a', IRLP: '#fa8c16',
  DMR: '#7c3aed', FUSION: '#eb2f96', DSTAR: '#13c2c2',
  P25: '#f5222d', M17: '#fadb14', ECHOLINK: '#a0d911',
}

const PLAT_COLORS: Record<string, string> = {
  Facebook: '#1877F2', 'Facebook - Radioaficionados XE': '#4267B2',
  Zello: '#FF6B00', Instagram: '#E1306C', Telegram: '#0088CC',
  YouTube: '#FF0000', 'Twitter / X': '#1DA1F2',
}

// ─── System logo SVGs ───────────────────────────────────────────────────────


// ─── SVG decorations ────────────────────────────────────────────────────────

const RadioWavesBg = () => (
  <svg width="420" height="420" viewBox="0 0 420 420" fill="none" style={{ opacity: 0.09 }}>
    <defs>
      <clipPath id="rwclip">
        <rect width="420" height="420" />
      </clipPath>
    </defs>
    <g clipPath="url(#rwclip)">
      {[48, 88, 130, 172, 214, 256, 298, 340, 382].map((r, i) => (
        <circle key={i} cx="420" cy="210" r={r} stroke="white" strokeWidth="1.6" fill="none" />
      ))}
      <circle cx="420" cy="210" r="8" fill="white" opacity="0.5" />
      <circle cx="420" cy="210" r="3" fill="white" />
    </g>
  </svg>
)

const MORSE = '-.-. --.-   -.. .   -..- . .---- .-.. --'

// ─── Contador animado ────────────────────────────────────────────────────────

function AnimatedCount({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    let start: number | null = null
    const duration = 1200
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return <span>{val.toLocaleString()}{suffix}</span>
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Stats = {
  rf: {
    total: number; indicativos: number
    por_estado: { estado: string; total: number }[]
    por_sistema: { sistema: string; nombre: string; total: number }[]
    tendencia: { mes: string; sistema: string; total: number }[]
    top_indicativos: { indicativo: string; nombre: string | null; total: number }[]
    paises: { pais: string; indicativos: number }[]
  }
  rs: {
    total: number; indicativos: number
    por_plataforma: { plataforma: string; total: number }[]
    tendencia: { mes: string; plataforma: string; total: number }[]
    por_estado: { estado: string; total: number }[]
    top_indicativos: { indicativo: string; nombre: string | null; total: number }[]
  }
  ultimo_evento_rf: { tipo: string; ultima: string; estaciones: number; total_qsos: number } | null
  ultimo_evento_rs: { tipo: string; ultima: string; estaciones: number; total_qsos: number } | null
}

type EstacionItem = { indicativo: string; nombre: string | null; total: number; ultima: string | null }
type UltimoEvDetalle   = { evento: string | null; fecha: string | null; participantes: { indicativo: string; nombre: string | null; total: number; sistemas: Record<string, number>; estado: string | null }[] }
type UltimoEvRSDetalle = { evento: string | null; fecha: string | null; participantes: { indicativo: string; nombre: string | null; total: number; plataformas: Record<string, number>; estado: string | null }[] }

type BusquedaResult = {
  indicativo: string
  operador: { nombre: string | null; municipio: string | null; estado: string | null; licencia: string | null } | null
  rf: {
    total: number; primera: string | null; ultima: string | null
    por_evento: { evento: string; total: number }[]
    por_sistema: { sistema: string; total: number }[]
    ultimos: { fecha: string | null; evento: string | null; sistema: string | null; zona: string | null; ciudad: string | null; estado: string | null; senal: number | null }[]
  }
  rs: {
    total: number; primera: string | null; ultima: string | null
    por_plataforma: { plataforma: string; total: number }[]
    ultimos: { fecha: string | null; plataforma: string | null; ciudad: string | null; estado: string | null; senal: number | null }[]
  }
}

// ─── Próximo Boletín Dominical ────────────────────────────────────────────────
const MX_OFFSET = -6 * 60 * 60 * 1000 // Mexico City = UTC-6 (sin horario de verano desde 2023)

function getNextBoletinInfo() {
  const now = new Date()
  const mx = new Date(now.getTime() + MX_OFFSET)
  const dow = mx.getUTCDay()
  const minuteOfDay = mx.getUTCHours() * 60 + mx.getUTCMinutes()
  const isLive         = dow === 0 && minuteOfDay >= 9 * 60     && minuteOfDay < 10 * 60
  const isBoletinWindow = dow === 0 && minuteOfDay >= 8 * 60 + 30 && minuteOfDay < 10 * 60 + 30

  const targetMx = new Date(mx)
  targetMx.setUTCHours(9, 0, 0, 0)
  if (dow !== 0 || minuteOfDay >= 10 * 60)
    targetMx.setUTCDate(targetMx.getUTCDate() + (dow === 0 ? 7 : 7 - dow))

  const year = targetMx.getUTCFullYear()
  const jan1dow = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  const firstSunday = new Date(Date.UTC(year, 0, 1 + (7 - jan1dow) % 7))
  const boletinNum = Math.round((targetMx.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  const diff = Math.max(0, targetMx.getTime() - MX_OFFSET - now.getTime())
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    isLive, isBoletinWindow, boletinNum, year,
  }
}

function getBoletinNumForDate(dateStr: string): number {
  const utc = new Date(dateStr)
  const mx = new Date(utc.getTime() + MX_OFFSET)
  const year = mx.getUTCFullYear()
  const eventDay = new Date(Date.UTC(year, mx.getUTCMonth(), mx.getUTCDate()))
  const jan1dow = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  const firstSunday = new Date(Date.UTC(year, 0, 1 + (7 - jan1dow) % 7))
  return Math.round((eventDay.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
}

export default function PublicFMREPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [boletinInfo, setBoletinInfo] = useState(getNextBoletinInfo)
  const voipStatusRef = useRef<HTMLDivElement>(null)
  const [voipStatusVisible, setVoipStatusVisible] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<{
    online: boolean; on_air: boolean; cos_keyed: boolean; tx_keyed: boolean; connections: number;
    nodes: { node: string; name: string; url: string | null; keyed: boolean; direction: string }[]
  } | null>(null)
  const [irlpStatus, setIrlpStatus] = useState<{
    online: boolean; on_air: boolean; cos: boolean; ptt: boolean; connections: number;
    nodes: { node: string; name: string; url: string; warning?: boolean }[]
  } | null>(null)
  const [dmrStatus, setDmrStatus] = useState<{
    connected: boolean; active: boolean; callsign: string; tg: number; tgName: string;
  }>({ connected: false, active: false, callsign: '', tg: 0, tgName: '' })
  const dmrSocketRef = useRef<Socket | null>(null)

  // Búsqueda por indicativo
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<BusquedaResult | null>(null)
  const [busqError, setBusqError] = useState<string | null>(null)
  const busquedaRef = useRef<HTMLDivElement>(null)
  const rfRef       = useRef<HTMLDivElement>(null)
  const rsRef       = useRef<HTMLDivElement>(null)
  const estRFRef    = useRef<HTMLDivElement>(null)
  const estRSRef    = useRef<HTMLDivElement>(null)
  const evRef       = useRef<HTMLDivElement>(null)
  const evRSRef     = useRef<HTMLDivElement>(null)
  const estIntlRef  = useRef<HTMLDivElement>(null)

  const [estacionesRF, setEstacionesRF]           = useState<EstacionItem[] | null>(null)
  const [estacionesRS, setEstacionesRS]           = useState<EstacionItem[] | null>(null)
  const [ultimoEvDetalle, setUltimoEvDetalle]     = useState<UltimoEvDetalle | null>(null)
  const [ultimoEvRSDetalle, setUltimoEvRSDetalle] = useState<UltimoEvRSDetalle | null>(null)
  const [estacionesIntl, setEstacionesIntl]       = useState<{ indicativo: string; nombre: string | null; pais: string; total: number; ultima: string | null }[] | null>(null)
  const [loadingEstRF, setLoadingEstRF]           = useState(false)
  const [loadingEstRS, setLoadingEstRS]           = useState(false)
  const [loadingEv, setLoadingEv]                 = useState(false)
  const [loadingEstIntl, setLoadingEstIntl]       = useState(false)
  const [visitaInfo, setVisitaInfo]               = useState<{ ip: string; pais: string; pais_codigo: string; total: number } | null>(null)
  const [loadingEvRS, setLoadingEvRS]             = useState(false)

  const handleCardClick = async (label: string) => {
    if (label === 'Reportes RF') {
      rfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (label === 'Reportes RS') {
      rsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (label === 'Estaciones RF') {
      if (!estacionesRF) {
        setLoadingEstRF(true)
        const { data } = await axios.get('/api/public/estaciones-rf')
        setEstacionesRF(data)
        setLoadingEstRF(false)
      }
      setTimeout(() => estRFRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    } else {
      if (!estacionesRS) {
        setLoadingEstRS(true)
        const { data } = await axios.get('/api/public/estaciones-rs')
        setEstacionesRS(data)
        setLoadingEstRS(false)
      }
      setTimeout(() => estRSRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }

  const handleUltimoEvento = async () => {
    if (!ultimoEvDetalle) {
      setLoadingEv(true)
      const { data } = await axios.get('/api/public/ultimo-evento-participantes')
      setUltimoEvDetalle(data)
      setLoadingEv(false)
    }
    setTimeout(() => evRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  const handleUltimoEventoRS = async () => {
    if (!ultimoEvRSDetalle) {
      setLoadingEvRS(true)
      const { data } = await axios.get('/api/public/ultimo-evento-rs-participantes')
      setUltimoEvRSDetalle(data)
      setLoadingEvRS(false)
    }
    setTimeout(() => evRSRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  const handleEstIntl = async () => {
    if (!estacionesIntl) {
      setLoadingEstIntl(true)
      const { data } = await axios.get('/api/public/estaciones-internacionales')
      setEstacionesIntl(data)
      setLoadingEstIntl(false)
    }
    setTimeout(() => estIntlRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }

  const handleBuscar = async () => {
    if (!busqueda.trim()) return
    setBuscando(true)
    setBusqError(null)
    setResultado(null)
    try {
      const { data } = await axios.get(`/api/public/buscar?indicativo=${busqueda.trim().toUpperCase()}`)
      setResultado(data)
      setTimeout(() => busquedaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: any) {
      setBusqError(e?.response?.data?.detail ?? `No se encontraron registros para ${busqueda.trim().toUpperCase()}`)
      setTimeout(() => busquedaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } finally {
      setBuscando(false)
    }
  }

  const buscarIndicativo = async (ind: string) => {
    setBusqueda(ind)
    setBuscando(true)
    setBusqError(null)
    setResultado(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const { data } = await axios.get(`/api/public/buscar?indicativo=${ind.toUpperCase()}`)
      setResultado(data)
      setTimeout(() => busquedaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } catch (e: any) {
      setBusqError(e?.response?.data?.detail ?? `No se encontraron registros para ${ind.toUpperCase()}`)
      setTimeout(() => busquedaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } finally {
      setBuscando(false)
    }
  }

  const callSign = (v: string, color = FMRE_BLUE) => (
    <strong
      style={{ color, cursor: 'pointer', textDecoration: 'none' }}
      onClick={() => buscarIndicativo(v)}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      title={`Ver historial de ${v}`}
    >
      {v}
    </strong>
  )

  const fetchStats = useCallback(() => {
    axios.get('/api/public/stats').then(r => {
      setStats(r.data)
      setLastUpdated(new Date())
    }).catch(() => {})
  }, [])

  useEffect(() => {
    // Cargar el mapa de México
    fetch('/mexico-states.json')
      .then(r => r.json())
      .then(geo => {
        echarts.registerMap('Mexico', geo)
        setMapReady(true)
      })

    // Cargar estadísticas y refrescar cada 60 s
    fetchStats()
    const interval = setInterval(fetchStats, 60_000)

    // Contador de visitas — solo una vez por sesión
    const cached = sessionStorage.getItem('visitaInfo')
    if (cached) {
      setVisitaInfo(JSON.parse(cached))
    } else {
      axios.post('/api/public/visita').then(r => {
        setVisitaInfo(r.data)
        sessionStorage.setItem('visitaInfo', JSON.stringify(r.data))
      }).catch(() => {})
    }

    return () => clearInterval(interval)
  }, [fetchStats])

  useEffect(() => {
    const t = setInterval(() => setBoletinInfo(getNextBoletinInfo()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const fetchNode = () =>
      axios.get('/api/public/node-status')
        .then(r => setNodeStatus(r.data))
        .catch(() => {})
    fetchNode()
    const t = setInterval(fetchNode, 5_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const fetchIrlp = () =>
      axios.get('/api/public/irlp-status')
        .then(r => setIrlpStatus(r.data))
        .catch(() => {})
    fetchIrlp()
    const t = setInterval(fetchIrlp, 5_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const socket = io('https://api.brandmeister.network', {
      path: '/lh/socket.io',
      transports: ['websocket'],
      reconnectionDelay: 5000,
    })
    socket.on('connect', () => {
      setDmrStatus(d => ({ ...d, connected: true }))
      axios.get('/api/public/node-config').then(r => {
        const raw: string = r.data?.bm_tgs ?? '33450,334'
        raw.split(',').map(s => s.trim()).filter(Boolean)
          .forEach(tg => socket.emit('subscribe', `dst_${tg}`))
      }).catch(() => {
        ['33450', '334'].forEach(tg => socket.emit('subscribe', `dst_${tg}`))
      })
    })
    socket.on('disconnect', () => {
      setDmrStatus(d => ({ ...d, connected: false, active: false }))
    })
    socket.on('mqtt', (p: { DestinationID: number; DestinationName: string; SourceCall: string; Stop: number }) => {
      if (p.Stop === 0) {
        setDmrStatus(d => ({ ...d, active: true, callsign: p.SourceCall, tg: p.DestinationID, tgName: p.DestinationName }))
      } else {
        setDmrStatus(d => ({ ...d, active: false }))
      }
    })
    dmrSocketRef.current = socket
    return () => { socket.disconnect() }
  }, [])

  const tendenciaOption = !stats ? {} : (() => {
    const meses = [...new Set(stats.rf.tendencia.map(t => t.mes))].sort()
    const sistemas = [...new Set(stats.rf.tendencia.map(t => t.sistema))].sort()
    const totales = meses.map(mes =>
      sistemas.reduce((sum, sis) => sum + (stats.rf.tendencia.find(t => t.mes === mes && t.sistema === sis)?.total ?? 0), 0)
    )
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: sistemas, top: 4, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 8, right: 8, top: 44, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: meses.map(m => dayjs(m).format('MMM YY')),
        axisLabel: { color: '#666', fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
      series: [
        ...sistemas.map(sis => ({
          name: sis,
          type: 'bar',
          stack: 'total',
          data: meses.map(mes => stats.rf.tendencia.find(t => t.mes === mes && t.sistema === sis)?.total ?? 0),
          itemStyle: { color: SISTEMA_COLORS[sis] ?? '#999' },
        })),
        {
          type: 'bar' as const, stack: 'total', silent: true,
          itemStyle: { color: 'transparent' },
          emphasis: { disabled: true },
          label: {
            show: true, position: 'top' as const,
            formatter: (p: any) => totales[p.dataIndex] > 0 ? totales[p.dataIndex].toLocaleString() : '',
            color: '#444', fontSize: 10, fontWeight: 700,
          },
          data: totales.map(() => 0),
        },
      ],
    }
  })()

  const sistemaOption = !stats ? {} : {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
      data: stats.rf.por_sistema.map(s => ({
        name: s.sistema, value: s.total,
        itemStyle: { color: SISTEMA_COLORS[s.sistema] ?? FMRE_BLUE },
      })),
      label: { show: false },
    }],
  }

  const tendenciaRSOption = !stats ? {} : (() => {
    const meses = [...new Set(stats.rs.tendencia.map(t => t.mes))].sort()
    const plataformas = [...new Set(stats.rs.tendencia.map(t => t.plataforma))].sort()
    const totalesRS = meses.map(mes =>
      plataformas.reduce((sum, plat) => sum + (stats.rs.tendencia.find(t => t.mes === mes && t.plataforma === plat)?.total ?? 0), 0)
    )
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: plataformas, top: 4, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 8, right: 8, top: 44, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: meses.map(m => dayjs(m).format('MMM YY')),
        axisLabel: { color: '#666', fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
      series: [
        ...plataformas.map(plat => ({
          name: plat,
          type: 'bar',
          stack: 'total',
          data: meses.map(mes => stats.rs.tendencia.find(t => t.mes === mes && t.plataforma === plat)?.total ?? 0),
          itemStyle: { color: PLAT_COLORS[plat] ?? '#999' },
        })),
        {
          type: 'bar' as const, stack: 'total', silent: true,
          itemStyle: { color: 'transparent' },
          emphasis: { disabled: true },
          label: {
            show: true, position: 'top' as const,
            formatter: (p: any) => totalesRS[p.dataIndex] > 0 ? totalesRS[p.dataIndex].toLocaleString() : '',
            color: '#444', fontSize: 10, fontWeight: 700,
          },
          data: totalesRS.map(() => 0),
        },
      ],
    }
  })()

  const plataformaPieOption = !stats ? {} : {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
      data: stats.rs.por_plataforma.map(p => ({
        name: p.plataforma, value: p.total,
        itemStyle: { color: PLAT_COLORS[p.plataforma] ?? '#0891b2' },
      })),
      label: { show: false },
    }],
  }

  const mapaRSOption = !stats || !mapReady ? {} : (() => {
    const total = stats.rs.por_estado.reduce((s, e) => s + e.total, 0)
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => p.value
          ? `<b>${p.name}</b><br/>${p.value.toLocaleString()} reportes<br/><span style="color:#888">${(p.value / total * 100).toFixed(1)}% del total</span>`
          : p.name,
      },
      visualMap: {
        min: 0, max: Math.max(...stats.rs.por_estado.map(e => e.total), 1),
        inRange: { color: ['#e0f7fa', '#0891b2'] },
        show: false,
      },
      series: [{
        type: 'map', map: 'Mexico', roam: false,
        emphasis: { label: { show: true }, itemStyle: { areaColor: FMRE_GOLD } },
        data: stats.rs.por_estado.map(e => ({ name: e.estado, value: e.total })),
        nameMap: {
          'Baja California': 'Baja California',
          'Baja California Sur': 'Baja California Sur',
          'Ciudad de México': 'Ciudad De México',
          'Estado De México': 'México',
        },
      }],
    }
  })()

  const mapaOption = !stats || !mapReady ? {} : (() => {
    const total = stats.rf.por_estado.reduce((s, e) => s + e.total, 0)
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => p.value
          ? `<b>${p.name}</b><br/>${p.value.toLocaleString()} reportes<br/><span style="color:#888">${(p.value / total * 100).toFixed(1)}% del total</span>`
          : p.name,
      },
      visualMap: {
        min: 0, max: Math.max(...stats.rf.por_estado.map(e => e.total), 1),
        inRange: { color: [FMRE_LIGHT, FMRE_BLUE] },
        show: false,
      },
      series: [{
        type: 'map', map: 'Mexico', roam: false,
        emphasis: { label: { show: true }, itemStyle: { areaColor: FMRE_GOLD } },
        data: stats.rf.por_estado.map(e => ({ name: e.estado, value: e.total })),
        nameMap: {
          'Baja California': 'Baja California',
          'Baja California Sur': 'Baja California Sur',
          'Ciudad de México': 'Ciudad De México',
          'Estado De México': 'México',
        },
      }],
    }
  })()

  const countryFlag = (code: string) => {
    if (!code || code.length !== 2) return '🌐'
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
  }

  const isLoading = !stats

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f5f7fa', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 2px rgba(82,196,26,.3)} 50%{box-shadow:0 0 0 5px rgba(82,196,26,0)} }
        @keyframes pulse-red { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.75;transform:scale(1.04)} }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: FMRE_DARK, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <a href="https://fmre.mx" target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 20, textDecoration: 'none' }}>
          <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 72 }} />
          <div style={{ color: 'white', fontWeight: 500, fontSize: 'clamp(20px, 3vw, 40px)', lineHeight: 1.2, letterSpacing: 0.2, textAlign: 'center' }}>
            Federación Mexicana de Radioexperimentadores, A.C.
          </div>
        </a>
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: `linear-gradient(135deg, ${FMRE_DARK} 0%, ${FMRE_BLUE} 100%)`,
        padding: '48px 32px', position: 'relative', overflow: 'hidden',
      }}>
        {/* decoraciones */}
        <div style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <RadioWavesBg />
        </div>
        <div style={{ position: 'absolute', top: '50%', left: -60, transform: 'translateY(-50%) scaleX(-1)', pointerEvents: 'none', opacity: 0.5 }}>
          <RadioWavesBg />
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, overflow: 'hidden', pointerEvents: 'none', lineHeight: 1 }}>
          <div style={{ color: 'white', opacity: 0.08, fontSize: 16, letterSpacing: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', padding: '5px 0' }}>
            {`${MORSE}          `.repeat(7)}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', pointerEvents: 'none', lineHeight: 1 }}>
          <div style={{ color: 'white', opacity: 0.05, fontSize: 16, letterSpacing: 10, fontFamily: 'monospace', whiteSpace: 'nowrap', padding: '5px 0' }}>
            {`${MORSE}          `.repeat(7)}
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ color: FMRE_GOLD, fontWeight: 700, letterSpacing: 3, fontSize: 12, marginBottom: 8 }}>
            ▶ CQ CQ DE XE1LM — ESTACIÓN OFICIAL DE LA FMRE
          </div>
          <Title level={1} style={{ color: 'white', margin: 0, fontSize: 'clamp(24px, 4vw, 42px)', lineHeight: 1.2 }}>
            Estadísticas Boletín Dominical
          </Title>
          <Paragraph style={{ color: '#8ab4e0', fontSize: 16, marginTop: 12, marginBottom: 16, maxWidth: 600 }}>
            Estadísticas en tiempo real de la actividad del Boletín Dominical,
            medio oficial de divulgación de la máxima autoridad de radioafición en México.
          </Paragraph>
          {/* Countdown + estado nodo */}
          <div style={{ marginBottom: 28 }}>

            {/* Fila superior: badge EN VIVO o label próximo boletín */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              {boletinInfo.isLive
                ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, padding: '6px 20px', borderRadius: 24, fontSize: 14, letterSpacing: 1, animation: 'pulse-red 1.2s ease-in-out infinite', display: 'inline-block' }}>
                    🔴 EN VIVO
                  </span>
                : <span style={{ color: FMRE_GOLD, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
                    PRÓXIMO BOLETÍN
                  </span>
              }
              <span style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>
                #{boletinInfo.boletinNum} · {boletinInfo.year}
              </span>
            </div>

            {/* Cajas D/H/M/S — siempre visibles */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { value: boletinInfo.days,    label: 'DÍAS'  },
                { value: boletinInfo.hours,   label: 'HORAS' },
                { value: boletinInfo.minutes, label: 'MIN'   },
                { value: boletinInfo.seconds, label: 'SEG'   },
              ].map(({ value, label }) => (
                <div key={label} style={{
                  background: boletinInfo.isLive ? 'rgba(255,77,79,0.15)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${boletinInfo.isLive ? 'rgba(255,77,79,0.4)' : 'rgba(255,255,255,0.2)'}`,
                  borderRadius: 8, padding: '10px 18px', textAlign: 'center', minWidth: 68,
                }}>
                  <div style={{ color: 'white', fontSize: 30, fontWeight: 700, lineHeight: 1, fontFamily: 'monospace' }}>
                    {String(value).padStart(2, '0')}
                  </div>
                  <div style={{ color: FMRE_GOLD, fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: 1 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {boletinInfo.isBoletinWindow && <>
            {/* Barra de estado AllStar Link */}
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: FMRE_GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>RED ALLSTAR LINK</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '10px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                    background: nodeStatus == null ? '#888' : nodeStatus.online ? '#52c41a' : '#ff4d4f',
                    boxShadow: nodeStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
                    animation: nodeStatus?.online ? 'pulse 2s infinite' : 'none',
                  }} />
                  <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>Hub 299081</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#8ab4e0' }}>Boletín Dominical</span>
                  {nodeStatus == null
                    ? <span style={{ color: '#888', fontSize: 12 }}>…</span>
                    : !nodeStatus.on_air
                      ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● OFF AIR</span>
                      : <><span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● ON AIR</span>
                        {nodeStatus.tx_keyed
                          ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                          : nodeStatus.cos_keyed
                            ? <span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● RX ACTIVO</span>
                            : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                        }</>
                  }
                </div>
              </div>

              <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                <div style={{ color: '#8ab4e0', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: FMRE_GOLD, fontWeight: 700 }}>{nodeStatus?.connections ?? '…'}</span> nodos conectados
                </div>
                {(nodeStatus?.nodes ?? []).length === 0
                  ? <span style={{ color: '#555', fontSize: 12 }}>Sin nodos conectados</span>
                  : (nodeStatus?.nodes ?? []).map(n => (
                    <div key={n.node} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 0 4px 6px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: n.node === '299080' ? '2px solid #D4A017' : '2px solid transparent',
                      background: n.node === '299080' ? 'rgba(212,160,23,0.1)' : undefined,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: n.keyed ? '#ff4d4f' : '#52c41a',
                        boxShadow: n.keyed ? '0 0 0 2px rgba(255,77,79,.2)' : '0 0 0 2px rgba(82,196,26,.2)',
                      }} />
                      <span style={{ fontWeight: 700, color: FMRE_GOLD, minWidth: 52, fontSize: 12 }}>{n.node}</span>
                      {n.url
                        ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#a0c4e8', flex: 1 }}>{n.name}</a>
                        : <span style={{ fontSize: 12, color: '#a0c4e8', flex: 1 }}>{n.name}</span>
                      }
                      {n.node === '299080' && <Tag style={{ margin: '0 4px 0 0', fontSize: 9, flexShrink: 0 }} color="gold">Origen del boletín</Tag>}
                      <Tag style={{ margin: 0, fontSize: 10 }} color={n.keyed ? 'red' : 'default'}>
                        {n.keyed ? 'TX' : n.direction || 'RX'}
                      </Tag>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Barra de estado IRLP */}
            <div style={{ marginTop: 10, marginBottom: 4 }}>
              <span style={{ color: '#06b6d4', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>RED IRLP</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 10, padding: '10px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                    background: irlpStatus == null ? '#888' : irlpStatus.online ? '#52c41a' : '#ff4d4f',
                    boxShadow: irlpStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
                    animation: irlpStatus?.online ? 'pulse 2s infinite' : 'none',
                  }} />
                  <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>Reflector 0077</span>
                </div>

                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#8ab4e0' }}>Boletín Dominical</span>
                  {irlpStatus == null
                    ? <span style={{ color: '#888', fontSize: 12 }}>…</span>
                    : !irlpStatus.on_air
                      ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● OFF AIR</span>
                      : <><span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● ON AIR</span>
                        {irlpStatus.ptt
                          ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                          : irlpStatus.cos
                            ? <span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● RX ACTIVO</span>
                            : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                        }</>
                  }
                </div>
              </div>

              <div style={{ marginTop: 8, borderTop: '1px solid rgba(6,182,212,0.2)', paddingTop: 8 }}>
                <div style={{ color: '#8ab4e0', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#06b6d4', fontWeight: 700 }}>{irlpStatus?.connections ?? '…'}</span> nodos conectados
                </div>
                {(irlpStatus?.nodes ?? []).length === 0
                  ? <span style={{ color: '#555', fontSize: 12 }}>Sin nodos conectados</span>
                  : (irlpStatus?.nodes ?? []).map(n => (
                    <div key={n.node} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 0 4px 6px',
                      borderBottom: '1px solid rgba(6,182,212,0.1)',
                      borderLeft: n.node === '8422' ? '2px solid #D4A017' : '2px solid transparent',
                      background: n.node === '8422' ? 'rgba(212,160,23,0.1)' : undefined,
                      opacity: n.warning ? 0.6 : 1,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: n.warning ? '#faad14' : n.node === '8422' ? '#52c41a' : '#06b6d4',
                      }} />
                      <span style={{ fontWeight: 700, color: '#06b6d4', minWidth: 46, fontSize: 12 }}>{n.node}</span>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: n.warning ? '#8c8c8c' : '#a0c4e8', flex: 1 }}>{n.name}</a>
                      {n.node === '8422' && <Tag style={{ margin: '0 4px 0 0', fontSize: 9, flexShrink: 0 }} color="gold">Origen del boletín</Tag>}
                      {n.warning && <Tag style={{ margin: 0, fontSize: 9, flexShrink: 0 }} color="warning">⚠ Sin heartbeat</Tag>}
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Barra de estado DMR */}
            <div style={{ marginTop: 10, marginBottom: 4 }}>
              <span style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>RED DMR — BRANDMEISTER</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '10px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                    background: dmrStatus.connected ? '#7c3aed' : '#555',
                    boxShadow: dmrStatus.connected ? '0 0 0 3px rgba(124,58,237,0.25)' : 'none',
                    animation: dmrStatus.connected ? 'pulse 2s infinite' : 'none',
                  }} />
                  <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>TG FMRE 33450 · TG México 334</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!dmrStatus.connected
                    ? <span style={{ color: '#888', fontSize: 12 }}>Conectando…</span>
                    : dmrStatus.active
                      ? <>
                          <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                          <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700 }}>{dmrStatus.callsign}</span>
                          <span style={{ color: '#8ab4e0', fontSize: 11 }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
                        </>
                      : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                  }
                </div>
              </div>
            </div>
            </>}
          </div>

          {isLoading ? <Spin size="large" /> : (
            <Row gutter={[24, 16]}>
              {[
                { icon: <WifiOutlined />, label: 'Reportes RF', value: stats!.rf.total, color: '#52c41a' },
                { icon: <GlobalOutlined />, label: 'Reportes RS', value: stats!.rs.total, color: '#faad14' },
                { icon: <TeamOutlined />, label: 'Estaciones RF', value: stats!.rf.indicativos, color: '#40a9ff' },
                { icon: <RadarChartOutlined />, label: 'Estaciones RS', value: stats!.rs.indicativos, color: '#ff7a45' },
              ].map((item, i) => (
                <Col key={i} xs={12} sm={6}>
                  <div
                    onClick={() => handleCardClick(item.label)}
                    style={{
                      background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px',
                      borderTop: `3px solid ${item.color}`, cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  >
                    <div style={{ color: item.color, fontSize: 22, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ color: 'white', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
                      <AnimatedCount target={item.value} />
                    </div>
                    <div style={{ color: '#8ab4e0', fontSize: 12, marginTop: 4 }}>{item.label}</div>
                  </div>
                </Col>
              ))}
            </Row>
          )}

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a', display: 'inline-block', boxShadow: '0 0 0 2px rgba(82,196,26,0.3)', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#8ab4e0', fontSize: 13 }}>
              Actualización automática cada 60 s
              {lastUpdated && <> · <span style={{ color: '#a0c4e8' }}>Última: {dayjs(lastUpdated).format('HH:mm:ss')}</span></>}
            </span>
          </div>

        </div>
      </section>

      {/* ── ÚLTIMO EVENTO RF ── */}
      {stats?.ultimo_evento_rf && (
        <div
          onClick={handleUltimoEvento}
          style={{ background: FMRE_GOLD, padding: '14px 32px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.92)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: FMRE_DARK, fontSize: 14 }}>
              <WifiOutlined style={{ marginRight: 8 }} />
              Último evento RF
            </div>
            <div style={{ color: FMRE_DARK, fontSize: 13, marginTop: 2, opacity: 0.8 }}>
              <strong>{stats.ultimo_evento_rf.tipo} #{getBoletinNumForDate(stats.ultimo_evento_rf.ultima)}</strong>
              {' · '}
              {dayjs(stats.ultimo_evento_rf.ultima).format('D [de] MMMM [de] YYYY')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: '6px 20px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: FMRE_DARK, lineHeight: 1.2 }}>
                  {stats.ultimo_evento_rf.total_qsos.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: FMRE_DARK, opacity: 0.7, letterSpacing: 1, textTransform: 'uppercase' }}>QSOs</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 10, padding: '6px 20px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: FMRE_DARK, lineHeight: 1.2 }}>
                  {stats.ultimo_evento_rf.estaciones.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: FMRE_DARK, opacity: 0.7, letterSpacing: 1, textTransform: 'uppercase' }}>Estaciones</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: `2px solid ${FMRE_DARK}`, borderRadius: 8,
                padding: '7px 20px', fontWeight: 800, color: FMRE_DARK,
                fontSize: 13, background: 'rgba(0,0,0,0.08)',
              }}>
                Ver detalles <RightOutlined />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ÚLTIMO EVENTO RS ── */}
      {stats?.ultimo_evento_rs && (
        <div
          onClick={handleUltimoEventoRS}
          style={{ background: '#0891b2', padding: '14px 32px', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: 'white', fontSize: 14 }}>
              <GlobalOutlined style={{ marginRight: 8 }} />
              Último evento RS
            </div>
            <div style={{ color: 'white', fontSize: 13, marginTop: 2, opacity: 0.85 }}>
              <strong>{stats.ultimo_evento_rs.tipo} #{getBoletinNumForDate(stats.ultimo_evento_rs.ultima)}</strong>
              {' · '}
              {dayjs(stats.ultimo_evento_rs.ultima).format('D [de] MMMM [de] YYYY')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '6px 20px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                  {stats.ultimo_evento_rs.total_qsos.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'white', opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' }}>QSOs</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '6px 20px', textAlign: 'center', minWidth: 90 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                  {stats.ultimo_evento_rs.estaciones.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'white', opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase' }}>Estaciones</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: '2px solid rgba(255,255,255,0.85)', borderRadius: 8,
                padding: '7px 20px', fontWeight: 800, color: 'white',
                fontSize: 13, background: 'rgba(255,255,255,0.15)',
              }}>
                Ver detalles <RightOutlined />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONVOCATORIA ── */}
      <section style={{ background: FMRE_DARK, padding: '32px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>📅</span>
              <span style={{ color: FMRE_GOLD, fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>
                ¿Cómo escuchar el Boletín Dominical?
              </span>
              <span style={{
                background: FMRE_GOLD, color: FMRE_DARK, fontWeight: 800,
                fontSize: 12, padding: '2px 10px', borderRadius: 20, marginLeft: 8,
              }}>Todos los Domingos · 09:00 h (UTC−6)</span>
            </div>
            <p style={{ color: '#8ab4e0', fontSize: 14, margin: 0, paddingLeft: 32 }}>
              Se transmite cada domingo puntualmente a las 09:00 h (UTC−6) de forma simultánea
              por HF, sistemas RoIP y redes sociales.
            </p>
          </div>

          {/* Sub-encabezado: Medios Tradicionales */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ color: FMRE_GOLD, fontWeight: 800, fontSize: 12, letterSpacing: 2, whiteSpace: 'nowrap' }}>
              📻 MEDIOS TRADICIONALES
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <Row gutter={[16, 16]} style={{ alignItems: 'stretch' }}>
            {/* HF */}
            <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${SISTEMA_COLORS.HF}`, flex: 1 }}>
                <div style={{ color: FMRE_GOLD, fontWeight: 800, fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📻 HF
                </div>
                <div style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>7.082 MHz</div>
                <div style={{ color: 'white', fontSize: 12, marginBottom: 12, opacity: 0.75 }}>LSB</div>
                <div style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>14.120 MHz</div>
                <div style={{ color: 'white', fontSize: 12, opacity: 0.75 }}>USB</div>
              </div>
            </Col>

            {/* IRLP + ASL */}
            <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${SISTEMA_COLORS.IRLP}`, flex: 1 }}>
                <div style={{ color: SISTEMA_COLORS.IRLP, fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
                  🔗 Sistemas VoIP / RoIP
                </div>
                <div
                  title="Ver estado en tiempo real"
                  onClick={() => { setVoipStatusVisible(true); setTimeout(() => voipStatusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                    background: irlpStatus == null ? '#555' : irlpStatus.online ? '#52c41a' : '#ff4d4f',
                    boxShadow: irlpStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
                    animation: irlpStatus?.online ? 'pulse 2s infinite' : 'none',
                  }} />
                  <div style={{ width: 38, height: 38, borderRadius: 7, background: '#C62828', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>IRLP</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>IRLP</div>
                    <div style={{ color: '#8ab4e0', fontSize: 13 }}>
                      Reflector <strong style={{ color: 'white' }}>0077</strong>
                      <a href="http://xe1dvi.crabdance.com/Auto_Refresh_0077Con.html" target="_blank" rel="noopener noreferrer"
                        style={{ color: '#8ab4e0', marginLeft: 4 }}
                        onClick={e => e.stopPropagation()}>↗</a>
                    </div>
                  </div>
                </div>
                <div
                  title="Ver estado en tiempo real"
                  onClick={() => { setVoipStatusVisible(true); setTimeout(() => voipStatusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                    background: nodeStatus == null ? '#555' : nodeStatus.online ? '#52c41a' : '#ff4d4f',
                    boxShadow: nodeStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
                    animation: nodeStatus?.online ? 'pulse 2s infinite' : 'none',
                  }} />
                  <div style={{ width: 38, height: 38, borderRadius: 7, background: '#1B5E20', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: 7, fontWeight: 'bold', lineHeight: 1.3 }}>AllStar</span>
                    <span style={{ color: '#A5D6A7', fontSize: 6, lineHeight: 1.3 }}>Link</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>AllStar Link</div>
                    <div style={{ color: '#8ab4e0', fontSize: 13 }}>Hub <strong style={{ color: 'white' }}>299081</strong></div>
                  </div>
                </div>
              </div>
            </Col>

            {/* Crossconexiones */}
            <Col xs={24} sm={24} lg={12} style={{ display: 'flex' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', borderLeft: '4px solid #52c41a', flex: 1 }}>
                <div style={{ color: '#52c41a', fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
                  🔁 Crossconexiones activas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 7, background: '#0D47A1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: 9.5, fontWeight: 'bold' }}>DMR</span>
                    </div>
                    <div>
                      <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>TG 33450</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>BrandMeister</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 7, background: '#E65100', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: 7.5, fontWeight: 'bold', lineHeight: 1.3 }}>C4FM</span>
                      <span style={{ color: '#FFCCBC', fontSize: 6, lineHeight: 1.3 }}>FUSION</span>
                    </div>
                    <div>
                      <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>C4FM / Fusion</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>vía Hub ASL</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 7, background: '#006064', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>D-STAR</span>
                    </div>
                    <div>
                      <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>D-Star</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>vía Hub ASL</div>
                    </div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>


          {/* Sub-encabezado: Redes Sociales */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 16 }}>
            <span style={{ color: '#FF6B00', fontWeight: 800, fontSize: 12, letterSpacing: 2, whiteSpace: 'nowrap' }}>
              📱 REDES SOCIALES
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[
                {
                  plataforma: 'Facebook', detalle: 'Boletín Dominical', color: '#1877F2',
                  href: 'https://www.facebook.com/boletin.dominical.2025',
                  logo: (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  ),
                },
                {
                  plataforma: 'Zello', detalle: 'Canal ARJAC', color: '#FF6B00',
                  href: null,
                  logo: <img src="/zello.png" alt="Zello" style={{ width: 28, height: 28, objectFit: 'contain' }} />,
                },
              ].map(({ plataforma, detalle, color, href, logo }) => {
                const inner = (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 16px',
                    borderLeft: `3px solid ${color}`,
                    transition: 'background 0.2s',
                    cursor: href ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => { if (href) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.16)' }}
                  onMouseLeave={e => { if (href) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)' }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 7,
                      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {logo}
                    </div>
                    <div>
                      <div style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>{plataforma}</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>{detalle}{href ? ' ↗' : ''}</div>
                    </div>
                  </div>
                )
                return href
                  ? <a key={plataforma} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
                  : <div key={plataforma}>{inner}</div>
              })}
            </div>
          </div>

          {/* Estado en tiempo real VoIP / RoIP — visible al hacer clic en el LED */}
          {voipStatusVisible && <div ref={voipStatusRef} style={{ marginTop: 20, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ color: '#06b6d4', fontWeight: 800, fontSize: 12, letterSpacing: 2, whiteSpace: 'nowrap' }}>
                📡 ESTADO DE SISTEMAS EN TIEMPO REAL
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>

              {/* AllStar Link */}
              <div>
                <div style={{ color: FMRE_GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RED ALLSTAR LINK</div>
                <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '10px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                        background: nodeStatus == null ? '#888' : nodeStatus.online ? '#52c41a' : '#ff4d4f',
                        boxShadow: nodeStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
                        animation: nodeStatus?.online ? 'pulse 2s infinite' : 'none',
                      }} />
                      <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>Hub 299081</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#8ab4e0' }}>Boletín Dominical</span>
                      {nodeStatus == null
                        ? <span style={{ color: '#888', fontSize: 12 }}>…</span>
                        : !nodeStatus.on_air
                          ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● OFF AIR</span>
                          : <><span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● ON AIR</span>
                            {nodeStatus.tx_keyed
                              ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                              : nodeStatus.cos_keyed
                                ? <span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● RX ACTIVO</span>
                                : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                            }</>
                      }
                    </div>
                  </div>
                  <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                    <div style={{ color: '#8ab4e0', fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: FMRE_GOLD, fontWeight: 700 }}>{nodeStatus?.connections ?? '…'}</span> nodos conectados
                    </div>
                    {(nodeStatus?.nodes ?? []).length === 0
                      ? <span style={{ color: '#555', fontSize: 12 }}>Sin nodos conectados</span>
                      : (nodeStatus?.nodes ?? []).map(n => (
                        <div key={n.node} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '4px 0 4px 6px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          borderLeft: n.node === '299080' ? '2px solid #D4A017' : '2px solid transparent',
                          background: n.node === '299080' ? 'rgba(212,160,23,0.1)' : undefined,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: n.keyed ? '#ff4d4f' : '#52c41a',
                            boxShadow: n.keyed ? '0 0 0 2px rgba(255,77,79,.2)' : '0 0 0 2px rgba(82,196,26,.2)',
                          }} />
                          <span style={{ fontWeight: 700, color: FMRE_GOLD, minWidth: 52, fontSize: 12 }}>{n.node}</span>
                          {n.url
                            ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#a0c4e8', flex: 1 }}>{n.name}</a>
                            : <span style={{ fontSize: 12, color: '#a0c4e8', flex: 1 }}>{n.name}</span>
                          }
                          {n.node === '299080' && <Tag style={{ margin: '0 4px 0 0', fontSize: 9, flexShrink: 0 }} color="gold">Origen del boletín</Tag>}
                          <Tag style={{ margin: 0, fontSize: 10 }} color={n.keyed ? 'red' : 'default'}>
                            {n.keyed ? 'TX' : n.direction || 'RX'}
                          </Tag>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              {/* IRLP */}
              <div>
                <div style={{ color: '#06b6d4', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RED IRLP</div>
                <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 10, padding: '10px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                        background: irlpStatus == null ? '#888' : irlpStatus.online ? '#52c41a' : '#ff4d4f',
                        boxShadow: irlpStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
                        animation: irlpStatus?.online ? 'pulse 2s infinite' : 'none',
                      }} />
                      <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>Reflector 0077</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#8ab4e0' }}>Boletín Dominical</span>
                      {irlpStatus == null
                        ? <span style={{ color: '#888', fontSize: 12 }}>…</span>
                        : !irlpStatus.on_air
                          ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● OFF AIR</span>
                          : <><span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● ON AIR</span>
                            {irlpStatus.ptt
                              ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                              : irlpStatus.cos
                                ? <span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● RX ACTIVO</span>
                                : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                            }</>
                      }
                    </div>
                  </div>
                  <div style={{ marginTop: 10, borderTop: '1px solid rgba(6,182,212,0.2)', paddingTop: 8 }}>
                    <div style={{ color: '#8ab4e0', fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: '#06b6d4', fontWeight: 700 }}>{irlpStatus?.connections ?? '…'}</span> nodos conectados
                    </div>
                    {(irlpStatus?.nodes ?? []).length === 0
                      ? <span style={{ color: '#555', fontSize: 12 }}>Sin nodos conectados</span>
                      : (irlpStatus?.nodes ?? []).map(n => (
                        <div key={n.node} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '4px 0 4px 6px',
                          borderBottom: '1px solid rgba(6,182,212,0.1)',
                          borderLeft: n.node === '8422' ? '2px solid #D4A017' : '2px solid transparent',
                          background: n.node === '8422' ? 'rgba(212,160,23,0.1)' : undefined,
                          opacity: n.warning ? 0.6 : 1,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: n.warning ? '#faad14' : n.node === '8422' ? '#52c41a' : '#06b6d4',
                          }} />
                          <span style={{ fontWeight: 700, color: '#06b6d4', minWidth: 46, fontSize: 12 }}>{n.node}</span>
                          <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: n.warning ? '#8c8c8c' : '#a0c4e8', flex: 1 }}>{n.name}</a>
                          {n.node === '8422' && <Tag style={{ margin: '0 4px 0 0', fontSize: 9, flexShrink: 0 }} color="gold">Origen del boletín</Tag>}
                          {n.warning && <Tag style={{ margin: 0, fontSize: 9, flexShrink: 0 }} color="warning">⚠ Sin heartbeat</Tag>}
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              {/* DMR / Brandmeister */}
              <div>
                <div style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RED DMR — BRANDMEISTER</div>
                <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '10px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
                        background: dmrStatus.connected ? '#7c3aed' : '#555',
                        boxShadow: dmrStatus.connected ? '0 0 0 3px rgba(124,58,237,0.25)' : 'none',
                        animation: dmrStatus.connected ? 'pulse 2s infinite' : 'none',
                      }} />
                      <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>TG FMRE 33450 · TG México 334</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!dmrStatus.connected
                        ? <span style={{ color: '#888', fontSize: 12 }}>Conectando…</span>
                        : dmrStatus.active
                          ? <>
                              <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                              <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700 }}>{dmrStatus.callsign}</span>
                              <span style={{ color: '#8ab4e0', fontSize: 11 }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
                            </>
                          : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                      }
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>}
        </div>
      </section>

      {/* ── BÚSQUEDA ── */}
      <section style={{ background: 'white', borderBottom: `3px solid ${FMRE_BLUE}`, padding: '40px 32px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <Title level={3} style={{ color: FMRE_DARK, margin: 0 }}>¿Tomaron mi reporte?</Title>
          <Paragraph style={{ color: '#444', fontSize: 15, marginTop: 8, marginBottom: 24 }}>
            Consulta los reportes de tu estación registrados en el sistema.
            Ingresa tu indicativo y ve el historial de actividad en RF y redes sociales.
          </Paragraph>
          <Input.Search
            size="large"
            placeholder="Ej. XE2MBE, XE1LM, XE3AAA..."
            enterButton={<><SearchOutlined /> Buscar</>}
            value={busqueda}
            onChange={e => {
                const val = e.target.value.toUpperCase()
                setBusqueda(val)
                if (!val) { setResultado(null); setBusqError(null) }
              }}
            onSearch={handleBuscar}
            loading={buscando}
            style={{ maxWidth: 480 }}
            allowClear
          />
        </div>

        {/* Resultado de búsqueda */}
        {(resultado || busqError) && (
          <div ref={busquedaRef} style={{ maxWidth: 900, margin: '32px auto 0' }}>
            {busqError && <Alert type="warning" message={busqError} showIcon />}

            {resultado && (
              <div>
                {/* Cabecera del operador */}
                <Card style={{ marginBottom: 16, borderTop: `4px solid ${FMRE_BLUE}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: FMRE_DARK, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <UserOutlined style={{ color: 'white', fontSize: 28 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: FMRE_BLUE, letterSpacing: 1 }}>
                        {resultado.indicativo}
                      </div>
                      {resultado.operador?.nombre && (
                        <div style={{ fontSize: 16, color: '#333', fontWeight: 600 }}>{resultado.operador.nombre}</div>
                      )}
                      {resultado.operador && (
                        <div style={{ color: '#888', fontSize: 13 }}>
                          {[resultado.operador.municipio, resultado.operador.estado, resultado.operador.licencia]
                            .filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center', background: FMRE_LIGHT, borderRadius: 8, padding: '8px 16px' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: FMRE_BLUE }}>{resultado.rf.total.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>Reportes RF</div>
                      </div>
                      <div style={{ textAlign: 'center', background: '#f9f0ff', borderRadius: 8, padding: '8px 16px' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#0891b2' }}>{resultado.rs.total.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>Reportes RS</div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Row gutter={[16, 16]}>
                  {/* RF */}
                  {resultado.rf.total > 0 && (
                    <Col xs={24} lg={12}>
                      <Card title={<span><WifiOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Actividad RF</span>}
                            size="small" style={{ height: '100%' }}>
                        <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
                          Primera actividad: <strong>{resultado.rf.primera}</strong>
                          {resultado.rf.primera !== resultado.rf.ultima && <> · Última: <strong>{resultado.rf.ultima}</strong></>}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          {resultado.rf.por_evento.map(e => (
                            <Tag key={e.evento} color={FMRE_BLUE} style={{ marginBottom: 4 }}>
                              {e.evento} · {e.total}
                            </Tag>
                          ))}
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          {resultado.rf.por_sistema.map(s => (
                            <Tag key={s.sistema} color={SISTEMA_COLORS[s.sistema] ?? '#666'} style={{ marginBottom: 4 }}>
                              {s.sistema} · {s.total}
                            </Tag>
                          ))}
                        </div>
                        <Table
                          size="small"
                          dataSource={resultado.rf.ultimos}
                          rowKey={(_r, i) => String(i)}
                          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} registros` }}
                          columns={[
                            { title: 'Fecha', dataIndex: 'fecha', width: 90, render: v => v ?? '—' },
                            { title: 'Evento', dataIndex: 'evento', render: v => v ?? '—' },
                            { title: 'Sistema', dataIndex: 'sistema', width: 70, render: v => v
                              ? <Tag color={SISTEMA_COLORS[v] ?? '#666'} style={{ fontSize: 11 }}>{v}</Tag> : '—' },
                            { title: 'Estado', dataIndex: 'estado', render: v => v ?? '—' },
                          ]}
                        />
                      </Card>
                    </Col>
                  )}

                  {/* RS */}
                  {resultado.rs.total > 0 && (
                    <Col xs={24} lg={12}>
                      <Card title={<span style={{ color: '#0891b2' }}>📱 Actividad en Redes Sociales</span>}
                            size="small" style={{ height: '100%' }}>
                        <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
                          Primera actividad: <strong>{resultado.rs.primera}</strong>
                          {resultado.rs.primera !== resultado.rs.ultima && <> · Última: <strong>{resultado.rs.ultima}</strong></>}
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          {resultado.rs.por_plataforma.map(p => (
                            <Tag key={p.plataforma} color={PLAT_COLORS[p.plataforma] ?? '#0891b2'} style={{ marginBottom: 4 }}>
                              {p.plataforma} · {p.total}
                            </Tag>
                          ))}
                        </div>
                        <Table
                          size="small"
                          dataSource={resultado.rs.ultimos}
                          rowKey={(_r, i) => String(i)}
                          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} registros` }}
                          columns={[
                            { title: 'Fecha', dataIndex: 'fecha', width: 90, render: v => v ?? '—' },
                            { title: 'Plataforma', dataIndex: 'plataforma', render: v => v
                              ? <Tag color={PLAT_COLORS[v] ?? '#0891b2'} style={{ fontSize: 11 }}>{v}</Tag> : '—' },
                            { title: 'Estado', dataIndex: 'estado', render: v => v ?? '—' },
                          ]}
                        />
                      </Card>
                    </Col>
                  )}
                </Row>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>

        {/* ── SECCIÓN RF ── */}
        <div ref={rfRef} style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 4, height: 28, background: FMRE_BLUE, borderRadius: 2 }} />
            <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
              Actividad por Sistemas RF
            </Title>
            <Tag color={FMRE_BLUE} style={{ fontWeight: 700 }}>HF · Sistemas RoIP</Tag>
          </div>
          <Paragraph style={{ color: '#444', fontSize: 15, marginBottom: 24, maxWidth: 700 }}>
            Registro de estaciones participantes en boletines dominicales a través de sistemas de HF, AllStar, IRLP, DMR y otros.
          </Paragraph>

          <Row gutter={[16, 16]}>
            {/* Tendencia mensual */}
            <Col xs={24} lg={14}>
              <Card title={<span><RiseOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Actividad mensual (últimos 12 meses)</span>}
                    size="small" className="card-shadow"
                    bodyStyle={{ padding: 12 }}>
                {isLoading
                  ? <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={tendenciaOption} style={{ height: 340 }} />}
              </Card>
            </Col>

            {/* Por sistema */}
            <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title={<span><WifiOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Distribución por sistema</span>}
                    size="small" className="card-shadow" style={{ flex: 1 }}>
                {isLoading ? <Spin /> : (() => {
                  const total = stats!.rf.por_sistema.reduce((s, r) => s + r.total, 0)
                  return (
                    <Row align="middle">
                      <Col span={12}>
                        <ReactECharts option={sistemaOption} style={{ height: 220 }} />
                      </Col>
                      <Col span={12} style={{ paddingLeft: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', fontSize: 11, color: '#aaa', paddingBottom: 6, fontWeight: 500 }}>Sistema</th>
                              <th style={{ textAlign: 'right', fontSize: 11, color: '#aaa', paddingBottom: 6, fontWeight: 500 }}>Reportes</th>
                              <th style={{ textAlign: 'right', fontSize: 11, color: '#aaa', paddingBottom: 6, fontWeight: 500 }}>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats!.rf.por_sistema.map(s => (
                              <tr key={s.sistema} style={{ borderTop: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '4px 0' }}>
                                  <Tag color={SISTEMA_COLORS[s.sistema] ?? '#666'} style={{ fontSize: 11, margin: 0 }}>{s.sistema}</Tag>
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, paddingRight: 6 }}>
                                  {s.total.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 12, color: '#888' }}>
                                  {((s.total / total) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid #d9d9d9' }}>
                              <td style={{ padding: '5px 0', fontSize: 12, fontWeight: 700, color: '#333' }}>Total</td>
                              <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, paddingRight: 6 }}>{total.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#333' }}>100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </Col>
                    </Row>
                  )
                })()}
              </Card>
            </Col>

            {/* Mapa de México */}
            <Col xs={24} lg={14} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title={<span><GlobalOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Cobertura por estado</span>}
                    size="small" className="card-shadow"
                    style={{ flex: 1 }}
                    bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 12 }}>
                {isLoading || !mapReady
                  ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={mapaOption} style={{ flex: 1, minHeight: 300 }} />}
              </Card>
            </Col>

            {/* Top indicativos RF */}
            <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title={<span><StarOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Top 10 estaciones más activas</span>}
                    size="small" className="card-shadow" style={{ flex: 1 }}>
                {isLoading ? <Spin /> : (
                  <div>
                    {stats!.rf.top_indicativos.map((op, i) => (
                      <div key={op.indicativo} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 0', borderBottom: i < 9 ? '1px solid #f0f0f0' : undefined,
                      }}>
                        {i === 0 ? (
                          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥇</span>
                        ) : i === 1 ? (
                          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥈</span>
                        ) : i === 2 ? (
                          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥉</span>
                        ) : (
                          <span style={{
                            width: 24, height: 24, borderRadius: '50%', background: FMRE_LIGHT,
                            color: '#666', fontWeight: 700, fontSize: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>{i + 1}</span>
                        )}
                        <span style={{ minWidth: 70 }}>{callSign(op.indicativo)}</span>
                        <span style={{ color: '#666', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {op.nombre ?? '—'}
                        </span>
                        <Tag color={FMRE_BLUE} style={{ fontWeight: 700, minWidth: 48, textAlign: 'center' }}>
                          {op.total.toLocaleString()}
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            {/* Participación por estado — barra horizontal */}
            <Col xs={24}>
              <Card title={<span><RadarChartOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Participación por Estado</span>}
                    size="small" className="card-shadow">
                {isLoading ? <Spin /> : (() => {
                  const nac = stats!.rf.por_estado
                  const nacTotal = stats!.rf.por_estado.reduce((s, e) => s + e.total, 0)
                  const intl = stats!.rf.total - nacTotal
                  const yData = [...nac.map(e => e.estado).reverse(), ...(intl > 0 ? ['Extranjero'] : [])]
                  const sData: any[] = [
                    ...nac.map((e, i) => ({
                      value: e.total,
                      itemStyle: { color: `hsl(${215 - i * 6}, 70%, ${45 + i * 1.5}%)`, borderRadius: [0, 4, 4, 0] },
                    })).reverse(),
                    ...(intl > 0 ? [{ value: intl, itemStyle: { color: '#f0a020', borderRadius: [0, 4, 4, 0] } }] : []),
                  ]
                  return (
                    <>
                      <ReactECharts
                        option={{
                          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
                            formatter: (p: any) => `<b>${p[0].name}</b>: ${p[0].value.toLocaleString()} reportes` },
                          grid: { left: 130, right: 48, top: 8, bottom: 8, containLabel: false },
                          xAxis: { type: 'value', axisLabel: { color: '#888', fontSize: 11 } },
                          yAxis: { type: 'category', axisLabel: { color: '#333', fontSize: 12 }, data: yData },
                          series: [{
                            type: 'bar', barMaxWidth: 22, data: sData,
                            label: { show: true, position: 'right', fontSize: 11, color: '#555',
                              formatter: (p: any) => p.value.toLocaleString() },
                          }],
                        }}
                        style={{ height: Math.max(300, yData.length * 28) }}
                      />
                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 12 }}>
                        <span style={{ color: '#888' }}>{stats!.rf.por_estado.length} estados</span>
                        <span style={{ color: '#888' }}>{nacTotal.toLocaleString()} nac.</span>
                        {intl > 0 && <span style={{ color: '#f0a020' }}>{intl.toLocaleString()} ext.</span>}
                        <strong>Total: {stats!.rf.total.toLocaleString()}</strong>
                      </div>
                    </>
                  )
                })()}
              </Card>
            </Col>

            {/* Países extranjeros */}
            {stats && stats.rf.paises.length > 0 && (
              <Col xs={24}>
                <Card
                  title={<span><GlobalOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Estaciones internacionales participantes</span>}
                  size="small" className="card-shadow" hoverable
                  onClick={handleEstIntl}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {stats.rf.paises.map(p => (
                      <Tag key={p.pais} color="geekblue" style={{ fontSize: 13, padding: '4px 10px' }}>
                        {p.pais} · <strong>{p.indicativos}</strong> estaciones
                      </Tag>
                    ))}
                  </div>
                  <div style={{ color: FMRE_BLUE, fontSize: 12 }}>
                    👆 Clic para ver el listado completo de estaciones internacionales
                  </div>
                </Card>
              </Col>
            )}
          </Row>
        </div>

        <Divider style={{ borderColor: '#d0d7e3' }} />

        {/* ── SECCIÓN RS ── */}
        <div ref={rsRef} style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 4, height: 28, background: '#0891b2', borderRadius: 2 }} />
            <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
              Actividad en Redes Sociales (RS)
            </Title>
            <Tag color="cyan" style={{ fontWeight: 700 }}>Facebook · Zello · y más</Tag>
          </div>
          <Paragraph style={{ color: '#444', fontSize: 15, marginBottom: 24, maxWidth: 700 }}>
            Seguimiento de la participación de radioaficionados en plataformas digitales
            durante los eventos de la FMRE. La comunidad XE también está presente en las redes.
          </Paragraph>

          <Row gutter={[16, 16]}>
            {/* Tendencia mensual RS */}
            <Col xs={24} lg={14}>
              <Card title={<span><RiseOutlined style={{ color: '#0891b2', marginRight: 8 }} />Actividad mensual por plataforma (últimos 12 meses)</span>}
                    size="small" className="card-shadow"
                    bodyStyle={{ padding: 12 }}>
                {isLoading
                  ? <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={tendenciaRSOption} style={{ height: 340 }} />}
              </Card>
            </Col>

            {/* Distribución por plataforma pie + tabla */}
            <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title={<span><GlobalOutlined style={{ color: '#0891b2', marginRight: 8 }} />Distribución por plataforma</span>}
                    size="small" className="card-shadow" style={{ flex: 1 }}>
                {isLoading ? <Spin /> : (() => {
                  const total = stats!.rs.por_plataforma.reduce((s, r) => s + r.total, 0)
                  return (
                    <Row align="middle">
                      <Col span={12}>
                        <ReactECharts option={plataformaPieOption} style={{ height: 220 }} />
                      </Col>
                      <Col span={12} style={{ paddingLeft: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', fontSize: 11, color: '#aaa', paddingBottom: 6, fontWeight: 500 }}>Plataforma</th>
                              <th style={{ textAlign: 'right', fontSize: 11, color: '#aaa', paddingBottom: 6, fontWeight: 500 }}>Rep.</th>
                              <th style={{ textAlign: 'right', fontSize: 11, color: '#aaa', paddingBottom: 6, fontWeight: 500 }}>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats!.rs.por_plataforma.map(p => (
                              <tr key={p.plataforma} style={{ borderTop: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '3px 0', fontSize: 11, color: '#333', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: PLAT_COLORS[p.plataforma] ?? '#0891b2', marginRight: 5, flexShrink: 0 }} />
                                  {p.plataforma}
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, paddingRight: 6 }}>
                                  {p.total.toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'right', fontSize: 12, color: '#888' }}>
                                  {((p.total / total) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid #d9d9d9' }}>
                              <td style={{ padding: '5px 0', fontSize: 12, fontWeight: 700, color: '#333' }}>Total</td>
                              <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, paddingRight: 6 }}>{total.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#333' }}>100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </Col>
                    </Row>
                  )
                })()}
              </Card>
            </Col>

            {/* Mapa RS */}
            <Col xs={24} lg={14} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title={<span><GlobalOutlined style={{ color: '#0891b2', marginRight: 8 }} />Cobertura por estado</span>}
                    size="small" className="card-shadow"
                    style={{ flex: 1 }}
                    bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 12 }}>
                {isLoading || !mapReady
                  ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={mapaRSOption} style={{ flex: 1, minHeight: 300 }} />}
              </Card>
            </Col>

            {/* Top 10 RS */}
            <Col xs={24} lg={10} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title={<span><StarOutlined style={{ color: '#0891b2', marginRight: 8 }} />Top 10 estaciones más activas en RS</span>}
                    size="small" className="card-shadow" style={{ flex: 1 }}>
                {isLoading ? <Spin /> : (
                  <div>
                    {stats!.rs.top_indicativos.map((op, i) => (
                      <div key={op.indicativo} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 0', borderBottom: i < 9 ? '1px solid #f0f0f0' : undefined,
                      }}>
                        {i === 0 ? (
                          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥇</span>
                        ) : i === 1 ? (
                          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥈</span>
                        ) : i === 2 ? (
                          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥉</span>
                        ) : (
                          <span style={{
                            width: 24, height: 24, borderRadius: '50%', background: '#e0f7fa',
                            color: '#666', fontWeight: 700, fontSize: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>{i + 1}</span>
                        )}
                        <span style={{ minWidth: 70 }}>{callSign(op.indicativo, '#0891b2')}</span>
                        <span style={{ color: '#666', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {op.nombre ?? '—'}
                        </span>
                        <Tag color="cyan" style={{ fontWeight: 700, minWidth: 48, textAlign: 'center' }}>
                          {op.total.toLocaleString()}
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            {/* Participación por estado RS */}
            {stats && stats.rs.por_estado.length > 0 && (
              <Col xs={24}>
                <Card title={<span><RadarChartOutlined style={{ color: '#0891b2', marginRight: 8 }} />Participación por Estado</span>}
                      size="small" className="card-shadow">
                  {isLoading ? <Spin /> : (() => {
                    const nac = stats!.rs.por_estado
                    const nacTotal = stats!.rs.por_estado.reduce((s, e) => s + e.total, 0)
                    const intl = stats!.rs.total - nacTotal
                    const yData = [...nac.map(e => e.estado).reverse(), ...(intl > 0 ? ['Extranjero'] : [])]
                    const sData: any[] = [
                      ...nac.map((e, i) => ({
                        value: e.total,
                        itemStyle: { color: `hsl(${280 - i * 6}, 60%, ${45 + i * 1.5}%)`, borderRadius: [0, 4, 4, 0] },
                      })).reverse(),
                      ...(intl > 0 ? [{ value: intl, itemStyle: { color: '#f0a020', borderRadius: [0, 4, 4, 0] } }] : []),
                    ]
                    return (
                      <>
                        <ReactECharts
                          option={{
                            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
                              formatter: (p: any) => `<b>${p[0].name}</b>: ${p[0].value.toLocaleString()} reportes` },
                            grid: { left: 130, right: 48, top: 8, bottom: 8, containLabel: false },
                            xAxis: { type: 'value', axisLabel: { color: '#888', fontSize: 11 } },
                            yAxis: { type: 'category', axisLabel: { color: '#333', fontSize: 12 }, data: yData },
                            series: [{
                              type: 'bar', barMaxWidth: 22, data: sData,
                              label: { show: true, position: 'right', fontSize: 11, color: '#555',
                                formatter: (p: any) => p.value.toLocaleString() },
                            }],
                          }}
                          style={{ height: Math.max(300, yData.length * 28) }}
                        />
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 12 }}>
                          <span style={{ color: '#888' }}>{stats!.rs.por_estado.length} estados</span>
                          <span style={{ color: '#888' }}>{nacTotal.toLocaleString()} nac.</span>
                          {intl > 0 && <span style={{ color: '#f0a020' }}>{intl.toLocaleString()} ext.</span>}
                          <strong>Total: {stats!.rs.total.toLocaleString()}</strong>
                        </div>
                      </>
                    )
                  })()}
                </Card>
              </Col>
            )}
          </Row>
        </div>

        {/* ── TABLA ESTACIONES INTERNACIONALES ── */}
        {(estacionesIntl || loadingEstIntl) && (
          <div ref={estIntlRef} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <Divider style={{ borderColor: '#d0d7e3' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 4, height: 28, background: FMRE_BLUE, borderRadius: 2 }} />
              <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>Estaciones internacionales</Title>
            </div>
            {loadingEstIntl ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
              <Table
                dataSource={estacionesIntl ?? []}
                rowKey="indicativo"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: false }}
                columns={[
                  { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => <Text type="secondary">{i + 1}</Text> },
                  { title: 'País', dataIndex: 'pais', width: 140, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v) },
                  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? '—' },
                  { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const, render: (v: number) => <Tag color="blue">{v.toLocaleString()}</Tag> },
                  { title: 'Última actividad', dataIndex: 'ultima', width: 130, render: (v: string | null) => v ?? '—' },
                ]}
              />
            )}
          </div>
        )}

        {/* ── TABLA ESTACIONES RF ── */}
        {(estacionesRF || loadingEstRF) && (
          <div ref={estRFRef} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <Divider style={{ borderColor: '#d0d7e3' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 4, height: 28, background: FMRE_BLUE, borderRadius: 2 }} />
              <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>Estaciones activas — RF</Title>
            </div>
            {loadingEstRF ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
              <Table
                dataSource={estacionesRF ?? []}
                rowKey="indicativo"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: false }}
                columns={[
                  { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => <Text type="secondary">{i + 1}</Text> },
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v) },
                  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? '—' },
                  { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const, render: (v: number) => <Tag color="blue">{v.toLocaleString()}</Tag> },
                  { title: 'Última actividad', dataIndex: 'ultima', width: 130, render: (v: string | null) => v ?? '—' },
                ]}
              />
            )}
          </div>
        )}

        {/* ── TABLA ESTACIONES RS ── */}
        {(estacionesRS || loadingEstRS) && (
          <div ref={estRSRef} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <Divider style={{ borderColor: '#d0d7e3' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 4, height: 28, background: '#0891b2', borderRadius: 2 }} />
              <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>Estaciones activas — Redes Sociales</Title>
            </div>
            {loadingEstRS ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
              <Table
                dataSource={estacionesRS ?? []}
                rowKey="indicativo"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: false }}
                columns={[
                  { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => <Text type="secondary">{i + 1}</Text> },
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v, '#0891b2') },
                  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? '—' },
                  { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const, render: (v: number) => <Tag color="cyan">{v.toLocaleString()}</Tag> },
                  { title: 'Última actividad', dataIndex: 'ultima', width: 130, render: (v: string | null) => v ?? '—' },
                ]}
              />
            )}
          </div>
        )}

        {/* ── ÚLTIMO EVENTO RF DETALLE ── */}
        {(ultimoEvDetalle || loadingEv) && (
          <div ref={evRef} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <Divider style={{ borderColor: '#d0d7e3' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 4, height: 28, background: FMRE_GOLD, borderRadius: 2 }} />
              <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
                RF · {ultimoEvDetalle?.evento ?? 'Último evento'} — {ultimoEvDetalle?.fecha ?? ''}
              </Title>
            </div>
            {loadingEv ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (() => {
              const participantes = ultimoEvDetalle?.participantes ?? []

              // Agrupar por estado para el mapa
              const porEstado = participantes.reduce((acc, p) => {
                if (p.estado) acc[p.estado] = (acc[p.estado] ?? 0) + 1
                return acc
              }, {} as Record<string, number>)
              const maxEstado = Math.max(...Object.values(porEstado), 1)

              // Agrupar por sistema para el pie
              const porSistema = participantes.reduce((acc, p) => {
                Object.entries(p.sistemas).forEach(([s, n]) => { acc[s] = (acc[s] ?? 0) + n })
                return acc
              }, {} as Record<string, number>)

              const totalQSOsEv = Object.values(porSistema).reduce((s, n) => s + n, 0)
              const totalEstadoEv = Object.values(porEstado).reduce((s, n) => s + n, 0)
              const eventoMapOption = !mapReady ? {} : {
                tooltip: {
                  trigger: 'item',
                  formatter: (p: any) => p.value
                    ? `<b>${p.name}</b><br/>${p.value} estación${p.value > 1 ? 'es' : ''}<br/><span style="color:#888">${(p.value / totalEstadoEv * 100).toFixed(1)}% del total</span>`
                    : p.name,
                },
                visualMap: {
                  min: 0, max: maxEstado,
                  inRange: { color: ['#FFF9C4', FMRE_GOLD] },
                  show: false,
                },
                series: [{
                  type: 'map', map: 'Mexico', roam: false,
                  emphasis: { label: { show: true }, itemStyle: { areaColor: FMRE_BLUE } },
                  data: Object.entries(porEstado).map(([estado, count]) => ({ name: estado, value: count })),
                  nameMap: {
                    'Ciudad de México': 'Ciudad De México',
                    'Estado De México': 'México',
                  },
                }],
              }

              return (
                <>
                  {/* Mapa + resumen sistemas */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                      <Card size="small" title={<span><GlobalOutlined style={{ color: FMRE_GOLD, marginRight: 8 }} />Cobertura geográfica del evento</span>} className="card-shadow">
                        {mapReady
                          ? <ReactECharts option={eventoMapOption} style={{ height: 300 }} />
                          : <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>}
                      </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                      <Card size="small" title={<span><WifiOutlined style={{ color: FMRE_GOLD, marginRight: 8 }} />Reportes por sistema</span>} className="card-shadow" style={{ height: '100%' }}>
                        <ReactECharts
                          option={{
                            title: { text: totalQSOsEv.toLocaleString(), subtext: 'QSOs', left: '50%', top: '40%', textAlign: 'center', textStyle: { fontSize: 16, fontWeight: 'bold', color: FMRE_DARK }, subtextStyle: { fontSize: 11, color: '#888' } },
                            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                            series: [{
                              type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
                              data: Object.entries(porSistema).map(([s, n]) => ({
                                name: s, value: n,
                                itemStyle: { color: SISTEMA_COLORS[s] ?? '#999' },
                              })),
                              label: { formatter: '{b}: {c}', fontSize: 11 },
                            }],
                          }}
                          style={{ height: 300 }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  {/* Tabla de participantes */}
                  <Table
                    dataSource={participantes}
                    rowKey="indicativo"
                    size="small"
                    pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} estaciones` }}
                    columns={[
                      { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => (
                        <span style={{ fontWeight: 700, color: i < 3 ? FMRE_GOLD : '#8c8c8c' }}>{i + 1}</span>
                      )},
                      { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v) },
                      { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin registro</span> },
                      { title: 'Estado', dataIndex: 'estado', width: 120, ellipsis: true, render: (v: string | null) => v ?? '—' },
                      { title: 'QSOs', dataIndex: 'total', width: 90, align: 'right' as const,
                        render: (v: number, r: { sistemas: Record<string, number> }) => (
                          <Popover trigger="click" title="Desglose por sistema"
                            content={
                              <div style={{ minWidth: 140 }}>
                                {Object.entries(r.sistemas).map(([s, n]) => (
                                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
                                    <Tag color={SISTEMA_COLORS[s] ?? '#666'} style={{ margin: 0 }}>{s}</Tag>
                                    <strong>{n}</strong>
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <Tag color="gold" style={{ cursor: 'pointer', fontWeight: 700 }}>{v.toLocaleString()} ▾</Tag>
                          </Popover>
                        )},
                    ]}
                  />
                </>
              )
            })()}
          </div>
        )}

        {/* ── ÚLTIMO EVENTO RS DETALLE ── */}
        {(ultimoEvRSDetalle || loadingEvRS) && (
          <div ref={evRSRef} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <Divider style={{ borderColor: '#d0d7e3' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 4, height: 28, background: '#0891b2', borderRadius: 2 }} />
              <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
                RS · {ultimoEvRSDetalle?.evento ?? 'Último evento'} — {ultimoEvRSDetalle?.fecha ?? ''}
              </Title>
            </div>
            {loadingEvRS ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (() => {
              const participantes = ultimoEvRSDetalle?.participantes ?? []

              const porEstadoRS = participantes.reduce((acc, p) => {
                if (p.estado) acc[p.estado] = (acc[p.estado] ?? 0) + 1
                return acc
              }, {} as Record<string, number>)
              const maxEstadoRS = Math.max(...Object.values(porEstadoRS), 1)

              const porPlataforma = participantes.reduce((acc, p) => {
                Object.entries(p.plataformas).forEach(([pl, n]) => { acc[pl] = (acc[pl] ?? 0) + n })
                return acc
              }, {} as Record<string, number>)

              const totalReportesEv = Object.values(porPlataforma).reduce((s, n) => s + n, 0)
              const totalEstadoEvRS = Object.values(porEstadoRS).reduce((s, n) => s + n, 0)
              const eventoRSMapOption = !mapReady ? {} : {
                tooltip: {
                  trigger: 'item',
                  formatter: (p: any) => p.value
                    ? `<b>${p.name}</b><br/>${p.value} estación${p.value > 1 ? 'es' : ''}<br/><span style="color:#888">${(p.value / totalEstadoEvRS * 100).toFixed(1)}% del total</span>`
                    : p.name,
                },
                visualMap: {
                  min: 0, max: maxEstadoRS,
                  inRange: { color: ['#e0f7fa', '#0891b2'] },
                  show: false,
                },
                series: [{
                  type: 'map', map: 'Mexico', roam: false,
                  emphasis: { label: { show: true }, itemStyle: { areaColor: FMRE_GOLD } },
                  data: Object.entries(porEstadoRS).map(([estado, count]) => ({ name: estado, value: count })),
                  nameMap: {
                    'Ciudad de México': 'Ciudad De México',
                    'Estado De México': 'México',
                  },
                }],
              }

              return (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                      <Card size="small" title={<span><GlobalOutlined style={{ color: '#0891b2', marginRight: 8 }} />Cobertura geográfica del evento</span>} className="card-shadow">
                        {mapReady
                          ? <ReactECharts option={eventoRSMapOption} style={{ height: 300 }} />
                          : <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>}
                      </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                      <Card size="small" title={<span><GlobalOutlined style={{ color: '#0891b2', marginRight: 8 }} />Reportes por plataforma</span>} className="card-shadow" style={{ height: '100%' }}>
                        <ReactECharts
                          option={{
                            title: { text: totalReportesEv.toLocaleString(), subtext: 'Reportes', left: '50%', top: '40%', textAlign: 'center', textStyle: { fontSize: 16, fontWeight: 'bold', color: '#0891b2' }, subtextStyle: { fontSize: 11, color: '#888' } },
                            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                            series: [{
                              type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
                              data: Object.entries(porPlataforma).map(([p, n]) => ({
                                name: p, value: n,
                                itemStyle: { color: PLAT_COLORS[p] ?? '#0891b2' },
                              })),
                              label: { formatter: '{b}: {c}', fontSize: 11 },
                            }],
                          }}
                          style={{ height: 300 }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Table
                    dataSource={participantes}
                    rowKey="indicativo"
                    size="small"
                    pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} estaciones` }}
                    columns={[
                      { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => (
                        <span style={{ fontWeight: 700, color: i < 3 ? '#0891b2' : '#8c8c8c' }}>{i + 1}</span>
                      )},
                      { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v, '#0891b2') },
                      { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin registro</span> },
                      { title: 'Estado', dataIndex: 'estado', width: 120, ellipsis: true, render: (v: string | null) => v ?? '—' },
                      { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const,
                        render: (v: number, r: { plataformas: Record<string, number> }) => (
                          <Popover trigger="click" title="Desglose por plataforma"
                            content={
                              <div style={{ minWidth: 160 }}>
                                {Object.entries(r.plataformas).map(([p, n]) => (
                                  <div key={p} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
                                    <Tag color={PLAT_COLORS[p] ?? '#0891b2'} style={{ margin: 0 }}>{p}</Tag>
                                    <strong>{n}</strong>
                                  </div>
                                ))}
                              </div>
                            }
                          >
                            <Tag color="cyan" style={{ cursor: 'pointer', fontWeight: 700 }}>{v.toLocaleString()} ▾</Tag>
                          </Popover>
                        )},
                    ]}
                  />
                </>
              )
            })()}
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: FMRE_DARK, padding: '20px 32px', marginTop: 16 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <a href="https://fmre.mx" target="_blank" rel="noopener noreferrer"
            style={{ color: FMRE_GOLD, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
            <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 20, width: 'auto', verticalAlign: 'middle', marginRight: 6, opacity: 0.9 }} />
              fmre.mx
          </a>
          {visitaInfo && (
            <div style={{ color: '#8ab4e0', fontSize: 11 }}>
              {countryFlag(visitaInfo.pais_codigo ?? '')} Visita #{visitaInfo.total.toLocaleString()} · {visitaInfo.ip}
            </div>
          )}
          <a href="https://rcg.org.mx" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
            <span style={{ color: '#8ab4e0', fontSize: 11 }}>Página diseñada por miembros del</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/rcg_small.png" alt="Radio Club Guadiana" style={{ height: 24, width: 'auto', opacity: 0.9 }} />
              <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>Radio Club Guadiana A.C.</span>
            </div>
          </a>
        </div>
      </footer>

    </div>
  )
}
