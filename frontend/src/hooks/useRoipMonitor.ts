import { useState, useRef, useEffect } from 'react'
import { Form, message } from 'antd'
import client from '@/api/client'
import { libretaApi, type NodeConfigGlobal } from '@/api/libreta'

export interface AslStatus {
  online: boolean
  cos_keyed: boolean
  tx_keyed: boolean
  on_air: boolean
  connections: number
  nodes: { node: string; name: string; url?: string; link?: string; cos_keyed: boolean; tx_keyed: boolean }[]
  /** false cuando el usuario no ha configurado su propio host (modo no-global); ausente/true = configurado. */
  configured?: boolean
}

export interface IrlpStatus {
  online: boolean
  on_air: boolean
  cos: boolean
  ptt: boolean
  connections: number
  nodes: { node: string; name: string; url?: string; warning: boolean }[]
  /** false cuando el usuario no ha configurado su propio host (modo no-global); ausente/true = configurado. */
  configured?: boolean
}

export interface DmrStatus {
  connected: boolean
  active: boolean
  callsign: string
  tg: number
  tgName: string
}

export interface NodeCfg {
  asl_hub_id: string
  asl_boletin_node: string
  irlp_reflector_id: string
  irlp_boletin_node: string
  bm_tgs: string
  bm_api_key: string
}

/**
 * Encapsula el monitoreo en vivo de sistemas RoIP (AllStarLink, IRLP,
 * DMR/Brandmeister) usado en Libreta (RF): estado, polling, WebSocket, y
 * persistencia de configuración de nodos. Subsistema exclusivo de RF —
 * LibretaRS no lo usa.
 */
export function useRoipMonitor() {
  const [nodeConfigForm] = Form.useForm()
  const [savingNodeConfig, setSavingNodeConfig] = useState(false)

  const [roipMonitorando, setRoipMonitorando] = useState(false)
  const [roipAvanzado, setRoipAvanzado] = useState(false)
  const [roipUsarGlobal, setRoipUsarGlobal] = useState(false)
  const [globalNodeCfg, setGlobalNodeCfg] = useState<NodeConfigGlobal | null>(null)
  const [aslStatus, setAslStatus] = useState<AslStatus | null>(null)
  const [irlpStatus, setIrlpStatus] = useState<IrlpStatus | null>(null)
  const [nodeCfg, setNodeCfg] = useState<NodeCfg>({
    asl_hub_id: '', asl_boletin_node: '', irlp_reflector_id: '', irlp_boletin_node: '',
    bm_tgs: '33450,334', bm_api_key: '',
  })
  const [dmrStatus, setDmrStatus] = useState<DmrStatus>({ connected: false, active: false, callsign: '', tg: 0, tgName: '' })
  const [dmrWsDbg, setDmrWsDbg] = useState<string>('')
  const [dmrRestDbg, setDmrRestDbg] = useState<string>('')
  const dmrSocketRef = useRef<any>(null)

  // ── Polling monitoreo RoIP ────────────────────────────────────────────────
  // En modo global usa los endpoints públicos (infraestructura del admin); en
  // modo personal usa los endpoints autenticados que revisan el host/puerto
  // que el propio usuario haya guardado (y responden configured:false si no
  // configuró nada, en vez de reportar el estado de otra infraestructura).
  useEffect(() => {
    if (!roipMonitorando) { setAslStatus(null); setIrlpStatus(null); return }
    const aslUrl = roipUsarGlobal ? '/public/node-status' : '/libreta/node-status'
    const irlpUrl = roipUsarGlobal ? '/public/irlp-status' : '/libreta/irlp-status'
    const poll = () => {
      client.get(aslUrl).then(r => setAslStatus(r.data)).catch(() => setAslStatus(null))
      client.get(irlpUrl).then(r => setIrlpStatus(r.data)).catch(() => setIrlpStatus(null))
    }
    poll()
    const t = setInterval(poll, 5_000)
    return () => clearInterval(t)
  }, [roipMonitorando, roipUsarGlobal])

  // ── WebSocket nativo DMR / Brandmeister (EIO=3 / socket.io v3) ──────────
  useEffect(() => {
    if (!roipMonitorando) {
      const ws = dmrSocketRef.current as WebSocket | null
      if (ws) { dmrSocketRef.current = null; ws.close() }
      setDmrStatus({ connected: false, active: false, callsign: '', tg: 0, tgName: '' })
      return
    }
    // aceptar coma o punto como separadores (el form a veces guarda con punto)
    const tgs = (nodeCfg.bm_tgs || '33450,334')
      .split(/[,.]/)
      .map((s: string) => s.trim())
      .filter((s: string) => /^\d+$/.test(s))

    const connect = () => {
      const ws = new WebSocket('wss://api.brandmeister.network/lh/socket.io/?EIO=3&transport=websocket')
      dmrSocketRef.current = ws

      ws.onmessage = (e: MessageEvent) => {
        const raw = String(e.data)
        if (raw === '2') { ws.send('3'); return }
        if (raw.startsWith('0')) return
        if (raw === '40') {
          setDmrStatus(d => ({ ...d, connected: true }))
          setDmrWsDbg('OK — escuchando')
          return
        }
        if (raw.startsWith('44')) {
          setDmrWsDbg(`err: ${raw.slice(0, 80)}`)
          return
        }
        if (raw.startsWith('42')) {
          const ci = raw.startsWith('42/') ? raw.indexOf(',') : 1
          const payload = raw.startsWith('42/') ? raw.slice(ci + 1) : raw.slice(2)
          try {
            const parsed = JSON.parse(payload)
            const [eventName, p] = Array.isArray(parsed) ? parsed : [String(parsed), null]
            setDmrWsDbg(`EVT[${eventName}] ${JSON.stringify(p).slice(0, 80)}`)
            // Aceptar cualquier evento con datos de transmisión DMR
            if (p && typeof p === 'object') {
              const srcCall = p.SourceCall || p.Callsign || ''
              const destId  = p.DestinationID ?? p.ToTalkgroupID ?? 0
              const destName = p.DestinationName || p.ToTalkgroupName || ''
              if (srcCall) {
                const tgNums = tgs.map((t: string) => parseInt(t))
                const isMonitored = tgNums.length === 0 || tgNums.includes(destId)
                if (isMonitored) {
                  if (p.Stop == 0 || p.Stop == null) {
                    setDmrStatus(d => ({ ...d, active: true, callsign: srcCall, tg: destId, tgName: destName }))
                  } else {
                    setDmrStatus(d => ({ ...d, active: false, callsign: '', tg: 0, tgName: '' }))
                  }
                }
              }
            }
          } catch (_) { setDmrWsDbg(`raw: ${raw.slice(0, 120)}`) }
          return
        }
      }

      ws.onclose = () => {
        setDmrStatus(d => ({ ...d, connected: false, active: false }))
        if (dmrSocketRef.current === ws) setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      const ws = dmrSocketRef.current as WebSocket | null
      if (ws) { dmrSocketRef.current = null; ws.close() }
    }
  }, [roipMonitorando, nodeCfg.bm_tgs])

  // ── REST polling DMR activity (BM API proxy) ──────────────────────────────
  useEffect(() => {
    if (!roipMonitorando || !nodeCfg.bm_api_key) return
    const poll = async () => {
      try {
        const { data } = await client.get('/libreta/dmr-lastheard')
        if (data.active) {
          setDmrStatus(d => ({ ...d, active: true, callsign: data.callsign, tg: data.tg, tgName: data.tg_name }))
          setDmrRestDbg(`TX: ${data.callsign} · TG ${data.tg}`)
        } else if (data.error === 'no_api_key') {
          setDmrRestDbg('sin API key')
        } else {
          setDmrStatus(d => ({ ...d, active: false, callsign: '', tg: 0, tgName: '' }))
          setDmrRestDbg(data.dbg ?? 'IDLE')
        }
      } catch (err: unknown) {
        setDmrRestDbg(`err: ${String(err).slice(0, 60)}`)
      }
    }
    poll()
    const t = setInterval(poll, 7_000)
    return () => clearInterval(t)
  }, [roipMonitorando, nodeCfg.bm_api_key])

  const toggleMonitorando = (v: boolean) => {
    setRoipMonitorando(v)
    if (!v) setRoipAvanzado(false)
    libretaApi.saveConfig({ roip_monitorando: v, roip_avanzado: v ? roipAvanzado : false })
  }

  const toggleAvanzado = (v: boolean) => {
    setRoipAvanzado(v)
    libretaApi.saveConfig({ roip_avanzado: v })
  }

  /** Trae la config global (sin credenciales) y la aplica a nodeCfg para mostrar/usar. */
  const fetchAndApplyGlobal = async () => {
    try {
      const { data } = await libretaApi.getGlobalNodeConfig()
      setGlobalNodeCfg(data)
      setNodeCfg(prev => ({
        ...prev,
        asl_hub_id: data.asl_hub_id,
        asl_boletin_node: data.asl_boletin_node,
        irlp_reflector_id: data.irlp_reflector_id,
        irlp_boletin_node: data.irlp_boletin_node,
        bm_tgs: data.bm_tgs,
        bm_api_key: '', // el modo global nunca expone credenciales
      }))
    } catch {
      setGlobalNodeCfg(null)
    }
  }

  const toggleUsarGlobal = (v: boolean) => {
    setRoipUsarGlobal(v)
    libretaApi.saveConfig({ roip_usar_global: v })
    if (v) {
      fetchAndApplyGlobal()
    } else {
      setGlobalNodeCfg(null)
      // Restaurar los valores propios del usuario (siguen en el form, aunque no estuviera montado)
      const vals = nodeConfigForm.getFieldsValue()
      setNodeCfg(prev => ({
        ...prev,
        asl_hub_id: vals.asl_hub_id ?? '',
        asl_boletin_node: vals.asl_boletin_node ?? '',
        irlp_reflector_id: vals.irlp_reflector_id ?? '',
        irlp_boletin_node: vals.irlp_boletin_node ?? '',
        bm_tgs: vals.bm_tgs ?? '33450,334',
        bm_api_key: vals.bm_api_key ?? '',
      }))
    }
  }

  const guardarNodeConfig = async () => {
    setSavingNodeConfig(true)
    try {
      const vals = nodeConfigForm.getFieldsValue()
      await libretaApi.saveConfig({
        asl_hub_id: vals.asl_hub_id,
        asl_host: vals.asl_host,
        asl_port: vals.asl_port,
        asl_boletin_node: vals.asl_boletin_node,
        irlp_reflector_id: vals.irlp_reflector_id,
        irlp_ref_url: vals.irlp_ref_url,
        irlp_user: vals.irlp_user,
        irlp_password: vals.irlp_password,
        irlp_boletin_node: vals.irlp_boletin_node,
        irlp_host: vals.irlp_host,
        irlp_port: vals.irlp_port,
        bm_tgs: vals.bm_tgs,
        bm_api_key: vals.bm_api_key,
      })
      setNodeCfg(prev => ({
        ...prev,
        asl_hub_id: vals.asl_hub_id ?? '',
        asl_boletin_node: vals.asl_boletin_node ?? '',
        irlp_reflector_id: vals.irlp_reflector_id ?? '',
        irlp_boletin_node: vals.irlp_boletin_node ?? '',
        bm_tgs: vals.bm_tgs ?? '33450,334',
        bm_api_key: vals.bm_api_key ?? '',
      }))
      message.success('Configuración de nodos guardada')
    } catch {
      message.error('Error al guardar configuración de nodos')
    } finally {
      setSavingNodeConfig(false)
    }
  }

  /** Aplica la parte RoIP de la config ya cargada por la pagina via libretaApi.getConfig(). */
  const hydrateFromConfig = (cfg: any) => {
    setNodeCfg({
      asl_hub_id: cfg.asl_hub_id ?? '',
      asl_boletin_node: cfg.asl_boletin_node ?? '',
      irlp_reflector_id: cfg.irlp_reflector_id ?? '',
      irlp_boletin_node: cfg.irlp_boletin_node ?? '',
      bm_tgs: cfg.bm_tgs ?? '33450,334',
      bm_api_key: cfg.bm_api_key ?? '',
    })
    if (cfg.roip_monitorando) setRoipMonitorando(true)
    if (cfg.roip_avanzado) setRoipAvanzado(true)
    if (cfg.roip_usar_global) {
      setRoipUsarGlobal(true)
      fetchAndApplyGlobal()
    }
    nodeConfigForm.setFieldsValue({
      asl_hub_id: cfg.asl_hub_id,
      asl_host: cfg.asl_host,
      asl_port: cfg.asl_port,
      asl_boletin_node: cfg.asl_boletin_node,
      irlp_reflector_id: cfg.irlp_reflector_id,
      irlp_ref_url: cfg.irlp_ref_url,
      irlp_user: cfg.irlp_user,
      irlp_password: cfg.irlp_password,
      irlp_boletin_node: cfg.irlp_boletin_node,
      irlp_host: cfg.irlp_host,
      irlp_port: cfg.irlp_port,
      bm_tgs: cfg.bm_tgs ?? '33450,334',
      bm_api_key: cfg.bm_api_key ?? '',
    })
  }

  const onNodeConfigFormChange = (changed: Partial<NodeCfg>) => {
    if (changed.bm_tgs !== undefined) setNodeCfg(prev => ({ ...prev, bm_tgs: changed.bm_tgs! }))
    if (changed.bm_api_key !== undefined) setNodeCfg(prev => ({ ...prev, bm_api_key: changed.bm_api_key! }))
    if (changed.asl_hub_id !== undefined) setNodeCfg(prev => ({ ...prev, asl_hub_id: changed.asl_hub_id! }))
    if (changed.asl_boletin_node !== undefined) setNodeCfg(prev => ({ ...prev, asl_boletin_node: changed.asl_boletin_node! }))
    if (changed.irlp_reflector_id !== undefined) setNodeCfg(prev => ({ ...prev, irlp_reflector_id: changed.irlp_reflector_id! }))
    if (changed.irlp_boletin_node !== undefined) setNodeCfg(prev => ({ ...prev, irlp_boletin_node: changed.irlp_boletin_node! }))
  }

  return {
    roipMonitorando, roipAvanzado, roipUsarGlobal, globalNodeCfg, aslStatus, irlpStatus, nodeCfg, dmrStatus, dmrWsDbg, dmrRestDbg,
    nodeConfigForm, savingNodeConfig,
    toggleMonitorando, toggleAvanzado, toggleUsarGlobal, guardarNodeConfig, hydrateFromConfig, onNodeConfigFormChange,
  }
}

export type RoipMonitor = ReturnType<typeof useRoipMonitor>
