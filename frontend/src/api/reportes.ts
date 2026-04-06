import client from './client'
import type { PaginatedReportes, Reporte, ReporteFilters } from '@/types'

export const reportesApi = {
  list: (filters: ReporteFilters = {}) =>
    client.get<PaginatedReportes>('/reportes', { params: filters }),

  get: (id: number) => client.get<Reporte>(`/reportes/${id}`),

  create: (data: Partial<Reporte>) => client.post<Reporte>('/reportes', data),

  update: (id: number, data: Partial<Reporte>) =>
    client.put<Reporte>(`/reportes/${id}`, data),

  delete: (id: number) => client.delete(`/reportes/${id}`),
}
