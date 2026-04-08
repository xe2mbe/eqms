export interface Usuario {
  id: number
  username: string
  full_name: string
  email?: string
  telefono?: string
  role: 'admin' | 'operador'
  indicativo?: string
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
  zona?: string
  sistema?: string
  tipo_reporte?: string
  qrz_station?: string
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
  tipo_reporte?: string
  sistema?: string
  zona?: string
  estado?: string
  indicativo?: string
  page?: number
  page_size?: number
}

export interface Evento {
  id: number
  tipo: string
  descripcion?: string
  is_active: boolean
}

export interface Estacion {
  id: number
  qrz: string
  descripcion?: string
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

export interface PlataformaRS {
  id: number
  nombre: string
  descripcion?: string
  is_active: boolean
}

export interface EstadisticaRS {
  plataforma: string
  me_gusta: number
  comentarios: number
  compartidos: number
  reproducciones: number
}

export interface EstadisticaResumen {
  total_reportes: number
  total_operadores: number
  estados: { estado: string; total: number }[]
  sistemas: { sistema: string; total: number }[]
}
