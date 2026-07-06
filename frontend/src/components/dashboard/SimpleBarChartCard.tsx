import type { ReactNode } from 'react'
import { Card, Empty } from 'antd'
import ReactECharts from 'echarts-for-react'
import { CHART_COLORS } from './chartColors'

interface SimpleBarChartCardProps {
  title: ReactNode
  categories: string[]
  values: number[]
  height?: number
}

/** Tarjeta de gráfica de barras simple (una serie, colores por barra), compartida por Dashboard RF/RS. */
export default function SimpleBarChartCard({ title, categories, values, height = 280 }: SimpleBarChartCardProps) {
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 16, right: 16, bottom: 8, top: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{
      data: values.map((v, i) => ({
        value: v,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [4, 4, 0, 0] },
      })),
      type: 'bar',
      label: { show: true, position: 'top', fontSize: 11, fontWeight: 'bold' },
    }],
  }

  return (
    <Card title={title} className="card-shadow">
      {values.length === 0
        ? <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
        : <ReactECharts option={option} style={{ height }} notMerge />
      }
    </Card>
  )
}
