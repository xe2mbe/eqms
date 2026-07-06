import { Card, Table, Empty } from 'antd'
import { CHART_COLORS } from './chartColors'

interface TopRankedTableProps {
  data: { estado: string; total: number }[]
}

const RANK_COLORS = ['#faad14', '#8c8c8c', '#d48806']

/** Tabla "Top 10 Estados" con badge de ranking, tag de color y barra de progreso. */
export default function TopRankedTable({ data }: TopRankedTableProps) {
  const maxEstado = data[0]?.total ?? 1

  const columns = [
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

  return (
    <Card title="Top 10 Estados" className="card-shadow" style={{ height: '100%' }}>
      {data.length === 0
        ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        : <Table
            dataSource={data.slice(0, 10)}
            columns={columns}
            rowKey="estado"
            size="small"
            pagination={false}
            scroll={{ y: 380 }}
          />
      }
    </Card>
  )
}
