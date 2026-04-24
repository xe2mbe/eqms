import { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Spin, Tabs, Table, Tag, Tooltip, Empty, Progress } from 'antd'
import DateRangeBar from '@/components/common/DateRangeBar'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import client from '@/api/client'

const { Title, Text } = Typography

const ZONA_COLORS: Record<string, string> = {
  XE1: '#1677ff', XE2: '#52c41a', XE3: '#fa8c16', XE4: '#722ed1', XE5: '#eb2f96',
}
const CHART_COLORS = ['#1A569E','#52c41a','#fa8c16','#722ed1','#eb2f96','#13c2c2','#faad14','#2f54eb']

type CoberturaEstado = {
  abreviatura: string; nombre: string; zona: string
  total: number; indicativos: number; senal_promedio: number
}

export default function EstadisticasPage() {
  const [loading, setLoading]           = useState(false)
  const [tendencia, setTendencia]       = useState<{ periodo: string; total: number }[]>([])
  const [porSistema, setPorSistema]     = useState<{ sistema: string; total: number }[]>([])
  const [porEstado, setPorEstado]       = useState<{ estado: string; total: number }[]>([])
  const [dateRange, setDateRange]       = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ])
  const [evento, setEvento]             = useState<number | undefined>()

  // Advanced stats
  const [horario, setHorario]           = useState<{ hora: number; total: number }[]>([])
  const [topOps, setTopOps]             = useState<any[]>([])
  const [zonaAct, setZonaAct]           = useState<any[]>([])
  const [nuevos, setNuevos]             = useState<{ mes: string; nuevos: number }[]>([])
  const [retencion, setRetencion]       = useState<{ mes: string; activos: number; retenidos: number; tasa: number }[]>([])
  const [rstZona, setRstZona]           = useState<any[]>([])
  const [sistZona, setSistZona]         = useState<any[]>([])
  const [tendEv, setTendEv]             = useState<any[]>([])
  const [cobertura, setCobertura]       = useState<CoberturaEstado[]>([])

  // Fetch oldest record date on mount to set default range
  useEffect(() => {
    estadisticasApi.primeraActividad().then(r => {
      if (r.data.fecha) {
        setDateRange([r.data.fecha, dayjs().format('YYYY-MM-DD')])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => { loadAll() }, [dateRange, evento])

  const loadAll = async () => {
    setLoading(true)
    const p = { fecha_inicio: dateRange[0], fecha_fin: dateRange[1], evento_id: evento }
    const results = await Promise.allSettled([
      estadisticasApi.tendencia({ ...p, granularidad: 'dia' }),
      estadisticasApi.porSistema(p),
      estadisticasApi.porEstado(p),
      client.get('/estadisticas/horario', { params: p }),
      client.get('/estadisticas/top-indicativos', { params: { ...p, limite: 20 } }),
      client.get('/estadisticas/zona-actividad', { params: p }),
      estadisticasApi.nuevosMensuales(p),
      estadisticasApi.retencion(p),
      client.get('/estadisticas/rst-por-zona', { params: p }),
      client.get('/estadisticas/sistemas-por-zona', { params: p }),
      client.get('/estadisticas/tendencia-eventos', { params: p }),
      estadisticasApi.coberturaEstados(p),
    ])
    const ok = (i: number) =>
      results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<any>).value.data : []
    setTendencia(ok(0)); setPorSistema(ok(1)); setPorEstado(ok(2))
    setHorario(ok(3));   setTopOps(ok(4));     setZonaAct(ok(5))
    setNuevos(ok(6));    setRetencion(ok(7));  setRstZona(ok(8))
    setSistZona(ok(9));  setTendEv(ok(10));    setCobertura(ok(11))
    setLoading(false)
  }

  // ── Chart options ─────────────────────────────────────────────────────────────

  const lineOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 16, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: tendencia.map(t => dayjs(t.periodo).format('DD/MM')) },
    yAxis: { type: 'value' },
    series: [{ data: tendencia.map(t => t.total), type: 'line', smooth: true,
      areaStyle: { opacity: .15 }, itemStyle: { color: '#1A569E' } }],
  }

  const hbarEstados = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 16, top: 8, bottom: 8, containLabel: false },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: porEstado.slice(0, 15).map(e => e.estado).reverse() },
    series: [{ data: porEstado.slice(0, 15).map(e => e.total).reverse(),
      type: 'bar', itemStyle: { color: '#1A569E', borderRadius: [0, 4, 4, 0] } }],
  }

  const radarSistemas = {
    tooltip: {},
    radar: { indicator: porSistema.slice(0, 8).map(s => ({
      name: s.sistema, max: Math.max(...porSistema.map(x => x.total), 1),
    })) },
    series: [{ type: 'radar', data: [{ value: porSistema.slice(0, 8).map(s => s.total), name: 'Reportes',
      itemStyle: { color: '#1A569E' }, areaStyle: { opacity: .2 } }] }],
  }

  const horarioOption = {
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}:00 hrs — ${p[0].value} contactos` },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: horario.map(h => `${h.hora}`) },
    yAxis: { type: 'value' },
    visualMap: { show: false, min: 0, max: Math.max(...horario.map(h => h.total), 1),
      inRange: { color: ['#bae0ff', '#1A569E'] } },
    series: [{ data: horario.map(h => h.total), type: 'bar', barMaxWidth: 24,
      itemStyle: { borderRadius: [3, 3, 0, 0] } }],
  }

  const zonas = [...new Set(zonaAct.map((z: any) => z.zona))]
  const zonaBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: zonas },
    yAxis: [{ type: 'value', name: 'Contactos' }, { type: 'value', name: 'Indicativos', position: 'right' }],
    series: [
      { name: 'Contactos', type: 'bar', data: zonas.map(z => zonaAct.find((r: any) => r.zona === z)?.total ?? 0),
        itemStyle: { color: (p: any) => ZONA_COLORS[p.name] ?? '#1677ff', borderRadius: [4, 4, 0, 0] } },
      { name: 'Indicativos únicos', type: 'line', yAxisIndex: 1, smooth: true,
        data: zonas.map(z => zonaAct.find((r: any) => r.zona === z)?.indicativos ?? 0),
        itemStyle: { color: '#fa8c16' }, lineStyle: { width: 2 } },
    ],
  }

  const nuevosOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: nuevos.map(n => dayjs(n.mes).format('MMM YY')) },
    yAxis: { type: 'value' },
    series: [
      { name: 'Nuevos indicativos', type: 'bar', data: nuevos.map(n => n.nuevos),
        itemStyle: { color: '#52c41a', borderRadius: [3, 3, 0, 0] } },
      { name: 'Acumulado', type: 'line', smooth: true,
        data: nuevos.reduce((acc: number[], n, i) => { acc.push((acc[i-1] ?? 0) + n.nuevos); return acc }, []),
        itemStyle: { color: '#1A569E' } },
    ],
  }

  const retencionOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: retencion.map(r => dayjs(r.mes).format('MMM YY')) },
    yAxis: [{ type: 'value', name: 'Operadores' }, { type: 'value', name: '%', max: 100, position: 'right' }],
    series: [
      { name: 'Activos', type: 'bar', data: retencion.map(r => r.activos), stack: 'r',
        itemStyle: { color: '#1677ff', borderRadius: [0,0,0,0] } },
      { name: 'Retenidos', type: 'bar', data: retencion.map(r => r.retenidos), stack: 'r',
        itemStyle: { color: '#52c41a', borderRadius: [3,3,0,0] } },
      { name: 'Tasa %', type: 'line', yAxisIndex: 1, smooth: true,
        data: retencion.map(r => r.tasa), itemStyle: { color: '#fa8c16' } },
    ],
  }

  const zonaList = [...new Set(rstZona.map((r: any) => r.zona))].sort()
  const rstValues = [51, 53, 55, 57, 59]
  const rstHeatOption = {
    tooltip: { formatter: (p: any) => `Zona ${p.value[1]} · RST ${p.value[0]}: ${p.value[2]} contactos` },
    grid: { left: 8, right: 80, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: rstValues.map(String) },
    yAxis: { type: 'category', data: zonaList },
    visualMap: { min: 0, max: Math.max(...rstZona.map((r: any) => r.total), 1), calculable: true,
      orient: 'vertical', right: 0, top: 'center',
      inRange: { color: ['#f0f8ff', '#1A569E'] } },
    series: [{ type: 'heatmap', data: rstZona.map((r: any) => [String(r.senal), r.zona, r.total]),
      label: { show: true, fontSize: 10 } }],
  }

  const sistZonas = [...new Set(sistZona.map((r: any) => r.zona))].sort()
  const sistSistemas = [...new Set(sistZona.map((r: any) => r.sistema))].sort()
  const sistZonaOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: sistSistemas, bottom: 0 },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: sistZonas },
    yAxis: { type: 'value' },
    series: sistSistemas.map((s, i) => ({
      name: s, type: 'bar', stack: 'sz',
      data: sistZonas.map(z => sistZona.find((r: any) => r.zona === z && r.sistema === s)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  const evMeses = [...new Set(tendEv.map((r: any) => r.mes))].sort()
  const evTipos = [...new Set(tendEv.map((r: any) => r.tipo))].sort()
  const evLineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: evTipos, bottom: 0 },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: evMeses.map((m: string) => dayjs(m).format('MMM YY')) },
    yAxis: { type: 'value' },
    series: evTipos.map((t, i) => ({
      name: t, type: 'line', smooth: true,
      data: evMeses.map(m => tendEv.find((r: any) => r.mes === m && r.tipo === t)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  // ── Cobertura charts ──────────────────────────────────────────────────────────

  const zonasCobertura = Object.keys(ZONA_COLORS)
  const coberturaByZona = zonasCobertura.map(z => {
    const estados = cobertura.filter(e => e.zona === z)
    const activos = estados.filter(e => e.total > 0)
    const totalContactos = estados.reduce((s, e) => s + e.total, 0)
    const totalIndicativos = estados.reduce((s, e) => s + e.indicativos, 0)
    return { zona: z, estados: estados.length, activos: activos.length, totalContactos, totalIndicativos }
  }).filter(z => z.estados > 0)

  const coberturaBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: ['Contactos', 'Indicativos únicos'] },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: coberturaByZona.map(z => z.zona) },
    yAxis: [
      { type: 'value', name: 'Contactos' },
      { type: 'value', name: 'Indicativos', position: 'right' },
    ],
    series: [
      {
        name: 'Contactos', type: 'bar', barMaxWidth: 48,
        data: coberturaByZona.map(z => ({ value: z.totalContactos, itemStyle: { color: ZONA_COLORS[z.zona] ?? '#1677ff', borderRadius: [4,4,0,0] } })),
      },
      {
        name: 'Indicativos únicos', type: 'line', yAxisIndex: 1, smooth: true,
        data: coberturaByZona.map(z => z.totalIndicativos),
        itemStyle: { color: '#fa8c16' }, lineStyle: { width: 2 },
      },
    ],
  }

  const coberturaActivos = cobertura.filter(e => e.total > 0)

  const coberturaEstadoBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p: any) => `${p[0].name}: ${p[0].value} contactos` },
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
        <Title level={4} style={{ margin: 0 }}>Estadísticas RF</Title>
        <DateRangeBar
          value={dateRange}
          onChange={setDateRange}
          ultimoEventoEndpoint="/estadisticas/ultima-actividad"
          evento={evento}
          onEventoChange={setEvento}
        />
      </div>

      <Spin spinning={loading}>
        <Tabs defaultActiveKey="tradicional" items={[

          // ── Tab: Reportes ────────────────────────────────────────────────────
          {
            key: 'tradicional', label: 'Reportes',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card title="Tendencia diaria de reportes" className="card-shadow">
                    {tendencia.length > 0
                      ? <ReactECharts option={lineOption} style={{ height: 240 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Top 15 Estados con más actividad" className="card-shadow">
                    {porEstado.length > 0
                      ? <ReactECharts option={hbarEstados} style={{ height: 320 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 60 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Actividad por Sistema" className="card-shadow">
                    {porSistema.length > 0
                      ? <ReactECharts option={radarSistemas} style={{ height: 320 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 60 }} />
                    }
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab: Propagación ─────────────────────────────────────────────────
          {
            key: 'propagacion', label: '📡 Propagación',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Ventanas horarias de mayor actividad — útil para programar eventos y redes">
                      ⏰ Actividad por hora del día (tiempo México)
                    </Tooltip>}>
                    {horario.length > 0
                      ? <ReactECharts option={horarioOption} style={{ height: 280 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Calidad promedio de señal RST por zona">
                      📶 Calidad de señal (RST) por zona FMRE
                    </Tooltip>}>
                    {rstZona.length > 0
                      ? <ReactECharts option={rstHeatOption} style={{ height: 280 }} notMerge />
                      : <Empty description="Sin datos de RST por zona en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Sistemas de comunicación usados en cada zona">
                      🔧 Sistemas de comunicación por zona FMRE
                    </Tooltip>}>
                    {sistZona.length > 0
                      ? <ReactECharts option={sistZonaOption} style={{ height: 300 }} notMerge />
                      : <Empty description="Sin datos de sistemas por zona" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab: Operadores ──────────────────────────────────────────────────
          {
            key: 'operadores', label: '👥 Operadores',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={14}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Ranking de indicativos más activos">
                      🏆 Top 20 indicativos más activos
                    </Tooltip>}>
                    <Table
                      dataSource={topOps} rowKey="indicativo" size="small"
                      pagination={false} scroll={{ y: 340 }}
                      locale={{ emptyText: <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      columns={[
                        { title: '#', width: 40, render: (_: any, _r: any, i: number) => <Text type="secondary">{i+1}</Text> },
                        { title: 'Indicativo', dataIndex: 'indicativo',
                          render: (v: string) => <Text strong style={{ color: '#1A569E', fontFamily: 'monospace', letterSpacing: 1 }}>{v}</Text> },
                        { title: 'Contactos', dataIndex: 'total', width: 90,
                          render: (v: number) => <Text strong>{v}</Text> },
                        { title: 'Estados', dataIndex: 'estados', width: 75,
                          render: (v: number) => <Tag color="blue">{v}</Tag> },
                        { title: 'Zonas', dataIndex: 'zonas', width: 70,
                          render: (v: number) => <Tag color="purple">{v}/5</Tag> },
                        { title: 'Nombre', dataIndex: 'nombre', ellipsis: true,
                          render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v ?? '—'}</Text> },
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={10}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Contactos, indicativos únicos y señal promedio por zona">
                      🗺️ Actividad por zona FMRE
                    </Tooltip>}>
                    {zonaAct.length > 0
                      ? <>
                          <ReactECharts option={zonaBarOption} style={{ height: 220 }} notMerge />
                          <Row gutter={8} style={{ marginTop: 12 }}>
                            {zonaAct.map((z: any) => (
                              <Col key={z.zona} span={Math.floor(24 / Math.max(zonaAct.length, 1))}>
                                <Card size="small" style={{ textAlign: 'center', borderColor: ZONA_COLORS[z.zona] ?? '#ddd', borderWidth: 2 }}>
                                  <Tag style={{ backgroundColor: ZONA_COLORS[z.zona] ?? '#1677ff', color: '#fff', fontWeight: 700 }}>{z.zona}</Tag>
                                  <div style={{ fontSize: 11, color: '#888' }}>RST ~{z.senal_promedio}</div>
                                </Card>
                              </Col>
                            ))}
                          </Row>
                        </>
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab: Crecimiento ─────────────────────────────────────────────────
          {
            key: 'crecimiento', label: '📈 Crecimiento',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Primeras apariciones de indicativos por mes">
                      🆕 Nuevos indicativos por mes (crecimiento de la red)
                    </Tooltip>}>
                    {nuevos.length > 0
                      ? <ReactECharts option={nuevosOption} style={{ height: 280 }} notMerge />
                      : <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Qué porcentaje de operadores activos en un mes también estuvo activo el mes anterior">
                      🔄 Retención mensual de operadores
                    </Tooltip>}>
                    {retencion.length > 0
                      ? <ReactECharts option={retencionOption} style={{ height: 280 }} notMerge />
                      : <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Tendencia de participación por tipo de evento">
                      📋 Tendencia por tipo de evento
                    </Tooltip>}>
                    {tendEv.length > 0
                      ? <ReactECharts option={evLineOption} style={{ height: 300 }} notMerge />
                      : <Empty description="Sin datos de eventos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
              </Row>
            ),
          },

          // ── Tab: Cobertura ───────────────────────────────────────────────────
          {
            key: 'cobertura', label: '🗺️ Cobertura',
            children: (
              <Row gutter={[16, 16]}>

                {/* Resumen por zona */}
                <Col xs={24}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Contactos e indicativos únicos por zona FMRE en el período">
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
                        <span><strong>{z.totalContactos.toLocaleString()}</strong> contactos</span>
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
                  <Card className="card-shadow"
                    title="Detalle por estado">
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
                        { title: 'Contactos', dataIndex: 'total', width: 100, align: 'right' as const,
                          render: (v: number) => v > 0
                            ? <Text strong style={{ color: '#1A569E' }}>{v.toLocaleString()}</Text>
                            : <Text type="secondary">—</Text>
                        },
                        { title: 'Indicativos', dataIndex: 'indicativos', width: 100, align: 'right' as const,
                          render: (v: number) => v > 0 ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
                        { title: 'RST Prom.', dataIndex: 'senal_promedio', width: 90, align: 'center' as const,
                          render: (v: number) => v > 0 ? <Tag color="green">{v}</Tag> : <Text type="secondary">—</Text> },
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
