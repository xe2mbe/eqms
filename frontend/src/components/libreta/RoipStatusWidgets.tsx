import { Row, Col } from 'antd'
import StatusPill from './StatusPill'
import type { RoipMonitor } from '@/hooks/useRoipMonitor'

interface RoipStatusWidgetsProps {
  roip: RoipMonitor
}

/**
 * Fila compacta de 3 tarjetas de estado RoIP (Hub ASL, Reflector IRLP, DMR
 * Brandmeister), mostrada durante la captura en Libreta (RF) cuando el
 * monitoreo está activo — independiente de si el panel de configuración
 * está visible.
 */
export default function RoipStatusWidgets({ roip }: RoipStatusWidgetsProps) {
  const { roipAvanzado, aslStatus, irlpStatus, nodeCfg, dmrStatus } = roip

  return (
    <Row gutter={8} style={{ marginBottom: 8 }}>
      <Col xs={24} sm={8} style={{ marginBottom: 4 }}>
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '4px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#389e0d' }}>Hub ASL: #{nodeCfg.asl_hub_id || '—'}</span>
            {!aslStatus ? <StatusPill label="..." color="#d9d9d9" />
              : aslStatus.online ? <StatusPill label="ONLINE" color="#52c41a" />
              : <StatusPill label="OFFLINE" color="#ff4d4f" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
              background: !aslStatus || !aslStatus.online ? '#8c8c8c' : aslStatus.on_air ? '#52c41a' : '#8c8c8c',
              boxShadow: aslStatus?.on_air ? '0 0 0 2px rgba(82,196,26,0.3)' : 'none' }} />
            <span style={{ fontSize: 10, color: '#595959', fontWeight: 600 }}>Nodo Boletín {nodeCfg.asl_boletin_node || '—'}</span>
            {aslStatus?.online && aslStatus?.on_air && (aslStatus.tx_keyed
              ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
              : aslStatus.cos_keyed ? <StatusPill label="RX ACTIVO" color="#52c41a" />
              : <StatusPill label="IDLE" color="#595959" />)}
          </div>
          {roipAvanzado && aslStatus?.online && !!aslStatus.nodes?.length && (
            <div style={{ marginTop: 4, borderTop: '1px solid #d9f7be', paddingTop: 3, maxHeight: 100, overflowY: 'auto' }}>
              {aslStatus.nodes.map(n => (
                <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0', fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                    background: n.tx_keyed ? '#ff4d4f' : n.cos_keyed ? '#52c41a' : '#389e0d' }} />
                  <span style={{ color: '#389e0d', fontWeight: 700 }}>#{n.node}</span>
                  {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                  {n.tx_keyed && <StatusPill label="TX" color="#ff4d4f" pulse />}
                  {!n.tx_keyed && n.cos_keyed && <StatusPill label="RX" color="#52c41a" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </Col>
      <Col xs={24} sm={8} style={{ marginBottom: 4 }}>
        <div style={{ background: '#e6f7ff', border: '1px solid #91caff', borderRadius: 6, padding: '4px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2' }}>Reflector IRLP: #{nodeCfg.irlp_reflector_id || '—'}</span>
            {!irlpStatus ? <StatusPill label="..." color="#d9d9d9" />
              : irlpStatus.online ? <StatusPill label="ONLINE" color="#52c41a" />
              : <StatusPill label="OFFLINE" color="#ff4d4f" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
              background: !irlpStatus || !irlpStatus.online ? '#8c8c8c' : irlpStatus.on_air ? '#52c41a' : '#8c8c8c',
              boxShadow: irlpStatus?.on_air ? '0 0 0 2px rgba(82,196,26,0.3)' : 'none' }} />
            <span style={{ fontSize: 10, color: '#595959', fontWeight: 600 }}>Nodo Boletín {nodeCfg.irlp_boletin_node || '—'}</span>
            {irlpStatus?.online && irlpStatus?.on_air && (irlpStatus.ptt
              ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
              : irlpStatus.cos ? <StatusPill label="RX ACTIVO" color="#52c41a" />
              : <StatusPill label="IDLE" color="#595959" />)}
          </div>
          {roipAvanzado && irlpStatus?.online && !!irlpStatus.nodes?.length && (
            <div style={{ marginTop: 4, borderTop: '1px solid #bae0ff', paddingTop: 3, maxHeight: 100, overflowY: 'auto' }}>
              {irlpStatus.nodes.map(n => (
                <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0', fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                    background: n.warning ? '#faad14' : '#52c41a' }} />
                  <span style={{ color: '#0891b2', fontWeight: 700 }}>#{n.node}</span>
                  {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                  {n.warning && <StatusPill label="!" color="#faad14" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </Col>
      <Col xs={24} sm={8} style={{ marginBottom: 4 }}>
        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 6, padding: '4px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>DMR Brandmeister</span>
            {!dmrStatus.connected
              ? <StatusPill label="Conectando…" color="#d9d9d9" />
              : <StatusPill label="ONLINE" color="#7c3aed" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
              background: dmrStatus.active ? '#ff4d4f' : dmrStatus.connected ? '#7c3aed' : '#8c8c8c',
              animation: dmrStatus.active ? 'pulse-red 0.8s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: 10, color: '#595959', fontWeight: 600 }}>TGs: {nodeCfg.bm_tgs || '—'}</span>
            {dmrStatus.connected && (dmrStatus.active
              ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
              : <StatusPill label="IDLE" color="#595959" />)}
          </div>
          {dmrStatus.active && dmrStatus.callsign && (
            <div style={{ marginTop: 3, borderTop: '1px solid #ddd6fe', paddingTop: 3, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: '#ff4d4f' }} />
              <span style={{ color: '#7c3aed', fontWeight: 700 }}>{dmrStatus.callsign}</span>
              <span style={{ color: '#8c8c8c' }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
            </div>
          )}
        </div>
      </Col>
    </Row>
  )
}
