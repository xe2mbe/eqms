import { Tag } from 'antd'
import { FMRE_GOLD } from '@/utils/publicFmreShared'
import type { NodeStatus, IrlpStatus, DmrStatus } from '@/hooks/usePublicRoipStatus'

interface AllStarLinkStatusCardProps {
  nodeStatus: NodeStatus | null
}

/** Tarjeta de estado del Hub AllStarLink (LED + badge ON/OFF AIR + lista de nodos conectados). */
export function AllStarLinkStatusCard({ nodeStatus }: AllStarLinkStatusCardProps) {
  return (
    <div>
      <div style={{ color: FMRE_GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RED ALLSTAR LINK</div>
      <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '10px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
              background: nodeStatus == null ? '#888' : nodeStatus.online ? '#52c41a' : '#ff4d4f',
              boxShadow: nodeStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
              animation: nodeStatus?.online ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>Hub 299081</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#8ab4e0' }}>Boletín Dominical</span>
            {nodeStatus == null
              ? <span style={{ color: '#888', fontSize: 12 }}>…</span>
              : !nodeStatus.on_air
                ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● OFF AIR</span>
                : <><span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● ON AIR</span>
                  {nodeStatus.tx_keyed
                    ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                    : nodeStatus.cos_keyed
                      ? <span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● RX ACTIVO</span>
                      : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                  }</>
            }
          </div>
        </div>

        <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
          <div style={{ color: '#8ab4e0', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: FMRE_GOLD, fontWeight: 700 }}>{nodeStatus?.connections ?? '…'}</span> nodos conectados
          </div>
          {(nodeStatus?.nodes ?? []).length === 0
            ? <span style={{ color: '#555', fontSize: 12 }}>Sin nodos conectados</span>
            : (nodeStatus?.nodes ?? []).map(n => (
              <div key={n.node} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 0 4px 6px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                borderLeft: n.node === '299080' ? '2px solid #D4A017' : '2px solid transparent',
                background: n.node === '299080' ? 'rgba(212,160,23,0.1)' : undefined,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: n.keyed ? '#ff4d4f' : '#52c41a',
                  boxShadow: n.keyed ? '0 0 0 2px rgba(255,77,79,.2)' : '0 0 0 2px rgba(82,196,26,.2)',
                }} />
                <span style={{ fontWeight: 700, color: FMRE_GOLD, minWidth: 52, fontSize: 12 }}>{n.node}</span>
                {n.url
                  ? <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#a0c4e8', flex: 1 }}>{n.name}</a>
                  : <span style={{ fontSize: 12, color: '#a0c4e8', flex: 1 }}>{n.name}</span>
                }
                {n.node === '299080' && <Tag style={{ margin: '0 4px 0 0', fontSize: 9, flexShrink: 0 }} color="gold">Origen del boletín</Tag>}
                <Tag style={{ margin: 0, fontSize: 10 }} color={n.keyed ? 'red' : 'default'}>
                  {n.keyed ? 'TX' : n.direction || 'RX'}
                </Tag>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

interface IrlpStatusCardProps {
  irlpStatus: IrlpStatus | null
}

/** Tarjeta de estado del Reflector IRLP (LED + badge ON/OFF AIR + lista de nodos conectados). */
export function IrlpStatusCard({ irlpStatus }: IrlpStatusCardProps) {
  return (
    <div>
      <div style={{ color: '#06b6d4', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RED IRLP</div>
      <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 10, padding: '10px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
              background: irlpStatus == null ? '#888' : irlpStatus.online ? '#52c41a' : '#ff4d4f',
              boxShadow: irlpStatus?.online ? '0 0 0 3px rgba(82,196,26,0.25)' : 'none',
              animation: irlpStatus?.online ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>Reflector 0077</span>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#8ab4e0' }}>Boletín Dominical</span>
            {irlpStatus == null
              ? <span style={{ color: '#888', fontSize: 12 }}>…</span>
              : !irlpStatus.on_air
                ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● OFF AIR</span>
                : <><span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● ON AIR</span>
                  {irlpStatus.ptt
                    ? <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                    : irlpStatus.cos
                      ? <span style={{ background: '#52c41a', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● RX ACTIVO</span>
                      : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
                  }</>
            }
          </div>
        </div>

        <div style={{ marginTop: 10, borderTop: '1px solid rgba(6,182,212,0.2)', paddingTop: 8 }}>
          <div style={{ color: '#8ab4e0', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>{irlpStatus?.connections ?? '…'}</span> nodos conectados
          </div>
          {(irlpStatus?.nodes ?? []).length === 0
            ? <span style={{ color: '#555', fontSize: 12 }}>Sin nodos conectados</span>
            : (irlpStatus?.nodes ?? []).map(n => (
              <div key={n.node} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 0 4px 6px',
                borderBottom: '1px solid rgba(6,182,212,0.1)',
                borderLeft: n.node === '8422' ? '2px solid #D4A017' : '2px solid transparent',
                background: n.node === '8422' ? 'rgba(212,160,23,0.1)' : undefined,
                opacity: n.warning ? 0.6 : 1,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: n.warning ? '#faad14' : n.node === '8422' ? '#52c41a' : '#06b6d4',
                }} />
                <span style={{ fontWeight: 700, color: '#06b6d4', minWidth: 46, fontSize: 12 }}>{n.node}</span>
                <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: n.warning ? '#8c8c8c' : '#a0c4e8', flex: 1 }}>{n.name}</a>
                {n.node === '8422' && <Tag style={{ margin: '0 4px 0 0', fontSize: 9, flexShrink: 0 }} color="gold">Origen del boletín</Tag>}
                {n.warning && <Tag style={{ margin: 0, fontSize: 9, flexShrink: 0 }} color="warning">⚠ Sin heartbeat</Tag>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

interface DmrStatusCardProps {
  dmrStatus: DmrStatus
}

/** Tarjeta de estado de DMR/Brandmeister (LED + estado de conexión + TX en vivo). */
export function DmrStatusCard({ dmrStatus }: DmrStatusCardProps) {
  return (
    <div>
      <div style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>RED DMR — BRANDMEISTER</div>
      <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, padding: '10px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 9, height: 9, borderRadius: '50%', display: 'inline-block',
              background: dmrStatus.connected ? '#7c3aed' : '#555',
              boxShadow: dmrStatus.connected ? '0 0 0 3px rgba(124,58,237,0.25)' : 'none',
              animation: dmrStatus.connected ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ color: '#c0d4e8', fontSize: 12, fontWeight: 600 }}>TG FMRE 33450 · TG México 334</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!dmrStatus.connected
              ? <span style={{ color: '#888', fontSize: 12 }}>Conectando…</span>
              : dmrStatus.active
                ? <>
                    <span style={{ background: '#ff4d4f', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5, animation: 'pulse-red 0.8s ease-in-out infinite' }}>● TX ACTIVO</span>
                    <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 700 }}>{dmrStatus.callsign}</span>
                    <span style={{ color: '#8ab4e0', fontSize: 11 }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
                  </>
                : <span style={{ background: '#595959', color: 'white', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12, letterSpacing: 0.5 }}>● IDLE</span>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
