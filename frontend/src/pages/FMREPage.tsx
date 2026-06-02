import { useState, useEffect } from 'react'
import { Alert, Tag, Steps } from 'antd'
import {
  MenuOutlined, CloseOutlined, GlobalOutlined,
  WarningOutlined, MailOutlined, PhoneOutlined,
  CheckCircleOutlined, FileTextOutlined, AudioOutlined,
  SoundOutlined, TeamOutlined,
} from '@ant-design/icons'

// URL del sistema EQMS — vacío = mismo servidor, URL completa = servidor externo
const EQMS_URL = (import.meta.env.VITE_EQMS_URL as string) || ''

// ─── Colores ─────────────────────────────────────────────────────────────────
const FMRE_BLUE   = '#1A569E'
const FMRE_DARK   = '#0D2E5F'
const FMRE_GOLD   = '#D4A017'
const FMRE_LIGHT  = '#E8F0FA'

// ─── Nav items ───────────────────────────────────────────────────────────────
const NAV = [
  { id: 'historia',     label: 'Historia' },
  { id: 'quienes',      label: 'Quiénes Somos' },
  { id: 'medios',       label: 'Medios de Difusión' },
  { id: 'reglamentacion', label: 'Reglamentación' },
  { id: 'afiliacion',   label: 'Afiliación' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SectionTitle({ children, accent = FMRE_BLUE }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
      <div style={{ width: 5, height: 36, background: accent, borderRadius: 3, flexShrink: 0 }} />
      <h2 style={{ margin: 0, fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: FMRE_DARK, lineHeight: 1.2 }}>
        {children}
      </h2>
    </div>
  )
}

// ─── Historia ────────────────────────────────────────────────────────────────
const HITOS = [
  {
    year: '1932',
    title: 'Fundación de la Liga Mexicana de Radioexperimentadores',
    desc: 'Nace la primera organización nacional de radioaficionados en México, sentando las bases del movimiento que representaría a los operadores mexicanos ante el mundo.',
  },
  {
    year: '1938',
    title: 'Afiliación a la IARU',
    desc: 'México se integra a la Unión Internacional de Radioaficionados (IARU), organismo que representa los intereses de la radioafición ante la Unión Internacional de Telecomunicaciones (UIT).',
  },
  {
    year: '1988',
    title: 'Transformación en Federación',
    desc: 'La Liga se transforma en la Federación Mexicana de Radioexperimentadores, A.C. al unirse a la Confederación Deportiva Mexicana (CODEME), integrándose formalmente al sistema deportivo nacional.',
  },
  {
    year: '1990s',
    title: 'Integración al Sistema Nacional de Protección Civil',
    desc: 'La FMRE se incorpora al Sistema Nacional de Protección Civil, reconociendo el papel fundamental de los radioaficionados como red de comunicaciones de emergencia en situaciones de desastre.',
  },
  {
    year: '2000s',
    title: 'Era Digital y nuevas bandas',
    desc: 'La federación lidera la adopción de sistemas digitales como D-STAR, DMR, Yaesu Fusion y AllStar Link, manteniendo a los radioaficionados mexicanos a la vanguardia tecnológica.',
  },
  {
    year: 'Hoy',
    title: '32 asociaciones estatales activas',
    desc: 'La FMRE agrupa a más de 32 asociaciones estatales e instituciones académicas, manteniendo su misión de representar, promover y defender los intereses de los radioaficionados mexicanos.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FMREPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('historia')
  const [navSticky, setNavSticky] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setNavSticky(window.scrollY > 80)
      const sections = NAV.map(n => document.getElementById(n.id))
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = sections[i]
        if (el && el.getBoundingClientRect().top <= 100) {
          setActiveSection(NAV[i].id)
          break
        }
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f7f8fa', minHeight: '100vh' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header style={{
        background: `linear-gradient(150deg, ${FMRE_DARK} 0%, ${FMRE_BLUE} 60%, #2563a8 100%)`,
        padding: '0 0 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Silueta del territorio mexicano */}
        <img src="/mexico.webp" alt="" aria-hidden="true"
          style={{ position: 'absolute', left: '-2%', bottom: 180,
            width: '44%', maxWidth: 420, pointerEvents: 'none',
            opacity: 0.18,
            filter: 'invert(1) grayscale(1) brightness(0.6)',
            mixBlendMode: 'screen' }} />

        {/* Antena Yagi — elemento técnico radioafición */}
        <svg style={{ position: 'absolute', top: 18, right: 32, opacity: 0.1, pointerEvents: 'none' }}
          width="220" height="200" viewBox="0 0 220 200">
          {/* Boom horizontal */}
          <line x1="10" y1="80" x2="210" y2="80" stroke="white" strokeWidth="2.5"/>
          {/* Reflector (más largo, izquierda) */}
          <line x1="22" y1="38" x2="22" y2="122" stroke="white" strokeWidth="2.5"/>
          {/* Elemento radiante (dipolo partido) */}
          <line x1="70" y1="44" x2="70" y2="68" stroke="white" strokeWidth="2.5"/>
          <line x1="70" y1="92" x2="70" y2="116" stroke="white" strokeWidth="2.5"/>
          <rect x="62" y="68" width="16" height="24" stroke="white" strokeWidth="1.5" fill="none" rx="2"/>
          {/* Directores */}
          <line x1="110" y1="48" x2="110" y2="112" stroke="white" strokeWidth="2"/>
          <line x1="148" y1="52" x2="148" y2="108" stroke="white" strokeWidth="2"/>
          <line x1="182" y1="56" x2="182" y2="104" stroke="white" strokeWidth="1.5"/>
          <line x1="208" y1="60" x2="208" y2="100" stroke="white" strokeWidth="1"/>
          {/* Línea de bajada (coaxial) */}
          <line x1="70" y1="80" x2="70" y2="165" stroke="white" strokeWidth="1.5" strokeDasharray="5,4"/>
          {/* Conector */}
          <circle cx="70" cy="170" r="6" stroke="white" strokeWidth="1.5" fill="none"/>
          <circle cx="70" cy="170" r="2" fill="white"/>
          {/* Bobina (tuner) */}
          {[0,1,2,3,4].map(i => (
            <path key={i} d={`M ${56+i*6},185 Q ${59+i*6},178 ${62+i*6},185`}
              stroke="white" strokeWidth="1.5" fill="none"/>
          ))}
          <line x1="56" y1="185" x2="56" y2="192" stroke="white" strokeWidth="1.5"/>
          <line x1="86" y1="185" x2="86" y2="192" stroke="white" strokeWidth="1.5"/>
        </svg>

        {/* XE — identidad */}
        <div style={{ position: 'absolute', left: 24, bottom: 24, opacity: 0.05, fontSize: 180, fontWeight: 900, color: 'white', lineHeight: 1, letterSpacing: -8 }}>XE</div>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '20px 32px 0' }}>
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
              color: 'white', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {menuOpen ? <CloseOutlined /> : <MenuOutlined />}
          </button>
        </div>

        {/* Contenido hero */}
        <div style={{ maxWidth: 800, margin: '40px auto 0', padding: '0 32px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <a href="https://www.iaru-r2.org/" target="_blank" rel="noopener noreferrer"
            style={{ color: FMRE_GOLD, fontWeight: 700, letterSpacing: 4, fontSize: 11,
              marginBottom: 20, display: 'inline-block', textDecoration: 'none',
              borderBottom: '1px dotted rgba(212,160,23,0.5)', paddingBottom: 1 }}>
            ▶ MIEMBRO DE LA IARU REGIÓN 2
          </a>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
            <img src="/fmre.webp" alt="FMRE" style={{ height: 120, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))', flexShrink: 0 }} />
            <h1 style={{ color: 'white', fontSize: 'clamp(24px, 4vw, 46px)', fontWeight: 900, margin: 0, lineHeight: 1.2, textAlign: 'left' }}>
              Federación Mexicana<br />de Radio Experimentadores<br />A.C.
            </h1>
          </div>
          <p style={{ color: '#8ab4e0', fontSize: 'clamp(14px, 2vw, 18px)', lineHeight: 1.7, margin: '0 0 32px' }}>
            Más de 90 años como máxima autoridad de la práctica de la radioafición en México.
            Representamos, promovemos y defendemos el espectro radioeléctrico para las generaciones presentes y futuras.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => scrollTo('afiliacion')}
              style={{ background: FMRE_GOLD, color: FMRE_DARK, border: 'none', borderRadius: 8,
                padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5 }}>
              Afíliate a la FMRE
            </button>
            <button onClick={() => scrollTo('quienes')}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1.5px solid rgba(255,255,255,0.4)',
                borderRadius: 8, padding: '12px 28px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              Conocer más
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div style={{ maxWidth: 700, margin: '40px auto 0', padding: '0 32px', display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { n: '90+', l: 'Años de historia' },
            { n: '32', l: 'Asociaciones estatales' },
            { n: 'IARU', l: 'Región 2' },
            { n: '73', l: 'Good DX de XE' },
          ].map(m => (
            <div key={m.n} style={{ textAlign: 'center', minWidth: 100 }}>
              <div style={{ color: FMRE_GOLD, fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{m.n}</div>
              <div style={{ color: '#8ab4e0', fontSize: 12, marginTop: 4 }}>{m.l}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── NAVEGACIÓN STICKY ─────────────────────────────────────────────── */}
      <nav style={{
        position: navSticky ? 'sticky' : 'relative', top: 0, zIndex: 100,
        background: navSticky ? FMRE_DARK : 'white',
        boxShadow: navSticky ? '0 2px 12px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s',
      }}>
        {/* Menú mobile */}
        {menuOpen && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => scrollTo(n.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                  padding: '10px 8px', color: navSticky ? 'white' : FMRE_DARK, fontWeight: 600,
                  fontSize: 15, cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                {n.label}
              </button>
            ))}
          </div>
        )}
        {/* Desktop nav */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '0 16px', overflowX: 'auto' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => scrollTo(n.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '14px 18px', fontSize: 14, fontWeight: activeSection === n.id ? 700 : 500,
                color: activeSection === n.id ? (navSticky ? FMRE_GOLD : FMRE_BLUE) : (navSticky ? '#8ab4e0' : '#555'),
                borderBottom: activeSection === n.id ? `3px solid ${navSticky ? FMRE_GOLD : FMRE_BLUE}` : '3px solid transparent',
                whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── CONTENIDO ────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px' }}>

        {/* ── HISTORIA ─────────────────────────────────────────────────── */}
        <section id="historia" style={{ padding: '64px 0 48px' }}>
          <SectionTitle>Historia</SectionTitle>
          <p style={{ color: '#555', fontSize: 16, lineHeight: 1.8, marginBottom: 48, maxWidth: 700 }}>
            Desde 1932, la organización que hoy conocemos como FMRE ha sido el pilar del radioaficionismo
            en México, evolucionando junto a la tecnología y manteniendo siempre viva la pasión por las ondas hertzianas.
          </p>

          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: 40 }}>
            <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: `linear-gradient(to bottom, ${FMRE_BLUE}, ${FMRE_GOLD})` }} />
            {HITOS.map((h, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: 40 }}>
                <div style={{
                  position: 'absolute', left: -32, top: 4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: i === HITOS.length - 1 ? FMRE_GOLD : FMRE_BLUE,
                  border: '3px solid white', boxShadow: '0 0 0 2px ' + (i === HITOS.length - 1 ? FMRE_GOLD : FMRE_BLUE),
                }} />
                <div style={{
                  background: 'white', borderRadius: 12, padding: '20px 24px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                  borderLeft: `4px solid ${i === HITOS.length - 1 ? FMRE_GOLD : FMRE_BLUE}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <Tag color={i === HITOS.length - 1 ? 'gold' : 'blue'} style={{ fontWeight: 700, fontSize: 13 }}>
                      {h.year}
                    </Tag>
                    <span style={{ fontWeight: 700, color: FMRE_DARK, fontSize: 15 }}>{h.title}</span>
                  </div>
                  <p style={{ margin: 0, color: '#666', lineHeight: 1.7, fontSize: 14 }}>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── QUIÉNES SOMOS ────────────────────────────────────────────── */}
        <section id="quienes" style={{ padding: '64px 0 48px', borderTop: '1px solid #e8ecf0' }}>
          <SectionTitle>Quiénes Somos</SectionTitle>

          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: 40 }}>
            {/* Card Descripción */}
            <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: FMRE_LIGHT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TeamOutlined style={{ color: FMRE_BLUE, fontSize: 26 }} />
                </div>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <h3 style={{ color: FMRE_DARK, fontWeight: 800, fontSize: 20, margin: '0 0 12px' }}>
                    La Federación
                  </h3>
                  <p style={{ color: '#555', lineHeight: 1.8, margin: 0, fontSize: 15 }}>
                    La Federación Mexicana de Radioexperimentadores, A.C. funciona como el organismo representativo
                    de los intereses de los radioaficionados mexicanos ante autoridades nacionales e internacionales,
                    siendo la máxima autoridad en esta práctica sin fines de lucro.
                  </p>
                  <p style={{ color: '#555', lineHeight: 1.8, margin: '12px 0 0', fontSize: 15 }}>
                    Está integrada por 32 asociaciones estatales más las que representan a instituciones académicas.
                    Su origen se remonta a la Liga Mexicana de Radioexperimentadores A.C., fundada en 1932,
                    transformándose en Federación durante 1988 al unirse a la Confederación Deportiva Mexicana.
                  </p>
                </div>
              </div>
            </div>

            {/* Representación Nacional e Internacional */}
            <div style={{ background: 'white', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#e6f4ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GlobalOutlined style={{ color: FMRE_BLUE, fontSize: 20 }} />
                </div>
                <h3 style={{ margin: 0, color: FMRE_DARK, fontWeight: 700, fontSize: 17 }}>
                  Representación Internacional
                </h3>
              </div>
              <p style={{ color: '#555', lineHeight: 1.75, margin: 0, fontSize: 14 }}>
                La FMRE es la sociedad miembro mexicana de la <strong>International Amateur Radio Union (IARU)</strong>,
                organización que representa los intereses de la radioafición a nivel mundial ante la Unión
                Internacional de Telecomunicaciones.
              </p>
              <p style={{ color: '#555', lineHeight: 1.75, margin: '10px 0 0', fontSize: 14 }}>
                Participa activamente en la <strong>Región 2 de la IARU</strong>, forma parte de CODEME
                (vinculada al sistema deportivo nacional SINADE), pertenece al Sistema Nacional de
                Protección Civil y mantiene representación ante el Instituto Federal de Telecomunicaciones.
              </p>
            </div>

            {/* Qué es la Radioafición */}
            <div style={{ background: 'white', borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fff7e6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AudioOutlined style={{ color: FMRE_GOLD, fontSize: 20 }} />
                </div>
                <h3 style={{ margin: 0, color: FMRE_DARK, fontWeight: 700, fontSize: 17 }}>
                  ¿Qué es la Radioafición?
                </h3>
              </div>
              <p style={{ color: '#555', lineHeight: 1.75, margin: 0, fontSize: 14 }}>
                La radioafición es un <strong>servicio de radiocomunicaciones</strong> reconocido por la Unión
                Internacional de Telecomunicaciones (UIT), enfocado en la autoinstrucción, intercomunicación
                e investigación técnica realizada por personas autorizadas, sin fines lucrativos.
              </p>
              <p style={{ color: '#555', lineHeight: 1.75, margin: '10px 0 0', fontSize: 14 }}>
                Los radioaficionados desempeñan un papel crucial en situaciones de emergencia, proporcionando
                comunicaciones cuando las redes convencionales fallan. Para operar, los interesados deben
                obtener su concesión ante el <strong>Instituto Federal de Telecomunicaciones (IFT)</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* ── MEDIOS DE DIFUSIÓN ───────────────────────────────────────── */}
        <section id="medios" style={{ padding: '64px 0 48px', borderTop: '1px solid #e8ecf0' }}>
          <SectionTitle accent={FMRE_GOLD}>Medios de Difusión</SectionTitle>
          <p style={{ color: '#555', fontSize: 16, lineHeight: 1.8, marginBottom: 40, maxWidth: 680 }}>
            La FMRE mantiene informada a su comunidad a través de tres canales principales que combinan
            la tradición del boletín escrito con la potencia de las ondas de radio.
          </p>

          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {[
              {
                icon: <FileTextOutlined style={{ fontSize: 36, color: FMRE_BLUE }} />,
                bg: FMRE_LIGHT,
                title: 'Boletín Escrito',
                subtitle: 'Publicación semanal dominical',
                color: FMRE_BLUE,
                desc: 'Cada domingo se publica el Boletín Dominical de la FMRE, documento oficial que contiene noticias, convocatorias, resultados de actividades y comunicados de la Federación. Disponible en el archivo histórico de la página oficial.',
                badge: 'Cada domingo',
                items: ['Noticias de la Federación', 'Convocatorias y concursos', 'Actividades de asociaciones', 'Comunicados oficiales'],
              },
              {
                icon: <SoundOutlined style={{ fontSize: 36, color: '#52c41a' }} />,
                bg: '#f6ffed',
                title: 'Emisión del Boletín',
                subtitle: 'Transmisión en vivo por radio',
                color: '#389e0d',
                desc: 'El boletín dominical se transmite en vivo a través de la red de estaciones afiliadas a la FMRE todos los domingos en las mañanas. La transmisión se realiza en frecuencias de HF y a través de sistemas de enlace digital como AllStar Link.',
                badge: 'Domingos · 9:00–10:30 hrs',
                items: ['HF · 7.082 MHz SSB', 'AllStar Link · Nodo XE1LM', 'IRLP · Cobertura nacional', 'Redes sociales en vivo'],
              },
              {
                icon: <AudioOutlined style={{ fontSize: 36, color: '#722ed1' }} />,
                bg: '#f9f0ff',
                title: 'Retransmisión',
                subtitle: 'Red nacional de retransmisión',
                color: '#531dab',
                desc: 'La red de retransmisión permite que el boletín dominical llegue a todas las regiones del país. Las estaciones retransmisoras reproducen el contenido del boletín para asegurar cobertura nacional, incluyendo zonas de difícil acceso.',
                badge: 'Miércoles · 18:51–19:00 hrs',
                items: ['Cobertura nacional XE1/XE2/XE3', 'Estación coordinadora XE2BC', 'IRLP y AllStar Link', 'Redundancia en comunicaciones'],
              },
            ].map((m, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                border: `1px solid ${m.color}22`,
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ background: m.bg, padding: '28px 24px 20px', textAlign: 'center' }}>
                  <div style={{ marginBottom: 12 }}>{m.icon}</div>
                  <Tag color={m.color} style={{ fontWeight: 700, fontSize: 11, marginBottom: 8 }}>{m.badge}</Tag>
                  <h3 style={{ margin: '8px 0 4px', color: FMRE_DARK, fontWeight: 800, fontSize: 18 }}>{m.title}</h3>
                  <div style={{ color: '#888', fontSize: 13 }}>{m.subtitle}</div>
                </div>
                <div style={{ padding: '20px 24px', flex: 1 }}>
                  <p style={{ color: '#555', fontSize: 14, lineHeight: 1.75, margin: '0 0 16px' }}>{m.desc}</p>
                  <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
                    {m.items.map((item, j) => (
                      <li key={j} style={{ color: '#555', fontSize: 13, lineHeight: 1.8, marginBottom: 4 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── REGLAMENTACIÓN ───────────────────────────────────────────── */}
        <section id="reglamentacion" style={{ padding: '64px 0 48px', borderTop: '1px solid #e8ecf0' }}>
          <SectionTitle accent="#d4380d">Reglamentación</SectionTitle>

          {/* Alerta fraude */}
          <div style={{
            background: '#fff2f0', border: '2px solid #ffccc7', borderRadius: 16,
            padding: 28, marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <WarningOutlined style={{ color: '#cf1322', fontSize: 28, flexShrink: 0, marginTop: 2 }} />
              <div>
                <h3 style={{ margin: '0 0 10px', color: '#820014', fontWeight: 800, fontSize: 18 }}>
                  ⚠️ Advertencia: Fraudes en Redes Sociales
                </h3>
                <p style={{ margin: '0 0 10px', color: '#5c0011', fontSize: 14, lineHeight: 1.75 }}>
                  Se han detectado publicaciones <strong>falsas en redes sociales</strong> donde se solicita a
                  radioaficionados realizar depósitos bancarios para obtener sus constancias de registro o credenciales.
                  <strong> Estos anuncios son fraudulentos.</strong>
                </p>
                <p style={{ margin: 0, color: '#5c0011', fontSize: 14, lineHeight: 1.75 }}>
                  La FMRE <strong>nunca solicita pagos a través de redes sociales ni cuentas bancarias no oficiales.</strong>{' '}
                  Si recibes este tipo de mensajes, <strong>no deposites</strong> e infórmalo a{' '}
                  <a href="mailto:contacto@fmre.mx" style={{ color: '#820014', fontWeight: 700 }}>contacto@fmre.mx</a>.
                </p>
              </div>
            </div>
          </div>

          {/* Trámite IFT */}
          <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fffbe6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileTextOutlined style={{ color: '#d48806', fontSize: 22 }} />
              </div>
              <div>
                <Tag color="orange" style={{ fontWeight: 700, marginBottom: 4 }}>En proceso · IFT</Tag>
                <h3 style={{ margin: 0, color: FMRE_DARK, fontWeight: 800, fontSize: 17 }}>
                  Propuesta de Modificación a los Lineamientos para Constancias de Registro
                </h3>
              </div>
            </div>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.8, margin: '0 0 14px' }}>
              Actualmente se encuentra en proceso ante el <strong>Instituto Federal de Telecomunicaciones (IFT)</strong>{' '}
              una propuesta de modificación a los Lineamientos Generales para el Otorgamiento y Operación de las
              Constancias de Registro para Radioaficionados.
            </p>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.8, margin: '0 0 14px' }}>
              Este trámite es de suma importancia para la comunidad radioaficionada nacional, ya que determinará
              las nuevas condiciones para la obtención y renovación de concesiones. A la fecha,{' '}
              <strong>el proceso regulatorio aún no ha concluido</strong> y no existe una resolución oficial publicada.
            </p>
            <Alert
              type="info"
              showIcon
              message="Estado actual: En revisión por el IFT"
              description="La FMRE está participando activamente en el proceso de consulta y defensa de los intereses de los radioaficionados mexicanos. Te mantendremos informado a través de los canales oficiales cuando haya novedades."
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ background: '#f0f5ff', borderRadius: 12, padding: '16px 24px', border: '1px solid #adc6ff' }}>
            <p style={{ margin: 0, color: '#1d3557', fontSize: 14, lineHeight: 1.75 }}>
              📢 <strong>Canales oficiales de información:</strong> Únicamente confía en comunicados publicados en{' '}
              <a href="https://fmre.mx" target="_blank" rel="noopener noreferrer" style={{ color: FMRE_BLUE, fontWeight: 700 }}>fmre.mx</a>{' '}
              y en los boletines oficiales de la Federación. Suscríbete al boletín dominical para recibir las
              actualizaciones más recientes sobre este y otros temas regulatorios.
            </p>
          </div>
        </section>

        {/* ── AFILIACIÓN ───────────────────────────────────────────────── */}
        <section id="afiliacion" style={{ padding: '64px 0 80px', borderTop: '1px solid #e8ecf0' }}>
          <SectionTitle accent="#52c41a">Afiliación</SectionTitle>
          <p style={{ color: '#555', fontSize: 16, lineHeight: 1.8, marginBottom: 40, maxWidth: 680 }}>
            Únete a la Federación Mexicana de Radioexperimentadores y forma parte de la comunidad
            radioaficionada más grande de México. Tu afiliación nos fortalece como representantes
            ante las autoridades nacionales e internacionales.
          </p>

          {/* Costos */}
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 40 }}>
            {[
              { tipo: 'Radioaficionado Mexicano', costo: '$500', moneda: 'MXN', color: FMRE_BLUE, icon: '📡' },
              { tipo: 'Aspirante / SWL', costo: '$400', moneda: 'MXN', color: '#52c41a', icon: '🎧' },
              { tipo: 'Radioaficionado Extranjero', costo: '$25', moneda: 'USD', color: FMRE_GOLD, icon: '🌎' },
            ].map((c, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 14, padding: '24px 20px', textAlign: 'center',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: `2px solid ${c.color}33` }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: c.color }}>{c.costo}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{c.moneda} / año</div>
                <div style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>{c.tipo}</div>
              </div>
            ))}
          </div>

          {/* Pasos */}
          <div style={{ background: 'white', borderRadius: 16, padding: '32px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 24 }}>
            <h3 style={{ color: FMRE_DARK, fontWeight: 800, fontSize: 18, margin: '0 0 24px' }}>
              Proceso de Afiliación
            </h3>
            <Steps direction="vertical" size="small" current={-1}
              items={[
                {
                  title: <span style={{ fontWeight: 700 }}>Regístrate en el portal</span>,
                  description: 'Crea tu cuenta en este portal para acceder al formulario de solicitud de afiliación. El registro es gratuito.',
                  icon: <CheckCircleOutlined style={{ color: FMRE_BLUE }} />,
                },
                {
                  title: <span style={{ fontWeight: 700 }}>Realiza el pago de afiliación</span>,
                  description: (
                    <span>
                      Mediante PayPal (<a href="mailto:fmre-mexico@fmre.mx" style={{ color: FMRE_BLUE }}>fmre-mexico@fmre.mx</a>) o
                      depósito bancario HSBC Cta. 6538465225 / CLABE 021180065384652254 a nombre del Tesorero de la FMRE.
                      Guarda tu comprobante.
                    </span>
                  ),
                  icon: <CheckCircleOutlined style={{ color: FMRE_BLUE }} />,
                },
                {
                  title: <span style={{ fontWeight: 700 }}>Reúne tus documentos</span>,
                  description: 'Fotografía digital con fondo uniforme · Copia de INE/IFE · Certificado de aptitud IFT · Acta de entrega de concesión IFT (radioaficionados) · Comprobante de pago.',
                  icon: <CheckCircleOutlined style={{ color: FMRE_BLUE }} />,
                },
                {
                  title: <span style={{ fontWeight: 700 }}>Envía tu solicitud</span>,
                  description: (
                    <span>
                      Envía todos los documentos y el comprobante de pago a{' '}
                      <a href="mailto:afiliacion@fmre.mx" style={{ color: FMRE_BLUE, fontWeight: 700 }}>afiliacion@fmre.mx</a>{' '}
                      usando tu indicativo o nombre como referencia. Los formatos aceptados son jpeg, png, tiff y zip.
                    </span>
                  ),
                  icon: <CheckCircleOutlined style={{ color: FMRE_BLUE }} />,
                },
                {
                  title: <span style={{ fontWeight: 700 }}>Recibe tu credencial</span>,
                  description: 'Una vez procesada tu solicitud, recibirás tu credencial digital de afiliado a la FMRE y quedarás registrado como miembro activo de la federación.',
                  icon: <CheckCircleOutlined style={{ color: FMRE_BLUE }} />,
                },
              ]}
            />
          </div>

          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <a href={`${EQMS_URL}/login`} style={{ textDecoration: 'none' }}>
              <button style={{
                background: `linear-gradient(135deg, ${FMRE_BLUE}, #2563a8)`,
                color: 'white', border: 'none', borderRadius: 10,
                padding: '14px 36px', fontSize: 16, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,86,158,0.35)',
                letterSpacing: 0.5,
              }}>
                Regístrate en el Portal para Afiliarte
              </button>
            </a>
            <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>
              ¿Ya tienes cuenta?{' '}
              <a href={`${EQMS_URL}/login`} style={{ color: FMRE_BLUE, fontWeight: 600 }}>Inicia sesión aquí</a>
            </p>
          </div>
        </section>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ background: FMRE_DARK, padding: '40px 32px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'grid', gap: 32, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 32 }}>
            <div>
              <img src="/LogoFMRE.png" alt="FMRE" style={{ height: 48, marginBottom: 12 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <p style={{ color: '#8ab4e0', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                Federación Mexicana de Radioexperimentadores, A.C.<br />
                Miembro de la IARU Región 2
              </p>
            </div>
            <div>
              <h4 style={{ color: FMRE_GOLD, fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Secciones</h4>
              {NAV.map(n => (
                <button key={n.id} onClick={() => scrollTo(n.id)}
                  style={{ display: 'block', background: 'none', border: 'none', color: '#8ab4e0',
                    fontSize: 13, padding: '3px 0', cursor: 'pointer', textAlign: 'left' }}>
                  {n.label}
                </button>
              ))}
            </div>
            <div>
              <h4 style={{ color: FMRE_GOLD, fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Contacto</h4>
              <div style={{ color: '#8ab4e0', fontSize: 13, lineHeight: 2 }}>
                <div><MailOutlined style={{ marginRight: 8 }} />contacto@fmre.mx</div>
                <div><PhoneOutlined style={{ marginRight: 8 }} />55 5563 1405</div>
                <div><GlobalOutlined style={{ marginRight: 8 }} />fmre.mx</div>
                <div style={{ marginTop: 4, color: '#6a8fad', fontSize: 12 }}>
                  Av. Molinos 51 int. 307 y 308<br />
                  Mixcoac, Ciudad de México
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20,
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: '#4a6fa5', fontSize: 12 }}>
              © 2026 Federación Mexicana de Radioexperimentadores, A.C.
            </span>
            <span style={{ color: FMRE_GOLD, fontSize: 12, fontWeight: 700 }}>
              73 de XE — Good DX
            </span>
          </div>
        </div>
      </footer>

    </div>
  )
}
