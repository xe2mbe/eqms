import client from './client'
import type { EstadisticaResumen } from '@/types'

export const estadisticasApi = {
  resumen: (params?: { fecha_inicio?: string; fecha_fin?: string; evento_id?: number }) =>
    client.get<EstadisticaResumen>('/estadisticas/resumen', { params }),

  porEstado: (params?: { fecha_inicio?: string; fecha_fin?: string; evento_id?: number }) =>
    client.get<{ estado: string; total: number }[]>('/estadisticas/por-estado', { params }),

  porSistema: (params?: { fecha_inicio?: string; fecha_fin?: string; evento_id?: number }) =>
    client.get<{ sistema: string; total: number }[]>('/estadisticas/por-sistema', { params }),

  tendencia: (params?: { fecha_inicio?: string; fecha_fin?: string; granularidad?: string; evento_id?: number }) =>
    client.get<{ periodo: string; total: number }[]>('/estadisticas/tendencia', { params }),

  // ── RS ────────────────────────────────────────────────────────────────────

  rsResumenReportes: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{
      total_reportes: number
      total_indicativos: number
      total_estados: number
      por_plataforma: { plataforma: string; total: number }[]
      por_estado: { estado: string; total: number }[]
    }>('/estadisticas/rs/resumen-reportes', { params }),

  rsResumen: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{ plataforma: string; color: string; slug: string; total: number }[]>(
      '/estadisticas/rs/resumen', { params }
    ),

  rsTendencia: (params?: { fecha_inicio?: string; fecha_fin?: string; granularidad?: string }) =>
    client.get<{ periodo: string; plataforma: string; total: number }[]>(
      '/estadisticas/rs/tendencia', { params }
    ),

  rsPorEstado: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{ estado: string; total: number }[]>('/estadisticas/rs/por-estado', { params }),

  rsTopIndicativos: (params?: { fecha_inicio?: string; fecha_fin?: string; limite?: number }) =>
    client.get<{ plataforma: string; indicativo: string; total: number; estados: number; zonas: number; ultimo: string | null; nombre: string | null }[]>(
      '/estadisticas/rs/top-indicativos', { params }
    ),

  rsZonaActividad: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{ plataforma: string; zona: string; total: number; indicativos: number }[]>(
      '/estadisticas/rs/zona-actividad', { params }
    ),

  primeraActividad: () =>
    client.get<{ fecha: string | null }>('/estadisticas/primera-actividad'),

  nuevosMensuales: (params?: { fecha_inicio?: string; fecha_fin?: string; evento_id?: number }) =>
    client.get<{ mes: string; nuevos: number }[]>('/estadisticas/nuevos-mensuales', { params }),

  retencion: (params?: { fecha_inicio?: string; fecha_fin?: string; evento_id?: number }) =>
    client.get<{ mes: string; activos: number; retenidos: number; tasa: number }[]>('/estadisticas/retencion', { params }),

  coberturaEstados: (params?: { fecha_inicio?: string; fecha_fin?: string; evento_id?: number }) =>
    client.get<{ abreviatura: string; nombre: string; zona: string; total: number; indicativos: number; senal_promedio: number }[]>(
      '/estadisticas/cobertura-estados', { params }
    ),

  rsNuevosMensuales: () =>
    client.get<{ mes: string; plataforma: string; nuevos: number }[]>('/estadisticas/rs/nuevos-mensuales'),

  rsPorEstadoPlataforma: (params?: { fecha_inicio?: string; fecha_fin?: string }) =>
    client.get<{ plataforma: string; estado: string; total: number }[]>(
      '/estadisticas/rs/por-estado-plataforma', { params }
    ),

  rsTendenciaMetricas: (params?: { fecha_inicio?: string; fecha_fin?: string; granularidad?: string; plataforma_id?: number }) =>
    client.get<{ periodo: string; plataforma: string; slug: string; total: number }[]>(
      '/estadisticas/rs/tendencia-metricas', { params }
    ),
}
