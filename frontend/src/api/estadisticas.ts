import client from './client'
import type { EstadisticaResumen, EstadisticaRS } from '@/types'

export const estadisticasApi = {
  resumen: (params?: { fecha_inicio?: string; fecha_fin?: string; tipo_reporte?: string }) =>
    client.get<EstadisticaResumen>('/estadisticas/resumen', { params }),

  porEstado: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{ estado: string; total: number }[]>('/estadisticas/por-estado', { params }),

  porSistema: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{ sistema: string; total: number }[]>('/estadisticas/por-sistema', { params }),

  tendencia: (params?: { fecha_inicio?: string; fecha_fin?: string; granularidad?: string }) =>
    client.get<{ periodo: string; total: number }[]>('/estadisticas/tendencia', { params }),

  rsResumen: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<EstadisticaRS[]>('/estadisticas/rs/resumen', { params }),
}
