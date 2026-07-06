import type { ReactNode } from 'react'
import { Row, Col, Card, Statistic } from 'antd'

export interface StatItem {
  title: string
  value: number | string
  /** Icono ya estilizado por el caller, ej. <FileTextOutlined style={{ color: '#1A569E' }} /> */
  icon: ReactNode
  /** Color para valueStyle, debe coincidir con el del icono. */
  color: string
}

interface StatsSummaryRowProps {
  items: StatItem[]
  /** Breakpoint lg de cada Col (24 / cantidad de items normalmente). */
  span?: number
}

/** Fila de tarjetas de estadísticas resumen, compartida por Dashboard RF/RS. */
export default function StatsSummaryRow({ items, span = 6 }: StatsSummaryRowProps) {
  return (
    <Row gutter={[16, 16]}>
      {items.map((item, i) => (
        <Col key={i} xs={24} sm={12} lg={span}>
          <Card className="card-shadow">
            <Statistic
              title={item.title}
              value={item.value}
              prefix={item.icon}
              valueStyle={{ color: item.color }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
