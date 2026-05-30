import { useEffect, useState } from 'react'
import {
  Badge, Button, Card, Col, DatePicker, Divider, Drawer, Form,
  Row, Select, Space, Switch, Tag, TimePicker, Tooltip, Typography,
  message, Empty, Spin,
} from 'antd'
import {
  CalendarOutlined, CloudDownloadOutlined, FilePdfOutlined,
  FileWordOutlined, MailOutlined, SendOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { reportesPdfApi, type PlantillaOut, type ProgramacionUpdate } from '@/api/reportesPdf'

const { Title, Text } = Typography

const TIPO_COLOR: Record<string, string> = { rf: 'blue', rs: 'purple', ambos: 'gold' }
const TIPO_LABEL: Record<string, string> = { rf: 'RF', rs: 'RS', ambos: 'RF + RS' }

const RECURRENCIA_OPTS = [
  { value: 'diario',   label: 'Diario (día anterior)' },
  { value: 'semanal',  label: 'Semanal (últimos 7 días)' },
  { value: 'mensual',  label: 'Mensual (mes anterior, día 1)' },
]
const DIAS_SEMANA = [
  { value: 0, label: 'Lunes' }, { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' }, { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' }, { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
]

export default function EstadisticasReportesPage() {
  const [loading, setLoading]             = useState(true)
  const [plantillas, setPlantillas]       = useState<PlantillaOut[]>([])
  const [selected, setSelected]           = useState<PlantillaOut | null>(null)
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [sending, setSending]             = useState<number | null>(null)
  const [downloading, setDownloading]     = useState<number | null>(null)

  // Rango de fechas para descarga/envío manual
  const [dateRange, setDateRange]         = useState<[string, string]>([
    dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ])

  // Form programación
  const [form] = Form.useForm()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await reportesPdfApi.list()
      setPlantillas(data.filter(p => p.activa))
    } finally {
      setLoading(false)
    }
  }

  const openConfig = (p: PlantillaOut) => {
    setSelected(p)
    form.setFieldsValue({
      destinatarios: p.destinatarios ?? [],
      prog_hora: p.prog_hora ? dayjs(p.prog_hora, 'HH:mm') : null,
      prog_recurrencia: p.prog_recurrencia ?? null,
      prog_dia_semana: p.prog_dia_semana ?? null,
      prog_activo: p.prog_activo ?? false,
    })
    setDrawerOpen(true)
  }

  const saveConfig = async () => {
    if (!selected) return
    try {
      const vals = await form.validateFields()
      const body: ProgramacionUpdate = {
        destinatarios: vals.destinatarios ?? [],
        prog_hora: vals.prog_hora ? dayjs(vals.prog_hora).format('HH:mm') : null,
        prog_recurrencia: vals.prog_recurrencia ?? null,
        prog_dia_semana: vals.prog_dia_semana ?? null,
        prog_activo: vals.prog_activo ?? false,
      }
      const { data } = await reportesPdfApi.updateProgramacion(selected.id, body)
      setPlantillas(prev => prev.map(p => p.id === data.id ? data : p))
      message.success('Configuración guardada')
      setDrawerOpen(false)
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? 'Error al guardar')
    }
  }

  const handleEnviar = async (p: PlantillaOut) => {
    setSending(p.id)
    try {
      await reportesPdfApi.enviar(p.id, dateRange[0], dateRange[1])
      message.success(`Reporte enviado a ${p.destinatarios.join(', ')}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? 'Error al enviar')
    } finally {
      setSending(null)
    }
  }

  const handleDescargar = async (p: PlantillaOut, formato: 'pdf' | 'word') => {
    setDownloading(p.id)
    try {
      const res = formato === 'pdf'
        ? await reportesPdfApi.generar(p.id, dateRange[0], dateRange[1])
        : await reportesPdfApi.generarWord(p.id, dateRange[0], dateRange[1])
      const ext  = formato === 'pdf' ? 'pdf' : 'docx'
      const mime = formato === 'pdf' ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      const url  = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `reporte_${p.nombre.replace(/\s+/g,'_')}_${dateRange[0]}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      message.error('Error al generar el archivo')
    } finally {
      setDownloading(null)
    }
  }

  const recurrencia = Form.useWatch('prog_recurrencia', form)

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Reportes</Title>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Período para descarga / envío manual:</Text>
          <DatePicker.RangePicker
            value={[dayjs(dateRange[0]), dayjs(dateRange[1])]}
            onChange={dates => {
              if (dates?.[0] && dates?.[1])
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
            }}
          />
        </Space>
      </div>

      <Spin spinning={loading}>
        {plantillas.length === 0 && !loading && (
          <Empty description="No tienes reportes asignados" image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 80 }} />
        )}
        <Row gutter={[16, 16]}>
          {plantillas.map(p => (
            <Col key={p.id} xs={24} lg={12}>
              <Card
                className="card-shadow"
                styles={{ header: { borderLeft: `4px solid ${TIPO_COLOR[p.tipo] === 'blue' ? '#1677ff' : TIPO_COLOR[p.tipo] === 'purple' ? '#722ed1' : '#faad14'}` } }}
                title={
                  <Space>
                    <Tag color={TIPO_COLOR[p.tipo]}>{TIPO_LABEL[p.tipo]}</Tag>
                    <Text strong>{p.nombre}</Text>
                  </Space>
                }
                extra={
                  <Tooltip title="Configurar buzones y programación">
                    <Button icon={<SettingOutlined />} size="small" onClick={() => openConfig(p)} />
                  </Tooltip>
                }
              >
                {/* Info evento */}
                {(p.evento_rf_tipo || p.evento_rs_tipo) && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    {p.evento_rf_tipo ?? p.evento_rs_tipo}
                  </div>
                )}

                {/* Programación activa */}
                {p.prog_activo && p.prog_hora && p.prog_recurrencia ? (
                  <Badge status="processing" color="green"
                    text={
                      <Text style={{ fontSize: 12 }}>
                        Envío automático — <strong>{p.prog_hora}</strong> ·{' '}
                        {RECURRENCIA_OPTS.find(r => r.value === p.prog_recurrencia)?.label}
                        {p.prog_recurrencia === 'semanal' && p.prog_dia_semana != null
                          ? ` (${DIAS_SEMANA.find(d => d.value === p.prog_dia_semana)?.label})` : ''}
                        {p.prog_ultima_ejecucion
                          ? <Text type="secondary" style={{ fontSize: 11 }}> · último envío: {dayjs(p.prog_ultima_ejecucion).format('DD/MM/YYYY HH:mm')}</Text>
                          : null}
                      </Text>
                    }
                  />
                ) : (
                  <Badge status="default" text={<Text type="secondary" style={{ fontSize: 12 }}>Sin programación activa</Text>} />
                )}

                {/* Destinatarios */}
                {p.destinatarios.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <MailOutlined style={{ marginRight: 4, color: '#888' }} />
                    {p.destinatarios.map(d => <Tag key={d} style={{ fontSize: 11 }}>{d}</Tag>)}
                  </div>
                )}

                <Divider style={{ margin: '12px 0' }} />

                {/* Acciones */}
                <Space wrap>
                  <Tooltip title="Enviar por email ahora">
                    <Button
                      icon={<SendOutlined />}
                      size="small"
                      loading={sending === p.id}
                      disabled={!p.destinatarios.length}
                      onClick={() => handleEnviar(p)}
                    >
                      Enviar ahora
                    </Button>
                  </Tooltip>
                  <Tooltip title="Descargar en PDF">
                    <Button
                      icon={<FilePdfOutlined />}
                      size="small"
                      loading={downloading === p.id}
                      onClick={() => handleDescargar(p, 'pdf')}
                    >
                      PDF
                    </Button>
                  </Tooltip>
                  <Tooltip title="Descargar en Word (.docx)">
                    <Button
                      icon={<FileWordOutlined />}
                      size="small"
                      loading={downloading === p.id}
                      onClick={() => handleDescargar(p, 'word')}
                    >
                      Word
                    </Button>
                  </Tooltip>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>

      {/* Drawer de configuración */}
      <Drawer
        title={`Configurar: ${selected?.nombre}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={460}
        footer={
          <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" onClick={saveConfig}>Guardar</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Buzones destinatarios"
            name="destinatarios"
            extra="Emails que recibirán el reporte. Presiona Enter para agregar."
          >
            <Select
              mode="tags"
              tokenSeparators={[',']}
              placeholder="correo@ejemplo.com"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider>Programación automática</Divider>

          <Form.Item label="Activar envío automático" name="prog_activo" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="Hora de envío" name="prog_hora">
            <TimePicker format="HH:mm" minuteStep={15} style={{ width: '100%' }}
              placeholder="Selecciona hora" />
          </Form.Item>

          <Form.Item label="Recurrencia" name="prog_recurrencia">
            <Select allowClear placeholder="Sin programación" options={RECURRENCIA_OPTS} />
          </Form.Item>

          {recurrencia === 'semanal' && (
            <Form.Item label="Día de la semana" name="prog_dia_semana">
              <Select placeholder="Selecciona día" options={DIAS_SEMANA} />
            </Form.Item>
          )}

          <div style={{ background: '#f9f9f9', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#666' }}>
            <CloudDownloadOutlined style={{ marginRight: 6 }} />
            El sistema genera automáticamente el período según la recurrencia:
            <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
              <li><strong>Diario</strong> — reporte del día anterior</li>
              <li><strong>Semanal</strong> — últimos 7 días</li>
              <li><strong>Mensual</strong> — mes anterior completo (se envía el día 1)</li>
            </ul>
          </div>
        </Form>
      </Drawer>
    </div>
  )
}
