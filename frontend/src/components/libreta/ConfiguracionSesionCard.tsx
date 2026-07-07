import {
  Card, Form, Select, DatePicker, Button, Row, Col, Checkbox, Collapse, Tag,
  Input, Space, Typography, Tooltip,
} from 'antd'
import type { FormInstance } from 'antd'
import { PlusOutlined, SettingOutlined, BellOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Evento, Sistema, Estacion, Estado } from '@/types'
import { normalizarRST, validarRST } from '@/utils/libretaShared'
import RoipMonitorPanel from '@/components/libreta/RoipMonitorPanel'
import type { RoipMonitor } from '@/hooks/useRoipMonitor'

const { Text } = Typography
const { Panel } = Collapse

interface ConfiguracionSesionCardProps {
  form: FormInstance
  sesionActiva: boolean
  eventos: Evento[]
  estaciones: Estacion[]
  sistemas: Sistema[]
  estados: Estado[]
  inputRst: string
  onInputRstChange: (v: string) => void
  considerarSwl: boolean
  onConsiderarSwlChange: (v: boolean) => void
  anunciarPrimeraVez: boolean
  onAnunciarPrimeraVezChange: (v: boolean) => void
  anunciarReaparicion: boolean
  onAnunciarReaparicionChange: (v: boolean) => void
  roip: RoipMonitor
  onIniciar: () => void
  onNueva: () => void
}

/** Tarjeta de configuración de sesión de captura (Libreta RF): evento, estaciones, recordatorios y monitoreo RoIP. */
export default function ConfiguracionSesionCard({
  form, sesionActiva, eventos, estaciones, sistemas, estados,
  inputRst, onInputRstChange, considerarSwl, onConsiderarSwlChange,
  anunciarPrimeraVez, onAnunciarPrimeraVezChange, anunciarReaparicion, onAnunciarReaparicionChange,
  roip, onIniciar, onNueva,
}: ConfiguracionSesionCardProps) {
  return (
    <Card className="card-shadow" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
      <Form form={form} layout="vertical" initialValues={{ fecha_hora: dayjs() }}>
        <Collapse defaultActiveKey={['evento', 'estaciones', 'recordatorio', 'nodos']} ghost style={{ marginBottom: 8 }}>

          <Panel header={<strong>Evento</strong>} key="evento">
            <Row gutter={16}>
              <Col xs={24} sm={12} md={6}>
                <Form.Item label="Evento" name="tipo_evento" rules={[{ required: true, message: 'Requerido' }]}>
                  <Select placeholder="Tipo de evento" disabled={sesionActiva}
                    labelRender={({ value }) => {
                      const ev = eventos.find(e => e.tipo === value)
                      const c = ev?.color ?? '#1677ff'
                      return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{String(value)}</Tag>
                    }}
                    options={eventos.map(e => {
                      const c = e.color ?? '#1677ff'
                      return { value: e.tipo, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.tipo}</Tag> }
                    })} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Form.Item label="Estación" name="estacion">
                  <Select placeholder="QRZ operando" disabled={sesionActiva} allowClear
                    labelRender={({ value }) => {
                      const est = estaciones.find(e => e.qrz === value)
                      const c = est?.color ?? '#1677ff'
                      return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{String(value)}</Tag>
                    }}
                    options={estaciones.map(e => {
                      const c = e.color ?? '#1677ff'
                      return { value: e.qrz, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.qrz}</Tag> }
                    })} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Form.Item label="Sistema preferido" name="sistema_default">
                  <Select placeholder="Sistema" disabled={sesionActiva} allowClear
                    labelRender={({ value }) => {
                      const s = sistemas.find(s => s.codigo === value)
                      if (!s) return <span>{String(value)}</span>
                      const c = s.color ?? '#1677ff'
                      return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>
                    }}
                    options={sistemas.map(s => {
                      const c = s.color ?? '#1677ff'
                      return {
                        value: s.codigo,
                        label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>,
                      }
                    })} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Form.Item label="Fecha" name="fecha_hora" rules={[{ required: true }]}>
                  <DatePicker format="DD/MM/YYYY" disabled={sesionActiva} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Panel>

          <Panel header={<strong>Estaciones</strong>} key="estaciones">
            <Row gutter={16} align="bottom">
              <Col xs={12} sm={6} md={4}>
                <Form.Item
                  label={<Tooltip title="R(1-5) S(1-9) T(1-9 opcional). Ej: 59 o 599">
                    RST por defecto <span style={{ color: '#999', fontSize: 11 }}>(?)</span>
                  </Tooltip>}
                  style={{ marginBottom: 0 }}
                  validateStatus={!validarRST(inputRst) ? 'error' : ''}
                  help={!validarRST(inputRst) ? 'Ej: 59 o 599' : ''}
                >
                  <Input value={inputRst} maxLength={3} disabled={sesionActiva}
                    onChange={e => onInputRstChange(normalizarRST(e.target.value))}
                    style={{ width: 80, textAlign: 'center', fontWeight: 700 }} placeholder="59" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <Checkbox checked={considerarSwl} disabled={sesionActiva}
                  onChange={e => {
                    onConsiderarSwlChange(e.target.checked)
                    if (!e.target.checked) form.setFieldsValue({ estado_default: undefined, ciudad_default: undefined })
                  }}>
                  <strong>Considerar SWL</strong>
                </Checkbox>
              </Col>
              {considerarSwl && (
                <>
                  <Col xs={24} sm={8}>
                    <Form.Item label="Estado por defecto" name="estado_default" style={{ marginBottom: 0 }}>
                      <Select placeholder="Estado" disabled={sesionActiva} allowClear showSearch
                        optionFilterProp="label"
                        options={estados.map(e => ({ value: e.nombre, label: e.nombre }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={6}>
                    <Form.Item label="Ciudad por defecto" name="ciudad_default" style={{ marginBottom: 0 }}>
                      <Input placeholder="Ciudad" disabled={sesionActiva} />
                    </Form.Item>
                  </Col>
                </>

              )}
            </Row>
          </Panel>

          <Panel header={<strong>Recordatorio</strong>} key="recordatorio"
            extra={<BellOutlined style={{ color: '#fa8c16' }} />}>
            <Space direction="vertical" size={8}>
              <Checkbox checked={anunciarPrimeraVez} disabled={sesionActiva}
                onChange={e => onAnunciarPrimeraVezChange(e.target.checked)}>
                <strong>Anunciar Primera Vez</strong>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  — Abre formulario para registrar datos del operador si es su primera aparición
                </Text>
              </Checkbox>
              <Checkbox checked={anunciarReaparicion} disabled={sesionActiva}
                onChange={e => onAnunciarReaparicionChange(e.target.checked)}>
                <strong>Anunciar Reaparición</strong>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  — Muestra la última fecha de aparición si superó el umbral configurado
                </Text>
              </Checkbox>
            </Space>
          </Panel>

          <Panel header={<strong>Monitoreo Sistemas RoIP</strong>} key="nodos"
            extra={<SettingOutlined style={{ color: '#1677ff' }} />}>
            <RoipMonitorPanel roip={roip} />
          </Panel>

        </Collapse>

        <Row style={{ marginTop: 8 }}>
          <Col>
            {!sesionActiva ? (
              <Button type="primary" onClick={onIniciar} icon={<PlusOutlined />}>
                Iniciar Toma de Reporte
              </Button>
            ) : (
              <Button onClick={onNueva}>
                Nueva Toma de Reporte
              </Button>
            )}
          </Col>
        </Row>
      </Form>
    </Card>
  )
}
