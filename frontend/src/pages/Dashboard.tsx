import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, Select, DatePicker, Typography, Table } from 'antd'
import { FileTextOutlined, TeamOutlined, GlobalOutlined, WifiOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import type { EstadisticaResumen } from '@/types'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<EstadisticaResumen | null>(null)
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ])

  useEffect(() => {
    loadData()
  }, [dateRange])

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

  const barSistemas = {
    tooltip: { trigger: 'axis' },
    grid: { left: 16, right: 16, bottom: 8, top: 16, containLabel: true },
    xAxis: { type: 'category', data: data?.sistemas.map(s => s.sistema) || [] },
    yAxis: { type: 'value' },
    series: [{
      data: data?.sistemas.map(s => s.total) || [],
      type: 'bar',
      itemStyle: { color: '#1A569E', borderRadius: [4, 4, 0, 0] },
    }],
  }

  const pieEstados = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: (data?.estados.slice(0, 10) || []).map(e => ({ name: e.estado, value: e.total })),
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,.3)' } },
    }],
  }

  const topEstadosColumns = [
    { title: 'Estado', dataIndex: 'estado', key: 'estado' },
    { title: 'Reportes', dataIndex: 'total', key: 'total',
      render: (v: number) => <strong>{v.toLocaleString()}</strong> },
  ]

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
        <RangePicker
          value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
          onChange={(dates) => {
            if (dates?.[0] && dates?.[1]) {
              setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
            }
          }}
        />
      </div>

      <Spin spinning={loading}>
        {/* Métricas principales */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="card-shadow">
              <Statistic
                title="Total Reportes"
                value={data?.total_reportes ?? 0}
                prefix={<FileTextOutlined style={{ color: '#1A569E' }} />}
                valueStyle={{ color: '#1A569E' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="card-shadow">
              <Statistic
                title="Operadores Activos"
                value={data?.total_operadores ?? 0}
                prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="card-shadow">
              <Statistic
                title="Estados con Actividad"
                value={data?.estados.length ?? 0}
                prefix={<GlobalOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="card-shadow">
              <Statistic
                title="Sistemas Usados"
                value={data?.sistemas.length ?? 0}
                prefix={<WifiOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* Gráfica por sistema */}
          <Col xs={24} lg={14}>
            <Card title="Reportes por Sistema" className="card-shadow">
              <ReactECharts option={barSistemas} style={{ height: 280 }} />
            </Card>
          </Col>

          {/* Top estados */}
          <Col xs={24} lg={10}>
            <Card title="Top 10 Estados" className="card-shadow">
              <Table
                dataSource={data?.estados.slice(0, 10) || []}
                columns={topEstadosColumns}
                rowKey="estado"
                size="small"
                pagination={false}
                scroll={{ y: 240 }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Distribución por Estado (Top 10)" className="card-shadow">
              <ReactECharts option={pieEstados} style={{ height: 300 }} />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
