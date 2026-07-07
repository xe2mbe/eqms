import { Divider, Spin, Table, Tag, Typography } from 'antd'
import { FMRE_BLUE, FMRE_DARK } from '@/utils/publicFmreShared'
import type { EstacionItem, EstacionIntlItem } from './types'

const { Title, Text } = Typography

interface EstacionesTableProps {
  variant: 'rf' | 'rs' | 'intl'
  items: (EstacionItem | EstacionIntlItem)[] | null
  loading: boolean
  onIndicativoClick: (indicativo: string) => void
}

interface EstacionesTableTheme {
  title: string
  accentColor: string
  tagColor: string
  showPais: boolean
}

const THEMES: Record<'rf' | 'rs' | 'intl', EstacionesTableTheme> = {
  intl: { title: 'Estaciones internacionales', accentColor: FMRE_BLUE, tagColor: 'blue', showPais: true },
  rf:   { title: 'Estaciones activas — RF', accentColor: FMRE_BLUE, tagColor: 'blue', showPais: false },
  rs:   { title: 'Estaciones activas — Redes Sociales', accentColor: '#0891b2', tagColor: 'cyan', showPais: false },
}

/** Sección "Divider + título + tabla paginada" de estaciones (RF/RS/internacionales). */
export default function EstacionesTable({ variant, items, loading, onIndicativoClick }: EstacionesTableProps) {
  const t = THEMES[variant]

  const callSign = (v: string) => (
    <strong
      style={{ color: t.accentColor, cursor: 'pointer', textDecoration: 'none' }}
      onClick={() => onIndicativoClick(v)}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      title={`Ver historial de ${v}`}
    >
      {v}
    </strong>
  )

  return (
    <>
      <Divider style={{ borderColor: '#d0d7e3' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 28, background: t.accentColor, borderRadius: 2 }} />
        <Title level={3} style={{ margin: 0, color: FMRE_DARK }}>{t.title}</Title>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div> : (
        <Table
          dataSource={items ?? []}
          rowKey="indicativo"
          size="small"
          pagination={{ pageSize: 50, showSizeChanger: false }}
          columns={[
            { title: '#', width: 52, render: (_v: unknown, _r: unknown, i: number) => <Text type="secondary">{i + 1}</Text> },
            ...(t.showPais ? [{ title: 'País', dataIndex: 'pais', width: 140, render: (v: string) => <Tag color="geekblue">{v}</Tag> }] : []),
            { title: 'Indicativo', dataIndex: 'indicativo', render: (v: string) => callSign(v) },
            { title: 'Nombre', dataIndex: 'nombre', ellipsis: true, render: (v: string | null) => v ?? '—' },
            { title: 'Reportes', dataIndex: 'total', width: 90, align: 'right' as const, render: (v: number) => <Tag color={t.tagColor}>{v.toLocaleString()}</Tag> },
            { title: 'Última actividad', dataIndex: 'ultima', width: 130, render: (v: string | null) => v ?? '—' },
          ]}
        />
      )}
    </>
  )
}
