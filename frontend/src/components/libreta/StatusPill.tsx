interface StatusPillProps {
  label: string
  color: string
  pulse?: boolean
}

/** Badge de estado compacto (ONLINE/OFFLINE/TX ACTIVO/etc.), con pulso opcional. */
export default function StatusPill({ label, color, pulse }: StatusPillProps) {
  return (
    <span style={{
      background: color, color: '#fff', fontWeight: 700, fontSize: 10,
      padding: '2px 8px', borderRadius: 10, letterSpacing: 0.4, whiteSpace: 'nowrap',
      animation: pulse ? 'pulse-red 0.8s ease-in-out infinite' : undefined,
    }}>● {label}</span>
  )
}
