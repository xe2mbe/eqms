import client from './client'

export type TipoReporte = 'rf' | 'rs' | 'ambos'

export interface SeccionesConfig {
  // RF
  resumen_general: boolean
  por_zona: boolean
  por_sistema: boolean
  top_estaciones: number
  por_estado: boolean
  primera_vez: boolean
  detalle_rf: boolean
  // RS
  resumen_plataformas: boolean
  top_estaciones_rs: number
  por_zona_rs: boolean
  metricas_detalle: boolean
  detalle_rs: boolean
  desglose_plataformas: boolean
}

export interface PlantillaOut {
  id: number
  nombre: string
  tipo: TipoReporte
  evento_rf_id: number | null
  evento_rs_id: number | null
  eventos_rf_ids: number[]
  eventos_rs_ids: number[]
  eventos_rf_tipos: string[]
  eventos_rs_tipos: string[]
  secciones: SeccionesConfig
  destinatarios: string[]
  asunto_email: string | null
  activa: boolean
  rol_asignado: string | null
  usuario_id: number | null
  usuario_nombre: string | null
  prog_activo: boolean
  prog_dia_semana: number | null
  prog_hora: string | null
  prog_recurrencia: string | null
  prog_ultima_ejecucion: string | null
  created_at: string | null
}

export interface PlantillaCreate {
  nombre: string
  tipo: TipoReporte
  evento_rf_id: number | null
  evento_rs_id: number | null
  eventos_rf_ids: number[]
  eventos_rs_ids: number[]
  secciones: SeccionesConfig
  destinatarios: string[]
  asunto_email: string | null
  activa: boolean
  rol_asignado: string | null
  usuario_id: number | null
}

export interface ProgramacionUpdate {
  destinatarios: string[]
  prog_hora: string | null
  prog_dia_semana: number | null
  prog_activo: boolean
}

export const DEFAULT_SECCIONES: SeccionesConfig = {
  resumen_general: true,
  por_zona: true,
  por_sistema: true,
  top_estaciones: 10,
  por_estado: true,
  primera_vez: false,
  detalle_rf: false,
  resumen_plataformas: true,
  top_estaciones_rs: 10,
  por_zona_rs: true,
  metricas_detalle: false,
  detalle_rs: false,
  desglose_plataformas: true,
}

export interface OrigenCluster {
  nombre: string
  color: string
  total: number
  fi: string
  ff: string
  fechas: { fecha: string; count: number }[]
}

export interface UltimoCluster {
  fi: string | null
  ff: string | null
  evento_nombre: string | null
  origenes: OrigenCluster[]
}

export interface UltimoEventoOut {
  fi: string | null
  ff: string | null
  rf: UltimoCluster | null
  rs: UltimoCluster | null
}

export const reportesPdfApi = {
  list: () =>
    client.get<PlantillaOut[]>('/reportes-pdf/plantillas'),

  create: (data: PlantillaCreate) =>
    client.post<PlantillaOut>('/reportes-pdf/plantillas', data),

  update: (id: number, data: PlantillaCreate) =>
    client.put<PlantillaOut>(`/reportes-pdf/plantillas/${id}`, data),

  delete: (id: number) =>
    client.delete(`/reportes-pdf/plantillas/${id}`),

  generar: (id: number, fechaInicio: string, fechaFin: string) =>
    client.post(`/reportes-pdf/generar/${id}`, null, {
      params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      responseType: 'blob',
    }),

  enviar: (id: number, fechaInicio: string, fechaFin: string) =>
    client.post<{ ok: boolean; enviado_a: string[]; archivo: string }>(
      `/reportes-pdf/enviar/${id}`,
      null,
      { params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin } },
    ),

  generarWord: (id: number, fechaInicio: string, fechaFin: string) =>
    client.post(`/reportes-pdf/generar-word/${id}`, null, {
      params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      responseType: 'blob',
    }),

  updateProgramacion: (id: number, data: ProgramacionUpdate) =>
    client.put<PlantillaOut>(`/reportes-pdf/plantillas/${id}/programacion`, data),

  ultimoEvento: (id: number) =>
    client.get<UltimoEventoOut>(`/reportes-pdf/plantillas/${id}/ultimo-evento`),
}
