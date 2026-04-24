import { useEffect, useState } from 'react'
import { DatePicker, Select, Space } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import client from '@/api/client'
import type { Evento } from '@/types'

const { RangePicker } = DatePicker

interface Props {
  value: [string, string]
  onChange: (range: [string, string]) => void
  ultimoEventoEndpoint?: string
  evento?: number
  onEventoChange?: (evento: number | undefined) => void
}

function getMonday(d: Dayjs): Dayjs {
  const dow = d.day()
  const daysBack = dow === 0 ? 6 : dow - 1
  return d.subtract(daysBack, 'day').startOf('day')
}

export default function DateRangeBar({ value, onChange, ultimoEventoEndpoint, evento, onEventoChange }: Props) {
  const [ultimoEvento, setUltimoEvento] = useState<Dayjs | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])

  useEffect(() => {
    if (!ultimoEventoEndpoint) return
    client.get<{ fecha: string | null }>(ultimoEventoEndpoint)
      .then(r => { if (r.data.fecha) setUltimoEvento(dayjs(r.data.fecha)) })
      .catch(() => {})
  }, [ultimoEventoEndpoint])

  useEffect(() => {
    if (!onEventoChange) return
    client.get<Evento[]>('/catalogos/eventos')
      .then(r => setEventos(r.data))
      .catch(() => {})
  }, [])

  const today      = dayjs()
  const thisMonday = getMonday(today)
  const lastMonday = thisMonday.subtract(7, 'day')
  const lastSunday = thisMonday.subtract(1, 'day')

  const presets: { label: string; value: [Dayjs, Dayjs] }[] = [
    { label: 'Hoy',             value: [today.startOf('day'),                                        today] },
    { label: 'Esta semana',     value: [thisMonday,                                                  today] },
    { label: 'Semana anterior', value: [lastMonday,                                                  lastSunday] },
    { label: 'Este mes',        value: [today.startOf('month'),                                      today] },
    { label: 'Mes anterior',    value: [today.subtract(1,'month').startOf('month'),  today.subtract(1,'month').endOf('month')] },
    { label: 'Últimos 90 días', value: [today.subtract(90,'day'),                                   today] },
    { label: 'Este año',        value: [today.startOf('year'),                                       today] },
    { label: 'Año anterior',    value: [today.subtract(1,'year').startOf('year'),    today.subtract(1,'year').endOf('year')] },
    { label: 'Todos',           value: [dayjs('2020-01-01'),                                        today] },
    ...(ultimoEvento
      ? [{ label: 'Último evento', value: [ultimoEvento.startOf('day'), ultimoEvento.endOf('day')] as [Dayjs, Dayjs] }]
      : []),
  ]

  return (
    <Space>
      {onEventoChange && (
        <Select
          allowClear
          placeholder="Todos los eventos"
          style={{ width: 200 }}
          value={evento}
          onChange={onEventoChange}
          options={eventos.map(e => ({
            value: e.id,
            label: (
              <span>
                {e.color && (
                  <span style={{
                    display: 'inline-block', width: 10, height: 10,
                    borderRadius: '50%', backgroundColor: e.color,
                    marginRight: 6, verticalAlign: 'middle',
                  }} />
                )}
                {e.tipo}
              </span>
            ),
          }))}
        />
      )}
      <RangePicker
        value={[dayjs(value[0]), dayjs(value[1])]}
        presets={presets}
        onChange={(dates) => {
          if (dates?.[0] && dates?.[1])
            onChange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
        }}
      />
    </Space>
  )
}
