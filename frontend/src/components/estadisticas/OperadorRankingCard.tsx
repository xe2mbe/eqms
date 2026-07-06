import { Card, Table, Empty } from 'antd'

interface RankingRow {
  usuario_id: number
  nombre: string
  total: number
  posicion: number
}

interface OperadorRankingCardProps {
  data: RankingRow[]
}

/** Tarjeta "Capturas por operador", compartida por Estadisticas (RF) y EstadisticasRS. */
export default function OperadorRankingCard({ data }: OperadorRankingCardProps) {
  return (
    <Card title="📋 Capturas por operador" className="card-shadow">
      <Table
        dataSource={data}
        rowKey="usuario_id"
        size="small"
        pagination={false}
        scroll={{ y: 320 }}
        locale={{ emptyText: <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        columns={[
          { title: '#', dataIndex: 'posicion', width: 48,
            render: (v: number) => <span style={{ color: v <= 3 ? '#fa8c16' : '#8c8c8c', fontWeight: 700 }}>{v}</span> },
          { title: 'Operador', dataIndex: 'nombre', ellipsis: true,
            render: (v: string) => <strong>{v}</strong> },
          { title: 'QSOs', dataIndex: 'total', width: 80, align: 'right' as const,
            render: (v: number) => <span style={{ fontWeight: 700, color: '#1A569E' }}>{v.toLocaleString()}</span> },
          { title: 'Participación', key: 'pct', width: 140,
            render: (_: unknown, r: { total: number }) => {
              const totalGeneral = data.reduce((s, o) => s + o.total, 0) || 1
              const pct = Math.round((r.total / totalGeneral) * 100)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 8 }}>
                    <div style={{ width: `${pct}%`, background: '#1A569E', borderRadius: 4, height: 8 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#8c8c8c', minWidth: 28 }}>{pct}%</span>
                </div>
              )
            }},
        ]}
        summary={() => {
          const total = data.reduce((s, o) => s + o.total, 0)
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}>
                <strong>Total</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <strong style={{ color: '#1A569E' }}>{total.toLocaleString()}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          )
        }}
      />
    </Card>
  )
}
