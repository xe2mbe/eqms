/**
 * Validación de indicativo (ITU). Formato: prefijo (1-3 alfanuméricos, al
 * menos una letra) + 1 dígito + sufijo (1-3 letras). Ej válidos: XE2MBE,
 * W1AW, EA8EE, XF2MC, K0RCA, JA1ABC. Ej inválidos: XE2EEEE (sufijo 4
 * letras), 123ABC (sin letra en prefijo), XE (sin dígito+sufijo).
 * SWL válidos: SWL, SWL001, SWL-XE2-001, SWL/XE2MBE, XE2-SWL-1234.
 * Compartido por Libreta (RF) y LibretaRS.
 */
export const INDICATIVO_RE = /^[A-Z0-9]{1,3}[0-9][A-Z]{1,3}$/

export function validarIndicativo(ind: string): boolean {
  const cs = ind.trim().toUpperCase()
  return cs === 'SWL' || INDICATIVO_RE.test(cs)
}

export const normalizarRST = (val: string) => val.replace(/[^0-9]/g, '').slice(0, 3)

export function validarRST(val: string): boolean {
  const v = (val || '').trim()
  if (v.length === 2) return parseInt(v[0]) >= 1 && parseInt(v[0]) <= 5 && parseInt(v[1]) >= 1 && parseInt(v[1]) <= 9
  if (v.length === 3) return parseInt(v[0]) >= 1 && parseInt(v[0]) <= 5 && parseInt(v[1]) >= 1 && parseInt(v[1]) <= 9 && parseInt(v[2]) >= 1 && parseInt(v[2]) <= 9
  return false
}

export const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
