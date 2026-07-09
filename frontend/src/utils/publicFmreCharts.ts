import dayjs from 'dayjs'

/** Builders de opciones de ECharts (tendencia mensual, pie por categoría, mapa de México), compartidos por PublicFMRE (RF/RS). */

const MEXICO_NAME_MAP: Record<string, string> = {
  'Baja California': 'Baja California',
  'Baja California Sur': 'Baja California Sur',
  'Ciudad de México': 'Ciudad De México',
  'Estado De México': 'México',
}

export function buildTendenciaOption(
  tendencia: { mes: string; categoria: string; total: number }[],
  colors: Record<string, string>,
) {
  const meses = [...new Set(tendencia.map(t => t.mes))].sort()
  const categorias = [...new Set(tendencia.map(t => t.categoria))].sort()
  const totales = meses.map(mes =>
    categorias.reduce((sum, cat) => sum + (tendencia.find(t => t.mes === mes && t.categoria === cat)?.total ?? 0), 0)
  )
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: categorias, top: 4, textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 },
    grid: { left: 8, right: 8, top: 44, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: meses.map(m => dayjs(m).format('MMM YY')),
      axisLabel: { color: '#666', fontSize: 11 },
    },
    yAxis: { type: 'value', axisLabel: { color: '#666', fontSize: 11 } },
    series: [
      ...categorias.map(cat => ({
        name: cat,
        type: 'bar',
        stack: 'total',
        data: meses.map(mes => tendencia.find(t => t.mes === mes && t.categoria === cat)?.total ?? 0),
        itemStyle: { color: colors[cat] ?? '#999' },
      })),
      {
        type: 'bar' as const, stack: 'total', silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
        label: {
          show: true, position: 'top' as const,
          formatter: (p: any) => totales[p.dataIndex] > 0 ? totales[p.dataIndex].toLocaleString() : '',
          color: '#444', fontSize: 10, fontWeight: 700,
        },
        data: totales.map(() => 0),
      },
    ],
  }
}

export function buildCategoriaPieOption(
  items: { categoria: string; total: number }[],
  colors: Record<string, string>,
  fallbackColor: string,
) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
      data: items.map(i => ({
        name: i.categoria, value: i.total,
        itemStyle: { color: colors[i.categoria] ?? fallbackColor },
      })),
      label: { show: false },
    }],
  }
}

export function buildMapaOption(
  porEstado: { estado: string; total: number }[],
  colorRange: [string, string],
  emphasisColor: string,
) {
  const total = porEstado.reduce((s, e) => s + e.total, 0)
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => p.value
        ? `<b>${p.name}</b><br/>${p.value.toLocaleString()} reportes<br/><span style="color:#888">${(p.value / total * 100).toFixed(1)}% del total</span>`
        : p.name,
    },
    visualMap: {
      min: 0, max: Math.max(...porEstado.map(e => e.total), 1),
      inRange: { color: colorRange },
      show: false,
    },
    series: [{
      type: 'map', map: 'Mexico', roam: false,
      emphasis: { label: { show: true }, itemStyle: { areaColor: emphasisColor } },
      data: porEstado.map(e => ({ name: e.estado, value: e.total })),
      nameMap: MEXICO_NAME_MAP,
    }],
  }
}
