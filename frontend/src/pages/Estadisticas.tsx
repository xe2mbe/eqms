import { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, DatePicker, Spin, Tabs } from 'antd'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import type { EstadisticaRS } from '@/types'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function EstadisticasPage() {
  const [loading, setLoading] = useState(false)
  const [tendencia, setTendencia] = useState<{ periodo: string; total: number }[]>([])
  const [porSistema, setPorSistema] = useState<{ sistema: string; total: number }[]>([])
  const [porEstado, setPorEstado] = useState<{ estado: string; total: number }[]>([])
  const [rsData, setRsData] = useState<EstadisticaRS[]>([])
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ])

  useEffect(() => { loadAll() }, [dateRange])

  const loadAll = async () => {
    setLoading(true)
    const p = { fecha_inicio: dateRange[0], fecha_fin: dateRange[1] }
    try {
      const [t, s, e, rs] = await Promise.all([
        estadisticasApi.tendencia({ ...p, granularidad: 'dia' }),
        estadisticasApi.porSistema(p),
        estadisticasApi.porEstado(p),
        estadisticasApi.rsResumen(p),
      ])
      setTendencia(t.data)
      setPorSistema(s.data)
      setPorEstado(e.data)
      setRsData(rs.data)
    } finally {
      setLoading(false)
    }
  }

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
    radar: { indicator: porSistema.slice(0, 8).map(s => ({ name: s.sistema, max: Math.max(...porSistema.map(x => x.total)) })) },
    series: [{ type: 'radar', data: [{ value: porSistema.slice(0, 8).map(s => s.total), name: 'Reportes',
      itemStyle: { color: '#1A569E' }, areaStyle: { opacity: .2 } }] }],
  }

  const rsBar = {
    tooltip: { trigger: 'axis' },
    legend: {},
    grid: { left: 16, right: 16, top: 40, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: rsData.map(r => r.plataforma) },
    yAxis: { type: 'value' },
    series: [
      { name: 'Me gusta', data: rsData.map(r => r.me_gusta), type: 'bar', stack: 'rs', itemStyle: { color: '#1677ff' } },
      { name: 'Comentarios', data: rsData.map(r => r.comentarios), type: 'bar', stack: 'rs', itemStyle: { color: '#52c41a' } },
      { name: 'Compartidos', data: rsData.map(r => r.compartidos), type: 'bar', stack: 'rs', itemStyle: { color: '#fa8c16' } },
      { name: 'Reproducciones', data: rsData.map(r => r.reproducciones), type: 'bar', stack: 'rs', itemStyle: { color: '#722ed1' } },
    ],
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Estadísticas</Title>
        <RangePicker
          value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
          onChange={(d) => {
            if (d?.[0] && d?.[1])
              setDateRange([d[0].format('YYYY-MM-DD'), d[1].format('YYYY-MM-DD')])
          }}
        />
      </div>

      <Spin spinning={loading}>
        <Tabs defaultActiveKey="tradicional" items={[
          {
            key: 'tradicional',
            label: 'Reportes Tradicionales',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card title="Tendencia diaria de reportes" className="card-shadow">
                    <ReactECharts option={lineOption} style={{ height: 260 }} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Top 15 Estados con más actividad" className="card-shadow">
                    <ReactECharts option={hbarEstados} style={{ height: 320 }} />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="Actividad por Sistema" className="card-shadow">
                    <ReactECharts option={radarSistemas} style={{ height: 320 }} />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'redes',
            label: 'Redes Sociales',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card title="Actividad por Plataforma" className="card-shadow">
                    <ReactECharts option={rsBar} style={{ height: 320 }} />
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
