import client from './client'
import type { EstadisticaRSRecord, ReporteRS } from '@/types'

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface EstadisticaRSPayload {
  plataforma_id: number
  valores: Record<string, number>
  fecha_reporte: string
  observaciones?: string
}

export interface ReporteRSPayload {
  indicativo: string
  operador?: string
  senal?: number
  plataforma_id: number
  estado?: string
  ciudad?: string
  zona_id?: number
  pais?: string
  evento_id?: number
  estacion_id?: number
  url_publicacion?: string
  fecha_reporte: string
  observaciones?: string
}

export const libretaRSApi = {
  // Estadísticas (métricas agregadas)
  listEstadisticas: (params?: Record<string, unknown>) =>
    client.get<PaginatedResult<EstadisticaRSRecord>>('/libreta-rs/estadisticas', { params }),
  createEstadistica: (payload: EstadisticaRSPayload) =>
    client.post<EstadisticaRSRecord>('/libreta-rs/estadisticas', payload),
  updateEstadistica: (id: number, payload: EstadisticaRSPayload) =>
    client.put<EstadisticaRSRecord>(`/libreta-rs/estadisticas/${id}`, payload),
  deleteEstadistica: (id: number) =>
    client.delete(`/libreta-rs/estadisticas/${id}`),

  // Reportes de estaciones vía RS
  listReportes: (params?: Record<string, unknown>) =>
    client.get<PaginatedResult<ReporteRS>>('/libreta-rs/reportes', { params }),
  createReporte: (payload: ReporteRSPayload) =>
    client.post<ReporteRS>('/libreta-rs/reportes', payload),
  updateReporte: (id: number, payload: ReporteRSPayload) =>
    client.put<ReporteRS>(`/libreta-rs/reportes/${id}`, payload),
  deleteReporte: (id: number) =>
    client.delete(`/libreta-rs/reportes/${id}`),
}
