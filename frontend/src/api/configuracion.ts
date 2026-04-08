import client from './client'

export interface SmtpConfig {
  host: string
  port: number
  usuario: string
  password: string
  remitente: string
  ssl: boolean
  habilitado: boolean
}

export interface RecordatorioConfig {
  dias_reaparicion: number
}

export const configuracionApi = {
  getSmtp: () => client.get<SmtpConfig>('/configuracion/smtp'),
  saveSmtp: (data: SmtpConfig) => client.put<SmtpConfig>('/configuracion/smtp', data),
  testSmtp: (destinatario: string) =>
    client.post<{ ok: boolean; mensaje: string }>('/configuracion/smtp/probar', { destinatario }),
  getRecordatorio: () => client.get<RecordatorioConfig>('/configuracion/recordatorio'),
  saveRecordatorio: (data: RecordatorioConfig) =>
    client.put<RecordatorioConfig>('/configuracion/recordatorio', data),
}
