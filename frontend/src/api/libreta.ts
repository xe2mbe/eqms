import client from './client'

export interface LibretaConfig {
  tipo_evento?: string | null
  estacion?: string | null
  sistema_default?: string | null
  considerar_swl?: boolean
  estado_default?: string | null
  ciudad_default?: string | null
  rst_default?: string | null
  anunciar_primera_vez?: boolean
  anunciar_reaparicion?: boolean
  zona_swl_default?: string | null
  bm_tgs?: string | null
  roip_monitorando?: boolean
  roip_avanzado?: boolean
  asl_hub_id?: string | null
  asl_host?: string | null
  asl_port?: string | null
  asl_boletin_node?: string | null
  irlp_reflector_id?: string | null
  irlp_ref_url?: string | null
  irlp_user?: string | null
  irlp_password?: string | null
  irlp_boletin_node?: string | null
  irlp_host?: string | null
  irlp_port?: string | null
}

export interface CheckIndicativoResult {
  es_primera_vez: boolean
  ultima_aparicion?: string | null
  ultimo_sistema?: string | null
  dias_sin_aparecer?: number | null
  dias_reaparicion: number
  es_reaparicion: boolean
}

export interface NuevoHam {
  indicativo: string
  nombre_completo?: string
  municipio?: string
  estado?: string
}

export const libretaApi = {
  getConfig: () => client.get<LibretaConfig>('/libreta/config'),
  saveConfig: (data: LibretaConfig) => client.put<LibretaConfig>('/libreta/config', data),
  checkIndicativo: (indicativo: string) =>
    client.get<CheckIndicativoResult>(`/libreta/check/${indicativo}`),
  nuevoHam: (data: NuevoHam) => client.post('/libreta/nuevo-ham', data),
}
