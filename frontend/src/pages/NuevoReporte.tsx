import { useEffect, useState } from 'react'
import {
  Form, Input, Select, DatePicker,
  Button, Card, Typography, Space, message, Spin,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { reportesApi } from '@/api/reportes'
import { catalogosApi } from '@/api/catalogos'
import { validateCallsignClient } from '@/utils/validators'
import type { Evento, Sistema, Estado, Zona, Estacion } from '@/types'

const { Title } = Typography

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
        form.setFieldValue('zona', result.zona)
      }
    } else {
      setCallsignStatus('error')
      setCallsignMsg('Indicativo no reconocido')
    }
  }

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const payload = { ...values, fecha_reporte: values.fecha_reporte.toISOString() }
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

            <Form.Item label="Tipo de Evento" name="tipo_reporte" rules={[{ required: true, message: 'Requerido' }]}>
              <Select
                placeholder="Selecciona el evento"
                options={eventos.map(e => ({ value: e.tipo, label: e.tipo }))}
              />
            </Form.Item>

            <Form.Item label="Sistema" name="sistema">
              <Select
                placeholder="Sistema de comunicación"
                allowClear
                options={sistemas.map(s => ({ value: s.codigo, label: `${s.codigo} – ${s.nombre}` }))}
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

            <Form.Item label="Zona" name="zona">
              <Select
                placeholder="Zona FMRE"
                allowClear
                options={zonas.map(z => ({ value: z.codigo, label: `${z.codigo} – ${z.nombre}` }))}
              />
            </Form.Item>

            <Form.Item label="Estación operando" name="qrz_station">
              <Select
                placeholder="QRZ de la estación"
                allowClear
                options={estaciones.map(e => ({ value: e.qrz, label: `${e.qrz} – ${e.descripcion}` }))}
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
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
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
    </div>
  )
}
