import { useState, useEffect } from 'react'
import {
  Card, Tabs, Form, Input, InputNumber, Button, Switch,
  Typography, Space, Divider, Alert, Row, Col, Modal,
  Table, Tag, Upload, message, Spin, Tooltip, Popconfirm,
  Badge, Select, List,
} from 'antd'
import {
  MailOutlined, SettingOutlined, DatabaseOutlined,
  GlobalOutlined, SendOutlined, SaveOutlined,
  CheckCircleOutlined, CloseCircleOutlined, BellOutlined,
  DownloadOutlined, UploadOutlined, TableOutlined,
  SyncOutlined, ReloadOutlined, LockOutlined,
} from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import { configuracionApi, type SmtpConfig } from '@/api/configuracion'
import client from '@/api/client'

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

// ─── Tab: Database ────────────────────────────────────────────────────────────

interface DBTable { name: string; columns: number; rows: number }
interface TableData {
  columns: { key: string; type: string }[]
  rows: Record<string, any>[]
  total: number; page: number; page_size: number
}
interface PgParam {
  name: string; setting: string; unit: string | null; category: string
  short_desc: string; context: string; vartype: string
  min_val: string | null; max_val: string | null; enumvals: string[] | null
  editable: boolean
}

// ── Tables panel ──────────────────────────────────────────────────────────────
function DBTables() {
  const [tables, setTables] = useState<DBTable[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  useEffect(() => { fetchTables() }, [])

  const fetchTables = async () => {
    setLoading(true)
    try { const r = await client.get<DBTable[]>('/admin/db/tables'); setTables(r.data) }
    catch { message.error('Error al obtener tablas') }
    finally { setLoading(false) }
  }

  const selectTable = async (name: string, p = 1, ps = pageSize) => {
    setSelected(name); setDataLoading(true)
    try {
      const r = await client.get<TableData>(`/admin/db/tables/${name}`, { params: { page: p, page_size: ps } })
      setTableData(r.data)
    } catch { message.error('Error al obtener datos') }
    finally { setDataLoading(false) }
  }

  const antColumns = tableData
    ? tableData.columns.map(c => ({
        title: (
          <Tooltip title={c.type}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.key}</span>
          </Tooltip>
        ),
        dataIndex: c.key,
        key: c.key,
        width: 140,
        ellipsis: true,
        render: (v: any) => {
          if (v === null || v === undefined) return <span style={{ color: '#bbb' }}>NULL</span>
          if (typeof v === 'boolean') return <Tag color={v ? 'green' : 'default'}>{String(v)}</Tag>
          return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{String(v)}</span>
        },
      }))
    : []

  return (
    <Row gutter={16} style={{ height: '70vh' }}>
      {/* Table list */}
      <Col xs={24} sm={6} style={{ borderRight: '1px solid #f0f0f0', overflowY: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Typography.Text strong style={{ fontSize: 12 }}>Tablas ({tables.length})</Typography.Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchTables} loading={loading} />
        </div>
        <Spin spinning={loading}>
          <List
            size="small"
            dataSource={tables}
            renderItem={t => (
              <List.Item
                style={{
                  cursor: 'pointer', padding: '6px 8px',
                  borderRadius: 4,
                  background: selected === t.name ? '#e6f4ff' : undefined,
                  borderLeft: selected === t.name ? '3px solid #1677ff' : '3px solid transparent',
                }}
                onClick={() => { setPage(1); selectTable(t.name, 1) }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{t.rows} filas · {t.columns} cols</div>
                </div>
              </List.Item>
            )}
          />
        </Spin>
      </Col>

      {/* Table content */}
      <Col xs={24} sm={18} style={{ overflow: 'auto', height: '100%' }}>
        {!selected ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
            <TableOutlined style={{ fontSize: 40, marginBottom: 12 }} />
            <div>Selecciona una tabla</div>
          </div>
        ) : (
          <Spin spinning={dataLoading}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Text strong style={{ fontFamily: 'monospace' }}>{selected}</Typography.Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => selectTable(selected, page)} />
            </div>
            <Table
              dataSource={tableData?.rows ?? []}
              columns={antColumns}
              rowKey={(_, i) => String(i)}
              size="small"
              scroll={{ x: 'max-content', y: 'calc(70vh - 100px)' }}
              pagination={{
                total: tableData?.total ?? 0,
                current: page,
                pageSize,
                showTotal: t => `${t} filas`,
                showSizeChanger: true,
                pageSizeOptions: ['25', '50', '100', '200'],
                onChange: (p, ps) => { setPage(p); setPageSize(ps); selectTable(selected, p, ps) },
              }}
            />
          </Spin>
        )}
      </Col>
    </Row>
  )
}

// ── Backup & Restore panel ────────────────────────────────────────────────────
function DBBackup() {
  const [restoring, setRestoring] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const resp = await client.get('/admin/db/backup', { responseType: 'blob' })
      const cd = resp.headers['content-disposition'] ?? ''
      const match = cd.match(/filename=(.+)/)
      const filename = match ? match[1] : 'qms_backup.json.gz'
      const url = URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      message.success('Respaldo descargado')
    } catch { message.error('Error al generar el respaldo') }
    finally { setDownloading(false) }
  }

  const beforeUpload = async (file: RcFile) => {
    setRestoring(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await client.post('/admin/db/restore', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      message.success(`Restaurado: ${r.data.tables_restored} tablas. Respaldo del ${r.data.backup_date ?? 'desconocido'}`)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al restaurar')
    } finally { setRestoring(false) }
    return false
  }

  return (
    <Row gutter={[32, 32]} style={{ maxWidth: 800 }}>
      <Col xs={24} sm={12}>
        <Card size="small" title={<span><DownloadOutlined /> Respaldo</span>}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Descarga un archivo comprimido (<code>.json.gz</code>) con el contenido completo de todas las tablas.
            </Typography.Text>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={downloading}
              onClick={handleDownload}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              block
            >
              Descargar respaldo
            </Button>
          </Space>
        </Card>
      </Col>

      <Col xs={24} sm={12}>
        <Card size="small" title={<span><UploadOutlined /> Restaurar</span>}
          extra={<Tag color="warning">Reemplaza todos los datos</Tag>}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Sube un archivo <code>.json.gz</code> generado por esta misma herramienta.
              <strong style={{ color: '#ff4d4f' }}> Esta operación borra y reemplaza todos los registros actuales.</strong>
            </Typography.Text>
            <Popconfirm
              title="¿Restaurar la base de datos?"
              description="Todos los datos actuales serán reemplazados. Esta acción no se puede deshacer."
              okText="Sí, restaurar" cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => document.getElementById('restore-upload-trigger')?.click()}
            >
              <Button danger icon={<UploadOutlined />} loading={restoring} block>
                Seleccionar archivo de respaldo
              </Button>
            </Popconfirm>
            <Upload
              showUploadList={false}
              accept=".json,.json.gz,.gz"
              beforeUpload={beforeUpload}
            >
              <button id="restore-upload-trigger" style={{ display: 'none' }} />
            </Upload>
          </Space>
        </Card>
      </Col>

      <Col xs={24}>
        <Alert
          type="info" showIcon
          message="Compatibilidad"
          description="El respaldo incluye toda la información de la base de datos en formato JSON. Solo es compatible con la misma versión del esquema. Se recomienda hacer un respaldo antes de cualquier actualización del sistema."
        />
      </Col>
    </Row>
  )
}

// ── Parameters panel ──────────────────────────────────────────────────────────
function DBParams() {
  const [params, setParams] = useState<PgParam[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [editVal, setEditVal] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { fetchParams() }, [])

  const fetchParams = async () => {
    setLoading(true)
    try { const r = await client.get<PgParam[]>('/admin/db/params'); setParams(r.data) }
    catch { message.error('Error al obtener parámetros') }
    finally { setLoading(false) }
  }

  const categories = [...new Set(params.map(p => p.category))].sort()

  const filtered = params.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.short_desc.toLowerCase().includes(search.toLowerCase())
    const matchCat = !category || p.category === category
    return matchSearch && matchCat
  })

  const saveParam = async (p: PgParam, permanent: boolean) => {
    const value = editVal[p.name] ?? p.setting
    setSaving(p.name)
    try {
      const r = await client.put('/admin/db/params', { name: p.name, value, permanent })
      message.success(`${p.name} = ${r.data.new_value}${permanent ? ' (permanente)' : ' (sesión)'}`)
      setParams(prev => prev.map(x => x.name === p.name ? { ...x, setting: r.data.new_value } : x))
      setEditVal(prev => { const n = { ...prev }; delete n[p.name]; return n })
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Error al guardar')
    } finally { setSaving(null) }
  }

  const resetParam = async (name: string) => {
    try {
      await client.post('/admin/db/params/reset', { name })
      message.success(`${name} restablecido al valor por defecto`)
      fetchParams()
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Error') }
  }

  const columns = [
    {
      title: 'Parámetro', dataIndex: 'name', width: 220,
      render: (v: string, r: PgParam) => (
        <Space size={4} direction="vertical" style={{ lineHeight: 1.3 }}>
          <code style={{ fontSize: 12, fontWeight: 700 }}>{v}</code>
          <span style={{ fontSize: 11, color: '#888' }}>{r.short_desc}</span>
        </Space>
      ),
    },
    {
      title: 'Valor actual', dataIndex: 'setting', width: 180,
      render: (v: string, r: PgParam) => {
        if (!r.editable) {
          return <code style={{ fontSize: 12 }}>{v}{r.unit ? ` ${r.unit}` : ''}</code>
        }
        if (r.vartype === 'bool' || (r.enumvals && r.enumvals.length > 0)) {
          const opts = r.enumvals ?? ['on', 'off']
          return (
            <Select
              size="small" style={{ width: 150 }}
              value={editVal[r.name] ?? v}
              onChange={val => setEditVal(prev => ({ ...prev, [r.name]: val }))}
              options={opts.map(o => ({ value: o, label: o }))}
            />
          )
        }
        return (
          <Input
            size="small" style={{ width: 150, fontFamily: 'monospace' }}
            value={editVal[r.name] ?? v}
            onChange={e => setEditVal(prev => ({ ...prev, [r.name]: e.target.value }))}
            suffix={r.unit ? <span style={{ fontSize: 10, color: '#aaa' }}>{r.unit}</span> : undefined}
          />
        )
      },
    },
    {
      title: 'Alcance', dataIndex: 'context', width: 100,
      render: (v: string, r: PgParam) => (
        r.editable
          ? <Tag color="blue">{v}</Tag>
          : <Tooltip title="Requiere reinicio del servidor"><Tag icon={<LockOutlined />} color="default">{v}</Tag></Tooltip>
      ),
    },
    {
      title: 'Categoría', dataIndex: 'category', width: 160,
      render: (v: string) => <span style={{ fontSize: 11, color: '#666' }}>{v}</span>,
    },
    {
      title: 'Acciones', width: 200,
      render: (_: any, r: PgParam) => {
        if (!r.editable) return null
        const hasEdit = editVal[r.name] !== undefined
        return (
          <Space size={4}>
            <Tooltip title="Aplicar solo en esta sesión">
              <Button size="small" disabled={!hasEdit}
                loading={saving === r.name}
                onClick={() => saveParam(r, false)}>
                Sesión
              </Button>
            </Tooltip>
            <Tooltip title="Guardar permanentemente (pg_reload_conf)">
              <Button size="small" type="primary" disabled={!hasEdit}
                loading={saving === r.name}
                onClick={() => saveParam(r, true)}
                style={hasEdit ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}}>
                Permanente
              </Button>
            </Tooltip>
            <Tooltip title="Restablecer al valor por defecto">
              <Button size="small" danger icon={<ReloadOutlined />}
                onClick={() => resetParam(r.name)} />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Buscar parámetro..."
          style={{ width: 220 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
        <Select
          placeholder="Categoría"
          allowClear style={{ width: 220 }}
          value={category}
          onChange={v => setCategory(v)}
          options={categories.map(c => ({ value: c, label: c }))}
        />
        <Button icon={<SyncOutlined />} onClick={fetchParams} loading={loading}>Refrescar</Button>
        <Badge count={filtered.length} color="#1677ff">
          <span style={{ fontSize: 12, color: '#666' }}>parámetros</span>
        </Badge>
      </Space>

      <Table
        dataSource={filtered}
        columns={columns as any}
        rowKey="name"
        size="small"
        loading={loading}
        scroll={{ x: 'max-content', y: 'calc(70vh - 80px)' }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} parámetros` }}
      />
    </div>
  )
}

// ── Main Database tab ─────────────────────────────────────────────────────────
function TabDatabase() {
  return (
    <Tabs
      size="small"
      items={[
        { key: 'tables', label: <span><TableOutlined /> Tablas</span>, children: <DBTables /> },
        { key: 'backup', label: <span><DownloadOutlined /> Respaldo & Restaurar</span>, children: <DBBackup /> },
        { key: 'params', label: <span><SettingOutlined /> Parámetros</span>, children: <DBParams /> },
      ]}
    />
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
              key: 'database',
              label: <span><DatabaseOutlined /> Database</span>,
              children: <TabDatabase />,
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
