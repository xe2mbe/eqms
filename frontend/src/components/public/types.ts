/** Tipos del payload de la página pública (PublicFMRE), compartidos por sus componentes. */

export type UltimoEventoResumen = { tipo: string; ultima: string; estaciones: number; total_qsos: number }

export type Stats = {
  rf: {
    total: number; indicativos: number
    por_estado: { estado: string; total: number }[]
    por_sistema: { sistema: string; nombre: string; total: number }[]
    tendencia: { mes: string; sistema: string; total: number }[]
    top_indicativos: { indicativo: string; nombre: string | null; total: number }[]
    paises: { pais: string; indicativos: number }[]
  }
  rs: {
    total: number; indicativos: number
    por_plataforma: { plataforma: string; total: number }[]
    tendencia: { mes: string; plataforma: string; total: number }[]
    por_estado: { estado: string; total: number }[]
    top_indicativos: { indicativo: string; nombre: string | null; total: number }[]
  }
  ultimo_evento_rf: UltimoEventoResumen | null
  ultimo_evento_rs: UltimoEventoResumen | null
}

export type EstacionItem = { indicativo: string; nombre: string | null; total: number; ultima: string | null }
export type EstacionIntlItem = EstacionItem & { pais: string }
export type UltimoEvDetalle   = { evento: string | null; fecha: string | null; participantes: { indicativo: string; nombre: string | null; total: number; sistemas: Record<string, number>; estado: string | null }[] }
export type UltimoEvRSDetalle = { evento: string | null; fecha: string | null; participantes: { indicativo: string; nombre: string | null; total: number; plataformas: Record<string, number>; estado: string | null }[] }

export type BusquedaResult = {
  indicativo: string
  operador: { nombre: string | null; municipio: string | null; estado: string | null; licencia: string | null } | null
  rf: {
    total: number; primera: string | null; ultima: string | null
    por_evento: { evento: string; total: number }[]
    por_sistema: { sistema: string; total: number }[]
    ultimos: { fecha: string | null; evento: string | null; sistema: string | null; zona: string | null; ciudad: string | null; estado: string | null; senal: number | null }[]
  }
  rs: {
    total: number; primera: string | null; ultima: string | null
    por_plataforma: { plataforma: string; total: number }[]
    ultimos: { fecha: string | null; plataforma: string | null; ciudad: string | null; estado: string | null; senal: number | null }[]
  }
}
