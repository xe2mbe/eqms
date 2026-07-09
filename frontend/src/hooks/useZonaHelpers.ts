import { useMemo } from 'react'
import type { Zona } from '@/types'

/**
 * Colores por zona y código de la zona "Extranjero" del catálogo.
 * Compartido por Libreta (RF) y LibretaRS.
 */
export function useZonaHelpers(zonas: Zona[]) {
  const zonaColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    zonas.forEach(z => { m[z.codigo] = z.color || '#999' })
    return m
  }, [zonas])

  const zonaColor = (codigo: string) => zonaColorMap[codigo] || '#999'

  const zonaExtranjero = useMemo(
    () => zonas.find(z => z.codigo.toLowerCase().includes('ext') || z.nombre.toLowerCase().includes('extranj'))?.codigo || 'Extranjero',
    [zonas]
  )

  return { zonaColorMap, zonaColor, zonaExtranjero }
}
