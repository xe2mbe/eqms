import { useEffect, useState } from 'react'
import {
  Form, Input, Select, DatePicker,
  Button, Card, Typography, Space, Tag, message, Spin, Modal,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { reportesApi } from '@/api/reportes'
import { catalogosApi } from '@/api/catalogos'
import { validateCallsignClient } from '@/utils/validators'
import type { Evento, Sistema, Estado, Zona, Estacion } from '@/types'

const { Title } = Typography
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function NuevoReportePage() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const isEdit = Boolean(editId)

  const [saving, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [callsignStatus, setCallsignStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [callsignMsg, setCallsignMsg] = useState('')
  const [eventos, setEventos] = useState<Evento[]>([])
  const [sistemas, setSistemas] = useState<Sistema[]>([])
  const [estados, setEstados] = useState<Estado[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [estaciones, setEstaciones] = useState<Estacion[]>([])
  const [diaEventoModal, setDiaEventoModal] = useState<{ fecha: ReturnType<typeof dayjs>; tipoEvento: string; diasConfig: number[] } | null>(null)

  useEffect(() => {
    Promise.all([
      catalogosApi.eventos().then(r => setEventos(r.data)),
      catalogosApi.sistemas().then(r => setSistemas(r.data)),
      catalogosApi.estados().then(r => setEstados(r.data)),
      catalogosApi.zonas().then(r => setZonas(r.data)),
      catalogosApi.estaciones().then(r => setEstaciones(r.data)),
    ])

    if (isEdit) {
      setLoadingData(true)
      reportesApi.get(Number(editId)).then(({ data }) => {
        form.setFieldsValue({
          ...data,
          fecha_reporte: dayjs(data.fecha_reporte),
        })
        setLoadingData(false)
      })
    }
  }, [editId])

  const handleCallsignBlur = () => {
    const val = form.getFieldValue('indicativo') as string
    if (!val) { setCallsignStatus('idle'); return }
    const result = validateCallsignClient(val)
    if (result.valid) {
      setCallsignStatus('ok')
      setCallsignMsg(`Zona: ${result.zona} – ${result.tipo}`)
      if (result.zona && result.zona !== 'Extranjero' && result.zona !== 'Error') {
        const z = zonas.find(z => z.codigo === result.zona)
        if (z) form.setFieldValue('zona_id', z.id)
      }
    } else {
      setCallsignStatus('error')
      setCallsignMsg('Indicativo no reconocido')
    }
  }

  const onFinish = async (values: any) => {
    // Validar día vs evento recurrente
    if (values.evento_id && values.fecha_reporte) {
      const evento = eventos.find(e => e.id === values.evento_id)
      if (evento?.recurrente && evento.dias_semana?.length) {
        const dia = (values.fecha_reporte as ReturnType<typeof dayjs>).day()
        if (!evento.dias_semana.includes(dia)) {
          setDiaEventoModal({ fecha: values.fecha_reporte, tipoEvento: evento.tipo, diasConfig: evento.dias_semana })
          return
        }
      }
    }

    setLoading(true)
    try {
      const payload = { ...values, fecha_reporte: values.fecha_reporte.format('YYYY-MM-DDTHH:mm:ss') }
      if (isEdit) {
        await reportesApi.update(Number(editId), payload)
        message.success('Reporte actualizado')
      } else {
        await reportesApi.create(payload)
        message.success('Reporte capturado exitosamente')
        form.resetFields()
        form.setFieldValue('fecha_reporte', dayjs())
        setCallsignStatus('idle')
      }
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reportes')}>Volver</Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Editar Reporte' : 'Nuevo Reporte'}
        </Title>
      </Space>

      <Spin spinning={loadingData}>
        <Card className="card-shadow">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ senal: 59, fecha_reporte: dayjs() }}
          >
            <Form.Item
              label="Indicativo"
              name="indicativo"
              validateStatus={callsignStatus === 'error' ? 'error' : callsignStatus === 'ok' ? 'success' : ''}
              help={callsignStatus !== 'idle' ? (
                <span style={{ color: callsignStatus === 'ok' ? '#52c41a' : '#ff4d4f' }}>
                  {callsignStatus === 'ok' && <CheckCircleOutlined style={{ marginRight: 4 }} />}
                  {callsignMsg}
                </span>
              ) : null}
              rules={[{ required: true, message: 'Indicativo requerido' }]}
            >
              <Input
                placeholder="XE2MBE"
                style={{ textTransform: 'uppercase' }}
                onBlur={handleCallsignBlur}
                onChange={(e) => {
                  form.setFieldValue('indicativo', e.target.value.toUpperCase())
                  setCallsignStatus('idle')
                }}
              />
            </Form.Item>

            <Form.Item label="Operador" name="operador">
              <Input placeholder="Nombre completo" />
            </Form.Item>

            <Form.Item label="Señal (RST)" name="senal" rules={[{ required: true }]}>
              <Select options={[59, 57, 55, 53, 51].map(v => ({ value: v, label: `${v}` }))} />
            </Form.Item>

            <Form.Item label="Tipo de Evento" name="evento_id" rules={[{ required: true, message: 'Requerido' }]}>
              <Select
                placeholder="Selecciona el evento"
                labelRender={({ value }) => {
                  const ev = eventos.find(e => e.id === value)
                  const c = ev?.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{ev?.tipo ?? String(value)}</Tag>
                }}
                options={eventos.map(e => {
                  const c = e.color ?? '#1677ff'
                  return { value: e.id, label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.tipo}</Tag> }
                })}
              />
            </Form.Item>

            <Form.Item label="Sistema" name="sistema_id">
              <Select
                placeholder="Sistema de comunicación"
                allowClear
                options={sistemas.map(s => {
                  const c = s.color ?? '#1677ff'
                  return {
                    value: s.id,
                    label: (
                      <Space size={6}>
                        <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>
                          {s.codigo}
                        </Tag>
                        {s.nombre}
                      </Space>
                    ),
                  }
                })}
              />
            </Form.Item>

            <Form.Item label="Estado" name="estado">
              <Select
                placeholder="Estado de la república"
                showSearch
                allowClear
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                options={estados.map(e => ({ value: e.nombre, label: e.nombre }))}
              />
            </Form.Item>

            <Form.Item label="Ciudad / Municipio" name="ciudad">
              <Input />
            </Form.Item>

            <Form.Item label="Zona" name="zona_id">
              <Select
                placeholder="Zona FMRE"
                allowClear
                labelRender={({ value }) => {
                  const z = zonas.find(z => z.id === value)
                  if (!z) return <span>{String(value)}</span>
                  const c = z.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{z.codigo}</Tag>
                }}
                options={zonas.map(z => {
                  const c = z.color ?? '#1677ff'
                  return {
                    value: z.id,
                    label: (
                      <Space size={6}>
                        <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{z.codigo}</Tag>
                        {z.nombre}
                      </Space>
                    ),
                  }
                })}
              />
            </Form.Item>

            <Form.Item label="Estación operando" name="estacion_id">
              <Select
                placeholder="QRZ de la estación"
                allowClear
                labelRender={({ value }) => {
                  const est = estaciones.find(e => e.id === value)
                  const c = est?.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{est?.qrz ?? String(value)}</Tag>
                }}
                options={estaciones.map(e => {
                  const c = e.color ?? '#1677ff'
                  return {
                    value: e.id,
                    label: (
                      <Space size={6}>
                        <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{e.qrz}</Tag>
                        {e.descripcion}
                      </Space>
                    ),
                  }
                })}
              />
            </Form.Item>

            <Form.Item label="Fecha y hora del reporte" name="fecha_reporte" rules={[{ required: true }]}>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="Observaciones" name="observaciones">
              <Input.TextArea rows={3} placeholder="Notas adicionales..." />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
                  {isEdit ? 'Actualizar Reporte' : 'Guardar Reporte'}
                </Button>
                {!isEdit && (
                  <Button onClick={() => { form.resetFields(); setCallsignStatus('idle') }}>
                    Limpiar
                  </Button>
                )}
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Spin>

      {/* ── Modal: Fecha no permitida para evento recurrente ── */}
      {diaEventoModal && (
        <Modal
          open
          footer={null}
          onCancel={() => setDiaEventoModal(null)}
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
              onClick={() => setDiaEventoModal(null)}
              style={{ minWidth: 140, fontWeight: 700, borderRadius: 8 }}
            >
              Entendido
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
