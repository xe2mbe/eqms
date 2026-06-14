import { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Spin, Tabs, Table, Tag, Tooltip, Select, Empty, Progress } from 'antd'
import DateRangeBar from '@/components/common/DateRangeBar'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'

const { Title, Text } = Typography

const ZONA_COLORS: Record<string, string> = {
  XE1: '#1677ff', XE2: '#52c41a', XE3: '#fa8c16', XE4: '#722ed1', XE5: '#eb2f96',
}
const CHART_COLORS = [
  '#5470c6','#91cc75','#fac858','#ee6666','#73c0de',
  '#3ba272','#fc8452','#9a60b4','#ea7ccc','#27727b',
]

const METRICA_LABELS: Record<string, string> = {
  me_gusta: 'Me gusta', comentarios: 'Comentarios', compartidos: 'Compartidos',
  reproducciones: 'Reproducciones', seguidores: 'Seguidores', alcance: 'Alcance',
  impresiones: 'Impresiones', reacciones: 'Reacciones', guardados: 'Guardados',
  interacciones: 'Interacciones',
}

type TendRow       = { periodo: string; plataforma: string; total: number }
type EstadoPlat    = { plataforma: string; estado: string; total: number }
type TopOp         = { plataforma: string; indicativo: string; total: number; estados: number; zonas: number; ultimo: string | null; nombre: string | null }
type ZonaRow       = { plataforma: string; zona: string; total: number; indicativos: number }
type NuevoRow      = { mes: string; plataforma: string; nuevos: number }
type ResumenRow    = { plataforma: string; color: string; slug: string; total: number }
type MetricaTend   = { periodo: string; plataforma: string; slug: string; total: number }
type CoberturaRS   = { abreviatura: string; nombre: string; zona: string; total: number; indicativos: number }

export default function EstadisticasRSPage() {
  const [loading, setLoading]             = useState(false)
  const [dateRange, setDateRange]         = useState<[string, string]>([
    '2020-01-01',
    dayjs().format('YYYY-MM-DD'),
  ])
  const [tendencia, setTendencia]         = useState<TendRow[]>([])
  const [porEstadoPlat, setPorEstadoPlat] = useState<EstadoPlat[]>([])
  const [topOps, setTopOps]               = useState<TopOp[]>([])
  const [zonaAct, setZonaAct]             = useState<ZonaRow[]>([])
  const [nuevos, setNuevos]               = useState<NuevoRow[]>([])
  const [resumen, setResumen]             = useState<ResumenRow[]>([])
  const [metricaTend, setMetricaTend]     = useState<MetricaTend[]>([])
  const [coberturaRS, setCoberturaRS]     = useState<CoberturaRS[]>([])
  const [rankingOpsRS, setRankingOpsRS]   = useState<{ usuario_id: number; nombre: string; total: number; posicion: number }[]>([])
  const [platFilter, setPlatFilter]       = useState<string | undefined>()
  const [loadingMetricas, setLoadingMetricas] = useState(false)

  const p = { fecha_inicio: dateRange[0], fecha_fin: dateRange[1] }

  useEffect(() => { loadAll() }, [dateRange])

  const loadAll = async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      estadisticasApi.rsTendencia({ ...p, granularidad: 'dia' }),
      estadisticasApi.rsPorEstadoPlataforma(p),
      estadisticasApi.rsTopIndicativos({ ...p, limite: 20 }),
      estadisticasApi.rsZonaActividad(p),
      estadisticasApi.rsNuevosMensuales(),
      estadisticasApi.rsResumen(p),
      estadisticasApi.rsCoberturaEstados(p),
      estadisticasApi.rsOperadoresPeriodo(p),
    ])
    const ok = <T,>(i: number): T[] =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<any>).value.data : []
    setTendencia(ok(0)); setPorEstadoPlat(ok(1)); setTopOps(ok(2))
    setZonaAct(ok(3));   setNuevos(ok(4));        setResumen(ok(5))
    setCoberturaRS(ok(6)); setRankingOpsRS(ok(7))
    setLoading(false)
  }

  useEffect(() => { loadMetricaTend() }, [dateRange, platFilter])

  const loadMetricaTend = async () => {
    setLoadingMetricas(true)
    try {
      const { data } = await estadisticasApi.rsTendenciaMetricas({ ...p, granularidad: 'dia' })
      setMetricaTend(data)
    } catch { setMetricaTend([]) }
    finally { setLoadingMetricas(false) }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const plataformas = [...new Set(tendencia.map(r => r.plataforma))]
  const periodos    = [...new Set(tendencia.map(r => r.periodo))].sort()

  // ── Tab 1: Reportes ──────────────────────────────────────────────────────────

  const totalPorPlat = plataformas.map((pl, i) => ({
    plataforma: pl,
    total: tendencia.filter(r => r.plataforma === pl).reduce((s, r) => s + r.total, 0),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const barPlatOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 16, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: totalPorPlat.map(r => r.plataforma) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      data: totalPorPlat.map(r => ({ value: r.total, itemStyle: { color: r.color, borderRadius: [4,4,0,0] } })),
      type: 'bar', label: { show: true, position: 'top', fontSize: 12, fontWeight: 'bold' },
    }],
  }

  const tendLineOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: plataformas },
    grid: { left: 8, right: 8, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: periodos.map(d => dayjs(d).format('DD/MM')) },
    yAxis: { type: 'value', minInterval: 1 },
    series: plataformas.map((pl, i) => {
      const c = CHART_COLORS[i % CHART_COLORS.length]
      const hex = c.replace('#','')
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
      return {
        name: pl, type: 'line', smooth: true,
        data: periodos.map(per => tendencia.find(r => r.periodo === per && r.plataforma === pl)?.total ?? 0),
        itemStyle: { color: c },
        lineStyle: { width: 2, color: c },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `rgba(${r},${g},${b},0.25)` },
              { offset: 1, color: `rgba(${r},${g},${b},0.02)` },
            ],
          },
        },
      }
    }),
  }

  const estadosList = [...new Set(porEstadoPlat.map(r => r.estado))]
    .sort((a, b) => {
      const ta = porEstadoPlat.filter(r => r.estado === a).reduce((s, r) => s + r.total, 0)
      const tb = porEstadoPlat.filter(r => r.estado === b).reduce((s, r) => s + r.total, 0)
      return tb - ta
    })

  const estadosPlatOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: plataformas },
    grid: { left: 130, right: 16, top: 8, bottom: 40, containLabel: false },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: estadosList.slice(0, 12).reverse() },
    series: plataformas.map((pl, i) => ({
      name: pl, type: 'bar', stack: 'estados',
      data: estadosList.slice(0, 12).reverse().map(
        est => porEstadoPlat.find(r => r.plataforma === pl && r.estado === est)?.total ?? 0
      ),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      label: { show: true, fontSize: 10 },
    })),
  }

  // ── Tab 2: Operadores — por plataforma ───────────────────────────────────────

  const topColumns = [
    { title: '#', width: 36, render: (_: any, _r: any, i: number) =>
        <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text> },
    { title: 'Indicativo', dataIndex: 'indicativo',
      render: (v: string) => <Text strong style={{ color: '#1A569E', fontFamily: 'monospace', letterSpacing: 1 }}>{v}</Text> },
    { title: 'Reportes', dataIndex: 'total', width: 80,
      render: (v: number) => <Text strong>{v}</Text> },
    { title: 'Estados', dataIndex: 'estados', width: 70,
      render: (v: number) => <Tag color="blue">{v}</Tag> },
    { title: 'Zonas', dataIndex: 'zonas', width: 65,
      render: (v: number) => <Tag color="purple">{v}/5</Tag> },
    { title: 'Nombre', dataIndex: 'nombre', ellipsis: true,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v ?? '—'}</Text> },
  ]

  const plataformasOps = [...new Set(topOps.map(r => r.plataforma))]

  // Zona: grouped bar por plataforma
  const zonas = [...new Set(zonaAct.map(z => z.zona))].sort()
  const plataformasZona = [...new Set(zonaAct.map(z => z.plataforma))]

  const zonaGroupedOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: plataformasZona },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: zonas },
    yAxis: { type: 'value', minInterval: 1 },
    series: plataformasZona.map((pl, i) => ({
      name: pl, type: 'bar', barMaxWidth: 36,
      data: zonas.map(z => zonaAct.find(r => r.plataforma === pl && r.zona === z)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [3,3,0,0] },
      label: { show: true, position: 'top', fontSize: 10 },
    })),
  }

  // ── Tab 3: Crecimiento — por plataforma ──────────────────────────────────────

  const plataformasNuevos = [...new Set(nuevos.map(r => r.plataforma))]
  const mesesNuevos = [...new Set(nuevos.map(r => r.mes))].sort()

  const nuevosOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: plataformasNuevos },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: mesesNuevos.map(m => dayjs(m).format('MMM YY')) },
    yAxis: { type: 'value', minInterval: 1 },
    series: plataformasNuevos.map((pl, i) => ({
      name: pl, type: 'bar', stack: 'nuevos',
      data: mesesNuevos.map(m => nuevos.find(r => r.mes === m && r.plataforma === pl)?.nuevos ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  const crecPlatOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: plataformas },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: periodos.map(d => dayjs(d).format('DD/MM')) },
    yAxis: { type: 'value', minInterval: 1 },
    series: plataformas.map((pl, i) => ({
      name: pl, type: 'bar', stack: 'plat',
      data: periodos.map(per => tendencia.find(r => r.periodo === per && r.plataforma === pl)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  // ── Tab 4: Métricas — por plataforma ─────────────────────────────────────────

  const plataformasMetricas = [...new Set(resumen.map(r => r.plataforma))]

  const metricaBarOptions = (platFilter ? [platFilter] : plataformasMetricas).map(plat => {
    const items = resumen.filter(r => r.plataforma === plat)
    const color = items[0]?.color ?? '#1677ff'
    return {
      plat, color,
      option: {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
        xAxis: { type: 'category', data: items.map(r => METRICA_LABELS[r.slug] ?? r.slug), axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{
          data: items.map(r => r.total),
          type: 'bar', label: { show: true, position: 'top', fontSize: 11 },
          itemStyle: { color, borderRadius: [4,4,0,0] },
        }],
      },
    }
  })

  const mPeriodos = [...new Set(metricaTend.map(r => r.periodo))].sort()
  const filteredTend = platFilter ? metricaTend.filter(r => r.plataforma === platFilter) : metricaTend
  const mSlugs = [...new Set(filteredTend.map(r => r.slug))]

  const metricaTendOption = {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: mSlugs.map(s => METRICA_LABELS[s] ?? s) },
    grid: { left: 8, right: 8, top: 16, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: mPeriodos.map(d => dayjs(d).format('DD/MM')) },
    yAxis: { type: 'value' },
    series: mSlugs.map((slug, i) => ({
      name: METRICA_LABELS[slug] ?? slug,
      type: 'line', smooth: true,
      data: mPeriodos.map(per =>
        filteredTend.filter(r => r.periodo === per && r.slug === slug).reduce((s, r) => s + r.total, 0)
      ),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      areaStyle: { opacity: 0.08 },
    })),
  }

  // ── Tab 5: Cobertura ─────────────────────────────────────────────────────────

  const zonasCobertura = Object.keys(ZONA_COLORS)
  const coberturaByZona = zonasCobertura.map(z => {
    const estados = coberturaRS.filter(e => e.zona === z)
    const activos = estados.filter(e => e.total > 0)
    const totalContactos = estados.reduce((s, e) => s + e.total, 0)
    const totalIndicativos = estados.reduce((s, e) => s + e.indicativos, 0)
    return { zona: z, estados: estados.length, activos: activos.length, totalContactos, totalIndicativos }
  }).filter(z => z.estados > 0)

  const coberturaBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: ['Reportes', 'Indicativos únicos'] },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: coberturaByZona.map(z => z.zona) },
    yAxis: [
      { type: 'value', name: 'Reportes' },
      { type: 'value', name: 'Indicativos', position: 'right' },
    ],
    series: [
      {
        name: 'Reportes', type: 'bar', barMaxWidth: 48,
        data: coberturaByZona.map(z => ({ value: z.totalContactos, itemStyle: { color: ZONA_COLORS[z.zona] ?? '#1677ff', borderRadius: [4,4,0,0] } })),
      },
      {
        name: 'Indicativos únicos', type: 'line', yAxisIndex: 1, smooth: true,
        data: coberturaByZona.map(z => z.totalIndicativos),
        itemStyle: { color: '#fa8c16' }, lineStyle: { width: 2 },
      },
    ],
  }

  const coberturaActivos = coberturaRS.filter(e => e.total > 0)

  const coberturaEstadoBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p: any) => `${p[0].name}: ${p[0].value} reportes` },
    grid: { left: 140, right: 16, top: 8, bottom: 8, containLabel: false },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: coberturaActivos.map(e => e.abreviatura).reverse(),
    },
    series: [{
      type: 'bar',
      data: coberturaActivos.map(e => ({
        value: e.total,
        itemStyle: { color: ZONA_COLORS[e.zona] ?? '#aaa', borderRadius: [0, 4, 4, 0] },
      })).reverse(),
      label: { show: true, position: 'right', fontSize: 10 },
    }],
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Estadísticas RS</Title>
        <DateRangeBar
          value={dateRange}
          onChange={setDateRange}
          ultimoEventoEndpoint="/estadisticas/rs/ultima-actividad"
        />
      </div>

      <Spin spinning={loading}>
        <Tabs defaultActiveKey="reportes" items={[

          // ── Tab 1: Reportes ────────────────────────────────────────────────
          {
            key: 'reportes', label: 'Reportes',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={10}>
                  <Card title="Total de reportes por plataforma" className="card-shadow">
                    {totalPorPlat.length > 0
                      ? <ReactECharts option={barPlatOption} style={{ height: 240 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={14}>
                  <Card title="Tendencia diaria por plataforma" className="card-shadow">
                    {tendencia.length > 0
                      ? <ReactECharts option={tendLineOption} style={{ height: 240 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card title="Estados con actividad por plataforma" className="card-shadow">
                    {porEstadoPlat.length > 0
                      ? <ReactECharts option={estadosPlatOption}
                          style={{ height: Math.max(300, estadosList.slice(0,12).length * 28 + 80) }} notMerge />
                      : <Empty description="Sin datos de estados en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card title="📋 Capturas por operador" className="card-shadow">
                    <Table
                      dataSource={rankingOpsRS}
                      rowKey="usuario_id"
                      size="small"
                      pagination={false}
                      scroll={{ y: 320 }}
                      locale={{ emptyText: <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      columns={[
                        { title: '#', dataIndex: 'posicion', width: 48,
                          render: (v: number) => <span style={{ color: v <= 3 ? '#fa8c16' : '#8c8c8c', fontWeight: 700 }}>{v}</span> },
                        { title: 'Operador', dataIndex: 'nombre', ellipsis: true,
                          render: (v: string) => <strong>{v}</strong> },
                        { title: 'QSOs', dataIndex: 'total', width: 80, align: 'right' as const,
                          render: (v: number) => <span style={{ fontWeight: 700, color: '#1A569E' }}>{v.toLocaleString()}</span> },
                        { title: 'Participación', key: 'pct', width: 140,
                          render: (_: unknown, r: { total: number }) => {
                            const totalGeneral = rankingOpsRS.reduce((s, o) => s + o.total, 0) || 1
                            const pct = Math.round((r.total / totalGeneral) * 100)
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 8 }}>
                                  <div style={{ width: `${pct}%`, background: '#1A569E', borderRadius: 4, height: 8 }} />
                                </div>
                                <span style={{ fontSize: 11, color: '#8c8c8c', minWidth: 28 }}>{pct}%</span>
                              </div>
                            )
                          }},
                      ]}
                      summary={() => {
                        const total = rankingOpsRS.reduce((s, o) => s + o.total, 0)
                        return (
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={2}>
                              <strong>Total</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right">
                              <strong style={{ color: '#1A569E' }}>{total.toLocaleString()}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2} />
                          </Table.Summary.Row>
                        )
                      }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab 2: Operadores ──────────────────────────────────────────────
          {
            key: 'operadores', label: '👥 Operadores',
            children: (
              <Row gutter={[16, 16]}>
                {plataformasOps.length === 0
                  ? <Col xs={24}><Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 60 }} /></Col>
                  : plataformasOps.map((pl, i) => (
                      <Col key={pl} xs={24} lg={plataformasOps.length === 1 ? 24 : 12}>
                        <Card className="card-shadow"
                          title={<span style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                            🏆 Top indicativos — {pl}
                          </span>}
                          styles={{ header: { borderLeft: `4px solid ${CHART_COLORS[i % CHART_COLORS.length]}` } }}>
                          <Table
                            dataSource={topOps.filter(r => r.plataforma === pl)}
                            rowKey="indicativo" size="small"
                            pagination={false} scroll={{ y: 300 }}
                            columns={topColumns}
                          />
                        </Card>
                      </Col>
                    ))
                }
                <Col xs={24}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Reportes por zona FMRE separados por plataforma">
                      🗺️ Actividad por zona FMRE por plataforma
                    </Tooltip>}>
                    {zonaAct.length > 0
                      ? <>
                          <ReactECharts option={zonaGroupedOption} style={{ height: 260 }} notMerge />
                          <Row gutter={8} style={{ marginTop: 12 }}>
                            {zonas.map(z => (
                              <Col key={z} span={Math.floor(24 / Math.max(zonas.length, 1))}>
                                <Card size="small" style={{ textAlign: 'center',
                                  borderColor: ZONA_COLORS[z] ?? '#ddd', borderWidth: 2 }}>
                                  <Tag style={{ backgroundColor: ZONA_COLORS[z] ?? '#1677ff', color: '#fff', fontWeight: 700 }}>{z}</Tag>
                                  {plataformasZona.map((pl, i) => {
                                    const row = zonaAct.find(r => r.zona === z && r.plataforma === pl)
                                    return row ? (
                                      <div key={pl} style={{ fontSize: 10, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                                        {pl}: {row.indicativos} ind.
                                      </div>
                                    ) : null
                                  })}
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </>
                      : <Empty description="Sin datos de zonas en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab 3: Crecimiento ─────────────────────────────────────────────
          {
            key: 'crecimiento', label: '📈 Crecimiento',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Primeras apariciones de indicativos por plataforma y mes">
                      🆕 Nuevos indicativos por mes y plataforma
                    </Tooltip>}>
                    {nuevos.length > 0
                      ? <ReactECharts option={nuevosOption} style={{ height: 280 }} notMerge />
                      : <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Reportes diarios acumulados por plataforma">
                      📊 Reportes por plataforma (apilado diario)
                    </Tooltip>}>
                    {tendencia.length > 0
                      ? <ReactECharts option={crecPlatOption} style={{ height: 280 }} notMerge />
                      : <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab 4: Métricas ────────────────────────────────────────────────
          {
            key: 'metricas', label: '📊 Métricas',
            children: (
              <Spin spinning={loadingMetricas}>
                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <Card className="card-shadow"
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Tooltip title="Evolución temporal de las métricas capturadas">
                            📈 Tendencia de métricas
                          </Tooltip>
                          <Select allowClear placeholder="Todas las plataformas"
                            style={{ width: 200, fontWeight: 'normal' }}
                            value={platFilter} onChange={setPlatFilter}
                            options={plataformasMetricas.map(pl => ({ value: pl, label: pl }))}
                          />
                        </div>
                      }>
                      {filteredTend.length > 0
                        ? <ReactECharts option={metricaTendOption} style={{ height: 280 }} notMerge />
                        : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                      }
                    </Card>
                  </Col>
                  {metricaBarOptions.length === 0
                    ? <Col xs={24}>
                        <Empty description="Sin métricas capturadas en el período"
                          image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 60 }} />
                      </Col>
                    : metricaBarOptions.map(({ plat, color, option }) => (
                        <Col key={plat} xs={24} lg={12}>
                          <Card className="card-shadow" title={<span style={{ color }}>{plat}</span>}
                            styles={{ header: { borderLeft: `4px solid ${color}` } }}>
                            <ReactECharts option={option} style={{ height: 220 }} notMerge />
                          </Card>
                        </Col>
                      ))
                  }
                </Row>
              </Spin>
            ),
          },

          // ── Tab 5: Cobertura ───────────────────────────────────────────────
          {
            key: 'cobertura', label: '🗺️ Cobertura',
            children: (
              <Row gutter={[16, 16]}>

                {/* Resumen por zona */}
                <Col xs={24}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Reportes e indicativos únicos por zona FMRE en el período">
                      📊 Actividad por zona FMRE
                    </Tooltip>}>
                    {coberturaByZona.length > 0
                      ? <ReactECharts option={coberturaBarOption} style={{ height: 240 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>

                {/* Cards de zonas con cobertura de estados */}
                {coberturaByZona.length > 0 && coberturaByZona.map(z => (
                  <Col key={z.zona} xs={24} sm={12} lg={Math.floor(24 / Math.max(coberturaByZona.length, 1)) as any}>
                    <Card size="small" className="card-shadow"
                      style={{ borderTop: `4px solid ${ZONA_COLORS[z.zona] ?? '#1677ff'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Tag style={{ backgroundColor: ZONA_COLORS[z.zona] ?? '#1677ff', color: '#fff', fontWeight: 800, fontSize: 14 }}>
                          {z.zona}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>{z.activos}/{z.estados} estados activos</Text>
                      </div>
                      <Progress
                        percent={z.estados > 0 ? Math.round(z.activos / z.estados * 100) : 0}
                        strokeColor={ZONA_COLORS[z.zona] ?? '#1677ff'}
                        size="small" style={{ marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span><strong>{z.totalContactos.toLocaleString()}</strong> reportes</span>
                        <span><strong>{z.totalIndicativos}</strong> indicativos</span>
                      </div>
                    </Card>
                  </Col>
                ))}

                {/* Cobertura por estado — barra horizontal */}
                <Col xs={24}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Todos los estados con actividad en el período, coloreados por zona FMRE">
                      🏛️ Cobertura por estado (coloreado por zona)
                    </Tooltip>}
                    extra={
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Object.entries(ZONA_COLORS).map(([z, c]) => (
                          <Tag key={z} style={{ backgroundColor: c, color: '#fff', fontWeight: 600 }}>{z}</Tag>
                        ))}
                      </div>
                    }>
                    {coberturaActivos.length > 0
                      ? <ReactECharts
                          option={coberturaEstadoBarOption}
                          style={{ height: Math.max(300, coberturaActivos.length * 22 + 40) }}
                          notMerge
                        />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>

                {/* Tabla completa */}
                <Col xs={24}>
                  <Card className="card-shadow" title="Detalle por estado">
                    <Table
                      dataSource={coberturaActivos}
                      rowKey="abreviatura"
                      size="small"
                      pagination={{ pageSize: 16, showSizeChanger: false }}
                      locale={{ emptyText: <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      columns={[
                        { title: 'Estado', dataIndex: 'abreviatura', width: 80,
                          render: (v: string) => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text> },
                        { title: 'Nombre', dataIndex: 'nombre', ellipsis: true },
                        { title: 'Zona', dataIndex: 'zona', width: 80, align: 'center' as const,
                          render: (v: string) => v
                            ? <Tag style={{ backgroundColor: ZONA_COLORS[v] ?? '#1677ff', color: '#fff', fontWeight: 600 }}>{v}</Tag>
                            : <span style={{ color: '#ccc' }}>—</span>
                        },
                        { title: 'Reportes', dataIndex: 'total', width: 100, align: 'right' as const,
                          render: (v: number) => v > 0
                            ? <Text strong style={{ color: '#1A569E' }}>{v.toLocaleString()}</Text>
                            : <Text type="secondary">—</Text>
                        },
                        { title: 'Indicativos', dataIndex: 'indicativos', width: 100, align: 'right' as const,
                          render: (v: number) => v > 0 ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
                      ]}
                    />
                  </Card>
                </Col>

              </Row>
            ),
          },
        ]} />
      </Spin>
    </div>
  )
}
