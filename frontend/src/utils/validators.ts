export function validateCallsignClient(callsign: string) {
  const cs = callsign.trim().toUpperCase()

  if (cs === 'SWL') return { valid: true, complete: true, zona: 'Definir', tipo: 'SWL' }

  const xe123 = /^(XE[123])([A-Z]{1,3})?$/
  const mexGeneral = /^(?:XE|XF|XB)[4-9][A-Z]{1,3}$/
  const mexEspecial = /^(?:4[ABC]|6[D-J])\d[A-Z0-9]{1,3}$/

  const m = xe123.exec(cs)
  if (m) {
    return { valid: true, complete: Boolean(m[2]), zona: m[1], tipo: 'ham' }
  }
  if (mexGeneral.test(cs) || mexEspecial.test(cs)) {
    return { valid: true, complete: true, zona: 'Especial', tipo: 'ham' }
  }
  if (/^(XE|XF|XB|4|6)/.test(cs)) {
    return { valid: false, complete: false, zona: 'Error', tipo: 'Error' }
  }
  if (/^[A-Z][A-Z0-9]{2,}$/.test(cs)) {
    return { valid: true, complete: true, zona: 'Extranjero', tipo: 'ham' }
  }
  return { valid: false, complete: false, zona: 'Error', tipo: 'Error' }
}
