import { Modal, Form, Row, Col, Input, Select, Tag } from 'antd'
import type { FormInstance } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import type { Reporte, Estado, Zona, Sistema } from '@/types'

interface EditarReporteModalProps {
  open: boolean
  record: Reporte | null
  form: FormInstance
  saving: boolean
  estados: Estado[]
  zonas: Zona[]
  sistemas: Sistema[]
  onSave: () => void
  onCancel: () => void
}

/** Modal de edición de un reporte ya guardado (tabla "Reportes guardados" de Libreta RF). */
export default function EditarReporteModal({
  open, record, form, saving, estados, zonas, sistemas, onSave, onCancel,
}: EditarReporteModalProps) {
  return (
    <Modal
      title={<><EditOutlined style={{ marginRight: 8 }} />Editar Reporte — {record?.indicativo}</>}
      open={open}
      onOk={onSave}
      onCancel={onCancel}
      okText="Guardar" cancelText="Cancelar"
      confirmLoading={saving}
      width={480}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Indicativo" name="indicativo">
              <Input disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Operador" name="operador">
              <Input placeholder="Nombre del operador" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Ciudad" name="ciudad">
              <Input placeholder="Ciudad" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Estado" name="estado">
              <Select placeholder="Estado" allowClear showSearch optionFilterProp="label"
                options={estados.map(e => ({ value: e.nombre, label: e.nombre }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Zona" name="zona_id">
              <Select placeholder="Zona" allowClear
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
                    label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{z.codigo}</Tag>,
                  }
                })} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Sistema" name="sistema_id">
              <Select placeholder="Sistema" allowClear
                labelRender={({ value }) => {
                  const s = sistemas.find(s => s.id === value)
                  if (!s) return <span>{String(value)}</span>
                  const c = s.color ?? '#1677ff'
                  return <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>
                }}
                options={sistemas.map(s => {
                  const c = s.color ?? '#1677ff'
                  return {
                    value: s.id,
                    label: <Tag style={{ backgroundColor: c, borderColor: c, color: '#fff', fontWeight: 600, margin: 0 }}>{s.codigo}</Tag>,
                  }
                })} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="RST" name="senal">
              <Input style={{ width: 80, textAlign: 'center', fontWeight: 700 }} maxLength={3} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Observaciones" name="observaciones">
              <Input.TextArea rows={2} placeholder="Observaciones" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
