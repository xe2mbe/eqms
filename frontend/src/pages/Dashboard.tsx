import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, DatePicker, Typography, Table, Empty } from 'antd'
import { FileTextOutlined, TeamOutlined, GlobalOutlined, WifiOutlined, RadarChartOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import type { EstadisticaResumen } from '@/types'
import MexicoMapCard from '@/components/dashboard/MexicoMapCard'

const { Title } = Typography
const { RangePicker } = DatePicker

const PIE_COLORS = [
  '#1A569E','#1677ff','#40a9ff','#52c41a','#73d13d',
  '#fa8c16','#ffc53d','#722ed1','#eb2f96','#13c2c2',
]

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EstadisticaResumen | null>(null)
  const [totales, setTotales] = useState<EstadisticaResumen | null>(null)
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').startOf('day').format('YYYY-MM-DD'),
    dayjs().add(1, 'day').endOf('day').format('YYYY-MM-DD'),
  ])

  useEffect(() => {
    estadisticasApi.resumen({}).then(r => setTotales(r.data))
  }, [])

  useEffect(() => { loadData() }, [dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: res } = await estadisticasApi.resumen({
        fecha_inicio: dateRange[0],
        fecha_fin: dateRange[1],
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
      data: sistemas.map(s => s.total),
      type: 'bar',
      label: { show: true, position: 'top', fontSize: 11 },
      itemStyle: { color: '#1A569E', borderRadius: [4, 4, 0, 0] },
    }],
  }

  const topEstadosColumns = [
    {
      title: '#', width: 36,
      render: (_: unknown, __: unknown, i: number) =>
        <span style={{ color: '#999', fontSize: 12 }}>{i + 1}</span>,
    },
    { title: 'Estado', dataIndex: 'estado', key: 'estado' },
    {
      title: 'Reportes', dataIndex: 'total', key: 'total', align: 'right' as const,
      render: (v: number) => <strong style={{ color: '#1A569E' }}>{v.toLocaleString()}</strong>,
    },
  ]

  const pieEventos = {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c} reportes ({d}%)' },
    legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
    color: PIE_COLORS,
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
        <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
        <RangePicker
          value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1])
              setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
          }}
        />
      </div>

      <Spin spinning={loading}>
        {/* Tarjetas — totales globales */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Total Reportes" value={totales?.total_reportes ?? '—'}
                prefix={<FileTextOutlined style={{ color: '#1A569E' }} />}
                valueStyle={{ color: '#1A569E' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Card className="card-shadow">
              <Statistic title="Operadores" value={totales?.total_operadores ?? '—'}
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Estaciones Reportadas" value={totales?.total_estaciones ?? '—'}
                prefix={<RadarChartOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Estados con Actividad" value={totales?.estados.length ?? '—'}
                prefix={<GlobalOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Card className="card-shadow">
              <Statistic title="Sistemas Usados" value={totales?.sistemas.length ?? '—'}
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
