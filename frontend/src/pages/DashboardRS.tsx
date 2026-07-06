import { useEffect, useState } from 'react'
import { Row, Col, Spin, Typography, Select, Space } from 'antd'
import { FileTextOutlined, TeamOutlined, GlobalOutlined, ShareAltOutlined, WifiOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { estadisticasApi } from '@/api/estadisticas'
import client from '@/api/client'
import DateRangeBar from '@/components/common/DateRangeBar'
import EstadoActivityRow from '@/components/dashboard/EstadoActivityRow'
import StatsSummaryRow from '@/components/dashboard/StatsSummaryRow'
import SimpleBarChartCard from '@/components/dashboard/SimpleBarChartCard'

const { Title } = Typography

type Resumen = {
  total_reportes: number
  total_indicativos: number
  total_estados: number
  por_plataforma: { plataforma: string; total: number }[]
  por_estado: { estado: string; total: number }[]
}

type PlataformaOpt = { id: number; nombre: string; color: string | null }

export default function DashboardRSPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Resumen | null>(null)
  const [dateRange, setDateRange] = useState<[string, string]>([
    '2020-01-01',
    dayjs().format('YYYY-MM-DD'),
  ])
  const [plataforma, setPlataforma] = useState<number | undefined>()
  const [plataformasOpts, setPlataformasOpts] = useState<PlataformaOpt[]>([])

  useEffect(() => {
    client.get<PlataformaOpt[]>('/catalogos/plataformas-rs')
      .then(r => setPlataformasOpts(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => { loadData() }, [dateRange, plataforma])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: res } = await estadisticasApi.rsResumenReportes({
        fecha_inicio: dateRange[0],
        fecha_fin: dateRange[1],
        plataforma_id: plataforma,
      })
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  const plataformas = data?.por_plataforma ?? []
  const estados = data?.por_estado ?? []

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Dashboard RS</Title>
        <Space>
          <Select
            allowClear
            placeholder="Todas las plataformas"
            style={{ width: 200 }}
            value={plataforma}
            onChange={setPlataforma}
            options={plataformasOpts.map(p => ({
              value: p.id,
              label: (
                <span>
                  {p.color && (
                    <span style={{
                      display: 'inline-block', width: 10, height: 10,
                      borderRadius: '50%', backgroundColor: p.color,
                      marginRight: 6, verticalAlign: 'middle',
                    }} />
                  )}
                  {p.nombre}
                </span>
              ),
            }))}
          />
          <DateRangeBar
            value={dateRange}
            onChange={setDateRange}
            ultimoEventoEndpoint="/estadisticas/rs/ultima-actividad"
          />
        </Space>
      </div>

      <Spin spinning={loading}>
        <StatsSummaryRow
          span={6}
          items={[
            { title: 'Total Reportes RS', value: data?.total_reportes ?? '—', icon: <FileTextOutlined style={{ color: '#1A569E' }} />, color: '#1A569E' },
            { title: 'Estaciones Reportadas', value: data?.total_indicativos ?? '—', icon: <TeamOutlined style={{ color: '#52c41a' }} />, color: '#52c41a' },
            { title: 'Estados con Actividad', value: data?.total_estados ?? '—', icon: <GlobalOutlined style={{ color: '#fa8c16' }} />, color: '#fa8c16' },
            { title: 'Plataformas', value: plataformas.length, icon: <WifiOutlined style={{ color: '#722ed1' }} />, color: '#722ed1' },
          ]}
        />

        <EstadoActivityRow estados={estados} />

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <SimpleBarChartCard
              title={<><ShareAltOutlined /> Reportes por Plataforma</>}
              categories={plataformas.map(p => p.plataforma)}
              values={plataformas.map(p => p.total)}
            />
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
