import { useRef } from 'react'
import { Modal, Button, Alert } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { CheckIndicativoResult } from '@/api/libreta'

interface ReaparicionModalProps {
  open: boolean
  indicativo: string
  info: CheckIndicativoResult | null
  onContinuar: () => void
}

/**
 * Modal de aviso cuando un indicativo reaparece tras superar el umbral de
 * días configurado (Libreta RF).
 */
export default function ReaparicionModal({ open, indicativo, info, onContinuar }: ReaparicionModalProps) {
  const continuarCapturaBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      title={<><BellOutlined style={{ color: '#fa8c16', marginRight: 8 }} />Reaparición: {indicativo}</>}
      open={open} closable={false} maskClosable={false}
      footer={
        <Button ref={continuarCapturaBtnRef} type="primary" onClick={onContinuar}>
          Continuar captura
        </Button>
      }
      width={420}
      afterOpenChange={isOpen => { if (isOpen) continuarCapturaBtnRef.current?.focus() }}>
      {info && (
        <Alert type="warning" showIcon
          message={`${indicativo} no ha aparecido en ${info.dias_sin_aparecer} días`}
          description={<span>Última aparición: <strong>
            {info.ultima_aparicion ? dayjs(info.ultima_aparicion).format('DD/MM/YYYY') : 'desconocida'}
          </strong> (umbral: {info.dias_reaparicion} días)</span>}
          style={{ marginTop: 8 }} />
      )}
    </Modal>
  )
}
