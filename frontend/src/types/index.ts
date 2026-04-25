export interface Usuario {
  id: number
  username: string
  full_name: string
  email?: string
  telefono?: string
  role: 'admin' | 'operador'
  indicativo?: string
  avatar?: string
  is_active: boolean
  must_change_password: boolean
  last_login?: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: Usuario
}

export interface Reporte {
  id: number
  indicativo: string
  operador?: string
  senal: number
  estado?: string
  ciudad?: string
  zona_id?: number
  zona?: Zona
  pais?: string
  sistema_id?: number
  sistema?: Sistema
  evento_id?: number
  evento?: Evento
  estacion_id?: number
  estacion?: Estacion
  fecha_reporte: string
  observaciones?: string
  created_at: string
  capturado_por?: number
  capturado_por_nombre?: string
}

export interface PaginatedReportes {
  items: Reporte[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface ReporteFilters {
  fecha_inicio?: string
  fecha_fin?: string
  evento_id?: number
  zona_id?: number
  sistema_id?: number
  estado?: string
  indicativo?: string
  page?: number
  page_size?: number
}

export interface Evento {
  id: number
  tipo: string
  descripcion?: string
  color?: string
  is_active: boolean
}

export interface Estacion {
  id: number
  qrz: string
  descripcion?: string
  color?: string
  is_active: boolean
}

export interface Zona {
  id: number
  codigo: string
  nombre: string
  color?: string
  is_active: boolean
}

export interface Sistema {
  id: number
  codigo: string
  nombre: string
  color?: string
  is_active: boolean
}

export interface Estado {
  id: number
  abreviatura: string
  nombre: string
  zona?: string
  lat?: string
  lng?: string
}

export interface MetricaRS {
  id: number
  plataforma_id: number
  nombre: string
  slug: string
  is_active: boolean
  is_default: boolean
  orden: number
}

export interface PlataformaRS {
  id: number
  nombre: string
  descripcion?: string
  color?: string
  is_active: boolean
  metricas: MetricaRS[]
}

export interface EstadisticaRS {
  plataforma: string
  me_gusta: number
  comentarios: number
  compartidos: number
  reproducciones: number
}

export interface EstadisticaRSRecord {
  id: number
  plataforma_id: number
  plataforma: PlataformaRS
  valores: Record<string, number>
  observaciones?: string
  fecha_reporte: string
  created_at: string
  capturado_por_nombre?: string
}

export interface ReporteRS {
  id: number
  indicativo: string
  operador?: string
  senal: number
  plataforma_id: number
  plataforma: PlataformaRS
  estado?: string
  ciudad?: string
  zona_id?: number
  zona?: Zona
  pais?: string
  evento_id?: number
  evento?: Evento
  estacion_id?: number
  estacion?: Estacion
  url_publicacion?: string
  fecha_reporte: string
  observaciones?: string
  created_at: string
  capturado_por_nombre?: string
}

export interface EstadisticaResumen {
  total_reportes: number
  total_operadores: number
  total_estaciones: number
  estados: { estado: string; total: number }[]
  sistemas: { sistema: string; total: number }[]
  eventos: { evento: string; total: number }[]
}
