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
}

export interface PlantillaOut {
  id: number
  nombre: string
  tipo: TipoReporte
  evento_rf_id: number | null
  evento_rs_id: number | null
  evento_rf_tipo: string | null
  evento_rs_tipo: string | null
  secciones: SeccionesConfig
  destinatarios: string[]
  asunto_email: string | null
  activa: boolean
  created_at: string | null
}

export interface PlantillaCreate {
  nombre: string
  tipo: TipoReporte
  evento_rf_id: number | null
  evento_rs_id: number | null
  secciones: SeccionesConfig
  destinatarios: string[]
  asunto_email: string | null
  activa: boolean
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
}
