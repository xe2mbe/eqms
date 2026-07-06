import { Modal, Button } from 'antd'
import type dayjs from 'dayjs'
import { NOMBRES_DIA } from '@/utils/libretaShared'

interface FechaNoPermitidaModalProps {
  diaEventoModal: { fecha: dayjs.Dayjs; tipoEvento: string; diasConfig: number[] } | null
  onClose: () => void
}

/**
 * Modal de aviso cuando la fecha seleccionada no coincide con los días
 * configurados de un evento recurrente. Compartido por Libreta (RF) y
 * LibretaRS.
 */
export default function FechaNoPermitidaModal({ diaEventoModal, onClose }: FechaNoPermitidaModalProps) {
  if (!diaEventoModal) return null

  return (
    <Modal
      open
      footer={null}
      onCancel={onClose}
      width={460}
      styles={{ body: { padding: 0 }, content: { overflow: 'hidden', borderRadius: 12, padding: 0 } }}
      closable={false}
      centered
    >
      {/* Cabecera con gradiente */}
      <div style={{
        background: 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 55%, #ff7a45 100%)',
        borderRadius: '12px 12px 0 0',
        padding: '28px 28px 20px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{
          width: 68, height: 68, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: 36,
          border: '3px solid rgba(255,255,255,0.4)',
        }}>
          📅
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
          Fecha no permitida
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.22)', borderRadius: 20,
          padding: '4px 18px', display: 'inline-block',
          fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
        }}>
          {diaEventoModal.tipoEvento}
        </div>
      </div>

      {/* Fecha intentada */}
      <div style={{
        background: '#fff2e8', borderBottom: '1px solid #ffbb96',
        padding: '12px 22px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 26 }}>🗓️</span>
        <div>
          <div style={{ fontSize: 11, color: '#874d00', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Fecha intentada
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#d4380d', marginTop: 2 }}>
            {NOMBRES_DIA[diaEventoModal.fecha.day()]} — {diaEventoModal.fecha.format('DD/MM/YYYY')}
          </div>
        </div>
      </div>

      {/* Días de la semana */}
      <div style={{ padding: '16px 22px 14px' }}>
        <div style={{ fontSize: 11, color: '#595959', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Días configurados para este evento
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {NOMBRES_DIA.map((nombre, idx) => {
            const esConfig = diaEventoModal.diasConfig.includes(idx)
            const esIntentado = idx === diaEventoModal.fecha.day()
            return (
              <div key={idx} style={{
                padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: esIntentado && !esConfig ? '#ff4d4f' : esConfig ? '#52c41a' : '#f5f5f5',
                color: esIntentado && !esConfig ? '#fff' : esConfig ? '#fff' : '#bfbfbf',
                border: `2px solid ${esIntentado && !esConfig ? '#cf1322' : esConfig ? '#389e0d' : '#e0e0e0'}`,
                transition: 'all 0.2s',
              }}>
                {esConfig && '✓ '}{esIntentado && !esConfig && '✗ '}{nombre.slice(0, 3)}
              </div>
            )
          })}
        </div>
      </div>

      {/* Aviso administrador */}
      <div style={{
        background: '#fffbe6', borderTop: '1px solid #ffe58f',
        padding: '12px 22px', display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1.6 }}>⚠️</span>
        <span style={{ fontSize: 13, color: '#614700', lineHeight: 1.6 }}>
          Cambia la fecha seleccionada para que coincida con un día configurado en este evento,
          o para habilitar capturas en{' '}
          <strong>{NOMBRES_DIA[diaEventoModal.fecha.day()]}</strong>,
          contacta a un administrador para agregar este día al evento.
        </span>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 22px 18px', display: 'flex', justifyContent: 'center' }}>
        <Button
          type="primary" danger size="large"
          onClick={onClose}
          style={{ minWidth: 140, fontWeight: 700, borderRadius: 8 }}
        >
          Entendido
        </Button>
      </div>
    </Modal>
  )
}
