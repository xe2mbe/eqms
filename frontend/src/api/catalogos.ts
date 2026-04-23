import client from './client'
import type { Evento, Estacion, Zona, Sistema, Estado, PlataformaRS, MetricaRS } from '@/types'

export interface PrefijoPaisResult {
  pais: string
  zona_codigo: string | null
}

export const catalogosApi = {
  eventos: () => client.get<Evento[]>('/catalogos/eventos'),
  estaciones: () => client.get<Estacion[]>('/catalogos/estaciones'),
  zonas: () => client.get<Zona[]>('/catalogos/zonas'),
  sistemas: () => client.get<Sistema[]>('/catalogos/sistemas'),
  estados: () => client.get<Estado[]>('/catalogos/estados'),
  plataformasRS: () => client.get<PlataformaRS[]>('/catalogos/plataformas-rs'),
  lookupPrefijo: (indicativo: string) =>
    client.get<PrefijoPaisResult>(`/catalogos/prefijos/lookup/${encodeURIComponent(indicativo)}`),
  listPaises: () => client.get<string[]>('/catalogos/prefijos/paises'),

  // Métricas por plataforma
  metricas: (pid: number) =>
    client.get<MetricaRS[]>(`/catalogos/plataformas-rs/${pid}/metricas`),
  createMetrica: (pid: number, data: { nombre: string; slug: string; is_active: boolean; orden: number }) =>
    client.post<MetricaRS>(`/catalogos/plataformas-rs/${pid}/metricas`, data),
  updateMetrica: (pid: number, mid: number, data: Partial<{ nombre: string; is_active: boolean; orden: number }>) =>
    client.put<MetricaRS>(`/catalogos/plataformas-rs/${pid}/metricas/${mid}`, data),
  deleteMetrica: (pid: number, mid: number) =>
    client.delete(`/catalogos/plataformas-rs/${pid}/metricas/${mid}`),
}
