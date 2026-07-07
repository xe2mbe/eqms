import { useEffect, useRef, useState } from 'react'

interface AnimatedCountProps {
  target: number
  suffix?: string
}

/** Contador animado (0 → target) usado en las tarjetas de estadísticas del HERO de PublicFMRE. */
export default function AnimatedCount({ target, suffix = '' }: AnimatedCountProps) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    let start: number | null = null
    const duration = 1200
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(progress * target))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return <span>{val.toLocaleString()}{suffix}</span>
}
