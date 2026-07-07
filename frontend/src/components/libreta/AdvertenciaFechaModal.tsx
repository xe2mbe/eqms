import { Modal, Button, Alert } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'

interface AdvertenciaFechaModalProps {
  open: boolean
  fecha: Dayjs
  onConfigurar: () => void
  onCapturar: () => void
}

/** Aviso cuando la fecha elegida para la sesión de captura no es hoy (Libreta RF). */
export default function AdvertenciaFechaModal({ open, fecha, onConfigurar, onCapturar }: AdvertenciaFechaModalProps) {
  return (
    <Modal title={<><WarningOutlined style={{ color: '#fa8c16', marginRight: 8 }} />Fecha diferente al día de hoy</>}
      open={open} closable={false} maskClosable={false}
      footer={[
        <Button key="config" onClick={onConfigurar}>Configurar libreta</Button>,
        <Button key="capture" type="primary" onClick={onCapturar}>Capturar registros</Button>,
      ]} width={420}>
      <Alert type="warning" showIcon
        message={`Los registros se guardarán con fecha: ${fecha?.format('DD/MM/YYYY')}`}
        description="¿Deseas capturar registros con esta fecha o revisar primero la configuración?"
        style={{ marginTop: 8 }} />
    </Modal>
  )
}
