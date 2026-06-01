import { useEffect, useState, useRef } from 'react'
import { Row, Col, Card, Statistic, Tag, Typography, Divider, Spin } from 'antd'
import {
  WifiOutlined, GlobalOutlined, TeamOutlined, RiseOutlined,
  StarOutlined, RadarChartOutlined,
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
  ultimo_evento: { tipo: string; ultima: string; participantes: number } | null
}

export default function PublicFMREPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [mapReady, setMapReady] = useState(false)

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
          <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 48 }} />
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>FMRE</div>
            <div style={{ color: '#8ab4e0', fontSize: 11 }}>Federación Mexicana de Radioexperimentadores</div>
          </div>
        </div>
        <div style={{ color: '#8ab4e0', fontSize: 12, textAlign: 'right' }}>
          <div style={{ color: FMRE_GOLD, fontWeight: 700, fontSize: 14 }}>Sistema QMS</div>
          <div>Gestión de Actividad en Red</div>
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
            ▶ CQ CQ DE XE — ESTACIÓN EN EL AIRE
          </div>
          <Title level={1} style={{ color: 'white', margin: 0, fontSize: 'clamp(24px, 4vw, 42px)', lineHeight: 1.2 }}>
            Red Nacional de Radioaficionados
          </Title>
          <Paragraph style={{ color: '#8ab4e0', fontSize: 16, marginTop: 12, marginBottom: 32, maxWidth: 600 }}>
            Monitoreo en tiempo real de la actividad radioaficionada en México.
            Boletines dominicales, retransmisiones y presencia en redes sociales
            de la comunidad XE unida por las ondas hertzianas.
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
                  <div style={{
                    background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px',
                    borderTop: `3px solid ${item.color}`,
                  }}>
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

      {/* ── ULTIMO EVENTO ── */}
      {stats?.ultimo_evento && (
        <div style={{ background: FMRE_GOLD, padding: '10px 32px', textAlign: 'center' }}>
          <Text style={{ fontWeight: 700, color: FMRE_DARK }}>
            <StarOutlined style={{ marginRight: 8 }} />
            Último evento registrado: <strong>{stats.ultimo_evento.tipo}</strong> —{' '}
            {dayjs(stats.ultimo_evento.ultima).format('D [de] MMMM [de] YYYY')} —{' '}
            {stats.ultimo_evento.participantes.toLocaleString()} participantes
          </Text>
        </div>
      )}

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>

        {/* ── SECCIÓN RF ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 4, height: 28, background: FMRE_BLUE, borderRadius: 2 }} />
            <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
              Actividad Radioaficionada — Tradicional (RF)
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
            <Col xs={24} lg={14}>
              <Card title={<span><GlobalOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Cobertura por estado</span>}
                    size="small" className="card-shadow">
                {isLoading || !mapReady
                  ? <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>
                  : <ReactECharts option={mapaOption} style={{ height: 320 }} />}
              </Card>
            </Col>

            {/* Top indicativos RF */}
            <Col xs={24} lg={10}>
              <Card title={<span><StarOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Top 10 estaciones más activas</span>}
                    size="small" className="card-shadow" style={{ height: '100%' }}>
                {isLoading ? <Spin /> : (
                  <div>
                    {stats!.rf.top_indicativos.map((op, i) => (
                      <div key={op.indicativo} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 0', borderBottom: i < 9 ? '1px solid #f0f0f0' : undefined,
                      }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', background: i < 3 ? FMRE_GOLD : FMRE_LIGHT,
                          color: i < 3 ? FMRE_DARK : '#666', fontWeight: 700, fontSize: 12,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{i + 1}</span>
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
        <div style={{ marginBottom: 40 }}>
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

      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: FMRE_DARK, padding: '24px 32px', marginTop: 16 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 36, opacity: 0.9 }} />
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>Federación Mexicana de Radioexperimentadores</div>
              <div style={{ color: '#8ab4e0', fontSize: 11 }}>Sistema QMS — Gestión de Actividad en Red</div>
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
