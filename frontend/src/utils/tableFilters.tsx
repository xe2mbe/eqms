import { Button, Input, Space } from 'antd'
import { SearchOutlined, FilterOutlined } from '@ant-design/icons'

type FilterDropdownProps = {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}

/** Filtro de texto con caja de búsqueda — para columnas de texto libre */
export function textFilterProps(dataIndex: string) {
  return {
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
      <div style={{ padding: 8 }} onKeyDown={e => e.stopPropagation()}>
        <Input
          autoFocus
          placeholder="Buscar..."
          value={selectedKeys[0] as string ?? ''}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: 'block', width: 200 }}
        />
        <Space>
          <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm()}>
            Filtrar
          </Button>
          <Button size="small" onClick={() => { clearFilters?.(); confirm() }}>
            Limpiar
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
    ),
    onFilter: (value: unknown, record: Record<string, unknown>) =>
      record[dataIndex]?.toString().toLowerCase().includes(String(value).toLowerCase()) ?? false,
  }
}

/** Filtro de selección con checklist — para columnas categóricas */
export function selectFilterProps<T extends Record<string, unknown>>(
  options: { text: string; value: string }[],
  onFilter: (value: unknown, record: T) => boolean,
) {
  return {
    filters: options,
    filterSearch: options.length > 6,
    filterIcon: (filtered: boolean) => (
      <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
    ),
    onFilter,
  }
}

/** Extrae valores únicos de un array de objetos para usar como opciones de filtro */
export function uniqueFilterOptions(
  data: Record<string, unknown>[],
  getValue: (r: Record<string, unknown>) => string | null | undefined,
): { text: string; value: string }[] {
  const seen = new Set<string>()
  const opts: { text: string; value: string }[] = []
  for (const row of data) {
    const v = getValue(row)
    if (v && !seen.has(v)) {
      seen.add(v)
      opts.push({ text: v, value: v })
    }
  }
  return opts.sort((a, b) => a.text.localeCompare(b.text))
}
