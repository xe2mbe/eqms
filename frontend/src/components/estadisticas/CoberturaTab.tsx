import { Card, Row, Col, Typography, Table, Tag, Tooltip, Empty, Progress } from 'antd'
import type { TableColumnsType } from 'antd'
import ReactECharts from 'echarts-for-react'
import { ZONA_COLORS, type EChartsFormatterParam } from '@/utils/estadisticasShared'

const { Text } = Typography

interface CoberturaEstadoComun {
  abreviatura: string
  nombre: string
  zona: string
  total: number
  indicativos: number
}

interface CoberturaTabProps<T extends CoberturaEstadoComun> {
  cobertura: T[]
  /** "contactos" en RF, "reportes" en RS — usado en títulos, tooltips y textos. */
  unidadLabel: string
  /** Columnas adicionales en la tabla de detalle, ej. "RST Prom." (solo RF). */
  extraDetailColumns?: TableColumnsType<T>
}

/** Pestaña "Cobertura" completa, compartida por Estadisticas (RF) y EstadisticasRS. */
export default function CoberturaTab<T extends CoberturaEstadoComun>({
  cobertura, unidadLabel, extraDetailColumns = [],
}: CoberturaTabProps<T>) {
  const zonasCobertura = Object.keys(ZONA_COLORS)
  const coberturaByZona = zonasCobertura.map(z => {
    const estados = cobertura.filter(e => e.zona === z)
    const activos = estados.filter(e => e.total > 0)
    const totalContactos = estados.reduce((s, e) => s + e.total, 0)
    const totalIndicativos = estados.reduce((s, e) => s + e.indicativos, 0)
    return { zona: z, estados: estados.length, activos: activos.length, totalContactos, totalIndicativos }
  }).filter(z => z.estados > 0)

  const coberturaBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, data: [unidadLabel[0].toUpperCase() + unidadLabel.slice(1), 'Indicativos únicos'] },
    grid: { left: 8, right: 8, top: 10, bottom: 40, containLabel: true },
    xAxis: { type: 'category', data: coberturaByZona.map(z => z.zona) },
    yAxis: [
      { type: 'value', name: unidadLabel[0].toUpperCase() + unidadLabel.slice(1) },
      { type: 'value', name: 'Indicativos', position: 'right' },
    ],
    series: [
      {
        name: unidadLabel[0].toUpperCase() + unidadLabel.slice(1), type: 'bar', barMaxWidth: 48,
        data: coberturaByZona.map(z => ({ value: z.totalContactos, itemStyle: { color: ZONA_COLORS[z.zona] ?? '#1677ff', borderRadius: [4, 4, 0, 0] } })),
      },
      {
        name: 'Indicativos únicos', type: 'line', yAxisIndex: 1, smooth: true,
        data: coberturaByZona.map(z => z.totalIndicativos),
        itemStyle: { color: '#fa8c16' }, lineStyle: { width: 2 },
      },
    ],
  }

  const coberturaActivos = cobertura.filter(e => e.total > 0)

  const coberturaEstadoBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p: EChartsFormatterParam[]) => `${p[0].name}: ${p[0].value} ${unidadLabel}` },
    grid: { left: 140, right: 16, top: 8, bottom: 8, containLabel: false },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: coberturaActivos.map(e => e.abreviatura).reverse(),
    },
    series: [{
      type: 'bar',
      data: coberturaActivos.map(e => ({
        value: e.total,
        itemStyle: { color: ZONA_COLORS[e.zona] ?? '#aaa', borderRadius: [0, 4, 4, 0] },
      })).reverse(),
      label: { show: true, position: 'right', fontSize: 10 },
    }],
  }

  return (
    <Row gutter={[16, 16]}>

      {/* Resumen por zona */}
      <Col xs={24}>
        <Card className="card-shadow"
          title={<Tooltip title={`${unidadLabel[0].toUpperCase() + unidadLabel.slice(1)} e indicativos únicos por zona FMRE en el período`}>
            📊 Actividad por zona FMRE
          </Tooltip>}>
          {coberturaByZona.length > 0
            ? <ReactECharts option={coberturaBarOption} style={{ height: 240 }} notMerge />
            : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
          }
        </Card>
      </Col>

      {/* Cards de zonas con cobertura de estados */}
      {coberturaByZona.length > 0 && coberturaByZona.map(z => (
        <Col key={z.zona} xs={24} sm={12} lg={Math.floor(24 / Math.max(coberturaByZona.length, 1))}>
          <Card size="small" className="card-shadow"
            style={{ borderTop: `4px solid ${ZONA_COLORS[z.zona] ?? '#1677ff'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Tag style={{ backgroundColor: ZONA_COLORS[z.zona] ?? '#1677ff', color: '#fff', fontWeight: 800, fontSize: 14 }}>
                {z.zona}
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>{z.activos}/{z.estados} estados activos</Text>
            </div>
            <Progress
              percent={z.estados > 0 ? Math.round(z.activos / z.estados * 100) : 0}
              strokeColor={ZONA_COLORS[z.zona] ?? '#1677ff'}
              size="small" style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span><strong>{z.totalContactos.toLocaleString()}</strong> {unidadLabel}</span>
              <span><strong>{z.totalIndicativos}</strong> indicativos</span>
            </div>
          </Card>
        </Col>
      ))}

      {/* Cobertura por estado — barra horizontal */}
      <Col xs={24}>
        <Card className="card-shadow"
          title={<Tooltip title="Todos los estados con actividad en el período, coloreados por zona FMRE">
            🏛️ Cobertura por estado (coloreado por zona)
          </Tooltip>}
          extra={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(ZONA_COLORS).map(([z, c]) => (
                <Tag key={z} style={{ backgroundColor: c, color: '#fff', fontWeight: 600 }}>{z}</Tag>
              ))}
            </div>
          }>
          {coberturaActivos.length > 0
            ? <ReactECharts
                option={coberturaEstadoBarOption}
                style={{ height: Math.max(300, coberturaActivos.length * 22 + 40) }}
                notMerge
              />
            : <Empty description="Sin datos en el período" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
          }
        </Card>
      </Col>

      {/* Tabla completa */}
      <Col xs={24}>
        <Card className="card-shadow" title="Detalle por estado">
          <Table
            dataSource={coberturaActivos}
            rowKey="abreviatura"
            size="small"
            pagination={{ pageSize: 16, showSizeChanger: false }}
            locale={{ emptyText: <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            columns={[
              { title: 'Estado', dataIndex: 'abreviatura', width: 80,
                render: (v: string) => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text> },
              { title: 'Nombre', dataIndex: 'nombre', ellipsis: true },
              { title: 'Zona', dataIndex: 'zona', width: 80, align: 'center' as const,
                render: (v: string) => v
                  ? <Tag style={{ backgroundColor: ZONA_COLORS[v] ?? '#1677ff', color: '#fff', fontWeight: 600 }}>{v}</Tag>
                  : <span style={{ color: '#ccc' }}>—</span>
              },
              { title: unidadLabel[0].toUpperCase() + unidadLabel.slice(1), dataIndex: 'total', width: 100, align: 'right' as const,
                render: (v: number) => v > 0
                  ? <Text strong style={{ color: '#1A569E' }}>{v.toLocaleString()}</Text>
                  : <Text type="secondary">—</Text>
              },
              { title: 'Indicativos', dataIndex: 'indicativos', width: 100, align: 'right' as const,
                render: (v: number) => v > 0 ? <Tag color="blue">{v}</Tag> : <Text type="secondary">—</Text> },
              ...extraDetailColumns,
            ]}
          />
        </Card>
      </Col>

    </Row>
  )
}
