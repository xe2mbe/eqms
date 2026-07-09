import { forwardRef } from 'react'
import { Row, Col, Card, Tag, Typography, Input, Alert, Table } from 'antd'
import { SearchOutlined, UserOutlined, WifiOutlined } from '@ant-design/icons'
import { FMRE_BLUE, FMRE_DARK, FMRE_LIGHT, SISTEMA_COLORS, PLAT_COLORS } from '@/utils/publicFmreShared'
import type { BusquedaResult } from './types'

const { Title, Paragraph } = Typography

interface BusquedaOperadorProps {
  busqueda: string
  onBusquedaChange: (value: string) => void
  onSearch: () => void
  buscando: boolean
  resultado: BusquedaResult | null
  busqError: string | null
}

/** Sección "¿Tomaron mi reporte?": buscador de indicativo con tarjeta de resultado (RF/RS). */
const BusquedaOperador = forwardRef<HTMLDivElement, BusquedaOperadorProps>(function BusquedaOperador(
  { busqueda, onBusquedaChange, onSearch, buscando, resultado, busqError },
  resultadoRef,
) {
  return (
    <section style={{ background: 'white', borderBottom: `3px solid ${FMRE_BLUE}`, padding: '40px 32px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
        <Title level={3} style={{ color: FMRE_DARK, margin: 0 }}>¿Tomaron mi reporte?</Title>
        <Paragraph style={{ color: '#444', fontSize: 15, marginTop: 8, marginBottom: 24 }}>
          Consulta los reportes de tu estación registrados en el sistema.
          Ingresa tu indicativo y ve el historial de actividad en RF y redes sociales.
        </Paragraph>
        <Input.Search
          size="large"
          placeholder="Ej. XE2MBE, XE1LM, XE3AAA..."
          enterButton={<><SearchOutlined /> Buscar</>}
          value={busqueda}
          onChange={e => onBusquedaChange(e.target.value.toUpperCase())}
          onSearch={onSearch}
          loading={buscando}
          style={{ maxWidth: 480 }}
          allowClear
        />
      </div>

      {/* Resultado de búsqueda */}
      {(resultado || busqError) && (
        <div ref={resultadoRef} style={{ maxWidth: 900, margin: '32px auto 0' }}>
          {busqError && <Alert type="warning" message={busqError} showIcon />}

          {resultado && (
            <div>
              {/* Cabecera del operador */}
              <Card style={{ marginBottom: 16, borderTop: `4px solid ${FMRE_BLUE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: FMRE_DARK, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <UserOutlined style={{ color: 'white', fontSize: 28 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: FMRE_BLUE, letterSpacing: 1 }}>
                      {resultado.indicativo}
                    </div>
                    {resultado.operador?.nombre && (
                      <div style={{ fontSize: 16, color: '#333', fontWeight: 600 }}>{resultado.operador.nombre}</div>
                    )}
                    {resultado.operador && (
                      <div style={{ color: '#888', fontSize: 13 }}>
                        {[resultado.operador.municipio, resultado.operador.estado, resultado.operador.licencia]
                          .filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center', background: FMRE_LIGHT, borderRadius: 8, padding: '8px 16px' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: FMRE_BLUE }}>{resultado.rf.total.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>Reportes RF</div>
                    </div>
                    <div style={{ textAlign: 'center', background: '#f9f0ff', borderRadius: 8, padding: '8px 16px' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#0891b2' }}>{resultado.rs.total.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>Reportes RS</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Row gutter={[16, 16]}>
                {/* RF */}
                {resultado.rf.total > 0 && (
                  <Col xs={24} lg={12}>
                    <Card title={<span><WifiOutlined style={{ color: FMRE_BLUE, marginRight: 8 }} />Actividad RF</span>}
                          size="small" style={{ height: '100%' }}>
                      <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
                        Primera actividad: <strong>{resultado.rf.primera}</strong>
                        {resultado.rf.primera !== resultado.rf.ultima && <> · Última: <strong>{resultado.rf.ultima}</strong></>}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        {resultado.rf.por_evento.map(e => (
                          <Tag key={e.evento} color={FMRE_BLUE} style={{ marginBottom: 4 }}>
                            {e.evento} · {e.total}
                          </Tag>
                        ))}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        {resultado.rf.por_sistema.map(s => (
                          <Tag key={s.sistema} color={SISTEMA_COLORS[s.sistema] ?? '#666'} style={{ marginBottom: 4 }}>
                            {s.sistema} · {s.total}
                          </Tag>
                        ))}
                      </div>
                      <Table
                        size="small"
                        dataSource={resultado.rf.ultimos}
                        rowKey={(_r, i) => String(i)}
                        pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} registros` }}
                        columns={[
                          { title: 'Fecha', dataIndex: 'fecha', width: 90, render: v => v ?? '—' },
                          { title: 'Evento', dataIndex: 'evento', render: v => v ?? '—' },
                          { title: 'Sistema', dataIndex: 'sistema', width: 70, render: v => v
                            ? <Tag color={SISTEMA_COLORS[v] ?? '#666'} style={{ fontSize: 11 }}>{v}</Tag> : '—' },
                          { title: 'Estado', dataIndex: 'estado', render: v => v ?? '—' },
                        ]}
                      />
                    </Card>
                  </Col>
                )}

                {/* RS */}
                {resultado.rs.total > 0 && (
                  <Col xs={24} lg={12}>
                    <Card title={<span style={{ color: '#0891b2' }}>📱 Actividad en Redes Sociales</span>}
                          size="small" style={{ height: '100%' }}>
                      <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
                        Primera actividad: <strong>{resultado.rs.primera}</strong>
                        {resultado.rs.primera !== resultado.rs.ultima && <> · Última: <strong>{resultado.rs.ultima}</strong></>}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        {resultado.rs.por_plataforma.map(p => (
                          <Tag key={p.plataforma} color={PLAT_COLORS[p.plataforma] ?? '#0891b2'} style={{ marginBottom: 4 }}>
                            {p.plataforma} · {p.total}
                          </Tag>
                        ))}
                      </div>
                      <Table
                        size="small"
                        dataSource={resultado.rs.ultimos}
                        rowKey={(_r, i) => String(i)}
                        pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} registros` }}
                        columns={[
                          { title: 'Fecha', dataIndex: 'fecha', width: 90, render: v => v ?? '—' },
                          { title: 'Plataforma', dataIndex: 'plataforma', render: v => v
                            ? <Tag color={PLAT_COLORS[v] ?? '#0891b2'} style={{ fontSize: 11 }}>{v}</Tag> : '—' },
                          { title: 'Estado', dataIndex: 'estado', render: v => v ?? '—' },
                        ]}
                      />
                    </Card>
                  </Col>
                )}
              </Row>
            </div>
          )}
        </div>
      )}
    </section>
  )
})

export default BusquedaOperador
