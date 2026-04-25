import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, Typography, Table, Empty } from 'antd'
import { FileTextOutlined, TeamOutlined, GlobalOutlined, ShareAltOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import DateRangeBar from '@/components/common/DateRangeBar'

const { Title } = Typography

type Resumen = {
  total_reportes: number
  total_indicativos: number
  total_estados: number
  por_plataforma: { plataforma: string; total: number }[]
  por_estado: { estado: string; total: number }[]
}

const CHART_COLORS = [
  '#5470c6','#91cc75','#fac858','#ee6666','#73c0de',
  '#3ba272','#fc8452','#9a60b4','#ea7ccc','#27727b',
]

export default function DashboardRSPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Resumen | null>(null)
  const [dateRange, setDateRange] = useState<[string, string]>([
    '2020-01-01',
    dayjs().format('YYYY-MM-DD'),
  ])

  useEffect(() => { loadData() }, [dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: res } = await estadisticasApi.rsResumenReportes({
        fecha_inicio: dateRange[0],
        fecha_fin: dateRange[1],
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const plataformas = data?.por_plataforma ?? []
  const estados = data?.por_estado ?? []

  const barPlataformas = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 16, right: 16, bottom: 8, top: 16, containLabel: true },
    xAxis: { type: 'category', data: plataformas.map(p => p.plataforma), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      data: plataformas.map((p, i) => ({
        value: p.total,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [4, 4, 0, 0] },
      })),
      type: 'bar',
      label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold' },
    }],
  }

  const pieEstados = {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c} reportes ({d}%)' },
    legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
    color: CHART_COLORS,
    series: [{
      type: 'pie',
      radius: ['38%', '65%'],
      center: ['38%', '50%'],
      data: estados.slice(0, 10).map(e => ({ name: e.estado, value: e.total })),
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.3)' },
      },
    }],
  }

  const topEstadosColumns = [
    { title: '#', width: 36, render: (_: unknown, __: unknown, i: number) =>
        <span style={{ color: '#999', fontSize: 12 }}>{i + 1}</span> },
    { title: 'Estado', dataIndex: 'estado', key: 'estado' },
    { title: 'Reportes', dataIndex: 'total', key: 'total', align: 'right' as const,
      render: (v: number) => <strong style={{ color: '#1A569E' }}>{v.toLocaleString()}</strong> },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Dashboard RS</Title>
        <DateRangeBar
          value={dateRange}
          onChange={setDateRange}
          ultimoEventoEndpoint="/estadisticas/rs/ultima-actividad"
        />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card className="card-shadow">
              <Statistic title="Total Reportes RS" value={data?.total_reportes ?? '—'}
                prefix={<FileTextOutlined style={{ color: '#1A569E' }} />}
                valueStyle={{ color: '#1A569E' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card className="card-shadow">
              <Statistic title="Estaciones Reportadas" value={data?.total_indicativos ?? '—'}
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card className="card-shadow">
              <Statistic title="Estados con Actividad" value={data?.total_estados ?? '—'}
                prefix={<GlobalOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title={<><ShareAltOutlined /> Reportes por Plataforma</>} className="card-shadow">
              {plataformas.length === 0
                ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                : <ReactECharts option={barPlataformas} style={{ height: 280 }} notMerge />
              }
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Top 10 Estados" className="card-shadow">
              {estados.length === 0
                ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : <Table
                    dataSource={estados.slice(0, 10)}
                    columns={topEstadosColumns}
                    rowKey="estado"
                    size="small"
                    pagination={false}
                    scroll={{ y: 280 }}
                  />
              }
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <Card title="Distribución por Estado" className="card-shadow">
              {estados.length === 0
                ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                : <ReactECharts option={pieEstados} style={{ height: 280 }} notMerge />
              }
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
