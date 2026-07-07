import { useRef } from 'react'
import { Modal, Form, Row, Col, Input, Select, Button } from 'antd'
import type { FormInstance } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import type { Estado } from '@/types'

interface PrimeraVezModalProps {
  open: boolean
  indicativo: string
  form: FormInstance
  saving: boolean
  estados: Estado[]
  onGuardar: () => void
  onOmitir: () => void
}

/**
 * Modal de recordatorio cuando un indicativo se captura por primera vez en
 * el sistema (Libreta RF): invita a registrar sus datos en el catálogo de
 * HAMs antes de continuar la captura.
 */
export default function PrimeraVezModal({
  open, indicativo, form, saving, estados, onGuardar, onOmitir,
}: PrimeraVezModalProps) {
  const registrarHamBtnRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      open={open}
      closable={false}
      maskClosable={false}
      footer={null}
      width={520}
      styles={{ body: { padding: 0 } }}
      afterOpenChange={isOpen => { if (isOpen) registrarHamBtnRef.current?.focus() }}
    >
      {/* Cabecera con gradiente */}
      <div style={{
        background: 'linear-gradient(135deg, #1A569E 0%, #1677ff 60%, #40a9ff 100%)',
        borderRadius: '8px 8px 0 0',
        padding: '32px 32px 24px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 36,
          border: '3px solid rgba(255,255,255,0.5)',
        }}>
          🎙️
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, marginBottom: 4 }}>
          {indicativo}
        </div>
        <div style={{ fontSize: 15, opacity: 0.9, fontWeight: 600 }}>
          ¡Primera aparición registrada!
        </div>
        <div style={{
          marginTop: 12, fontSize: 13, opacity: 0.8,
          background: 'rgba(0,0,0,0.15)', borderRadius: 20,
          padding: '6px 16px', display: 'inline-block',
        }}>
          Esta estación no tiene registros previos en el sistema
        </div>
      </div>

      {/* Invitación */}
      <div style={{
        background: '#fffbe6', borderBottom: '1px solid #ffe58f',
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>📡</span>
        <span style={{ fontSize: 13, color: '#614700' }}>
          <strong>¡Bienvenido a la red FMRE!</strong> Invitamos a <strong>{indicativo}</strong> a
          seguir reportándose y ser parte activa de nuestra comunidad de radioaficionados.
        </span>
      </div>

      {/* Formulario de datos */}
      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          Registra los datos del operador para enriquecer el catálogo de HAMs:
        </div>
        <Form form={form} layout="vertical">
          <Form.Item label="Nombre completo" name="nombre_completo" style={{ marginBottom: 12 }}>
            <Input prefix={<span>👤</span>} placeholder="Nombre del operador" size="large" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item label="Ciudad / Municipio" name="municipio" style={{ marginBottom: 12 }}>
                <Input prefix={<span>🏙️</span>} placeholder="Ciudad" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Estado" name="estado" style={{ marginBottom: 12 }}>
                <Select placeholder="Estado" showSearch allowClear optionFilterProp="label"
                  options={estados.map(e => ({ value: e.nombre, label: e.nombre }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 24px 20px',
        display: 'flex', justifyContent: 'flex-end', gap: 8,
      }}>
        <Button onClick={onOmitir} size="large">
          Omitir
        </Button>
        <Button ref={registrarHamBtnRef} type="primary" icon={<SaveOutlined />} size="large"
          loading={saving} onClick={onGuardar}
          style={{ background: '#1A569E', borderColor: '#1A569E' }}>
          Registrar en HAMs
        </Button>
      </div>
    </Modal>
  )
}
