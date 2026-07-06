import { useState, useRef, useEffect } from 'react'
import { Input } from 'antd'

interface IndicativoCellProps {
  value: string
  rowKey: string
  onCommit: (key: string, nuevo: string, anterior: string) => void
}

/**
 * Celda editable de indicativo (estado local — no re-renderiza al padre
 * durante tipeo). Compartida por Libreta (RF) y LibretaRS.
 */
export default function IndicativoCell({ value, rowKey, onCommit }: IndicativoCellProps) {
  const [local, setLocal] = useState(value)
  const originalRef = useRef(value)
  useEffect(() => { setLocal(value); originalRef.current = value }, [value])
  return (
    <Input
      size="small"
      value={local}
      variant="borderless"
      onChange={e => setLocal(e.target.value.toUpperCase())}
      onBlur={() => onCommit(rowKey, local.trim().toUpperCase(), originalRef.current)}
      style={{ fontWeight: 700, color: '#1A569E', fontSize: 14 }}
    />
  )
}
