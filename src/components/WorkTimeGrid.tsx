import { useEffect, useRef, useState, type CSSProperties } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import viLocale from '@fullcalendar/core/locales/vi'
import type { EventInput } from '@fullcalendar/core'
import { addDays, timeToMinutes, workTimeRange } from '../lib/schedule.ts'
import { EMPLOYEE_TYPE_LABEL, type WorkAssignment, type WorkPreference, type WorkShift } from '../services/workShifts.ts'

const plugins = [timeGridPlugin, interactionPlugin]
const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'UTC' })
const zoomLevels = [
  { minutes: 120, height: 88, label: '2 giờ/ô' },
  { minutes: 60, height: 60, label: '1 giờ/ô' },
  { minutes: 30, height: 42, label: '30 phút/ô' },
]

type Props = {
  week: string
  today: string
  shifts: WorkShift[]
  assignments: WorkAssignment[]
  rangeAssignments: WorkAssignment[]
  daysOff: WorkPreference[]
  personName: (personId: string) => string
  onAdd?: (shiftId: string, date: string) => void
  onDetail: (item: WorkAssignment) => void
}

export default function WorkTimeGrid({ week, today, shifts, assignments, rangeAssignments, daysOff, personName, onAdd, onDetail }: Props) {
  const calendar = useRef<FullCalendar>(null)
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = zoomLevels[zoomIndex]
  const range = workTimeRange([...shifts, ...rangeAssignments])
  const assignmentsById = new Map(assignments.map((item) => [item.id, item]))
  const events: EventInput[] = [
    ...assignments.map((item) => ({
      id: item.id,
      title: item.personName || personName(item.personId),
      start: `${item.date}T${item.start}`,
      end: `${item.end < item.start ? addDays(item.date, 1) : item.date}T${item.end}`,
      classNames: [`hrm-event-${item.employeeType || 'other'}`],
      interactive: true,
    })),
    ...daysOff.map((item) => ({
      title: personName(item.personId),
      start: item.date,
      allDay: true,
      interactive: false,
      classNames: ['hrm-event-off'],
    })),
  ]

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const api = calendar.current?.getApi()
      if (api && api.getDate().toISOString().slice(0, 10) !== week) api.gotoDate(week)
    })
    return () => cancelAnimationFrame(frame)
  }, [week])

  const openAt = (date: string, minutes: number) => {
    const shift = shifts.find((item) => {
      const start = timeToMinutes(item.start)
      const end = timeToMinutes(item.end)
      return end < start ? minutes >= start || minutes < end : minutes >= start && minutes < end
    }) ?? shifts[0]
    if (shift) onAdd?.(shift.id, date)
  }

  const addForWeek = () => {
    const shift = shifts[0]
    if (!shift) return
    const date = today >= week && today <= addDays(week, 6) ? today : week
    onAdd?.(shift.id, date)
  }

  return (
    <div className="hrm-timegrid">
      <div className="hrm-grid-toolbar">
        <div className="hrm-grid-legend" aria-label="Chú thích lịch">
          <strong>{assignments.filter((item) => item.date >= week).length} ca làm</strong>
          <span className="hrm-legend-sale">Sale</span>
          <span className="hrm-legend-cskh">CSKH</span>
          <span className="hrm-legend-off">Ngày nghỉ</span>
        </div>
        <div className="hrm-grid-actions">
          <div className="hrm-zoom" role="group" aria-label="Thu phóng lịch">
            <button type="button" aria-label="Thu nhỏ lịch" disabled={zoomIndex === 0} onClick={() => setZoomIndex(zoomIndex - 1)}>−</button>
            <output aria-live="polite">{zoom.label}</output>
            <button type="button" aria-label="Phóng to lịch" disabled={zoomIndex === zoomLevels.length - 1} onClick={() => setZoomIndex(zoomIndex + 1)}>+</button>
          </div>
          {onAdd && <button type="button" className="hrm-add" disabled={!shifts.length} onClick={addForWeek}>+ Thêm ca làm</button>}
        </div>
      </div>
      <div className="hrm-calendar-scroll" role="region" aria-label="Lịch theo ngày và giờ" tabIndex={0}>
        <div className="hrm-calendar" style={{ '--hrm-slot-height': `${zoom.height}px` } as CSSProperties}>
          <FullCalendar
            ref={calendar}
            plugins={plugins}
            locale={viLocale}
            timeZone="UTC"
            now={today}
            initialView="timeGridWeek"
            initialDate={week}
            firstDay={1}
            headerToolbar={false}
            height={610}
            allDayContent="OFF"
            dayMaxEvents={3}
            slotMinTime={{ minutes: range.start }}
            slotMaxTime={{ minutes: range.end }}
            scrollTime={{ minutes: range.start }}
            scrollTimeReset={false}
            slotDuration={{ minutes: zoom.minutes }}
            slotLabelInterval={{ minutes: zoom.minutes }}
            snapDuration="00:15:00"
            slotLabelContent={({ date }) => date.toISOString().slice(11, 16)}
            dayHeaderContent={({ date }) => {
              const iso = date.toISOString()
              return (
                <div className="hrm-calendar-day">
                  <span>{weekday.format(date)}</span>
                  <strong>{iso.slice(8, 10)}<small>/{iso.slice(5, 7)}</small></strong>
                </div>
              )
            }}
            eventMinHeight={24}
            eventMaxStack={3}
            slotEventOverlap={false}
            events={events}
            dateClick={({ allDay, date }) => {
              if (!allDay) openAt(date.toISOString().slice(0, 10), date.getUTCHours() * 60 + date.getUTCMinutes())
            }}
            eventClick={({ event }) => {
              const item = assignmentsById.get(event.id)
              if (item) onDetail(item)
            }}
            eventDidMount={({ el, event }) => {
              const item = assignmentsById.get(event.id)
              el.title = item ? `${event.title} · ${item.start}–${item.end}` : event.title
            }}
            eventContent={({ event }) => {
              const item = assignmentsById.get(event.id)
              if (!item) return <div className="hrm-off-label">{event.title}</div>
              return (
                <div className="hrm-event-label">
                  <strong>{event.title}</strong>
                  <span>{item.start}–{item.end}</span>
                  <small>{shifts.find((shift) => shift.id === item.shiftId)?.name || (item.employeeType && EMPLOYEE_TYPE_LABEL[item.employeeType])}</small>
                </div>
              )
            }}
          />
        </div>
      </div>
      <footer className="hrm-grid-footer">
        {onAdd ? 'Bấm ô giờ để thêm ca · Bấm vào ca để xem chi tiết' : 'Bấm vào ca để xem chi tiết'}
      </footer>
    </div>
  )
}
