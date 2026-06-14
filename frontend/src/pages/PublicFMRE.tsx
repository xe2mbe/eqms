import { useEffect, useState, useRef } from 'react'
import { Row, Col, Card, Tag, Typography, Divider, Spin, Input, Alert, Table, Popover } from 'antd'
import {
  WifiOutlined, GlobalOutlined, TeamOutlined, RiseOutlined,
  StarOutlined, RadarChartOutlined, SearchOutlined, UserOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import axios from 'axios'
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

const IrlpLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="7" fill="#C62828"/>
    <text x="20" y="13" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial,sans-serif">IRLP</text>
    <path d="M10 22 Q20 16 30 22" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <path d="M6 27 Q20 19 34 27" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55"/>
    <circle cx="20" cy="33" r="2.5" fill="white"/>
    <line x1="20" y1="30.5" x2="20" y2="24.5" stroke="white" strokeWidth="1.5"/>
  </svg>
)

const AslLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="7" fill="#1B5E20"/>
    <text x="20" y="11" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="bold" fontFamily="Arial,sans-serif">AllStar</text>
    <text x="20" y="18" textAnchor="middle" fill="#A5D6A7" fontSize="5.5" fontFamily="Arial,sans-serif">Link</text>
    {/* 6-arm asterisk */}
    {[0, 60, 120].map((a, i) => {
      const rad = (a * Math.PI) / 180
      return (
        <line key={i}
          x1={20 + 9 * Math.cos(rad)} y1={27 + 9 * Math.sin(rad)}
          x2={20 - 9 * Math.cos(rad)} y2={27 - 9 * Math.sin(rad)}
          stroke="white" strokeWidth="2.5" strokeLinecap="round"
        />
      )
    })}
    <circle cx="20" cy="27" r="2.5" fill="#A5D6A7"/>
  </svg>
)

const DmrLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="7" fill="#0D47A1"/>
    <text x="20" y="12" textAnchor="middle" fill="white" fontSize="9.5" fontWeight="bold" fontFamily="Arial,sans-serif">DMR</text>
    {/* Diamond */}
    <polygon points="20,16 31,25 20,34 9,25" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
    <polygon points="20,20 27,25 20,30 13,25" fill="white" opacity="0.35"/>
    <circle cx="20" cy="25" r="2" fill="white"/>
  </svg>
)

const FusionLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="7" fill="#E65100"/>
    <text x="20" y="11" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="bold" fontFamily="Arial,sans-serif">C4FM</text>
    <text x="20" y="19" textAnchor="middle" fill="#FFCCBC" fontSize="5.5" fontFamily="Arial,sans-serif">FUSION</text>
    {/* Double wave */}
    <path d="M5 27 C10 22 15 32 20 27 C25 22 30 32 35 27" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <path d="M5 33 C10 28 15 38 20 33 C25 28 30 38 35 33" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.5"/>
  </svg>
)

const DstarLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="7" fill="#006064"/>
    <text x="20" y="12" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial,sans-serif">D-STAR</text>
    {/* 5-point star */}
    <polygon
      points="20,15 22.4,21.9 29.8,21.9 23.9,26.1 26.3,33 20,28.8 13.7,33 16.1,26.1 10.2,21.9 17.6,21.9"
      fill="white" opacity="0.92"
    />
  </svg>
)

// ─── SVG decorations ────────────────────────────────────────────────────────

const AntennaIcon = () => (
  <svg width="48" height="64" viewBox="0 0 48 64" fill="none" style={{ opacity: 0.15 }}>
    <line x1="24" y1="0" x2="24" y2="44" stroke="white" strokeWidth="3"/>
    <line x1="24" y1="20" x2="4"  y2="44" stroke="white" strokeWidth="2"/>
    <line x1="24" y1="20" x2="44" y2="44" stroke="white" strokeWidth="2"/>
    <line x1="24" y1="32" x2="10" y2="44" stroke="white" strokeWidth="1.5"/>
    <line x1="24" y1="32" x2="38" y2="44" stroke="white" strokeWidth="1.5"/>
    <rect x="10" y="44" width="28" height="6" rx="2" fill="white"/>
    <rect x="18" y="50" width="12" height="14" rx="2" fill="white"/>
  </svg>
)

const WaveLines = () => (
  <svg width="120" height="40" viewBox="0 0 120 40" fill="none" style={{ opacity: 0.12 }}>
    {[0, 12, 24, 36].map((y, i) => (
      <path key={i} d={`M0 ${20 + y - 24} Q30 ${y - 4} 60 ${20 + y - 24} Q90 ${40 + y - 24} 120 ${20 + y - 24}`}
        stroke="white" strokeWidth="1.5" fill="none"/>
    ))}
  </svg>
)

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

export default function PublicFMREPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [mapReady, setMapReady] = useState(false)

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
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    // Cargar el mapa de México
    fetch('/mexico-states.json')
      .then(r => r.json())
      .then(geo => {
        echarts.registerMap('Mexico', geo)
        setMapReady(true)
      })

    // Cargar estadísticas
    axios.get('/api/public/stats').then(r => setStats(r.data))
  }, [])

  const tendenciaOption = !stats ? {} : (() => {
    const meses = [...new Set(stats.rf.tendencia.map(t => t.mes))].sort()
    const sistemas = [...new Set(stats.rf.tendencia.map(t => t.sistema))].sort()
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: sistemas, bottom: 0, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 40, right: 16, top: 8, bottom: 60 },
      xAxis: {
        type: 'category',
        data: meses.map(m => dayjs(m).format('MMM YY')),
        axisLabel: { color: '#666', fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
      series: sistemas.map(sis => ({
        name: sis,
        type: 'bar',
        stack: 'total',
        data: meses.map(mes => stats.rf.tendencia.find(t => t.mes === mes && t.sistema === sis)?.total ?? 0),
        itemStyle: { color: SISTEMA_COLORS[sis] ?? '#999' },
      })),
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
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: plataformas, bottom: 0, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
      grid: { left: 40, right: 16, top: 8, bottom: 60 },
      xAxis: {
        type: 'category',
        data: meses.map(m => dayjs(m).format('MMM YY')),
        axisLabel: { color: '#666', fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
      series: plataformas.map(plat => ({
        name: plat,
        type: 'bar',
        stack: 'total',
        data: meses.map(mes => stats.rs.tendencia.find(t => t.mes === mes && t.plataforma === plat)?.total ?? 0),
        itemStyle: { color: PLAT_COLORS[plat] ?? '#999' },
      })),
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

  const mapaRSOption = !stats || !mapReady ? {} : {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => p.value ? `<b>${p.name}</b><br/>${p.value.toLocaleString()} reportes` : p.name,
    },
    visualMap: {
      min: 0, max: Math.max(...stats.rs.por_estado.map(e => e.total), 1),
      inRange: { color: ['#e0f7fa', '#0891b2'] },
      text: ['Alto', 'Bajo'], textStyle: { color: '#666', fontSize: 11 },
      calculable: true, orient: 'horizontal', left: 'center', bottom: 8,
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

  const mapaOption = !stats || !mapReady ? {} : {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => p.value ? `<b>${p.name}</b><br/>${p.value.toLocaleString()} reportes` : p.name,
    },
    visualMap: {
      min: 0, max: Math.max(...stats.rf.por_estado.map(e => e.total), 1),
      inRange: { color: [FMRE_LIGHT, FMRE_BLUE] },
      text: ['Alto', 'Bajo'], textStyle: { color: '#666', fontSize: 11 },
      calculable: true, orient: 'horizontal', left: 'center', bottom: 8,
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

  const isLoading = !stats

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f5f7fa', minHeight: '100vh' }}>

      {/* ── HEADER ── */}
      <header style={{ background: FMRE_DARK, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 72 }} />
          <div style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(18px, 2.5vw, 30px)', lineHeight: 1.2, letterSpacing: 0.3, textAlign: 'center' }}>
            Federación Mexicana de Radioexperimentadores, A.C.
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: `linear-gradient(135deg, ${FMRE_DARK} 0%, ${FMRE_BLUE} 100%)`,
        padding: '48px 32px', position: 'relative', overflow: 'hidden',
      }}>
        {/* decoraciones */}
        <div style={{ position: 'absolute', top: 16, right: 80 }}><AntennaIcon /></div>
        <div style={{ position: 'absolute', bottom: 8, left: 40 }}><WaveLines /></div>
        <div style={{ position: 'absolute', top: 12, left: '45%', opacity: 0.06, fontSize: 120, fontWeight: 900, color: 'white', letterSpacing: -4 }}>CQ</div>

        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ color: FMRE_GOLD, fontWeight: 700, letterSpacing: 3, fontSize: 12, marginBottom: 8 }}>
            ▶ CQ CQ DE XE1LM — ESTACIÓN OFICIAL DE LA FMRE
          </div>
          <Title level={1} style={{ color: 'white', margin: 0, fontSize: 'clamp(24px, 4vw, 42px)', lineHeight: 1.2 }}>
            Estadísticas Boletín Dominical
          </Title>
          <Paragraph style={{ color: '#8ab4e0', fontSize: 16, marginTop: 12, marginBottom: 32, maxWidth: 600 }}>
            Estadísticas en tiempo real de la actividad del Boletín Dominical,
            medio oficial de divulgación de la máxima autoridad de radioafición en México.
          </Paragraph>

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
        </div>
      </section>

      {/* ── ÚLTIMO EVENTO RF ── */}
      {stats?.ultimo_evento_rf && (
        <div
          onClick={handleUltimoEvento}
          style={{ background: FMRE_GOLD, padding: '10px 32px', textAlign: 'center', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.92)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          <Text style={{ fontWeight: 700, color: FMRE_DARK }}>
            <WifiOutlined style={{ marginRight: 8 }} />
            Último evento RF: <strong>{stats.ultimo_evento_rf.tipo}</strong> —{' '}
            {dayjs(stats.ultimo_evento_rf.ultima).format('D [de] MMMM [de] YYYY')} —{' '}
            {stats.ultimo_evento_rf.total_qsos.toLocaleString()} QSOs · {stats.ultimo_evento_rf.estaciones.toLocaleString()} estaciones
          </Text>
        </div>
      )}

      {/* ── ÚLTIMO EVENTO RS ── */}
      {stats?.ultimo_evento_rs && (
        <div
          onClick={handleUltimoEventoRS}
          style={{ background: '#0891b2', padding: '10px 32px', textAlign: 'center', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          <Text style={{ fontWeight: 700, color: 'white' }}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            Último evento RS: <strong>{stats.ultimo_evento_rs.tipo}</strong> —{' '}
            {dayjs(stats.ultimo_evento_rs.ultima).format('D [de] MMMM [de] YYYY')} —{' '}
            {stats.ultimo_evento_rs.total_qsos.toLocaleString()} QSOs · {stats.ultimo_evento_rs.estaciones.toLocaleString()} estaciones
          </Text>
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
              a través de los siguientes medios:
            </p>
          </div>

          <Row gutter={[16, 16]} style={{ alignItems: 'stretch' }}>
            {/* HF */}
            <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${SISTEMA_COLORS.HF}`, flex: 1 }}>
                <div style={{ color: SISTEMA_COLORS.HF, fontWeight: 800, fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📻 HF
                </div>
                <div style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>7.082 MHz</div>
                <div style={{ color: '#8ab4e0', fontSize: 12, marginBottom: 12 }}>LSB</div>
                <div style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>14.120 MHz</div>
                <div style={{ color: '#8ab4e0', fontSize: 12 }}>USB</div>
              </div>
            </Col>

            {/* IRLP + ASL */}
            <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${SISTEMA_COLORS.IRLP}`, flex: 1 }}>
                <div style={{ color: SISTEMA_COLORS.IRLP, fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
                  🔗 VoIP / Enlace
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <IrlpLogo size={38} />
                  <div>
                    <div style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>IRLP</div>
                    <div style={{ color: '#8ab4e0', fontSize: 13 }}>Reflector <strong style={{ color: 'white' }}>0077</strong></div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AslLogo size={38} />
                  <div>
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
                    <DmrLogo size={38} />
                    <div>
                      <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>TG 33450</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>BrandMeister</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px' }}>
                    <FusionLogo size={38} />
                    <div>
                      <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>C4FM / Fusion</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>vía Hub ASL</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px' }}>
                    <DstarLogo size={38} />
                    <div>
                      <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>D-Star</div>
                      <div style={{ color: '#8ab4e0', fontSize: 11 }}>vía Hub ASL</div>
                    </div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </section>

      {/* ── BÚSQUEDA ── */}
      <section style={{ background: 'white', borderBottom: `3px solid ${FMRE_BLUE}`, padding: '40px 32px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <Title level={3} style={{ color: FMRE_DARK, margin: 0 }}>¿Tomaron mi reporte?</Title>
          <Paragraph style={{ color: '#666', marginTop: 8, marginBottom: 24 }}>
            Consulta los reportes de tu estación registrados en el sistema.
            Ingresa tu indicativo y ve el historial de actividad en RF y redes sociales.
          </Paragraph>
          <Input.Search
            size="large"
            placeholder="Ej. XE2MBE, XE1LM, XE3AAA..."
            enterButton={<><SearchOutlined /> Buscar</>}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value.toUpperCase())}
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
                          pagination={false}
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
                          pagination={false}
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
          <Paragraph style={{ color: '#666', marginBottom: 24, maxWidth: 700 }}>
            Registro de estaciones participantes en boletines dominicales a través de sistemas de HF, AllStar, IRLP, DMR y otros.
          </Paragraph>

          <Row gutter={[16, 16]}>
            {/* Tendencia mensual */}
            <Col xs={24} lg={14}>
              <Card title={<span><RiseOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Actividad mensual (últimos 12 meses)</span>}
                    size="small" className="card-shadow">
                {isLoading ? <Spin /> : <ReactECharts option={tendenciaOption} style={{ height: 220 }} />}
              </Card>
            </Col>

            {/* Por sistema */}
            <Col xs={24} lg={10}>
              <Card title={<span><WifiOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Distribución por sistema</span>}
                    size="small" className="card-shadow">
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
                    size="small" className="card-shadow" style={{ flex: 1 }}>
                {isLoading || !mapReady
                  ? <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={mapaOption} style={{ height: 320 }} />}
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
                        <span style={{ fontWeight: 700, color: FMRE_BLUE, minWidth: 70 }}>{op.indicativo}</span>
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
                {isLoading ? <Spin /> : (
                  <ReactECharts
                    option={{
                      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
                        formatter: (p: any) => `<b>${p[0].name}</b>: ${p[0].value.toLocaleString()} reportes` },
                      grid: { left: 130, right: 48, top: 8, bottom: 8, containLabel: false },
                      xAxis: { type: 'value', axisLabel: { color: '#888', fontSize: 11 } },
                      yAxis: { type: 'category', axisLabel: { color: '#333', fontSize: 12 },
                        data: stats!.rf.por_estado.slice(0, 25).map(e => e.estado).reverse() },
                      series: [{
                        type: 'bar', barMaxWidth: 22,
                        data: stats!.rf.por_estado.slice(0, 25).map((e, i) => ({
                          value: e.total,
                          itemStyle: { color: `hsl(${215 - i * 6}, 70%, ${45 + i * 1.5}%)`, borderRadius: [0, 4, 4, 0] },
                        })).reverse(),
                        label: { show: true, position: 'right', fontSize: 11, color: '#555',
                          formatter: (p: any) => p.value.toLocaleString() },
                      }],
                    }}
                    style={{ height: Math.max(300, stats!.rf.por_estado.slice(0, 25).length * 28) }}
                  />
                )}
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
          <Paragraph style={{ color: '#666', marginBottom: 24, maxWidth: 700 }}>
            Seguimiento de la participación de radioaficionados en plataformas digitales
            durante los eventos de la FMRE. La comunidad XE también está presente en las redes.
          </Paragraph>

          <Row gutter={[16, 16]}>
            {/* Tendencia mensual RS */}
            <Col xs={24} lg={14}>
              <Card title={<span><RiseOutlined style={{ color: '#0891b2', marginRight: 8 }} />Actividad mensual por plataforma (últimos 12 meses)</span>}
                    size="small" className="card-shadow">
                {isLoading ? <Spin /> : <ReactECharts option={tendenciaRSOption} style={{ height: 220 }} />}
              </Card>
            </Col>

            {/* Distribución por plataforma pie + tabla */}
            <Col xs={24} lg={10}>
              <Card title={<span><GlobalOutlined style={{ color: '#0891b2', marginRight: 8 }} />Distribución por plataforma</span>}
                    size="small" className="card-shadow">
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
                    size="small" className="card-shadow" style={{ flex: 1 }}>
                {isLoading || !mapReady
                  ? <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={mapaRSOption} style={{ height: 320 }} />}
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
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', background: i < 3 ? '#0891b2' : '#e0f7fa',
                          color: i < 3 ? 'white' : '#666', fontWeight: 700, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ fontWeight: 700, color: '#0891b2', minWidth: 70 }}>{op.indicativo}</span>
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
                  {isLoading ? <Spin /> : (
                    <ReactECharts
                      option={{
                        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
                          formatter: (p: any) => `<b>${p[0].name}</b>: ${p[0].value.toLocaleString()} reportes` },
                        grid: { left: 130, right: 48, top: 8, bottom: 8, containLabel: false },
                        xAxis: { type: 'value', axisLabel: { color: '#888', fontSize: 11 } },
                        yAxis: { type: 'category', axisLabel: { color: '#333', fontSize: 12 },
                          data: stats!.rs.por_estado.slice(0, 25).map(e => e.estado).reverse() },
                        series: [{
                          type: 'bar', barMaxWidth: 22,
                          data: stats!.rs.por_estado.slice(0, 25).map((e, i) => ({
                            value: e.total,
                            itemStyle: { color: `hsl(${280 - i * 6}, 60%, ${45 + i * 1.5}%)`, borderRadius: [0, 4, 4, 0] },
                          })).reverse(),
                          label: { show: true, position: 'right', fontSize: 11, color: '#555',
                            formatter: (p: any) => p.value.toLocaleString() },
                        }],
                      }}
                      style={{ height: Math.max(300, stats!.rs.por_estado.slice(0, 25).length * 28) }}
                    />
                  )}
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
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: FMRE_BLUE }}>{v}</strong> },
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
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: FMRE_BLUE }}>{v}</strong> },
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
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: '#0891b2' }}>{v}</strong> },
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
                {ultimoEvDetalle?.evento ?? 'Último evento RF'} — {ultimoEvDetalle?.fecha ?? ''}
              </Title>
            </div>
            {loadingEv ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
              <Table
                dataSource={ultimoEvDetalle?.participantes ?? []}
                rowKey="indicativo"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: false }}
                columns={[
                  { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => (
                    <span style={{ fontWeight: 700, color: i < 3 ? FMRE_GOLD : '#8c8c8c' }}>{i + 1}</span>
                  )},
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: FMRE_BLUE }}>{v}</strong> },
                  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin registro</span> },
                  { title: 'Estado', dataIndex: 'estado', width: 120, ellipsis: true, render: (v: string | null) => v ?? '—' },
                  { title: 'QSOs', dataIndex: 'total', width: 90, align: 'right' as const,
                    render: (v: number, r: { sistemas: Record<string, number> }) => (
                      <Popover
                        trigger="click"
                        title="Desglose por sistema"
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
            )}
          </div>
        )}

        {/* ── ÚLTIMO EVENTO RS DETALLE ── */}
        {(ultimoEvRSDetalle || loadingEvRS) && (
          <div ref={evRSRef} style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <Divider style={{ borderColor: '#d0d7e3' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 4, height: 28, background: '#0891b2', borderRadius: 2 }} />
              <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
                {ultimoEvRSDetalle?.evento ?? 'Último evento RS'} — {ultimoEvRSDetalle?.fecha ?? ''}
              </Title>
            </div>
            {loadingEvRS ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
              <Table
                dataSource={ultimoEvRSDetalle?.participantes ?? []}
                rowKey="indicativo"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: false }}
                columns={[
                  { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => (
                    <span style={{ fontWeight: 700, color: i < 3 ? '#0891b2' : '#8c8c8c' }}>{i + 1}</span>
                  )},
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: '#0891b2' }}>{v}</strong> },
                  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin registro</span> },
                  { title: 'Estado', dataIndex: 'estado', width: 120, ellipsis: true, render: (v: string | null) => v ?? '—' },
                  { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const,
                    render: (v: number, r: { plataformas: Record<string, number> }) => (
                      <Popover
                        trigger="click"
                        title="Desglose por plataforma"
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
            )}
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: FMRE_DARK, padding: '20px 32px', marginTop: 16 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ color: FMRE_GOLD, fontWeight: 700, fontSize: 12 }}>73 de XE — Good DX</div>
          <a href="https://rcg.org.mx" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ color: '#8ab4e0', fontSize: 11 }}>Página diseñada por miembros del</span>
            <img src="/rcg_small.png" alt="Radio Club Guadiana" style={{ height: 20, width: 'auto', opacity: 0.9 }} />
            <span style={{ color: 'white', fontSize: 11, fontWeight: 600 }}>Radio Club Guadiana A.C.</span>
          </a>
        </div>
      </footer>

    </div>
  )
}
