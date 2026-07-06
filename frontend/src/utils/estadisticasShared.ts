/** Colores por zona FMRE, compartidos por Estadisticas (RF) y EstadisticasRS. */
export const ZONA_COLORS: Record<string, string> = {
  XE1: '#1677ff', XE2: '#52c41a', XE3: '#fa8c16', XE4: '#722ed1', XE5: '#eb2f96',
}

/**
 * Shim angosto sobre el tipado suelto de los formatters de echarts-for-react
 * (el paquete no exporta un tipo utilizable para el shape real de `params`).
 */
export type EChartsFormatterParam = {
  name: string
  value: number | string | (number | string)[]
  dataIndex: number
}
