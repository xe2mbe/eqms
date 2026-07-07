import { Modal, DatePicker, Spin } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'

interface SeleccionFechaModalProps {
  open: boolean
  loading: boolean
  fecha: Dayjs
  onFechaChange: (v: Dayjs) => void
  onConfirm: () => void
  onCancel: () => void
}

/** Primer modal que ve el usuario al entrar a Libreta RF: elegir la fecha de captura. */
export default function SeleccionFechaModal({
  open, loading, fecha, onFechaChange, onConfirm, onCancel,
}: SeleccionFechaModalProps) {
  return (
    <Modal title={<><CalendarOutlined style={{ marginRight: 8 }} />Fecha de captura</>}
      open={open} closable={false} maskClosable={false}
      onOk={onConfirm} okText="Continuar"
      onCancel={onCancel} cancelText="Cancelar"
      width={340}>
      <Spin spinning={loading}>
        <div style={{ padding: '16px 0' }}>
          <DatePicker format="DD/MM/YYYY" value={fecha}
            onChange={v => { if (v) onFechaChange(v) }}
            style={{ width: '100%' }} allowClear={false} />
        </div>
      </Spin>
    </Modal>
  )
}
