import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, Typography, Table, Empty } from 'antd'
import { FileTextOutlined, TeamOutlined, GlobalOutlined, WifiOutlined, RadarChartOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import type { EstadisticaResumen } from '@/types'
import MexicoMapCard from '@/components/dashboard/MexicoMapCard'
import DateRangeBar from '@/components/common/DateRangeBar'

const { Title } = Typography

const CHART_COLORS = [
  '#5470c6','#91cc75','#fac858','#ee6666','#73c0de',
  '#3ba272','#fc8452','#9a60b4','#ea7ccc','#27727b',
]

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EstadisticaResumen | null>(null)
  const [dateRange, setDateRange] = useState<[string, string]>([
    '2020-01-01',
    dayjs().format('YYYY-MM-DD'),
  ])
  const [evento, setEvento] = useState<number | undefined>()

  useEffect(() => { loadData() }, [dateRange, evento])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: res } = await estadisticasApi.resumen({
        fecha_inicio: dateRange[0],
        fecha_fin: dateRange[1],
        evento_id: evento,
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const sistemas = data?.sistemas ?? []
  const estados  = data?.estados  ?? []
  const eventos  = data?.eventos  ?? []

  const barSistemas = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 16, right: 16, bottom: 8, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: sistemas.map(s => s.sistema),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      data: sistemas.map((s, i) => ({
        value: s.total,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [4, 4, 0, 0] },
      })),
      type: 'bar',
      label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold' },
    }],
  }

  const maxEstado = estados[0]?.total ?? 1
  const RANK_COLORS = ['#faad14', '#8c8c8c', '#d48806']

  const topEstadosColumns = [
    {
      title: '#', width: 36,
      render: (_: unknown, __: unknown, i: number) => (
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: RANK_COLORS[i] ?? '#e8e8e8',
          color: i < 3 ? '#fff' : '#666',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, margin: '0 auto',
        }}>
          {i + 1}
        </div>
      ),
    },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado',
      render: (v: string, _: unknown, i: number) => (
        <span style={{
          display: 'inline-block',
          padding: '1px 10px',
          borderRadius: 12,
          background: CHART_COLORS[i % CHART_COLORS.length] + '22',
          color: CHART_COLORS[i % CHART_COLORS.length],
          border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}55`,
          fontWeight: 600, fontSize: 12,
        }}>
          {v}
        </span>
      ),
    },
    {
      title: 'Reportes', dataIndex: 'total', key: 'total', align: 'right' as const,
      render: (v: number, _: unknown, i: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <div style={{ width: 50, height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(v / maxEstado) * 100}%`, height: '100%',
              background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 3,
            }} />
          </div>
          <strong style={{ color: '#1A569E', minWidth: 36, textAlign: 'right' }}>
            {v.toLocaleString()}
          </strong>
        </div>
      ),
    },
  ]

  const pieEventos = {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c} reportes ({d}%)' },
    legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
    color: CHART_COLORS,
    series: [{
      type: 'pie',
      radius: ['38%', '65%'],
      center: ['38%', '50%'],
      data: eventos.map(e => ({ name: e.evento, value: e.total })),
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.3)' },
      },
    }],
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Dashboard RF</Title>
        <DateRangeBar
          value={dateRange}
          onChange={setDateRange}
          ultimoEventoEndpoint="/estadisticas/ultima-actividad"
          evento={evento}
          onEventoChange={setEvento}
        />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Total Reportes" value={data?.total_reportes ?? '—'}
                prefix={<FileTextOutlined style={{ color: '#1A569E' }} />}
                valueStyle={{ color: '#1A569E' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="card-shadow">
              <Statistic title="Operadores" value={data?.total_operadores ?? '—'}
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Estaciones Reportadas" value={data?.total_estaciones ?? '—'}
                prefix={<RadarChartOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Estados con Actividad" value={data?.estados.length ?? '—'}
                prefix={<GlobalOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Sistemas Usados" value={data?.sistemas.length ?? '—'}
                prefix={<WifiOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }} />
            </Card>
          </Col>
        </Row>

        {/* Mapa + Top 10 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={16}>
            <Card title="Actividad por Estado" className="card-shadow"
              styles={{ body: { padding: '8px 16px 16px' } }}>
              <MexicoMapCard estados={estados} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Top 10 Estados" className="card-shadow" style={{ height: '100%' }}>
              {estados.length === 0
                ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : <Table
                    dataSource={estados.slice(0, 10)}
                    columns={topEstadosColumns}
                    rowKey="estado"
                    size="small"
                    pagination={false}
                    scroll={{ y: 380 }}
                  />
              }
            </Card>
          </Col>
        </Row>

        {/* Sistemas + Distribución por Evento */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Reportes por Sistema" className="card-shadow">
              {sistemas.length === 0
                ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                : <ReactECharts option={barSistemas} style={{ height: 280 }} notMerge />
              }
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Distribución por Evento" className="card-shadow">
              {eventos.length === 0
                ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                : <ReactECharts option={pieEventos} style={{ height: 280 }} notMerge />
              }
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
