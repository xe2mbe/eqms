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

export interface SistemaInfoConfig {
  url_sistema: string
  descripcion: string
}

export interface EmailBienvenidaConfig {
  asunto: string
  cuerpo: string
}

export interface NodeConfig {
  asl_hub_id: string
  asl_host: string
  asl_port: string
  asl_boletin_node: string
  irlp_reflector_id: string
  irlp_ref_url: string
  irlp_user: string
  irlp_password: string
  irlp_boletin_node: string
  irlp_host: string
  irlp_port: string
  bm_tgs: string
}

export const configuracionApi = {
  getSmtp: () => client.get<SmtpConfig>('/configuracion/smtp'),
  saveSmtp: (data: SmtpConfig) => client.put<SmtpConfig>('/configuracion/smtp', data),
  testSmtp: (destinatario: string) =>
    client.post<{ ok: boolean; mensaje: string }>('/configuracion/smtp/probar', { destinatario }),
  getRecordatorio: () => client.get<RecordatorioConfig>('/configuracion/recordatorio'),
  saveRecordatorio: (data: RecordatorioConfig) =>
    client.put<RecordatorioConfig>('/configuracion/recordatorio', data),
  getSistemaInfo: () => client.get<SistemaInfoConfig>('/configuracion/sistema-info'),
  saveSistemaInfo: (data: SistemaInfoConfig) =>
    client.put<SistemaInfoConfig>('/configuracion/sistema-info', data),
  getEmailBienvenida: () => client.get<EmailBienvenidaConfig>('/configuracion/email-bienvenida'),
  saveEmailBienvenida: (data: EmailBienvenidaConfig) =>
    client.put<EmailBienvenidaConfig>('/configuracion/email-bienvenida', data),
  getNodeConfig: () => client.get<NodeConfig>('/configuracion/node-config'),
  saveNodeConfig: (data: NodeConfig) => client.put<NodeConfig>('/configuracion/node-config', data),
}
