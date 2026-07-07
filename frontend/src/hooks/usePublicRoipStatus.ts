import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'

export interface NodeStatus {
  online: boolean; on_air: boolean; cos_keyed: boolean; tx_keyed: boolean; connections: number
  nodes: { node: string; name: string; url: string | null; keyed: boolean; direction: string }[]
}

export interface IrlpStatus {
  online: boolean; on_air: boolean; cos: boolean; ptt: boolean; connections: number
  nodes: { node: string; name: string; url: string; warning?: boolean }[]
}

export interface DmrStatus {
  connected: boolean; active: boolean; callsign: string; tg: number; tgName: string
}

/**
 * Monitoreo en vivo, sin autenticacion, del estado de los sistemas RoIP
 * (AllStarLink, IRLP, DMR/Brandmeister) mostrados en la pagina publica
 * PublicFMRE. Implementacion independiente de useRoipMonitor (Libreta RF) --
 * usa socket.io-client en vez de WebSocket nativo, y no requiere sesion.
 */
export function usePublicRoipStatus() {
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null)
  const [irlpStatus, setIrlpStatus] = useState<IrlpStatus | null>(null)
  const [dmrStatus, setDmrStatus] = useState<DmrStatus>({ connected: false, active: false, callsign: '', tg: 0, tgName: '' })
  const dmrSocketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const fetchNode = () =>
      axios.get('/api/public/node-status')
        .then(r => setNodeStatus(r.data))
        .catch(() => {})
    fetchNode()
    const t = setInterval(fetchNode, 5_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const fetchIrlp = () =>
      axios.get('/api/public/irlp-status')
        .then(r => setIrlpStatus(r.data))
        .catch(() => {})
    fetchIrlp()
    const t = setInterval(fetchIrlp, 5_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const socket = io('https://api.brandmeister.network', {
      path: '/lh/socket.io',
      transports: ['websocket'],
      reconnectionDelay: 5000,
    })
    socket.on('connect', () => {
      setDmrStatus(d => ({ ...d, connected: true }))
      axios.get('/api/public/node-config').then(r => {
        const raw: string = r.data?.bm_tgs ?? '33450,334'
        raw.split(',').map(s => s.trim()).filter(Boolean)
          .forEach(tg => socket.emit('subscribe', `dst_${tg}`))
      }).catch(() => {
        ['33450', '334'].forEach(tg => socket.emit('subscribe', `dst_${tg}`))
      })
    })
    socket.on('disconnect', () => {
      setDmrStatus(d => ({ ...d, connected: false, active: false }))
    })
    socket.on('mqtt', (p: { DestinationID: number; DestinationName: string; SourceCall: string; Stop: number }) => {
      if (p.Stop === 0) {
        setDmrStatus(d => ({ ...d, active: true, callsign: p.SourceCall, tg: p.DestinationID, tgName: p.DestinationName }))
      } else {
        setDmrStatus(d => ({ ...d, active: false }))
      }
    })
    dmrSocketRef.current = socket
    return () => { socket.disconnect() }
  }, [])

  return { nodeStatus, irlpStatus, dmrStatus }
}
