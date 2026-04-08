import { useState, useCallback, useMemo, useRef } from 'react'

const ResizeHandle = ({
  onResize,
  width,
}: {
  onResize: (w: number) => void
  width: number
}) => {
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  return (
    <span
      title=""
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 20,
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={e => {
        e.preventDefault()
        e.stopPropagation()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        dragging.current = true
        startX.current = e.clientX
        startW.current = width
      }}
      onPointerMove={e => {
        if (!dragging.current) return
        const newW = Math.max(startW.current + e.clientX - startX.current, 40)
        onResize(newW)
      }}
      onPointerUp={e => {
        dragging.current = false
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      }}
      // Visual indicator on hover
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderRight = '2px solid #1677ff'
      }}
      onMouseLeave={e => {
        if (!dragging.current)
          (e.currentTarget as HTMLElement).style.borderRight = 'none'
      }}
    />
  )
}

const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props
  if (!width || !onResize) return <th {...restProps} />

  return (
    <th
      {...restProps}
      style={{
        ...restProps.style,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {restProps.children}
      <ResizeHandle onResize={onResize} width={width} />
    </th>
  )
}

export function useResizableColumns(initialWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(initialWidths)

  const handleResize = useCallback(
    (index: number) => (newWidth: number) => {
      setWidths(prev => {
        const next = [...prev]
        next[index] = newWidth
        return next
      })
    },
    []
  )

  const applyWidths = useCallback(
    (columns: any[]) =>
      columns.map((col, i) => ({
        ...col,
        width: widths[i] ?? col.width,
        onHeaderCell: () => ({
          width: widths[i] ?? col.width,
          onResize: handleResize(i),
        }),
      })),
    [widths, handleResize]
  )

  const components = useMemo(() => ({ header: { cell: ResizableTitle } }), [])

  return { applyWidths, components }
}
