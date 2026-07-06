import { Row, Col } from 'antd'

interface MiRecordPersonal {
  posicion: number
  totalSesiones: number
  totalHoy: number
  esPrimero: boolean
  mejorFecha: string
  mejorTotal: number
}

interface OpsEnFecha {
  posicion: number
  totalOps: number
  totalHoy: number
}

interface RankingHistorico {
  posicion: number
  totalOps: number
  totalGeneral: number
}

interface StatsCardsRowProps {
  totalQSOs: number
  estacionesUnicas: number
  posicion: number | null
  totalSesiones: number
  esRecordQSOs: boolean
  esRecordEstaciones: boolean
  /** rankingEvento.length / rankingRS.length — historial completo del evento. */
  totalSesionesHistoricas: number
  miRecordPersonal?: MiRecordPersonal
  opsEnFecha?: OpsEnFecha
  rankingHistorico?: RankingHistorico
}

function medalla(posicion: number): string {
  return posicion === 1 ? '🥇' : posicion === 2 ? '🥈' : posicion === 3 ? '🥉' : `#${posicion}`
}

/**
 * Fila de 6 tarjetas gradiente con las estadísticas de la sesión de captura
 * en curso (QSOs, estaciones únicas, posición en el evento, récord
 * personal, ranking de operadores en la fecha, ranking histórico).
 * Compartida por Libreta (RF) y LibretaRS — el cómputo de estos valores
 * difiere entre ambas páginas (RF los deriva del resumen en memoria, RS los
 * toma del ranking del servidor), pero el renderizado es idéntico.
 */
export default function StatsCardsRow({
  totalQSOs, estacionesUnicas, posicion, totalSesiones, esRecordQSOs, esRecordEstaciones,
  totalSesionesHistoricas, miRecordPersonal, opsEnFecha, rankingHistorico,
}: StatsCardsRowProps) {
  if (totalQSOs === 0 && posicion === null) return null

  return (
    <Row gutter={[6, 6]} style={{ marginBottom: 16, alignItems: 'stretch' }}>
      <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
        <div style={{
          background: esRecordQSOs
            ? 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)'
            : 'linear-gradient(135deg, #1A569E 0%, #1677ff 100%)',
          borderRadius: 8, padding: '8px 10px', color: '#fff',
          boxShadow: esRecordQSOs
            ? '0 4px 16px rgba(250,173,20,0.55)'
            : '0 4px 12px rgba(22,119,255,0.3)',
          transition: 'all 0.4s ease', height: '100%',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
            {esRecordQSOs ? '🏆 Récord QSOs' : '📡 QSOs guardados'}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
            {totalQSOs}
          </div>
          {esRecordQSOs && totalSesionesHistoricas > 1 && (
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95, fontWeight: 700, letterSpacing: 0.3 }}>
              ¡Mejor sesión del evento!
            </div>
          )}
        </div>
      </Col>
      <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
        <div style={{
          background: esRecordEstaciones
            ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
            : 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
          borderRadius: 8, padding: '8px 10px', color: '#fff',
          boxShadow: esRecordEstaciones
            ? '0 4px 16px rgba(82,196,26,0.45)'
            : '0 4px 12px rgba(19,194,194,0.3)',
          transition: 'all 0.4s ease', height: '100%',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
            {esRecordEstaciones ? '🏆 Récord Estaciones' : '👥 Estaciones únicas'}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
            {estacionesUnicas}
          </div>
          {esRecordEstaciones && totalSesionesHistoricas > 1 && (
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.95, fontWeight: 700, letterSpacing: 0.3 }}>
              ¡Más estaciones del evento!
            </div>
          )}
        </div>
      </Col>
      {posicion !== null && (
        <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
          <div style={{
            background: posicion === 1
              ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)'
              : posicion <= 3
                ? 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)'
                : 'linear-gradient(135deg, #595959 0%, #434343 100%)',
            borderRadius: 8, padding: '8px 10px', color: '#fff',
            boxShadow: posicion === 1
              ? '0 4px 16px rgba(250,173,20,0.55)'
              : '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.4s ease', height: '100%',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
              📊 Posición del evento
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
              {medalla(posicion)}
            </div>
            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
              {totalSesionesHistoricas === 1
                ? 'Primera sesión del evento'
                : posicion === 1
                  ? `de ${totalSesiones} sesiones — ¡la mejor!`
                  : `de ${totalSesiones} sesiones`}
            </div>
          </div>
        </Col>
      )}
      {/* Tarjeta 4: récord personal del operador en este evento */}
      {miRecordPersonal && (() => {
        const { posicion: p, totalSesiones: ts, totalHoy, esPrimero, mejorFecha, mejorTotal } = miRecordPersonal
        const esTop3 = p <= 3
        return (
          <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
            <div style={{
              background: esPrimero
                ? 'linear-gradient(135deg, #ff7a45 0%, #d4380d 100%)'
                : esTop3
                  ? 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)'
                  : 'linear-gradient(135deg, #531dab 0%, #391085 100%)',
              borderRadius: 8, padding: '8px 10px', color: '#fff',
              boxShadow: esPrimero
                ? '0 4px 16px rgba(212,56,13,0.45)'
                : '0 4px 12px rgba(83,29,171,0.3)',
              transition: 'all 0.4s ease', height: '100%',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                🏅 Mi récord personal
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                {medalla(p)}
              </div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                {`de ${ts} ses. · ${totalHoy} QSOs hoy`}
              </div>
              {!esPrimero && (
                <div style={{ fontSize: 11, marginTop: 2, opacity: 0.75, fontWeight: 500 }}>
                  {`Récord: ${mejorFecha} · ${mejorTotal} QSOs`}
                </div>
              )}
            </div>
          </Col>
        )
      })()}
      {/* Tarjeta 5: ranking de operadores en esta fecha+evento */}
      {opsEnFecha && (() => {
        const { posicion: p, totalOps, totalHoy } = opsEnFecha
        const esPrimero = p === 1
        const esTop3 = p <= 3
        return (
          <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
            <div style={{
              background: esPrimero
                ? 'linear-gradient(135deg, #096dd9 0%, #0050b3 100%)'
                : esTop3
                  ? 'linear-gradient(135deg, #13c2c2 0%, #006d75 100%)'
                  : 'linear-gradient(135deg, #434343 0%, #262626 100%)',
              borderRadius: 8, padding: '8px 10px', color: '#fff',
              boxShadow: esPrimero
                ? '0 4px 16px rgba(9,109,217,0.45)'
                : '0 4px 12px rgba(0,0,0,0.25)',
              transition: 'all 0.4s ease', height: '100%',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                👥 Ops en esta fecha
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                {medalla(p)}
              </div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                {`de ${totalOps} ops · ${totalHoy} QSOs hoy`}
              </div>
            </div>
          </Col>
        )
      })()}
      {/* Tarjeta 6: ranking histórico de operadores del evento */}
      {rankingHistorico && (() => {
        const { posicion: p, totalOps, totalGeneral } = rankingHistorico
        const esPrimero = p === 1
        const esTop3 = p <= 3
        return (
          <Col xs={12} sm={8} md={4} style={{ display: 'flex' }}>
            <div style={{
              background: esPrimero
                ? 'linear-gradient(135deg, #389e0d 0%, #237804 100%)'
                : esTop3
                  ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                  : 'linear-gradient(135deg, #595959 0%, #3d3d3d 100%)',
              borderRadius: 8, padding: '8px 10px', color: '#fff',
              boxShadow: esPrimero
                ? '0 4px 16px rgba(56,158,13,0.45)'
                : '0 4px 12px rgba(0,0,0,0.2)',
              transition: 'all 0.4s ease', height: '100%',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                📈 Ranking histórico ops
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                {medalla(p)}
              </div>
              <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85, fontWeight: 600 }}>
                {`de ${totalOps} ops · ${totalGeneral} QSOs totales`}
              </div>
            </div>
          </Col>
        )
      })()}
    </Row>
  )
}
