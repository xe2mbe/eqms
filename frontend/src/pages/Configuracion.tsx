import { useState, useEffect } from 'react'
import {
  Card, Tabs, Form, Input, InputNumber, Button, Switch,
  Typography, Space, Divider, Alert, Row, Col, Modal,
} from 'antd'
import {
  MailOutlined, SettingOutlined, DatabaseOutlined,
  GlobalOutlined, SendOutlined, SaveOutlined,
  CheckCircleOutlined, CloseCircleOutlined, BellOutlined,
} from '@ant-design/icons'
import { configuracionApi, type SmtpConfig } from '@/api/configuracion'

const { Title, Text } = Typography

// ─── Tab: Correo Electrónico ──────────────────────────────────────────────────

function TabCorreo() {
  const [form] = Form.useForm<SmtpConfig>()
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [testModal, setTestModal] = useState(false)
  const [destinatario, setDestinatario] = useState('')

  useEffect(() => {
    configuracionApi.getSmtp().then(r => {
      form.setFieldsValue({
        ...r.data,
        password: r.data.password ? r.data.password : '',
      })
    })
  }, [form])

  const guardar = async () => {
    const values = await form.validateFields()
    setGuardando(true)
    try {
      await configuracionApi.saveSmtp(values)
      Modal.success({ title: 'Guardado', content: 'Configuración SMTP guardada correctamente.' })
    } catch (e: any) {
      Modal.error({ title: 'Error', content: e?.response?.data?.detail || 'No se pudo guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  const probar = async () => {
    if (!destinatario) return
    setProbando(true)
    setTestResult(null)
    try {
      const r = await configuracionApi.testSmtp(destinatario)
      setTestResult({ ok: true, msg: r.data.mensaje })
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.response?.data?.detail || 'Error desconocido.' })
    } finally {
      setProbando(false)
    }
  }

  return (
    <Row gutter={[24, 0]}>
      <Col xs={24} lg={14}>
        <Form form={form} layout="vertical" initialValues={{ port: 587, ssl: false, habilitado: false }}>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item label="Servidor SMTP (host)" name="host"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="smtp.gmail.com" prefix={<GlobalOutlined />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Puerto" name="port"
                rules={[{ required: true }]}>
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Usuario" name="usuario"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="usuario@dominio.com" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Contraseña" name="password"
                rules={[{ required: true, message: 'Requerido' }]}>
                <Input.Password placeholder="Contraseña SMTP" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Correo del remitente (From)" name="remitente">
            <Input placeholder="QMS FMRE <noreply@fmre.org.mx>" prefix={<MailOutlined />} />
          </Form.Item>

          <Row gutter={32}>
            <Col>
              <Form.Item label="Usar SSL/TLS (puerto 465)" name="ssl" valuePropName="checked">
                <Switch
                  checkedChildren="SSL"
                  unCheckedChildren="STARTTLS"
                  onChange={val => form.setFieldValue('port', val ? 465 : 587)}
                />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item label="Correo habilitado" name="habilitado" valuePropName="checked">
                <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={guardando}
              onClick={guardar}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Guardar configuración
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={() => { setTestModal(true); setTestResult(null) }}
            >
              Probar conexión
            </Button>
          </Space>
        </Form>
      </Col>

      <Col xs={24} lg={10}>
        <Card size="small" title="Configuraciones comunes" style={{ background: '#fafafa' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {[
              { label: 'Gmail', host: 'smtp.gmail.com', port: 587, ssl: false },
              { label: 'Gmail SSL', host: 'smtp.gmail.com', port: 465, ssl: true },
              { label: 'Outlook / Hotmail', host: 'smtp.office365.com', port: 587, ssl: false },
              { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, ssl: false },
            ].map(p => (
              <Button
                key={p.label}
                size="small"
                block
                onClick={() => form.setFieldsValue({ host: p.host, port: p.port, ssl: p.ssl })}
              >
                {p.label} — {p.host}:{p.port}
              </Button>
            ))}
          </Space>

          <Divider style={{ margin: '12px 0' }} />

          <Alert
            type="info"
            showIcon
            message="Gmail"
            description={
              <Text style={{ fontSize: 12 }}>
                Para Gmail activa "Acceso de aplicaciones menos seguras" o usa una
                <strong> contraseña de aplicación</strong> si tienes 2FA habilitado.
              </Text>
            }
          />
        </Card>
      </Col>

      {/* Modal para probar */}
      <Modal
        open={testModal}
        title="Probar conexión SMTP"
        onCancel={() => setTestModal(false)}
        footer={null}
        width={420}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Ingresa el correo destinatario de prueba:</Text>
          <Input
            placeholder="tu@email.com"
            value={destinatario}
            onChange={e => setDestinatario(e.target.value)}
            onPressEnter={probar}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={probando}
            onClick={probar}
            block
            disabled={!destinatario}
          >
            Enviar correo de prueba
          </Button>

          {testResult && (
            <Alert
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              icon={testResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              message={testResult.ok ? 'Correo enviado exitosamente' : 'Error al enviar'}
              description={testResult.msg}
            />
          )}
        </Space>
      </Modal>
    </Row>
  )
}

// ─── Tab: Opciones del Sistema ────────────────────────────────────────────────

function TabSistema() {
  return (
    <div style={{ color: '#999', textAlign: 'center', padding: '48px 0' }}>
      <SettingOutlined style={{ fontSize: 48, marginBottom: 16 }} />
      <div>Opciones del sistema — próximamente</div>
    </div>
  )
}

// ─── Tab: Consulta SQL ────────────────────────────────────────────────────────

function TabSQL() {
  return (
    <div style={{ color: '#999', textAlign: 'center', padding: '48px 0' }}>
      <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16 }} />
      <div>Consulta SQL — próximamente</div>
    </div>
  )
}

// ─── Tab: Recordatorio ───────────────────────────────────────────────────────

function TabRecordatorio() {
  const [form] = Form.useForm()
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    configuracionApi.getRecordatorio().then(r => {
      form.setFieldsValue(r.data)
    }).catch(() => form.setFieldsValue({ dias_reaparicion: 30 }))
  }, [form])

  const guardar = async () => {
    const values = await form.validateFields()
    setGuardando(true)
    try {
      await configuracionApi.saveRecordatorio(values)
      Modal.success({ title: 'Guardado', content: 'Configuración de recordatorio guardada.' })
    } catch (e: any) {
      Modal.error({ title: 'Error', content: e?.response?.data?.detail || 'No se pudo guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Row gutter={[24, 0]}>
      <Col xs={24} lg={10}>
        <Form form={form} layout="vertical" initialValues={{ dias_reaparicion: 30 }}>
          <Form.Item
            label="Días para considerar reaparición"
            name="dias_reaparicion"
            rules={[
              { required: true, message: 'Requerido' },
              { type: 'number', min: 1, max: 3650, message: 'Debe ser entre 1 y 3650 días' },
            ]}
            extra="Si una estación no ha aparecido en este número de días, se marcará como reaparición al capturarla en la libreta."
          >
            <InputNumber min={1} max={3650} style={{ width: '100%' }} addonAfter="días" />
          </Form.Item>
          <Divider />
          <Button type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardar}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
            Guardar
          </Button>
        </Form>
      </Col>
      <Col xs={24} lg={14}>
        <Alert
          type="info"
          showIcon
          icon={<BellOutlined />}
          message="¿Cómo funciona el recordatorio?"
          description={
            <Space direction="vertical" size={4} style={{ fontSize: 13 }}>
              <span>En la configuración de la libreta puedes activar dos opciones:</span>
              <span>• <strong>Anunciar Primera Vez</strong>: cuando se capture un indicativo que nunca ha aparecido en reportes, se abre un formulario para registrar sus datos en la tabla de HAMs.</span>
              <span>• <strong>Anunciar Reaparición</strong>: cuando se capture un indicativo que no ha aparecido en el número de días configurado aquí, se muestra la última fecha en que apareció.</span>
            </Space>
          }
          style={{ marginTop: 8 }}
        />
      </Col>
    </Row>
  )
}

// ─── Tab: Redes Sociales ──────────────────────────────────────────────────────

function TabRedesSociales() {
  return (
    <div style={{ color: '#999', textAlign: 'center', padding: '48px 0' }}>
      <GlobalOutlined style={{ fontSize: 48, marginBottom: 16 }} />
      <div>Integración con redes sociales — próximamente</div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  return (
    <div className="page-container">
      <Title level={4} style={{ margin: '0 0 16px' }}>
        Configuración
      </Title>

      <Card className="card-shadow">
        <Tabs
          defaultActiveKey="correo"
          items={[
            {
              key: 'correo',
              label: <span><MailOutlined /> Correo Electrónico</span>,
              children: <TabCorreo />,
            },
            {
              key: 'sistema',
              label: <span><SettingOutlined /> Opciones del Sistema</span>,
              children: <TabSistema />,
            },
            {
              key: 'sql',
              label: <span><DatabaseOutlined /> Consulta SQL</span>,
              children: <TabSQL />,
            },
            {
              key: 'recordatorio',
              label: <span><BellOutlined /> Recordatorio</span>,
              children: <TabRecordatorio />,
            },
            {
              key: 'redes',
              label: <span><GlobalOutlined /> Redes Sociales</span>,
              children: <TabRedesSociales />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
