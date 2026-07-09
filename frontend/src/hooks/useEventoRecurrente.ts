import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import dayjs from 'dayjs'
import type { Evento } from '@/types'

type DiaEventoModal = { fecha: dayjs.Dayjs; tipoEvento: string; diasConfig: number[] } | null

/**
 * Valida que una fecha caiga en uno de los días configurados para un evento
 * recurrente; si no, dispara el modal de advertencia. Compartido por Libreta
 * (RF) y LibretaRS.
 */
export function useVerificarDiaEvento(eventos: Evento[], setDiaEventoModal: Dispatch<SetStateAction<DiaEventoModal>>) {
  return useCallback((fecha: dayjs.Dayjs, tipoEvento: string): boolean => {
    const evento = eventos.find(e => e.tipo === tipoEvento)
    if (!evento?.recurrente || !evento.dias_semana?.length) return true
    if (evento.dias_semana.includes(fecha.day())) return true
    setDiaEventoModal({ fecha, tipoEvento, diasConfig: evento.dias_semana })
    return false
  }, [eventos, setDiaEventoModal])
}

/**
 * Número de ocurrencia del día en el año para un evento recurrente
 * (ej. 20 → "Domingo #20 del año"). Compartido por Libreta (RF) y LibretaRS.
 */
export function useOcurrenciaEvento(
  fecha: dayjs.Dayjs | string | null | undefined,
  tipoEvento: string | null | undefined,
  eventos: Evento[],
) {
  return useMemo<{ numero: number; dia: number } | null>(() => {
    if (!tipoEvento) return null
    const evento = eventos.find(e => e.tipo === tipoEvento)
    if (!evento?.recurrente || !evento.dias_semana?.length) return null
    const f = dayjs(fecha)
    const dia = f.day()
    if (!evento.dias_semana.includes(dia)) return null
    const inicioAnio = f.startOf('year')
    const diasHastaFecha = f.diff(inicioAnio, 'day')
    const diasHastaPrimero = (dia - inicioAnio.day() + 7) % 7
    const numero = Math.floor((diasHastaFecha - diasHastaPrimero) / 7) + 1
    return { numero, dia }
  }, [fecha, tipoEvento, eventos])
}
