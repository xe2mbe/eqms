import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Typography, Input, Button, Tag, Progress,
  Tabs, Table, Space, Alert, Spin, Badge, Tooltip, Empty,
  Statistic, Divider,
} from 'antd'
import {
  TrophyOutlined, SearchOutlined, FileTextOutlined,
  StarOutlined, TeamOutlined,
} from '@ant-design/icons'
import client from '@/api/client'

const { Title, Text, Paragraph } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

interface PremioNivel { nivel: string; umbral: number; color: string }
interface Premio {
  id: string; nombre: string; descripcion: string; icono: string
  categoria: string; niveles: PremioNivel[]
}
interface EvaluacionItem {
  premio: Premio
  resultado: {
    califica: boolean; valor: any; nivel: PremioNivel | null
    progreso: number; detalle?: string
  }
}
interface Evaluacion {
  indicativo: string; nombre: string | null; premios: EvaluacionItem[]
}
interface RankingRow { indicativo: string; valor: number; label: string }

// ─── Award card ───────────────────────────────────────────────────────────────

function AwardCard({ item, onCertificado }: {
  item: EvaluacionItem
  onCertificado: (premioId: string) => void
}) {
  const { premio, resultado } = item
  const color = resultado.nivel?.color ?? '#d9d9d9'
  const califica = resultado.califica

  return (
    <Card
      size="small"
      style={{
        border: `2px solid ${califica ? color : '#f0f0f0'}`,
        borderRadius: 10,
        opacity: califica ? 1 : 0.7,
        transition: 'all .2s',
      }}
      bodyStyle={{ padding: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 32, lineHeight: 1 }}>{premio.icono}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text strong style={{ fontSize: 14 }}>{premio.nombre}</Text>
            {califica && resultado.nivel && (
              <Tag style={{ backgroundColor: color, borderColor: color, color: '#fff', fontWeight: 700 }}>
                {resultado.nivel.nivel}
              </Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
            {premio.descripcion}
          </Text>
          <Progress
            percent={Math.round(resultado.progreso)}
            strokeColor={califica ? color : '#d9d9d9'}
            size="small"
            format={p => <span style={{ fontSize: 10 }}>{p}%</span>}
          />
          {resultado.detalle && (
            <Text style={{ fontSize: 11, color: '#555', display: 'block', marginTop: 4 }}>
              {resultado.detalle}
            </Text>
          )}
          {califica && (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              style={{ marginTop: 8, borderColor: color, color: color }}
              onClick={() => onCertificado(premio.id)}
            >
              Ver certificado
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Buscar operador ─────────────────────────────────────────────────────────

function BuscarOperador() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buscar = async () => {
    if (!query.trim()) return
    setLoading(true); setError(null); setEvaluacion(null)
    try {
      const r = await client.get<Evaluacion>(`/premios/evaluar/${query.trim().toUpperCase()}`)
      setEvaluacion(r.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al evaluar')
    } finally { setLoading(false) }
  }

  const abrirCertificado = (premioId: string) => {
    if (!evaluacion) return
    const token = localStorage.getItem('access_token') ?? ''
    window.open(`/api/premios/certificado/${premioId}/${evaluacion.indicativo}?token=${token}`, '_blank')
  }

  const calificados = evaluacion?.premios.filter(p => p.resultado.califica) ?? []
  const noCalificados = evaluacion?.premios.filter(p => !p.resultado.califica) ?? []

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 24, maxWidth: 500 }}>
        <Col flex={1}>
          <Input
            placeholder="Indicativo (ej. XE2MBE)"
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onPressEnter={buscar}
            style={{ fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}
            prefix={<SearchOutlined />}
          />
        </Col>
        <Col>
          <Button type="primary" onClick={buscar} loading={loading} icon={<TrophyOutlined />}>
            Evaluar premios
          </Button>
        </Col>
      </Row>

      {error && <Alert type="warning" message={error} showIcon style={{ maxWidth: 500, marginBottom: 16 }} />}

      <Spin spinning={loading}>
        {evaluacion && (
          <div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <Title level={3} style={{ margin: 0, color: '#1A569E', letterSpacing: 4 }}>
                  {evaluacion.indicativo}
                </Title>
                {evaluacion.nombre && (
                  <Text type="secondary">{evaluacion.nombre}</Text>
                )}
              </div>
              <Badge
                count={calificados.length}
                style={{ backgroundColor: '#52c41a' }}
                overflowCount={99}
              >
                <Tag icon={<TrophyOutlined />} color="gold" style={{ fontSize: 13, padding: '4px 12px' }}>
                  reconocimientos otorgados
                </Tag>
              </Badge>
            </div>

            {calificados.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 12, color: '#52c41a' }}>
                  ✅ Reconocimientos obtenidos ({calificados.length})
                </Title>
                <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                  {calificados.map(item => (
                    <Col xs={24} sm={12} lg={8} key={item.premio.id}>
                      <AwardCard item={item} onCertificado={abrirCertificado} />
                    </Col>
                  ))}
                </Row>
              </>
            )}

            {noCalificados.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 12, color: '#aaa' }}>
                  En progreso ({noCalificados.length})
                </Title>
                <Row gutter={[12, 12]}>
                  {noCalificados.map(item => (
                    <Col xs={24} sm={12} lg={8} key={item.premio.id}>
                      <AwardCard item={item} onCertificado={abrirCertificado} />
                    </Col>
                  ))}
                </Row>
              </>
            )}
          </div>
        )}

        {!evaluacion && !loading && !error && (
          <Empty
            image={<TrophyOutlined style={{ fontSize: 64, color: '#d4af37', opacity: .4 }} />}
            description="Ingresa un indicativo para evaluar sus reconocimientos"
          />
        )}
      </Spin>
    </div>
  )
}

// ─── Catálogo ─────────────────────────────────────────────────────────────────

function CatalogoPremios({ catalogo }: { catalogo: Premio[] }) {
  const categorias = [...new Set(catalogo.map(p => p.categoria))]
  return (
    <div>
      {categorias.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <Title level={5} style={{ marginBottom: 12, color: '#1A569E' }}>{cat}</Title>
          <Row gutter={[12, 12]}>
            {catalogo.filter(p => p.categoria === cat).map(p => (
              <Col xs={24} sm={12} lg={8} key={p.id}>
                <Card size="small" style={{ borderRadius: 10 }} bodyStyle={{ padding: 16 }}>
                  <Space>
                    <span style={{ fontSize: 28 }}>{p.icono}</span>
                    <div>
                      <Text strong>{p.nombre}</Text>
                      <Paragraph style={{ fontSize: 12, margin: 0, color: '#666' }}>
                        {p.descripcion}
                      </Paragraph>
                    </div>
                  </Space>
                  <Divider style={{ margin: '10px 0 8px' }} />
                  <Space wrap>
                    {p.niveles.map(n => (
                      <Tag key={n.nivel}
                        style={{ backgroundColor: n.color, borderColor: n.color, color: '#fff', fontWeight: 700 }}>
                        {n.nivel}
                        <span style={{ opacity: .8, marginLeft: 4, fontSize: 10 }}>≥ {n.umbral}</span>
                      </Tag>
                    ))}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  )
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

function Rankings({ catalogo }: { catalogo: Premio[] }) {
  const [selPremio, setSelPremio] = useState(catalogo[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<RankingRow[]>([])

  useEffect(() => { if (selPremio) fetchRanking() }, [selPremio])

  const fetchRanking = async () => {
    setLoading(true)
    try {
      const r = await client.get<RankingRow[]>(`/premios/ranking/${selPremio}`)
      setData(r.data)
    } catch { setData([]) }
    finally { setLoading(false) }
  }

  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`

  return (
    <div>
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        {catalogo.map(p => (
          <Col key={p.id}>
            <Button
              size="small"
              type={selPremio === p.id ? 'primary' : 'default'}
              onClick={() => setSelPremio(p.id)}
            >
              {p.icono} {p.nombre}
            </Button>
          </Col>
        ))}
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={data}
          rowKey="indicativo"
          size="small"
          pagination={false}
          columns={[
            {
              title: '#', width: 50,
              render: (_: any, _r: any, i: number) => (
                <span style={{ fontSize: 16 }}>{medal(i)}</span>
              ),
            },
            {
              title: 'Indicativo', dataIndex: 'indicativo',
              render: (v: string) => (
                <Text strong style={{ color: '#1A569E', letterSpacing: 2, fontFamily: 'monospace' }}>{v}</Text>
              ),
            },
            { title: 'Mérito', dataIndex: 'label' },
            {
              title: '',
              render: (_: any, r: RankingRow) => (
                <Tooltip title="Ver certificado">
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => {
                      const tok = localStorage.getItem('access_token') ?? ''
                      window.open(`/api/premios/certificado/${selPremio}/${r.indicativo}?token=${tok}`, '_blank')
                    }}
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      </Spin>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PremiosPage() {
  const [catalogo, setCatalogo] = useState<Premio[]>([])
  const [resumen, setResumen] = useState<any>(null)

  useEffect(() => {
    client.get<Premio[]>('/premios/catalogo').then(r => setCatalogo(r.data))
    client.get('/premios/resumen-global').then(r => setResumen(r.data))
  }, [])

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <TrophyOutlined style={{ fontSize: 28, color: '#d4af37' }} />
          <Title level={4} style={{ margin: 0 }}>Premios y Distinciones</Title>
        </Space>
        {resumen && (
          <Space size={24}>
            <Statistic title="Reportes totales" value={resumen.total_reportes}
              prefix={<StarOutlined />} valueStyle={{ fontSize: 18, color: '#1A569E' }} />
            <Statistic title="Indicativos activos" value={resumen.total_indicativos}
              prefix={<TeamOutlined />} valueStyle={{ fontSize: 18, color: '#1A569E' }} />
          </Space>
        )}
      </div>

      <Card className="card-shadow">
        <Tabs
          defaultActiveKey="buscar"
          items={[
            {
              key: 'buscar',
              label: <span><SearchOutlined /> Evaluar Operador</span>,
              children: <BuscarOperador />,
            },
            {
              key: 'catalogo',
              label: <span><TrophyOutlined /> Catálogo de Premios</span>,
              children: <CatalogoPremios catalogo={catalogo} />,
            },
            {
              key: 'ranking',
              label: <span><StarOutlined /> Rankings</span>,
              children: <Rankings catalogo={catalogo} />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
