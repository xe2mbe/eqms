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
  DMR: '#722ed1', FUSION: '#eb2f96', DSTAR: '#13c2c2',
  P25: '#f5222d', M17: '#fadb14', ECHOLINK: '#a0d911',
}

const PLAT_COLORS: Record<string, string> = {
  Facebook: '#1877F2', 'Facebook - Radioaficionados XE': '#4267B2',
  Zello: '#FF6B00', Instagram: '#E1306C', Telegram: '#0088CC',
  YouTube: '#FF0000', 'Twitter / X': '#1DA1F2',
}

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
    tendencia: { mes: string; total: number }[]
    top_indicativos: { indicativo: string; nombre: string | null; total: number }[]
    paises: { pais: string; indicativos: number }[]
  }
  rs: {
    total: number; indicativos: number
    por_plataforma: { plataforma: string; total: number }[]
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

  const [estacionesRF, setEstacionesRF]           = useState<EstacionItem[] | null>(null)
  const [estacionesRS, setEstacionesRS]           = useState<EstacionItem[] | null>(null)
  const [ultimoEvDetalle, setUltimoEvDetalle]     = useState<UltimoEvDetalle | null>(null)
  const [ultimoEvRSDetalle, setUltimoEvRSDetalle] = useState<UltimoEvRSDetalle | null>(null)
  const [loadingEstRF, setLoadingEstRF]           = useState(false)
  const [loadingEstRS, setLoadingEstRS]           = useState(false)
  const [loadingEv, setLoadingEv]                 = useState(false)
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

  const tendenciaOption = !stats ? {} : {
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>${p[0].value} reportes` },
    grid: { left: 40, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: stats.rf.tendencia.map(t => dayjs(t.mes).format('MMM YY')),
      axisLabel: { color: '#666', fontSize: 11 },
    },
    yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
    series: [{
      type: 'bar', data: stats.rf.tendencia.map(t => t.total),
      itemStyle: { color: FMRE_BLUE, borderRadius: [4, 4, 0, 0] },
    }],
  }

  const sistemaOption = !stats ? {} : {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['45%', '75%'], center: ['38%', '50%'],
      data: stats.rf.por_sistema.map(s => ({
        name: s.sistema, value: s.total,
        itemStyle: { color: SISTEMA_COLORS[s.sistema] ?? FMRE_BLUE },
      })),
      label: { show: false },
    }],
  }

  const plataformaOption = !stats ? {} : {
    tooltip: { trigger: 'axis' },
    grid: { left: 160, right: 16, top: 8, bottom: 8 },
    xAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
    yAxis: {
      type: 'category', axisLabel: { color: '#333', fontSize: 12 },
      data: [...stats.rs.por_plataforma].reverse().map(p => p.plataforma),
    },
    series: [{
      type: 'bar', barMaxWidth: 32,
      data: [...stats.rs.por_plataforma].reverse().map(p => ({
        value: p.total,
        itemStyle: { color: PLAT_COLORS[p.plataforma] ?? FMRE_BLUE, borderRadius: [0, 4, 4, 0] },
      })),
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
      <header style={{ background: FMRE_DARK, padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 52 }} />
          <div style={{ color: 'white', fontWeight: 800, fontSize: 'clamp(14px, 2vw, 22px)', lineHeight: 1.2, letterSpacing: 0.3 }}>
            Federación Mexicana de Radioexperimentadores, A.C.
          </div>
        </div>
        <div style={{ color: '#8ab4e0', fontSize: 12, textAlign: 'right' }}>
          <div style={{ color: FMRE_GOLD, fontWeight: 700, fontSize: 14 }}>Sistema QMS</div>
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
          style={{ background: '#722ed1', padding: '10px 32px', textAlign: 'center', cursor: 'pointer' }}
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

      {/* ── BÚSQUEDA ── */}
      <section style={{ background: 'white', borderBottom: `3px solid ${FMRE_BLUE}`, padding: '40px 32px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <Title level={3} style={{ color: FMRE_DARK, margin: 0 }}>¿Tomaron mi reporte?</Title>
          <Paragraph style={{ color: '#666', marginTop: 8, marginBottom: 24 }}>
            Consulta los reportes de cualquier estación radioaficionada registrados en el sistema.
            Ingresa un indicativo y ve su historial de actividad en RF y redes sociales.
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
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#722ed1' }}>{resultado.rs.total.toLocaleString()}</div>
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
                      <Card title={<span style={{ color: '#722ed1' }}>📱 Actividad en Redes Sociales</span>}
                            size="small" style={{ height: '100%' }}>
                        <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
                          Primera actividad: <strong>{resultado.rs.primera}</strong>
                          {resultado.rs.primera !== resultado.rs.ultima && <> · Última: <strong>{resultado.rs.ultima}</strong></>}
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          {resultado.rs.por_plataforma.map(p => (
                            <Tag key={p.plataforma} color={PLAT_COLORS[p.plataforma] ?? '#722ed1'} style={{ marginBottom: 4 }}>
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
                              ? <Tag color={PLAT_COLORS[v] ?? '#722ed1'} style={{ fontSize: 11 }}>{v}</Tag> : '—' },
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
            <Tag color={FMRE_BLUE} style={{ fontWeight: 700 }}>HF · VHF · UHF · Digital</Tag>
          </div>
          <Paragraph style={{ color: '#666', marginBottom: 24, maxWidth: 700 }}>
            Registro de estaciones participantes en boletines dominicales, retransmisiones y
            actividades especiales de la FMRE a través de sistemas de HF, AllStar, IRLP, DMR y otros.
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
                {isLoading ? <Spin /> : <ReactECharts option={sistemaOption} style={{ height: 220 }} />}
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
                <Card title={<span><GlobalOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Estaciones internacionales participantes</span>}
                      size="small" className="card-shadow">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {stats.rf.paises.map(p => (
                      <Tag key={p.pais} color="geekblue" style={{ fontSize: 13, padding: '4px 10px' }}>
                        {p.pais} · <strong>{p.indicativos}</strong> estaciones
                      </Tag>
                    ))}
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
            <div style={{ width: 4, height: 28, background: '#722ed1', borderRadius: 2 }} />
            <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
              Actividad en Redes Sociales (RS)
            </Title>
            <Tag color="purple" style={{ fontWeight: 700 }}>Facebook · Zello · y más</Tag>
          </div>
          <Paragraph style={{ color: '#666', marginBottom: 24, maxWidth: 700 }}>
            Seguimiento de la participación de radioaficionados en plataformas digitales
            durante los eventos de la FMRE. La comunidad XE también está presente en las redes.
          </Paragraph>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Reportes por plataforma" size="small" className="card-shadow">
                {isLoading ? <Spin /> : (
                  <ReactECharts option={plataformaOption}
                    style={{ height: Math.max(120, stats!.rs.por_plataforma.length * 44) }} />
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title={<span><StarOutlined style={{ color: '#722ed1', marginRight: 8 }} />Top 10 estaciones más activas en RS</span>}
                    size="small" className="card-shadow">
                {isLoading ? <Spin /> : (
                  <div>
                    {stats!.rs.top_indicativos.map((op, i) => (
                      <div key={op.indicativo} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 0', borderBottom: i < 9 ? '1px solid #f0f0f0' : undefined,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', background: i < 3 ? '#722ed1' : '#f5f0ff',
                          color: i < 3 ? 'white' : '#666', fontWeight: 700, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ fontWeight: 700, color: '#722ed1', minWidth: 70 }}>{op.indicativo}</span>
                        <span style={{ color: '#666', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {op.nombre ?? '—'}
                        </span>
                        <Tag color="purple" style={{ fontWeight: 700, minWidth: 48, textAlign: 'center' }}>
                          {op.total.toLocaleString()}
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </div>

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
              <div style={{ width: 4, height: 28, background: '#722ed1', borderRadius: 2 }} />
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
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: '#722ed1' }}>{v}</strong> },
                  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? '—' },
                  { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const, render: (v: number) => <Tag color="purple">{v.toLocaleString()}</Tag> },
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
              <div style={{ width: 4, height: 28, background: '#722ed1', borderRadius: 2 }} />
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
                    <span style={{ fontWeight: 700, color: i < 3 ? '#722ed1' : '#8c8c8c' }}>{i + 1}</span>
                  )},
                  { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => <strong style={{ color: '#722ed1' }}>{v}</strong> },
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
                                <Tag color={PLAT_COLORS[p] ?? '#722ed1'} style={{ margin: 0 }}>{p}</Tag>
                                <strong>{n}</strong>
                              </div>
                            ))}
                          </div>
                        }
                      >
                        <Tag color="purple" style={{ cursor: 'pointer', fontWeight: 700 }}>{v.toLocaleString()} ▾</Tag>
                      </Popover>
                    )},
                ]}
              />
            )}
          </div>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: FMRE_DARK, padding: '24px 32px', marginTop: 16 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 36, opacity: 0.9 }} />
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>Federación Mexicana de Radioexperimentadores, A.C.</div>
            </div>
          </div>
          <div style={{ color: '#8ab4e0', fontSize: 11, textAlign: 'right' }}>
            <div>Datos actualizados en tiempo real</div>
            <div style={{ color: FMRE_GOLD, marginTop: 4 }}>73 de XE — Good DX</div>
          </div>
        </div>
      </footer>

    </div>
  )
}
