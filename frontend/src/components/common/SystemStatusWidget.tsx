import React, { useEffect, useState } from 'react'
import axios from 'axios'

type RemoteNode = { node: string; name: string; keyed: boolean }
type NodeStatus = { online: boolean; cos_keyed: boolean; tx_keyed: boolean; nodes: RemoteNode[] }
type IrlpStatus = { online: boolean; on_air: boolean; cos: boolean; ptt: boolean }
type DotState = 'loading' | 'off' | 'idle' | 'rx' | 'tx'

const DOT: Record<DotState, { bg: string; label: string }> = {
  loading: { bg: '#d9d9d9', label: '...' },
  off:     { bg: '#8c8c8c', label: 'OFF' },
  idle:    { bg: '#595959', label: 'IDLE' },
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

export default function SystemStatusWidget() {
  const [asl, setAsl] = useState<NodeStatus | null>(null)
  const [irlp, setIrlp] = useState<IrlpStatus | null>(null)

  useEffect(() => {
    const poll = () => {
      axios.get('/api/public/node-status').then(r => setAsl(r.data)).catch(() => {})
      axios.get('/api/public/irlp-status').then(r => setIrlp(r.data)).catch(() => {})
    }
    poll()
    const t = setInterval(poll, 5_000)
    return () => clearInterval(t)
  }, [])

  const aslState: DotState = !asl ? 'loading' : !asl.online ? 'off' : asl.tx_keyed ? 'tx' : asl.cos_keyed ? 'rx' : 'idle'
  const irlpState: DotState = !irlp ? 'loading' : !irlp.online ? 'off' : irlp.ptt ? 'tx' : irlp.cos ? 'rx' : 'idle'

  const activeNode = asl?.nodes.find(n => n.keyed)

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <div style={pillStyle}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#389e0d', lineHeight: 1 }}>ASL</span>
          <Dot state={aslState} />
        </div>
        {activeNode && (
          <span style={{ fontSize: 9, color: '#595959', paddingLeft: 4, whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            nodo {activeNode.node}{activeNode.name && activeNode.name !== '—' ? ` · ${activeNode.name}` : ''}
          </span>
        )}
      </div>
      <div style={pillStyle}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', lineHeight: 1 }}>IRLP</span>
        <Dot state={irlpState} />
      </div>
    </div>
  )
}
