import client from './client'

export interface Operador {
  indicativo: string
  nombre_completo?: string
  municipio?: string
  estado?: string
  tipo_licencia?: string
  tipo_ham?: string
  activo: boolean
}

export const operadoresApi = {
  buscar: (indicativo: string) =>
    client.get<Operador>(`/operadores/buscar/${indicativo}`),

  autocomplete: (q: string) =>
    client.get<Operador[]>('/operadores/autocomplete', { params: { q } }),
}
