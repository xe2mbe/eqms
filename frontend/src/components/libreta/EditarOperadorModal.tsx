import { Modal, Form, Row, Col, Input, Select, AutoComplete, Switch, Spin } from 'antd'
import type { FormInstance } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import type { Estado } from '@/types'

interface EditarOperadorModalProps {
  open: boolean
  indicativo: string
  form: FormInstance
  saving: boolean
  loading: boolean
  estados: Estado[]
  paises: string[]
  onSave: () => void
  onCancel: () => void
}

/** Modal de edición de un radioexperimentador (se abre al hacer clic en un indicativo de la tabla resumen de Libreta RF). */
export default function EditarOperadorModal({
  open, indicativo, form, saving, loading, estados, paises, onSave, onCancel,
}: EditarOperadorModalProps) {
  return (
    <Modal
      title={<><UserOutlined style={{ marginRight: 8 }} />Editar Radioexperimentador — {indicativo}</>}
      open={open}
      onOk={onSave}
      onCancel={onCancel}
      okText="Guardar" cancelText="Cancelar"
      confirmLoading={saving}
      width={560}
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Indicativo" name="indicativo">
                <Input disabled style={{ fontWeight: 700, color: '#1A569E' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nombre completo" name="nombre_completo">
                <Input placeholder="Nombre del operador" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ciudad / Municipio" name="municipio">
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
              <Form.Item label="País" name="pais">
                <AutoComplete
                  placeholder="México"
                  allowClear
                  options={paises.map(p => ({ value: p }))}
                  filterOption={(input, opt) =>
                    (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tipo de licencia" name="tipo_licencia">
                <Input placeholder="Ej: Novato, General, Extra" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tipo HAM" name="tipo_ham">
                <Input placeholder="Ej: Fijo, Móvil" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Activo" name="activo" valuePropName="checked">
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  )
}
