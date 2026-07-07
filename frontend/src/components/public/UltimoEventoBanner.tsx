import type { ReactNode } from 'react'
import { WifiOutlined, GlobalOutlined, RightOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { FMRE_DARK, FMRE_GOLD } from '@/utils/publicFmreShared'
import { getBoletinNumForDate } from '@/utils/publicBoletin'
import type { UltimoEventoResumen } from './types'

interface UltimoEventoBannerProps {
  variant: 'rf' | 'rs'
  evento: UltimoEventoResumen
  onClick: () => void
}

interface BannerTheme {
  background: string
  textColor: string
  icon: ReactNode
  label: string
  hoverFilter: string
  subtitleOpacity: number
  statBg: string
  statLabelOpacity: number
  border: string
  buttonBg: string
}

const THEMES: Record<'rf' | 'rs', BannerTheme> = {
  rf: {
    background: FMRE_GOLD,
    textColor: FMRE_DARK,
    icon: <WifiOutlined style={{ marginRight: 8 }} />,
    label: 'Último evento RF',
    hoverFilter: 'brightness(0.92)',
    subtitleOpacity: 0.8,
    statBg: 'rgba(0,0,0,0.12)',
    statLabelOpacity: 0.7,
    border: `2px solid ${FMRE_DARK}`,
    buttonBg: 'rgba(0,0,0,0.08)',
  },
  rs: {
    background: '#0891b2',
    textColor: 'white',
    icon: <GlobalOutlined style={{ marginRight: 8 }} />,
    label: 'Último evento RS',
    hoverFilter: 'brightness(0.88)',
    subtitleOpacity: 0.85,
    statBg: 'rgba(255,255,255,0.18)',
    statLabelOpacity: 0.8,
    border: '2px solid rgba(255,255,255,0.85)',
    buttonBg: 'rgba(255,255,255,0.15)',
  },
}

/** Banner clicable de "Último evento" (RF/RS) en la portada pública. */
export default function UltimoEventoBanner({ variant, evento, onClick }: UltimoEventoBannerProps) {
  const t = THEMES[variant]
  return (
    <div
      onClick={onClick}
      style={{ background: t.background, padding: '14px 32px', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.filter = t.hoverFilter)}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontWeight: 800, color: t.textColor, fontSize: 14 }}>
          {t.icon}
          {t.label}
        </div>
        <div style={{ color: t.textColor, fontSize: 13, marginTop: 2, opacity: t.subtitleOpacity }}>
          <strong>{evento.tipo} #{getBoletinNumForDate(evento.ultima)}</strong>
          {' · '}
          {dayjs(evento.ultima).format('D [de] MMMM [de] YYYY')}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
          <div style={{ background: t.statBg, borderRadius: 10, padding: '6px 20px', textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.textColor, lineHeight: 1.2 }}>
              {evento.total_qsos.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textColor, opacity: t.statLabelOpacity, letterSpacing: 1, textTransform: 'uppercase' }}>QSOs</div>
          </div>
          <div style={{ background: t.statBg, borderRadius: 10, padding: '6px 20px', textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.textColor, lineHeight: 1.2 }}>
              {evento.estaciones.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textColor, opacity: t.statLabelOpacity, letterSpacing: 1, textTransform: 'uppercase' }}>Estaciones</div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: t.border, borderRadius: 8,
            padding: '7px 20px', fontWeight: 800, color: t.textColor,
            fontSize: 13, background: t.buttonBg,
          }}>
            Ver detalles <RightOutlined />
          </div>
        </div>
      </div>
    </div>
  )
}
