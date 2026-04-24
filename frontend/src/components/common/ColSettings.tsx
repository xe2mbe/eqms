/**
 * Reusable column visibility + ordering for Ant Design Tables.
 *
 * Usage:
 *   const { colOrder, colVisible, handleColChange, colSettingsButton } =
 *     useColPrefs('my_table', userId, ALL_KEYS, LOCKED_KEYS, LABELS)
 *
 *   const columns = colOrder
 *     .filter(k => colVisible.includes(k))
 *     .map(k => colDefs[k])
 */

import { useState, useRef, useEffect } from 'react'
import { Popover, Checkbox, Button, Tooltip } from 'antd'
import { SettingOutlined, HolderOutlined } from '@ant-design/icons'

// ─── Persistence ─────────────────────────────────────────────────────────────

interface ColPrefs<K extends string> {
  order: K[]
  visible: K[]
}

function loadPrefs<K extends string>(key: string, allKeys: readonly K[]): ColPrefs<K> {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as ColPrefs<K>
      const validOrder = parsed.order.filter(k => (allKeys as readonly string[]).includes(k)) as K[]
      const missing = allKeys.filter(k => !validOrder.includes(k))
      return {
        order: [...validOrder, ...missing],
        visible: [
          ...parsed.visible.filter(k => (allKeys as readonly string[]).includes(k)),
          ...missing,
        ] as K[],
      }
    }
  } catch { /* ignore */ }
  return { order: [...allKeys], visible: [...allKeys] }
}

function savePrefs<K extends string>(key: string, prefs: ColPrefs<K>) {
  localStorage.setItem(key, JSON.stringify(prefs))
}

// ─── Popover content ──────────────────────────────────────────────────────────

interface ColSettingsContentProps<K extends string> {
  order: K[]
  visible: K[]
  locked: K[]
  labels: Record<K, string>
  onChange: (order: K[], visible: K[]) => void
}

function ColSettingsContent<K extends string>({
  order, visible, locked, labels, onChange,
}: ColSettingsContentProps<K>) {
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const handleDrop = () => {
    if (dragItem.current === null || dragOver.current === null) return
    if (dragItem.current === dragOver.current) { dragItem.current = null; dragOver.current = null; return }
    const newOrder = [...order]
    const dragged = newOrder.splice(dragItem.current, 1)[0]
    newOrder.splice(dragOver.current, 0, dragged)
    const lockedPart = newOrder.filter(k => locked.includes(k))
    const freePart = newOrder.filter(k => !locked.includes(k))
    dragItem.current = null
    dragOver.current = null
    onChange([...lockedPart, ...freePart], visible)
  }

  const toggleVisible = (key: K, checked: boolean) => {
    if (locked.includes(key)) return
    const newVisible = checked ? [...visible, key] : visible.filter(k => k !== key)
    onChange(order, newVisible)
  }

  return (
    <div style={{ width: 230 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Arrastra para reordenar · marca para mostrar
      </div>
      {order.map((key, idx) => {
        const isLocked = locked.includes(key)
        return (
          <div
            key={key}
            draggable={!isLocked}
            onDragStart={() => { dragItem.current = idx }}
            onDragEnter={() => { dragOver.current = idx }}
            onDragEnd={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 4px', borderRadius: 4,
              cursor: isLocked ? 'default' : 'grab',
              userSelect: 'none',
            }}
            onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <HolderOutlined style={{ color: isLocked ? '#ddd' : '#aaa', fontSize: 13 }} />
            <Checkbox
              checked={visible.includes(key)}
              disabled={isLocked}
              onChange={e => toggleVisible(key, e.target.checked)}
            />
            <span style={{ fontSize: 13, color: isLocked ? '#999' : undefined }}>
              {labels[key]}
              {isLocked && <span style={{ fontSize: 11, color: '#bbb', marginLeft: 4 }}>(fijo)</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useColPrefs<K extends string>(
  tableId: string,
  userId: number | undefined,
  allKeys: readonly K[],
  lockedKeys: K[],
  labels: Record<K, string>,
) {
  const storageKey = userId ? `col_prefs_${tableId}_${userId}` : null
  const loaded = useRef(false)

  const [colOrder, setColOrder] = useState<K[]>([...allKeys])
  const [colVisible, setColVisible] = useState<K[]>([...allKeys])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (storageKey && !loaded.current) {
      const prefs = loadPrefs<K>(storageKey, allKeys)
      setColOrder(prefs.order)
      setColVisible(prefs.visible)
      loaded.current = true
    }
  }, [storageKey])

  const handleColChange = (newOrder: K[], newVisible: K[]) => {
    setColOrder(newOrder)
    setColVisible(newVisible)
    if (storageKey) savePrefs(storageKey, { order: newOrder, visible: newVisible })
  }

  const colSettingsButton = (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      title="Columnas visibles y orden"
      content={
        <ColSettingsContent
          order={colOrder}
          visible={colVisible}
          locked={lockedKeys}
          labels={labels}
          onChange={handleColChange}
        />
      }
    >
      <Tooltip title="Configurar columnas">
        <Button icon={<SettingOutlined />} />
      </Tooltip>
    </Popover>
  )

  return { colOrder, colVisible, handleColChange, colSettingsButton }
}
