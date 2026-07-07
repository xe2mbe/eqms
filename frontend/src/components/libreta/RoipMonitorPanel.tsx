import { Row, Col, Space, Typography, Switch, Divider, Form, Input, Button } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import StatusPill from './StatusPill'
import type { RoipMonitor } from '@/hooks/useRoipMonitor'

const { Text } = Typography

interface RoipMonitorPanelProps {
  roip: RoipMonitor
}

/**
 * Contenido del panel "Monitoreo Sistemas RoIP" dentro del Collapse de
 * configuración de Libreta (RF): toggles de monitoreo, las 3 tarjetas de
 * estado (Hub ASL, Reflector IRLP, DMR Brandmeister) con lista de nodos
 * conectados, y el formulario de parámetros de conexión.
 */
export default function RoipMonitorPanel({ roip }: RoipMonitorPanelProps) {
  const {
    roipMonitorando, roipAvanzado, aslStatus, irlpStatus, nodeCfg, dmrStatus, dmrWsDbg, dmrRestDbg,
    nodeConfigForm, savingNodeConfig,
    toggleMonitorando, toggleAvanzado, guardarNodeConfig, onNodeConfigFormChange,
  } = roip

  return (
    <>
      {/* Toggle de monitoreo */}
      <Space align="center" style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 13 }}>Monitoreo Sistemas RoIP</Text>
        <Switch checked={roipMonitorando} onChange={toggleMonitorando} />
        {roipMonitorando && (
          <>
            <Text type="secondary" style={{ fontSize: 11 }}>actualizando cada 5 s</Text>
            <Text strong style={{ fontSize: 13, marginLeft: 8 }}>Avanzado</Text>
            <Switch checked={roipAvanzado} onChange={toggleAvanzado} />
          </>
        )}
      </Space>

      {roipMonitorando && (<>

        {/* Indicadores de estado */}
        <Row gutter={12} style={{ marginBottom: 12 }}>

          {/* ── Hub ASL ── */}
          <Col xs={24} sm={8} style={{ marginBottom: 8 }}>
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px' }}>
              {/* Fila 1: título + ONLINE/OFFLINE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#389e0d' }}>
                  Hub ASL: #{nodeCfg.asl_hub_id || '—'}
                </span>
                {!aslStatus
                  ? <StatusPill label="..." color="#d9d9d9" />
                  : aslStatus.online
                    ? <StatusPill label="ONLINE" color="#52c41a" />
                    : <StatusPill label="OFFLINE" color="#ff4d4f" />
                }
              </div>
              {/* Fila 2: dot boletín + número + actividad (solo si conectado) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: !aslStatus || !aslStatus.online ? '#8c8c8c' : aslStatus.on_air ? '#52c41a' : '#8c8c8c',
                  boxShadow: aslStatus?.on_air ? '0 0 0 3px rgba(82,196,26,0.3)' : 'none',
                }} />
                <span style={{ fontSize: 11, color: '#595959', fontWeight: 600 }}>
                  Nodo Boletín {nodeCfg.asl_boletin_node || '—'}
                </span>
                {aslStatus?.online && aslStatus?.on_air && (
                  aslStatus.tx_keyed
                    ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                    : aslStatus.cos_keyed
                      ? <StatusPill label="RX ACTIVO" color="#52c41a" />
                      : <StatusPill label="IDLE" color="#595959" />
                )}
              </div>
              {/* Lista de nodos conectados al Hub */}
              {roipAvanzado && aslStatus?.online && !!aslStatus.nodes?.length && (
                <div style={{ marginTop: 8, borderTop: '1px solid #d9f7be', paddingTop: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {aslStatus.nodes.map(n => (
                    <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                        background: n.tx_keyed ? '#ff4d4f' : n.cos_keyed ? '#52c41a' : '#389e0d',
                      }} />
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

          {/* ── Reflector IRLP ── */}
          <Col xs={24} sm={8} style={{ marginBottom: 8 }}>
            <div style={{ background: '#e6f7ff', border: '1px solid #91caff', borderRadius: 8, padding: '10px 14px' }}>
              {/* Fila 1: título + ONLINE/OFFLINE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2' }}>
                  Reflector IRLP: #{nodeCfg.irlp_reflector_id || '—'}
                </span>
                {!irlpStatus
                  ? <StatusPill label="..." color="#d9d9d9" />
                  : irlpStatus.online
                    ? <StatusPill label="ONLINE" color="#52c41a" />
                    : <StatusPill label="OFFLINE" color="#ff4d4f" />
                }
              </div>
              {/* Fila 2: dot nodo boletín + actividad (solo si conectado) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: !irlpStatus || !irlpStatus.online ? '#8c8c8c' : irlpStatus.on_air ? '#52c41a' : '#8c8c8c',
                  boxShadow: irlpStatus?.on_air ? '0 0 0 3px rgba(82,196,26,0.3)' : 'none',
                }} />
                <span style={{ fontSize: 11, color: '#595959', fontWeight: 600 }}>
                  Nodo Boletín {nodeCfg.irlp_boletin_node || '—'}
                </span>
                {irlpStatus?.online && irlpStatus?.on_air && (
                  irlpStatus.ptt
                    ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                    : irlpStatus.cos
                      ? <StatusPill label="RX ACTIVO" color="#52c41a" />
                      : <StatusPill label="IDLE" color="#595959" />
                )}
              </div>
              {/* Lista de nodos en el Reflector */}
              {roipAvanzado && irlpStatus?.online && !!irlpStatus.nodes?.length && (
                <div style={{ marginTop: 8, borderTop: '1px solid #bae0ff', paddingTop: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {irlpStatus.nodes.map(n => (
                    <div key={n.node} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 11 }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                        background: n.warning ? '#faad14' : '#52c41a',
                      }} />
                      <span style={{ color: '#0891b2', fontWeight: 700 }}>#{n.node}</span>
                      {n.name && <span style={{ color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>}
                      {n.warning && <StatusPill label="!" color="#faad14" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Col>

          {/* ── DMR / Brandmeister ── */}
          <Col xs={24} sm={8} style={{ marginBottom: 8 }}>
            <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>DMR Brandmeister</span>
                {!dmrStatus.connected
                  ? <StatusPill label="Conectando…" color="#d9d9d9" />
                  : <StatusPill label="ONLINE" color="#7c3aed" />
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                  background: dmrStatus.active ? '#ff4d4f' : dmrStatus.connected ? '#7c3aed' : '#8c8c8c',
                  boxShadow: dmrStatus.active ? '0 0 0 3px rgba(255,77,79,0.3)' : dmrStatus.connected ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none',
                  animation: dmrStatus.active ? 'pulse-red 0.8s ease-in-out infinite' : 'none',
                }} />
                {dmrStatus.connected && (
                  dmrStatus.active
                    ? <StatusPill label="TX ACTIVO" color="#ff4d4f" pulse />
                    : <StatusPill label="IDLE" color="#595959" />
                )}
              </div>
              {dmrStatus.active && dmrStatus.callsign && (
                <div style={{ marginTop: 8, borderTop: '1px solid #ddd6fe', paddingTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: '#ff4d4f' }} />
                  <span style={{ color: '#7c3aed', fontWeight: 700 }}>{dmrStatus.callsign}</span>
                  <span style={{ color: '#8c8c8c' }}>TG {dmrStatus.tg}{dmrStatus.tgName ? ` · ${dmrStatus.tgName}` : ''}</span>
                </div>
              )}
              {(dmrWsDbg || dmrRestDbg) && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#888', fontFamily: 'monospace', wordBreak: 'break-all', borderTop: '1px dashed #e9d5ff', paddingTop: 4 }}>
                  {dmrWsDbg && <div>WS: {dmrWsDbg}</div>}
                  {dmrRestDbg && <div>REST: {dmrRestDbg}</div>}
                </div>
              )}
            </div>
          </Col>

        </Row>

        <Divider style={{ margin: '4px 0 10px' }} />

        {/* Parámetros de configuración */}
        <Form form={nodeConfigForm} layout="vertical" size="small"
          onValuesChange={onNodeConfigFormChange}>
          <Divider orientation="left" plain style={{ fontSize: 12, color: '#389e0d', margin: '0 0 8px' }}>AllStarLink (AllScan)</Divider>
          <Row gutter={12}>
            <Col xs={8} sm={4}>
              <Form.Item label="# Hub" name="asl_hub_id">
                <Input placeholder="299081" />
              </Form.Item>
            </Col>
            <Col xs={16} sm={14}>
              <Form.Item label="IP / URL del Hub" name="asl_host">
                <Input placeholder="stn8422.ip.irlp.net" />
              </Form.Item>
            </Col>
            <Col xs={8} sm={3}>
              <Form.Item label="Puerto" name="asl_port">
                <Input placeholder="8081" />
              </Form.Item>
            </Col>
            <Col xs={8} sm={3}>
              <Form.Item label="Nodo Boletín" name="asl_boletin_node">
                <Input placeholder="299080" />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" plain style={{ fontSize: 12, color: '#0891b2', margin: '4px 0 8px' }}>IRLP</Divider>
          <Row gutter={12}>
            <Col xs={8} sm={4}>
              <Form.Item label="# Reflector" name="irlp_reflector_id">
                <Input placeholder="0077" />
              </Form.Item>
            </Col>
            <Col xs={16} sm={20}>
              <Form.Item label="URL página del Reflector" name="irlp_ref_url">
                <Input placeholder="http://85.8.149.218/Chan_Zero_Node_Numbers.html" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={5}>
              <Form.Item label="Usuario CGI" name="irlp_user">
                <Input placeholder="xe2mbe" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={5}>
              <Form.Item label="Contraseña CGI" name="irlp_password">
                <Input.Password placeholder="••••••" />
              </Form.Item>
            </Col>
            <Col xs={8} sm={4}>
              <Form.Item label="# Nodo Boletín" name="irlp_boletin_node">
                <Input placeholder="8422" />
              </Form.Item>
            </Col>
            <Col xs={16} sm={7}>
              <Form.Item label="IP / URL Nodo Boletín" name="irlp_host">
                <Input placeholder="stn8422.ip.irlp.net" />
              </Form.Item>
            </Col>
            <Col xs={8} sm={3}>
              <Form.Item label="Puerto CGI" name="irlp_port">
                <Input placeholder="8080" />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" plain style={{ fontSize: 12, color: '#7c3aed', margin: '4px 0 8px' }}>DMR / Brandmeister</Divider>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item label="TalkGroups a monitorear" name="bm_tgs" extra="Separados por coma — ej: 33450,334">
                <Input placeholder="33450,334" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item label="BM API Key" name="bm_api_key" extra="JWT token de tu perfil en brandmeister.network">
                <Input.Password placeholder="eyJ0eXAi..." />
              </Form.Item>
            </Col>
          </Row>
          <Button
            type="primary" size="small" icon={<SaveOutlined />}
            loading={savingNodeConfig}
            onClick={guardarNodeConfig}
          >
            Guardar configuración de nodos
          </Button>
        </Form>
      </>)}
    </>
  )
}
