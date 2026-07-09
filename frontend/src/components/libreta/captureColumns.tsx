import { Button, Input, Select, Space, Tooltip } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { CheckCircleOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { validarIndicativo } from '@/utils/libretaShared'
import type { Estado, Zona } from '@/types'
import IndicativoCell from './IndicativoCell'

/**
 * Forma mínima de una fila de captura compartida por Libreta (RF) y
 * LibretaRS. Cada página extiende esto con sus propios campos (sistema,
 * ultimaAparicion, etc.).
 */
export interface FilaCapturaBase {
  key: string
  indicativo: string
  nombre_completo: string
  municipio: string
  estado: string
  zona: string
  status: 'ok' | 'notfound'
}

/** Columna "estado de catálogo" (ícono ok/no encontrado). Idéntica en RF y RS. */
export function statusColumn<T extends FilaCapturaBase>(): ColumnType<T> {
  return {
    title: '', dataIndex: 'status', width: 32,
    render: (v: T['status']) => (
      <Tooltip title={v === 'ok' ? 'En catálogo' : 'No encontrado en catálogo'}>
        {v === 'ok'
          ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
          : <WarningOutlined style={{ color: '#fa8c16' }} />}
      </Tooltip>
    ),
  }
}

/** Columna "Indicativo" (celda editable + botón re-buscar). Idéntica salvo el ancho. */
export function indicativoColumn<T extends FilaCapturaBase>(
  width: number,
  onCommit: (key: string, nuevo: string, anterior: string) => void,
  onRelookup: (key: string, indicativo: string) => void,
): ColumnType<T> {
  return {
    title: 'Indicativo', dataIndex: 'indicativo', width,
    render: (v: string, row: T) => (
      <Space size={0}>
        <IndicativoCell value={v} rowKey={row.key} onCommit={onCommit} />
        <Tooltip title="Re-buscar datos del indicativo">
          <Button
            size="small" type="text" icon={<ReloadOutlined />}
            onClick={() => { if (validarIndicativo(row.indicativo)) onRelookup(row.key, row.indicativo) }}
            style={{ color: '#8c8c8c', padding: '0 4px' }}
          />
        </Tooltip>
      </Space>
    ),
  }
}

/** Columna "Nombre" (input libre). Idéntica en RF y RS. */
export function nombreColumn<T extends FilaCapturaBase>(
  onNombreChange: (rowKey: string, val: string) => void,
): ColumnType<T> {
  return {
    title: 'Nombre', dataIndex: 'nombre_completo', width: 180,
    render: (v: string, row: T) => (
      <Input size="small" value={v} variant="borderless" placeholder="Nombre"
        onChange={e => onNombreChange(row.key, e.target.value)} />
    ),
  }
}

/** Columna "Ciudad" (input libre). Idéntica en RF y RS. */
export function ciudadColumn<T extends FilaCapturaBase>(
  onCiudadChange: (rowKey: string, val: string) => void,
): ColumnType<T> {
  return {
    title: 'Ciudad', dataIndex: 'municipio', width: 130,
    render: (v: string, row: T) => (
      <Input size="small" value={v} variant="borderless" placeholder="Ciudad"
        onChange={e => onCiudadChange(row.key, e.target.value)} />
    ),
  }
}

/** Columna "Estado" (Select con búsqueda). Idéntica salvo el manejo del onChange, que cada página define. */
export function estadoColumn<T extends FilaCapturaBase>(
  estados: Estado[],
  onEstadoChange: (rowKey: string, val: string | undefined) => void,
): ColumnType<T> {
  return {
    title: 'Estado', dataIndex: 'estado', width: 160,
    render: (v: string, row: T) => (
      <Select size="small" value={v || undefined} placeholder="Estado"
        showSearch allowClear optionFilterProp="label" style={{ width: '100%' }}
        options={estados.map(e => ({ value: e.nombre, label: e.nombre }))}
        onChange={val => onEstadoChange(row.key, val)} />
    ),
  }
}

interface ZonaColumnOptions {
  /** RF muestra un punto de color junto al código en las opciones; RS no. */
  showDot?: boolean
  /** RS solo lista zonas activas; RF lista el catálogo completo. */
  filterActive?: boolean
  /** Peso de fuente del texto de cada opción (RF: 600, RS: 700). */
  optionFontWeight?: number
}

/** Columna "Zona" (Select con etiqueta/opciones coloreadas por zona). */
export function zonaColumn<T extends FilaCapturaBase>(
  zonas: Zona[],
  zonaColor: (codigo: string) => string,
  onZonaChange: (rowKey: string, val: string) => void,
  opts: ZonaColumnOptions = {},
): ColumnType<T> {
  const { showDot = false, filterActive = false, optionFontWeight = 600 } = opts
  const zonasDisponibles = filterActive ? zonas.filter(z => z.is_active) : zonas
  return {
    title: 'Zona', dataIndex: 'zona', width: 100,
    render: (v: string, row: T) => {
      const color = zonaColor(v)
      return (
        <Select size="small" value={v} style={{ width: '100%' }}
          onChange={val => onZonaChange(row.key, val)}
          labelRender={({ value }) => (
            <span style={{ color, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{value as string}</span>
          )}
          optionRender={option => {
            const c = zonaColor(option.value as string)
            return showDot ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ fontWeight: optionFontWeight, color: c }}>{option.value as string}</span>
              </span>
            ) : (
              <span style={{ color: c, fontWeight: optionFontWeight }}>{option.value as string}</span>
            )
          }}
          options={zonasDisponibles.map(z => ({ value: z.codigo, label: z.codigo }))}
        />
      )
    },
  }
}
