import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'

// ── tipos ─────────────────────────────────────────────────────────────────────
type RemoteNode = { node: string; name: string; keyed: boolean }
type NodeStatus  = { online: boolean; cos_keyed: boolean; tx_keyed: boolean; nodes: RemoteNode[] }
type IrlpStatus  = { online: boolean; on_air: boolean; cos: boolean; ptt: boolean }
type DotState    = 'loading' | 'off' | 'idle' | 'rx' | 'tx'

type DmrState = {
  connected: boolean
  active: boolean
  callsign: string
  tg: number
  tgName: string
}

// ── badge dot ─────────────────────────────────────────────────────────────────
const DOT: Record<DotState, { bg: string; label: string }> = {
  loading: { bg: '#d9d9d9', label: '...'       },
  off:     { bg: '#8c8c8c', label: 'OFF'       },
  idle:    { bg: '#595959', label: 'IDLE'      },
  rx:      { bg: '#52c41a', label: 'RX ACTIVO' },
  tx:      { bg: '#ff4d4f', label: 'TX ACTIVO' },
}

function Dot({ state }: { state: DotState }) {
  const { bg, label } = DOT[state]
  return (
    <span style={{
      background: bg, color: '#fff', fontWeight: 700, fontSize: 10,
      padding: '1px 7px', borderRadius: 10, letterSpacing: 0.4, whiteSpace: 'nowrap',
      animation: state === 'tx' ? 'pulse-red 0.8s ease-in-out infinite' : undefined,
    }}>
      ● {label}
    </span>
  )
}

const pillStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: '#f5f5f5', border: '1px solid #e8e8e8', borderRadius: 6, padding: '3px 9px',
}

const subText: React.CSSProperties = {
  fontSize: 9, color: '#595959', paddingLeft: 4,
  whiteSpace: 'nowrap', maxWidth: 170,
  overflow: 'hidden', textOverflow: 'ellipsis',
}

// ── componente ────────────────────────────────────────────────────────────────
export default function SystemStatusWidget() {
  const [asl, setAsl]   = useState<NodeStatus | null>(null)
  const [irlp, setIrlp] = useState<IrlpStatus | null>(null)
  const [dmr, setDmr]   = useState<DmrState>({
    connected: false, active: false, callsign: '', tg: 0, tgName: '',
  })
  const socketRef = useRef<WebSocket | null>(null)

  // ── AllStar + IRLP poll ───────────────────────────────────────────────────
  useEffect(() => {
    const poll = () => {
      axios.get('/api/public/node-status').then(r => setAsl(r.data)).catch(() => {})
      axios.get('/api/public/irlp-status').then(r => setIrlp(r.data)).catch(() => {})
    }
    poll()
    const t = setInterval(poll, 5_000)
    return () => clearInterval(t)
  }, [])

  // ── WebSocket nativo DMR / Brandmeister (EIO=3) ──────────────────────────
  useEffect(() => {
    let tgs: string[] = ['33450', '334']
    axios.get('/api/public/node-config').then(r => {
      const raw: string = r.data?.bm_tgs ?? '33450,334'
      tgs = raw.split(/[,.]/).map(s => s.trim()).filter(s => /^\d+$/.test(s))
    }).catch(() => {})

    const connect = () => {
      const ws = new WebSocket('wss://api.brandmeister.network/lh/socket.io/?EIO=3&transport=websocket')
      socketRef.current = ws

      ws.onmessage = (e: MessageEvent) => {
        const raw = String(e.data)
        if (raw === '2') { ws.send('3'); return }
        if (raw.startsWith('0')) return
        if (raw === '40') {
          setDmr(d => ({ ...d, connected: true }))
          return
        }
        if (raw.startsWith('42')) {
          const ci = raw.startsWith('42/') ? raw.indexOf(',') : 1
          const payload = raw.startsWith('42/') ? raw.slice(ci + 1) : raw.slice(2)
          try {
            const parsed = JSON.parse(payload)
            const [, p] = Array.isArray(parsed) ? parsed : [null, null]
            if (p && typeof p === 'object') {
              const srcCall = p.SourceCall || p.Callsign || ''
              const destId  = p.DestinationID ?? p.ToTalkgroupID ?? 0
              if (srcCall && (tgs.length === 0 || tgs.includes(String(destId)))) {
                if (p.Stop == 0 || p.Stop == null) {
                  setDmr(d => ({ ...d, active: true, callsign: srcCall, tg: destId, tgName: p.DestinationName || '' }))
                } else {
                  setDmr(d => ({ ...d, active: false }))
                }
              }
            }
          } catch (_) {}
        }
      }

      ws.onclose = () => {
        setDmr(d => ({ ...d, connected: false, active: false }))
        if (socketRef.current === ws) setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      const ws = socketRef.current
      if (ws) { socketRef.current = null; ws.close() }
    }
  }, [])

  // ── estados derivados ─────────────────────────────────────────────────────
  const aslState: DotState  = !asl  ? 'loading' : !asl.online  ? 'off' : asl.tx_keyed  ? 'tx' : asl.cos_keyed ? 'rx' : 'idle'
  const irlpState: DotState = !irlp ? 'loading' : !irlp.online ? 'off' : irlp.ptt      ? 'tx' : irlp.cos      ? 'rx' : 'idle'
  const dmrState: DotState  = !dmr.connected ? 'loading' : dmr.active ? 'tx' : 'idle'

  const activeNode = asl?.nodes.find(n => n.keyed)

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>

      {/* AllStar Link */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={pillStyle}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#389e0d', lineHeight: 1 }}>ASL</span>
          <Dot state={aslState} />
        </div>
        {activeNode && (
          <span style={subText}>
            nodo {activeNode.node}{activeNode.name && activeNode.name !== '—' ? ` · ${activeNode.name}` : ''}
          </span>
        )}
      </div>

      {/* IRLP */}
      <div style={pillStyle}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', lineHeight: 1 }}>IRLP</span>
        <Dot state={irlpState} />
      </div>

      {/* DMR / Brandmeister */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={pillStyle}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', lineHeight: 1 }}>DMR</span>
          <Dot state={dmrState} />
        </div>
        {dmr.active && dmr.callsign && (
          <span style={subText}>
            {dmr.callsign} · TG {dmr.tg}{dmr.tgName ? ` ${dmr.tgName}` : ''}
          </span>
        )}
      </div>

    </div>
  )
}
