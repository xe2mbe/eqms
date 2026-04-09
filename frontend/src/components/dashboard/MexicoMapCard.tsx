import { useEffect, useRef, useState } from 'react'
import { Spin, Alert, Typography } from 'antd'
import * as echarts from 'echarts'
import ReactECharts from 'echarts-for-react'

const MAP_NAME = 'MexicoStates'

const GEO_TO_DB: Record<string, string> = { México: 'Estado de México' }
const DB_TO_GEO: Record<string, string> = { 'Estado de México': 'México' }

const ESTADO_ZONA: Record<string, string> = {
  'Baja California': 'XE1', 'Baja California Sur': 'XE1', Sonora: 'XE1',
  Chihuahua: 'XE1', Coahuila: 'XE1', 'Nuevo León': 'XE1', Tamaulipas: 'XE1',
  Sinaloa: 'XE1', Durango: 'XE1', Zacatecas: 'XE1', 'San Luis Potosí': 'XE1',
  Aguascalientes: 'XE1', Nayarit: 'XE1',
  'Ciudad de México': 'XE2', Jalisco: 'XE2', 'Estado de México': 'XE2',
  Guanajuato: 'XE2', 'Querétaro': 'XE2', Hidalgo: 'XE2', 'Michoacán': 'XE2',
  Colima: 'XE2', Morelos: 'XE2', Tlaxcala: 'XE2',
  Veracruz: 'XE3', Puebla: 'XE3', Guerrero: 'XE3', Oaxaca: 'XE3',
  Chiapas: 'XE3', Tabasco: 'XE3', Campeche: 'XE3', 'Yucatán': 'XE3',
  'Quintana Roo': 'XE3',
}

interface Props {
  estados: { estado: string; total: number }[]
}

type Status = 'loading' | 'ready' | 'error'

// Bandera a nivel módulo para no volver a registrar en HMR
let _registered = false

export default function MexicoMapCard({ estados }: Props) {
  const [status, setStatus] = useState<Status>(_registered ? 'ready' : 'loading')
  const didFetch = useRef(false)

  useEffect(() => {
    if (_registered) { setStatus('ready'); return }
    if (didFetch.current) return
    didFetch.current = true

    fetch('/mexico-states.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((geo: object) => {
        echarts.registerMap(MAP_NAME, geo as any)
        _registered = true
        setStatus('ready')
      })
      .catch(err => {
        console.error('[MexicoMap] error cargando GeoJSON:', err)
        setStatus('error')
      })
  }, [])

  if (status === 'error') {
    return (
      <Alert
        type="warning"
        showIcon
        message="No se pudo cargar el mapa"
        description="Revisa la consola del navegador para más detalles."
      />
    )
  }

  if (status === 'loading') {
    return (
      <div style={{ height: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spin size="large" />
        <Typography.Text type="secondary">Cargando mapa…</Typography.Text>
      </div>
    )
  }

  // Construir datos
  const countMap: Record<string, number> = {}
  for (const { estado, total } of estados) {
    const geoName = DB_TO_GEO[estado] ?? estado
    countMap[geoName] = total
  }
  const mapData = Object.entries(countMap).map(([name, value]) => ({ name, value }))
  const maxVal = Math.max(...mapData.map(d => d.value), 1)

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const dbName = GEO_TO_DB[params.name] ?? params.name
        const zona = ESTADO_ZONA[dbName] ?? '—'
        const count = (params.value !== undefined && !isNaN(params.value)) ? params.value : 0
        return [
          `<strong style="font-size:13px">${dbName}</strong>`,
          `<span style="color:#888">Zona:</span> <strong>${zona}</strong>`,
          `<span style="color:#888">Reportes:</span> <strong style="color:#1A569E">${Number(count).toLocaleString()}</strong>`,
        ].join('<br/>')
      },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      left: 'left',
      bottom: 10,
      text: ['Más', 'Menos'],
      textStyle: { color: '#666', fontSize: 11 },
      calculable: true,
      inRange: { color: ['#dbeafe', '#3b82f6', '#1A569E'] },
    },
    series: [
      {
        name: 'Reportes',
        type: 'map',
        map: MAP_NAME,
        roam: true,
        scaleLimit: { min: 1, max: 6 },
        emphasis: {
          label: { show: true, fontSize: 10, fontWeight: 'bold', color: '#fff' },
          itemStyle: { areaColor: '#40a9ff', shadowBlur: 8 },
        },
        select: { disabled: true },
        itemStyle: { borderColor: '#fff', borderWidth: 0.8, areaColor: '#e8f4ff' },
        label: { show: false },
        data: mapData,
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 420 }}
      notMerge
    />
  )
}
