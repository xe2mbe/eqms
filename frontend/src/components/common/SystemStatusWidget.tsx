import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'

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

// ── Brandmeister TGs a monitorear ─────────────────────────────────────────────
const BM_TGS = [33450, 334]   // FMRE, Nacional México

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
  const socketRef = useRef<Socket | null>(null)

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

  // ── Brandmeister Socket.IO ────────────────────────────────────────────────
  useEffect(() => {
    const socket = io('https://api.brandmeister.network', {
      path: '/lh/socket.io',
      transports: ['websocket'],
      reconnectionDelay: 5000,
    })

    socket.on('connect', () => {
      setDmr(d => ({ ...d, connected: true }))
      BM_TGS.forEach(tg => socket.emit('subscribe', `dst_${tg}`))
    })

    socket.on('disconnect', () => {
      setDmr(d => ({ ...d, connected: false, active: false }))
    })

    socket.on('mqtt', (payload: {
      DestinationID: number
      DestinationName: string
      SourceCall: string
      Stop: number
    }) => {
      if (payload.Stop === 0) {
        // transmisión iniciada / en curso
        setDmr(d => ({
          ...d, active: true,
          callsign: payload.SourceCall,
          tg: payload.DestinationID,
          tgName: payload.DestinationName,
        }))
      } else {
        // transmisión terminada
        setDmr(d => ({ ...d, active: false }))
      }
    })

    socketRef.current = socket
    return () => { socket.disconnect() }
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
