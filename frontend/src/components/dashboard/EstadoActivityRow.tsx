import { Row, Col, Card } from 'antd'
import MexicoMapCard from './MexicoMapCard'
import TopRankedTable from './TopRankedTable'

interface EstadoActivityRowProps {
  estados: { estado: string; total: number }[]
}

/** Fila "Actividad por Estado" (mapa) + "Top 10 Estados", compartida por Dashboard RF/RS. */
export default function EstadoActivityRow({ estados }: EstadoActivityRowProps) {
  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={16}>
        <Card title="Actividad por Estado" className="card-shadow"
          styles={{ body: { padding: '8px 16px 16px' } }}>
          <MexicoMapCard estados={estados} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <TopRankedTable data={estados} />
      </Col>
    </Row>
  )
}
