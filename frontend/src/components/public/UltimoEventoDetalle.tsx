import type { ReactNode } from 'react'
import { Row, Col, Card, Tag, Typography, Divider, Spin, Table, Popover } from 'antd'
import ReactECharts from 'echarts-for-react'
import { WifiOutlined, GlobalOutlined } from '@ant-design/icons'
import { FMRE_BLUE, FMRE_DARK, FMRE_GOLD, SISTEMA_COLORS, PLAT_COLORS } from '@/utils/publicFmreShared'

const { Title } = Typography

interface ParticipanteDetalle {
  indicativo: string
  nombre: string | null
  total: number
  estado: string | null
  categorias: Record<string, number>
}

interface UltimoEventoDetalleProps {
  variant: 'rf' | 'rs'
  loading: boolean
  evento: string | null | undefined
  fecha: string | null | undefined
  participantes: ParticipanteDetalle[]
  mapReady: boolean
  onIndicativoClick: (indicativo: string) => void
}

interface DetalleTheme {
  titlePrefix: string
  accentColor: string
  callSignColor: string
  mapColorRange: [string, string]
  mapEmphasisColor: string
  pieTitleColor: string
  categoryColors: Record<string, string>
  pieFallbackColor: string
  popoverFallbackColor: string
  popoverMinWidth: number
  secondCardIcon: ReactNode
  secondCardTitle: string
  unitLabel: string
  popoverTitle: string
  tagColor: string
}

const THEMES: Record<'rf' | 'rs', DetalleTheme> = {
  rf: {
    titlePrefix: 'RF',
    accentColor: FMRE_GOLD,
    callSignColor: FMRE_BLUE,
    mapColorRange: ['#FFF9C4', FMRE_GOLD],
    mapEmphasisColor: FMRE_BLUE,
    pieTitleColor: FMRE_DARK,
    categoryColors: SISTEMA_COLORS,
    pieFallbackColor: '#999',
    popoverFallbackColor: '#666',
    popoverMinWidth: 140,
    secondCardIcon: <WifiOutlined style={{ color: FMRE_GOLD, marginRight: 8 }} />,
    secondCardTitle: 'Reportes por sistema',
    unitLabel: 'QSOs',
    popoverTitle: 'Desglose por sistema',
    tagColor: 'gold',
  },
  rs: {
    titlePrefix: 'RS',
    accentColor: '#0891b2',
    callSignColor: '#0891b2',
    mapColorRange: ['#e0f7fa', '#0891b2'],
    mapEmphasisColor: FMRE_GOLD,
    pieTitleColor: '#0891b2',
    categoryColors: PLAT_COLORS,
    pieFallbackColor: '#0891b2',
    popoverFallbackColor: '#0891b2',
    popoverMinWidth: 160,
    secondCardIcon: <GlobalOutlined style={{ color: '#0891b2', marginRight: 8 }} />,
    secondCardTitle: 'Reportes por plataforma',
    unitLabel: 'Reportes',
    popoverTitle: 'Desglose por plataforma',
    tagColor: 'cyan',
  },
}

/** Sección "Divider + título + mapa/pie + tabla" del detalle del último evento (RF/RS). */
export default function UltimoEventoDetalle({ variant, loading, evento, fecha, participantes, mapReady, onIndicativoClick }: UltimoEventoDetalleProps) {
  const theme = THEMES[variant]

  const callSign = (v: string) => (
    <strong
      style={{ color: theme.callSignColor, cursor: 'pointer', textDecoration: 'none' }}
      onClick={() => onIndicativoClick(v)}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      title={`Ver historial de ${v}`}
    >
      {v}
    </strong>
  )

  return (
    <>
      <Divider style={{ borderColor: '#d0d7e3' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 28, background: theme.accentColor, borderRadius: 2 }} />
        <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>
          {theme.titlePrefix} · {evento ?? 'Último evento'} — {fecha ?? ''}
        </Title>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (() => {
        const porEstado = participantes.reduce((acc, p) => {
          if (p.estado) acc[p.estado] = (acc[p.estado] ?? 0) + 1
          return acc
        }, {} as Record<string, number>)
        const maxEstado = Math.max(...Object.values(porEstado), 1)

        const porCategoria = participantes.reduce((acc, p) => {
          Object.entries(p.categorias).forEach(([c, n]) => { acc[c] = (acc[c] ?? 0) + n })
          return acc
        }, {} as Record<string, number>)

        const totalCategoria = Object.values(porCategoria).reduce((s, n) => s + n, 0)
        const totalEstado = Object.values(porEstado).reduce((s, n) => s + n, 0)
        const mapOption = !mapReady ? {} : {
          tooltip: {
            trigger: 'item',
            formatter: (p: any) => p.value
              ? `<b>${p.name}</b><br/>${p.value} estación${p.value > 1 ? 'es' : ''}<br/><span style="color:#888">${(p.value / totalEstado * 100).toFixed(1)}% del total</span>`
              : p.name,
          },
          visualMap: {
            min: 0, max: maxEstado,
            inRange: { color: theme.mapColorRange },
            show: false,
          },
          series: [{
            type: 'map', map: 'Mexico', roam: false,
            emphasis: { label: { show: true }, itemStyle: { areaColor: theme.mapEmphasisColor } },
            data: Object.entries(porEstado).map(([estado, count]) => ({ name: estado, value: count })),
            nameMap: {
              'Ciudad de México': 'Ciudad De México',
              'Estado De México': 'México',
            },
          }],
        }

        return (
          <>
            {/* Mapa + resumen de categorías */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={24} lg={14}>
                <Card size="small" title={<span><GlobalOutlined style={{ color: theme.accentColor, marginRight: 8 }} />Cobertura geográfica del evento</span>} className="card-shadow">
                  {mapReady
                    ? <ReactECharts option={mapOption} style={{ height: 300 }} />
                    : <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>}
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card size="small" title={<span>{theme.secondCardIcon}{theme.secondCardTitle}</span>} className="card-shadow" style={{ height: '100%' }}>
                  <ReactECharts
                    option={{
                      title: { text: totalCategoria.toLocaleString(), subtext: theme.unitLabel, left: '50%', top: '40%', textAlign: 'center', textStyle: { fontSize: 16, fontWeight: 'bold', color: theme.pieTitleColor }, subtextStyle: { fontSize: 11, color: '#888' } },
                      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                      series: [{
                        type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
                        data: Object.entries(porCategoria).map(([c, n]) => ({
                          name: c, value: n,
                          itemStyle: { color: theme.categoryColors[c] ?? theme.pieFallbackColor },
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
              pagination={{ pageSize: 50, showSizeChanger: false, showTotal: t => `${t} estaciones` }}
              columns={[
                { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => (
                  <span style={{ fontWeight: 700, color: i < 3 ? theme.accentColor : '#8c8c8c' }}>{i + 1}</span>
                )},
                { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v) },
                { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin registro</span> },
                { title: 'Estado', dataIndex: 'estado', width: 120, ellipsis: true, render: (v: string | null) => v ?? '—' },
                { title: theme.unitLabel, dataIndex: 'total', width: 90, align: 'right' as const,
                  render: (v: number, r: ParticipanteDetalle) => (
                    <Popover trigger="click" title={theme.popoverTitle}
                      content={
                        <div style={{ minWidth: theme.popoverMinWidth }}>
                          {Object.entries(r.categorias).map(([c, n]) => (
                            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '2px 0' }}>
                              <Tag color={theme.categoryColors[c] ?? theme.popoverFallbackColor} style={{ margin: 0 }}>{c}</Tag>
                              <strong>{n}</strong>
                            </div>
                          ))}
                        </div>
                      }
                    >
                      <Tag color={theme.tagColor} style={{ cursor: 'pointer', fontWeight: 700 }}>{v.toLocaleString()} ▾</Tag>
                    </Popover>
                  )},
              ]}
            />
          </>
        )
      })()}
    </>
  )
}
