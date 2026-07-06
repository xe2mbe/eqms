import type { TableColumnType } from 'antd'
import { Tag } from 'antd'
import dayjs from 'dayjs'
import { textFilterProps, selectFilterProps, uniqueFilterOptions } from '@/utils/tableFilters'
import type { Zona, Evento, Estacion } from '@/types'

interface ReporteComun {
  id: number
  indicativo: string
  operador?: string
  senal: number
  ciudad?: string
  pais?: string
  estado?: string
  zona?: Zona
  evento?: Evento
  estacion?: Estacion
  fecha_reporte: string
  created_at: string
  capturado_por_nombre?: string
}

interface BuildColumnasComunesOpts<T> {
  data: T[]
  zonas: Zona[]
  eventos: Evento[]
}

/**
 * Definiciones de columna compartidas por Reportes (RF) y ReportesRS: son
 * idénticas en ambas páginas salvo la columna sistema/plataforma, que cada
 * página agrega por su cuenta.
 */
export function buildReporteColumnasComunes<T extends ReporteComun>({
  data, zonas, eventos,
}: BuildColumnasComunesOpts<T>): Record<
  'id' | 'indicativo' | 'operador' | 'senal' | 'ciudad' | 'pais' | 'estado' |
  'zona' | 'evento' | 'estacion' | 'fecha_reporte' | 'created_at' | 'capturado_por_nombre',
  TableColumnType<T>
> {
  return {
    id: { title: 'ID', dataIndex: 'id' as keyof T & string, width: 65 },
    indicativo: {
      title: 'Indicativo', dataIndex: 'indicativo' as keyof T & string, width: 110, fixed: 'left' as const,
      render: (v: string) => <strong style={{ color: '#1A569E' }}>{v}</strong>,
      ...textFilterProps<T>('indicativo' as keyof T & string),
    },
    operador: {
      title: 'Operador', dataIndex: 'operador' as keyof T & string, width: 160,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...textFilterProps<T>('operador' as keyof T & string),
    },
    senal: {
      title: 'RST', dataIndex: 'senal' as keyof T & string, width: 70,
      render: (v: number) => <strong>{v}</strong>,
    },
    ciudad: {
      title: 'Ciudad', dataIndex: 'ciudad' as keyof T & string, width: 130,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...textFilterProps<T>('ciudad' as keyof T & string),
    },
    pais: {
      title: 'País', dataIndex: 'pais' as keyof T & string, width: 140,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...selectFilterProps<T>(
        uniqueFilterOptions(data, (r: T) => r.pais ?? undefined),
        (value, record) => record.pais === value,
      ),
    },
    estado: {
      title: 'Estado', dataIndex: 'estado' as keyof T & string, width: 130,
      ...selectFilterProps<T>(
        uniqueFilterOptions(data, (r: T) => r.estado ?? undefined),
        (value, record) => record.estado === value,
      ),
    },
    zona: {
      title: 'Zona', dataIndex: 'zona' as keyof T & string, width: 80, align: 'center' as const,
      render: (_: unknown, record: T) => {
        const codigo = record.zona?.codigo
        if (!codigo) return null
        const c = record.zona?.color ?? '#1677ff'
        return <Tag color={c} style={{ fontWeight: 600 }}>{codigo}</Tag>
      },
      ...selectFilterProps<T>(
        zonas.map(z => ({ text: z.codigo, value: z.codigo })),
        (value, record) => record.zona?.codigo === value,
      ),
    },
    evento: {
      title: 'Tipo', dataIndex: 'evento' as keyof T & string, width: 160,
      render: (_: unknown, record: T) => {
        if (!record.evento) return null
        const c = record.evento.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{record.evento.tipo}</Tag>
      },
      ...selectFilterProps<T>(
        eventos.map(e => ({ text: e.tipo, value: e.tipo })),
        (value, record) => record.evento?.tipo === value,
      ),
    },
    estacion: {
      title: 'Estación', dataIndex: 'estacion' as keyof T & string, width: 110,
      render: (_: unknown, record: T) => {
        if (!record.estacion) return null
        const c = record.estacion.color ?? '#1677ff'
        return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600 }}>{record.estacion.qrz}</Tag>
      },
      ...selectFilterProps<T>(
        uniqueFilterOptions(data, (r: T) => r.estacion?.qrz ?? undefined),
        (value, record) => record.estacion?.qrz === value,
      ),
    },
    fecha_reporte: {
      title: 'Fecha Evento', dataIndex: 'fecha_reporte' as keyof T & string, width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    created_at: {
      title: 'Fecha Captura', dataIndex: 'created_at' as keyof T & string, width: 140,
      render: (v: string) => v
        ? <span style={{ color: '#8c8c8c' }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</span>
        : <span style={{ color: '#ccc' }}>—</span>,
    },
    capturado_por_nombre: {
      title: 'Capturado por', dataIndex: 'capturado_por_nombre' as keyof T & string, width: 140,
      render: (v: string) => v ?? <span style={{ color: '#ccc' }}>—</span>,
      ...selectFilterProps<T>(
        uniqueFilterOptions(data, (r: T) => r.capturado_por_nombre ?? undefined),
        (value, record) => record.capturado_por_nombre === value,
      ),
    },
  }
}
