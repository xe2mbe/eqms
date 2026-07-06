import { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Spin, Tabs, Table, Tag, Tooltip, Empty, Select } from 'antd'
import DateRangeBar from '@/components/common/DateRangeBar'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import { CHART_COLORS } from '@/components/dashboard/chartColors'
import { ZONA_COLORS, type EChartsFormatterParam } from '@/utils/estadisticasShared'
import CoberturaTab from '@/components/estadisticas/CoberturaTab'
import OperadorRankingCard from '@/components/estadisticas/OperadorRankingCard'
import type { TopIndicativo, ZonaActividad, RstPorZona, SistemaPorZona, TendenciaEvento } from '@/types'

const { Title, Text } = Typography

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
    '2020-01-01',
    dayjs().format('YYYY-MM-DD'),
  ])
  const [evento, setEvento]             = useState<number | undefined>()

  // Advanced stats
  const [horario, setHorario]           = useState<{ hora: number; total: number }[]>([])
  const [topOps, setTopOps]             = useState<TopIndicativo[]>([])
  const [rankingOps, setRankingOps]     = useState<{ usuario_id: number; nombre: string; total: number; posicion: number }[]>([])
  const [zonaAct, setZonaAct]           = useState<ZonaActividad[]>([])
  const [nuevos, setNuevos]             = useState<{ mes: string; nuevos: number }[]>([])
  const [retencion, setRetencion]       = useState<{ mes: string; activos: number; retenidos: number; tasa: number }[]>([])
  const [rstZona, setRstZona]           = useState<RstPorZona[]>([])
  const [sistZona, setSistZona]         = useState<SistemaPorZona[]>([])
  const [tendEv, setTendEv]             = useState<TendenciaEvento[]>([])
  const [eventosFiltro, setEventosFiltro] = useState<string[]>([])
  const [sistPorEv, setSistPorEv]       = useState<{ tipo: string; sistema: string; total: number }[]>([])
  const [sistEvFiltro, setSistEvFiltro] = useState<string[]>([])
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
      estadisticasApi.tendencia({ ...p, granularidad: 'mes' }),
      estadisticasApi.porSistema(p),
      estadisticasApi.porEstado(p),
      estadisticasApi.horario(p),
      estadisticasApi.topIndicativos({ ...p, limite: 20 }),
      estadisticasApi.zonaActividad(p),
      estadisticasApi.nuevosMensuales(p),
      estadisticasApi.retencion(p),
      estadisticasApi.rstPorZona(p),
      estadisticasApi.sistemasPorZona(p),
      estadisticasApi.tendenciaEventos(p),
      estadisticasApi.coberturaEstados(p),
      estadisticasApi.operadoresPeriodo(p),
      estadisticasApi.sistemasPorEvento(p),
    ])
    const ok = <T,>(i: number): T[] =>
      results[i].status === 'fulfilled' ? (results[i] as unknown as PromiseFulfilledResult<{ data: T[] }>).value.data : []
    setTendencia(ok(0)); setPorSistema(ok(1)); setPorEstado(ok(2))
    setHorario(ok(3));   setTopOps(ok(4));     setZonaAct(ok(5))
    setNuevos(ok(6));    setRetencion(ok(7));  setRstZona(ok(8))
    setSistZona(ok(9));  setTendEv(ok(10));    setCobertura(ok(11))
    setRankingOps(ok(12)); setSistPorEv(ok(13))
    setLoading(false)
  }

  // ── Chart options ─────────────────────────────────────────────────────────────

  const lineOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 16, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: tendencia.map(t => dayjs(t.periodo).format('MMM YY')) },
    yAxis: { type: 'value' },
    series: [{ data: tendencia.map(t => t.total), type: 'line', smooth: true,
      itemStyle: { color: '#5470c6' },
      lineStyle: { width: 2.5, color: '#5470c6' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(84,112,198,0.35)' },
            { offset: 1, color: 'rgba(84,112,198,0.02)' },
          ],
        },
      },
    }],
  }

  const hbarEstados = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 16, top: 8, bottom: 8, containLabel: false },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: porEstado.slice(0, 15).map(e => e.estado).reverse() },
    series: [{
      data: porEstado.slice(0, 15).map((e, i) => ({
        value: e.total,
        itemStyle: {
          color: CHART_COLORS[(14 - i) % CHART_COLORS.length],
          borderRadius: [0, 4, 4, 0],
        },
      })).reverse(),
      type: 'bar',
      label: { show: true, position: 'right', fontSize: 10 },
    }],
  }

  const sistPorEvData = sistPorEv.length > 0 ? sistPorEv
    : porSistema.map(r => ({ tipo: 'Sistema', sistema: r.sistema, total: r.total }))
  const sistEvTipos    = [...new Set(sistPorEvData.map(r => r.tipo))].sort()
  const sistEvSistemas = [...new Set(sistPorEvData.map(r => r.sistema))].sort()
  const sistEvFiltrados = sistEvFiltro.length > 0 ? sistEvFiltro : sistEvTipos
  const sistPorEvOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: sistEvSistemas, bottom: 0, type: 'scroll' },
    grid: { left: 8, right: 8, top: 10, bottom: 50, containLabel: true },
    xAxis: { type: 'category', data: sistEvFiltrados, axisLabel: { rotate: 20, fontSize: 11 } },
    yAxis: { type: 'value' },
    series: sistEvSistemas.map((s, i) => ({
      name: s, type: 'bar', stack: 'se',
      data: sistEvFiltrados.map(t => sistPorEvData.find(r => r.tipo === t && r.sistema === s)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  const horarioOption = {
    tooltip: { trigger: 'axis', formatter: (p: EChartsFormatterParam[]) => `${p[0].name}:00 hrs — ${p[0].value} contactos` },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: horario.map(h => `${h.hora}`) },
    yAxis: { type: 'value' },
    visualMap: { show: false, min: 0, max: Math.max(...horario.map(h => h.total), 1),
      inRange: { color: ['#dfe6f7', '#5470c6'] } },
    series: [{ data: horario.map(h => h.total), type: 'bar', barMaxWidth: 24,
      itemStyle: { borderRadius: [3, 3, 0, 0] } }],
  }

  const zonas = [...new Set(zonaAct.map(z => z.zona))]
  const zonaBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: zonas },
    yAxis: [{ type: 'value', name: 'Contactos' }, { type: 'value', name: 'Indicativos', position: 'right' }],
    series: [
      { name: 'Contactos', type: 'bar', data: zonas.map(z => zonaAct.find(r => r.zona === z)?.total ?? 0),
        itemStyle: { color: (p: EChartsFormatterParam) => ZONA_COLORS[p.name] ?? '#1677ff', borderRadius: [4, 4, 0, 0] } },
      { name: 'Indicativos únicos', type: 'line', yAxisIndex: 1, smooth: true,
        data: zonas.map(z => zonaAct.find(r => r.zona === z)?.indicativos ?? 0),
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
        itemStyle: { color: '#91cc75', borderRadius: [3, 3, 0, 0] } },
      { name: 'Acumulado', type: 'line', smooth: true,
        data: nuevos.reduce((acc: number[], n, i) => { acc.push((acc[i-1] ?? 0) + n.nuevos); return acc }, []),
        itemStyle: { color: '#5470c6' }, lineStyle: { width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(84,112,198,0.25)' },
              { offset: 1, color: 'rgba(84,112,198,0.02)' },
            ],
          },
        },
      },
    ],
  }

  const retencionOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: retencion.map(r => dayjs(r.mes).format('MMM YY')) },
    yAxis: [{ type: 'value', name: 'Operadores' }, { type: 'value', name: '%', max: 100, position: 'right' }],
    series: [
      { name: 'Activos', type: 'bar', data: retencion.map(r => r.activos), stack: 'r',
        itemStyle: { color: '#73c0de', borderRadius: [0,0,0,0] } },
      { name: 'Retenidos', type: 'bar', data: retencion.map(r => r.retenidos), stack: 'r',
        itemStyle: { color: '#91cc75', borderRadius: [3,3,0,0] } },
      { name: 'Tasa %', type: 'line', yAxisIndex: 1, smooth: true,
        data: retencion.map(r => r.tasa), itemStyle: { color: '#fac858' }, lineStyle: { width: 2.5 } },
    ],
  }

  const zonaList = [...new Set(rstZona.map(r => r.zona))].sort()
  const rstValues = [51, 53, 55, 57, 59]
  const rstHeatOption = {
    tooltip: { formatter: (p: EChartsFormatterParam) => {
      const [rst, zona, total] = p.value as (number | string)[]
      return `Zona ${zona} · RST ${rst}: ${total} contactos`
    } },
    grid: { left: 8, right: 80, top: 10, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: rstValues.map(String) },
    yAxis: { type: 'category', data: zonaList },
    visualMap: { min: 0, max: Math.max(...rstZona.map(r => r.total), 1), calculable: true,
      orient: 'vertical', right: 0, top: 'center',
      inRange: { color: ['#fff7e6', '#fc8452'] } },
    series: [{ type: 'heatmap', data: rstZona.map(r => [String(r.senal), r.zona, r.total]),
      label: { show: true, fontSize: 10 } }],
  }

  const sistZonas = [...new Set(sistZona.map(r => r.zona))].sort()
  const sistSistemas = [...new Set(sistZona.map(r => r.sistema))].sort()
  const sistZonaOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: sistSistemas, bottom: 0 },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: sistZonas },
    yAxis: { type: 'value' },
    series: sistSistemas.map((s, i) => ({
      name: s, type: 'bar', stack: 'sz',
      data: sistZonas.map(z => sistZona.find(r => r.zona === z && r.sistema === s)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  const evMeses = [...new Set(tendEv.map(r => r.mes))].sort()
  const evTipos = [...new Set(tendEv.map(r => r.tipo))].sort()
  const evLineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: evTipos, bottom: 0 },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: evMeses.map((m: string) => dayjs(m).format('MMM YY')) },
    yAxis: { type: 'value' },
    series: evTipos.map((t, i) => ({
      name: t, type: 'line', smooth: true,
      data: evMeses.map(m => tendEv.find(r => r.mes === m && r.tipo === t)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
  }

  const evTiposFiltrados = eventosFiltro.length > 0 ? eventosFiltro : evTipos
  const evLineOptionFiltrado = {
    tooltip: { trigger: 'axis' },
    legend: { data: evTiposFiltrados, bottom: 0 },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: evMeses.map((m: string) => dayjs(m).format('MMM YY')) },
    yAxis: { type: 'value' },
    series: evTiposFiltrados.map((t: string) => ({
      name: t, type: 'line', smooth: true,
      data: evMeses.map(m => tendEv.find(r => r.mes === m && r.tipo === t)?.total ?? 0),
      itemStyle: { color: CHART_COLORS[evTipos.indexOf(t) % CHART_COLORS.length] },
    })),
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
                <Col xs={24} lg={12}>
                  <Card title="Tendencia mensual de reportes" className="card-shadow">
                    {tendencia.length > 0
                      ? <ReactECharts option={lineOption} style={{ height: 260 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card
                    title="Tendencia mensual por evento"
                    className="card-shadow"
                    extra={
                      <Select
                        mode="multiple"
                        allowClear
                        placeholder="Todos los eventos"
                        style={{ minWidth: 180 }}
                        size="small"
                        value={eventosFiltro}
                        onChange={setEventosFiltro}
                        options={evTipos.map(t => ({ value: t, label: t }))}
                        maxTagCount="responsive"
                      />
                    }
                  >
                    {tendEv.length > 0
                      ? <ReactECharts option={evLineOptionFiltrado} style={{ height: 260 }} notMerge />
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
                  <Card
                    title="Actividad por Sistema"
                    className="card-shadow"
                    extra={
                      sistEvTipos.length > 1 && (
                        <Select
                          mode="multiple"
                          allowClear
                          placeholder="Todos los eventos"
                          style={{ minWidth: 180 }}
                          size="small"
                          value={sistEvFiltro}
                          onChange={setSistEvFiltro}
                          options={sistEvTipos.map(t => ({ value: t, label: t }))}
                          maxTagCount="responsive"
                        />
                      )
                    }
                  >
                    {sistPorEvData.length > 0
                      ? <ReactECharts option={sistPorEvOption} style={{ height: 320 }} notMerge />
                      : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 60 }} />
                    }
                  </Card>
                </Col>
                <Col xs={24}>
                  <OperadorRankingCard data={rankingOps} />
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
            key: 'operadores', label: '📻 Estaciones',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={14}>
                  <Card className="card-shadow"
                    title={<Tooltip title="Ranking de indicativos más activos">
                      🏆 Top 20 indicativos más activos
                    </Tooltip>}>
                    <Table<TopIndicativo>
                      dataSource={topOps} rowKey="indicativo" size="small"
                      pagination={false} scroll={{ y: 340 }}
                      locale={{ emptyText: <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      columns={[
                        { title: '#', width: 40, render: (_, _r, i) => <Text type="secondary">{i+1}</Text> },
                        { title: 'Indicativo', dataIndex: 'indicativo',
                          render: (v: string) => <Text strong style={{ color: '#1A569E', fontFamily: 'monospace', letterSpacing: 1 }}>{v}</Text> },
                        { title: 'Contactos', dataIndex: 'total', width: 90,
                          render: (v: number) => <Text strong>{v}</Text> },
                        { title: 'Estados', dataIndex: 'estados', width: 75,
                          render: (v: number) => <Tag color="blue">{v}</Tag> },
                        { title: 'Zonas', dataIndex: 'zonas', width: 70,
                          render: (v: number) => <Tag color="purple">{v}/5</Tag> },
                        { title: 'Nombre', dataIndex: 'nombre', ellipsis: true,
                          render: (v: string | null) => <Text type="secondary" style={{ fontSize: 11 }}>{v ?? '—'}</Text> },
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
                            {zonaAct.map(z => (
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
              <CoberturaTab
                cobertura={cobertura}
                unidadLabel="contactos"
                extraDetailColumns={[
                  { title: 'RST Prom.', dataIndex: 'senal_promedio', width: 90, align: 'center' as const,
                    render: (v: number) => v > 0 ? <Tag color="green">{v}</Tag> : <Text type="secondary">—</Text> },
                ]}
              />
            ),
          },

        ]} />
      </Spin>
    </div>
  )
}
