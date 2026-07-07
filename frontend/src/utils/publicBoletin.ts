/** Lógica de fechas del Boletín Dominical, compartida por PublicFMRE y sus componentes. */

export const MX_OFFSET = -6 * 60 * 60 * 1000 // Mexico City = UTC-6 (sin horario de verano desde 2023)

export function getNextBoletinInfo() {
  const now = new Date()
  const mx = new Date(now.getTime() + MX_OFFSET)
  const dow = mx.getUTCDay()
  const minuteOfDay = mx.getUTCHours() * 60 + mx.getUTCMinutes()
  const isLive         = dow === 0 && minuteOfDay >= 9 * 60     && minuteOfDay < 10 * 60
  const isBoletinWindow = dow === 0 && minuteOfDay >= 8 * 60 + 30 && minuteOfDay < 10 * 60 + 30

  const targetMx = new Date(mx)
  targetMx.setUTCHours(9, 0, 0, 0)
  if (dow !== 0 || minuteOfDay >= 10 * 60)
    targetMx.setUTCDate(targetMx.getUTCDate() + (dow === 0 ? 7 : 7 - dow))

  const year = targetMx.getUTCFullYear()
  const jan1dow = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  const firstSunday = new Date(Date.UTC(year, 0, 1 + (7 - jan1dow) % 7))
  const boletinNum = Math.round((targetMx.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  const diff = Math.max(0, targetMx.getTime() - MX_OFFSET - now.getTime())
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    isLive, isBoletinWindow, boletinNum, year,
  }
}

export function getBoletinNumForDate(dateStr: string): number {
  const utc = new Date(dateStr)
  const mx = new Date(utc.getTime() + MX_OFFSET)
  const year = mx.getUTCFullYear()
  const eventDay = new Date(Date.UTC(year, mx.getUTCMonth(), mx.getUTCDate()))
  const jan1dow = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  const firstSunday = new Date(Date.UTC(year, 0, 1 + (7 - jan1dow) % 7))
  return Math.round((eventDay.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
}
