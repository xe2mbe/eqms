import { useEffect, useState } from 'react'
import { Row, Col, Card, Spin, Typography, Empty } from 'antd'
import { FileTextOutlined, TeamOutlined, GlobalOutlined, WifiOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import type { EstadisticaResumen } from '@/types'
import DateRangeBar from '@/components/common/DateRangeBar'
import EstadoActivityRow from '@/components/dashboard/EstadoActivityRow'
import StatsSummaryRow from '@/components/dashboard/StatsSummaryRow'
import SimpleBarChartCard from '@/components/dashboard/SimpleBarChartCard'
import { CHART_COLORS } from '@/components/dashboard/chartColors'

const { Title } = Typography

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
        <StatsSummaryRow
          span={5}
          items={[
            { title: 'Total Reportes', value: data?.total_reportes ?? '—', icon: <FileTextOutlined style={{ color: '#1A569E' }} />, color: '#1A569E' },
            { title: 'Estaciones Reportadas', value: data?.total_estaciones ?? '—', icon: <TeamOutlined style={{ color: '#52c41a' }} />, color: '#52c41a' },
            { title: 'Estados con Actividad', value: data?.estados.length ?? '—', icon: <GlobalOutlined style={{ color: '#fa8c16' }} />, color: '#fa8c16' },
            { title: 'Sistemas Usados', value: data?.sistemas.length ?? '—', icon: <WifiOutlined style={{ color: '#722ed1' }} />, color: '#722ed1' },
          ]}
        />

        <EstadoActivityRow estados={estados} />

        {/* Sistemas + Distribución por Evento */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <SimpleBarChartCard
              title="Reportes por Sistema"
              categories={sistemas.map(s => s.sistema)}
              values={sistemas.map(s => s.total)}
            />
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
