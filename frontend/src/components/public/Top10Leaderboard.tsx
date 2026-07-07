import { Card, Spin, Tag } from 'antd'
import { StarOutlined } from '@ant-design/icons'
import { FMRE_BLUE, FMRE_LIGHT } from '@/utils/publicFmreShared'

interface Top10Item {
  indicativo: string
  nombre: string | null
  total: number
}

interface Top10LeaderboardProps {
  variant: 'rf' | 'rs'
  items: Top10Item[]
  loading: boolean
  onIndicativoClick: (indicativo: string) => void
}

interface LeaderboardTheme {
  accentColor: string
  title: string
  badgeBg: string
  tagColor: string
}

const THEMES: Record<'rf' | 'rs', LeaderboardTheme> = {
  rf: {
    accentColor: FMRE_BLUE,
    title: 'Top 10 estaciones más activas',
    badgeBg: FMRE_LIGHT,
    tagColor: FMRE_BLUE,
  },
  rs: {
    accentColor: '#0891b2',
    title: 'Top 10 estaciones más activas en RS',
    badgeBg: '#e0f7fa',
    tagColor: 'cyan',
  },
}

/** Tarjeta "Top 10 estaciones más activas" (RF/RS) con ranking por medallas 🥇🥈🥉. */
export default function Top10Leaderboard({ variant, items, loading, onIndicativoClick }: Top10LeaderboardProps) {
  const t = THEMES[variant]
  const ranks = [...new Set(items.map(o => o.total))].sort((a, b) => b - a)

  return (
    <Card title={<span><StarOutlined style={{ color: t.accentColor, marginRight: 8 }} />{t.title}</span>}
          size="small" className="card-shadow" style={{ flex: 1 }}>
      {loading ? <Spin /> : (
        <div>
          {items.map((op, i) => {
            const rank = ranks.indexOf(op.total)
            return (
              <div key={op.indicativo} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0', borderBottom: i < items.length - 1 ? '1px solid #f0f0f0' : undefined,
              }}>
                {rank === 0 ? (
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥇</span>
                ) : rank === 1 ? (
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥈</span>
                ) : rank === 2 ? (
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🥉</span>
                ) : (
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: t.badgeBg,
                    color: '#666', fontWeight: 700, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{rank + 1}</span>
                )}
                <span style={{ minWidth: 70 }}>
                  <strong
                    style={{ color: t.accentColor, cursor: 'pointer', textDecoration: 'none' }}
                    onClick={() => onIndicativoClick(op.indicativo)}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    title={`Ver historial de ${op.indicativo}`}
                  >
                    {op.indicativo}
                  </strong>
                </span>
                <span style={{ color: '#666', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {op.nombre ?? '—'}
                </span>
                <Tag color={t.tagColor} style={{ fontWeight: 700, minWidth: 48, textAlign: 'center' }}>
                  {op.total} QSOs
                </Tag>
              </div>
            )
          })}
          <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 6, fontSize: 11, color: '#888', lineHeight: 1.4 }}>
            <span style={{ marginRight: 4 }}>&#9432;</span> El número indica <strong>QSO o reportes únicos</strong>. Si una estación se reportó en varios sistemas el mismo día, cuenta como uno solo.
          </div>
        </div>
      )}
    </Card>
  )
}
