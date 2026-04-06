import client from './client'
import type { Evento, Estacion, Zona, Sistema, Estado, PlataformaRS } from '@/types'

export const catalogosApi = {
  eventos: () => client.get<Evento[]>('/catalogos/eventos'),
  estaciones: () => client.get<Estacion[]>('/catalogos/estaciones'),
  zonas: () => client.get<Zona[]>('/catalogos/zonas'),
  sistemas: () => client.get<Sistema[]>('/catalogos/sistemas'),
  estados: () => client.get<Estado[]>('/catalogos/estados'),
  plataformasRS: () => client.get<PlataformaRS[]>('/catalogos/plataformas-rs'),
}
