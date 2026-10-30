import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatCalendarDate, formatEventEnd, getLondonDate, getMonthCells, isDate, shiftMonth } from './domain'
import type { CalendarEvent, LifeArea } from './model'

interface CalendarProps {
  events: CalendarEvent[]
  lifeAreas: LifeArea[]
  onChange: (events: CalendarEvent[]) => void
}

function EventEditor({ initialEvent, isNew, lifeAreas, onSave, onCancel }: {
  initialEvent: CalendarEvent
  isNew: boolean
  lifeAreas: LifeArea[]
  onSave: (event: CalendarEvent) => void
  onCancel: () => void
}) {
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    const title = value('title')
    const date = value('date')
    const startTime = value('startTime')
    const durationMinutes = Number(value('durationMinutes'))
    const lifeAreaId = value('lifeAreaId')
    if (!title || !isDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)
      || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440
      || !lifeAreas.some((area) => area.id === lifeAreaId)) {
      setError('Enter a title, valid date and time, duration from 1 to 1440 whole minutes, and a life area.')
      return
    }
    onSave({ ...initialEvent, title, date, startTime, durationMinutes, lifeAreaId, notes: value('notes') })
  }

  return (
    <section className="event-editor" aria-labelledby="event-editor-title">
      <h2 id="event-editor-title">{isNew ? 'Add event' : 'Edit event'}</h2>
      <form onSubmit={submit} onChange={() => setError('')} aria-describedby={error ? 'event-error' : undefined}>
        <div className="event-field">
          <label htmlFor="event-title">Title</label>
          <input id="event-title" name="title" autoFocus required maxLength={10000} defaultValue={initialEvent.title} />
        </div>
        <div className="event-fields">
          <div className="event-field">
            <label htmlFor="event-date">Date</label>
            <input id="event-date" name="date" type="date" required min="0001-01-01" max="9999-12-31" defaultValue={initialEvent.date} />
          </div>
          <div className="event-field">
            <label htmlFor="event-time">Start time (London)</label>
            <input id="event-time" name="startTime" type="time" required step={60} defaultValue={initialEvent.startTime} />
          </div>
          <div className="event-field">
            <label htmlFor="event-duration">Duration (minutes)</label>
            <input id="event-duration" name="durationMinutes" type="number" required min={1} max={1440} step={1} defaultValue={initialEvent.durationMinutes || ''} />
          </div>
        </div>
        <div className="event-field">
          <label htmlFor="event-area">Life area</label>
          <select id="event-area" name="lifeAreaId" required defaultValue={initialEvent.lifeAreaId}>
            <option value="" disabled>Choose a life area</option>
            {lifeAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </div>
        <div className="event-field">
          <label htmlFor="event-notes">Notes (optional)</label>
          <textarea id="event-notes" name="notes" rows={3} maxLength={10000} defaultValue={initialEvent.notes} />
        </div>
        {error && <p id="event-error" className="field-error" role="alert">{error}</p>}
        <div className="event-actions">
          <button type="submit" className="primary">Save event</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  )
}

export default function Calendar({ events, lifeAreas, onChange }: CalendarProps) {
  const today = getLondonDate()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [editor, setEditor] = useState<{ event: CalendarEvent; isNew: boolean } | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const monthLabel = formatCalendarDate(`${month}-01`, { month: 'long', year: 'numeric' })
  const monthEvents = events.filter((event) => event.date.startsWith(`${month}-`))
    .sort((first, second) => first.date.localeCompare(second.date)
      || first.startTime.localeCompare(second.startTime) || first.title.localeCompare(second.title))
  const cells = getMonthCells(month)
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
  const agendaDates = [...new Set(monthEvents.map((event) => event.date))]

  function addEvent(date: string) {
    if (editor && !window.confirm('Discard the open event form?')) return
    setEditorVersion((value) => value + 1)
    setMessage('')
    setEditor({
      isNew: true,
      event: { id: crypto.randomUUID(), title: '', date, startTime: '', durationMinutes: 0, lifeAreaId: '', notes: '' },
    })
  }

  function editEvent(event: CalendarEvent) {
    if (editor && !window.confirm('Discard the open event form?')) return
    setEditorVersion((value) => value + 1)
    setMessage('')
    setEditor({ event, isNew: false })
  }

  function closeEditor() {
    setEditor(null)
    addButton.current?.focus()
  }

  function saveEvent(event: CalendarEvent) {
    const next = editor?.isNew ? [...events, event] : events.map((item) => item.id === event.id ? event : item)
    onChange(next)
    setMonth(event.date.slice(0, 7))
    setMessage(editor?.isNew ? 'Event added.' : 'Event updated.')
    closeEditor()
  }

  function deleteEvent(event: CalendarEvent) {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    onChange(events.filter((item) => item.id !== event.id))
    if (editor?.event.id === event.id) closeEditor()
    setMessage('Event deleted.')
    addButton.current?.focus()
  }

  return (
    <section className="calendar" aria-label="Calendar">
      <div className="calendar-toolbar">
        <div className="month-controls">
          <button type="button" className="icon-button" title="Previous month" aria-label="Previous month" disabled={month === '0001-01'} onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2 id="month-title" aria-live="polite">{monthLabel}</h2>
          <button type="button" className="icon-button" title="Next month" aria-label="Next month" disabled={month === '9999-12'} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="event-actions">
          <button type="button" className="secondary" onClick={() => setMonth(getLondonDate().slice(0, 7))}>
            <CalendarDays size={18} aria-hidden="true" /> Today
          </button>
          <button ref={addButton} type="button" className="primary" onClick={() => addEvent(today.startsWith(month) ? today : `${month}-01`)}>
            <Plus size={18} aria-hidden="true" /> Add event
          </button>
        </div>
      </div>
      <p className="calendar-context">Europe/London - Plans only, not actual time logged.</p>
      <p className="calendar-message" role="status">{message}</p>
      {editor && (
        <EventEditor key={editorVersion} initialEvent={editor.event} isNew={editor.isNew} lifeAreas={lifeAreas} onSave={saveEvent} onCancel={closeEditor} />
      )}
      <table className="month-grid" aria-labelledby="month-title">
        <thead>
          <tr>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
            <th key={day} scope="col"><abbr title={day}>{day.slice(0, 3)}</abbr></th>
          ))}</tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={index}>
              {week.map((date, dayIndex) => {
                const dayEvents = date ? monthEvents.filter((event) => event.date === date) : []
                return (
                  <td key={date ?? `blank-${dayIndex}`} className={date === null ? 'outside-month' : date === today ? 'today-cell' : undefined}>
                    {date && (
                      <>
                        <button type="button" className="day-number" aria-current={date === today ? 'date' : undefined} aria-label={`Add event on ${formatCalendarDate(date)}${dayEvents.length ? `, ${dayEvents.length} existing events` : ''}`} onClick={() => addEvent(date)}>
                          {Number(date.slice(8))}
                        </button>
                        <div className="day-previews">
                          {dayEvents.slice(0, 2).map((event) => (
                            <button key={event.id} type="button" className="event-preview" title={`Edit ${event.title}`} aria-label={`Edit ${event.title}, ${event.startTime}`} onClick={() => editEvent(event)}>
                              <span>{event.startTime}</span> {event.title}
                            </button>
                          ))}
                          {dayEvents.length > 2 && <span className="more-events">+{dayEvents.length - 2} more in agenda</span>}
                        </div>
                        {dayEvents.length > 0 && <span className="mobile-event-count">{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</span>}
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <section className="agenda" aria-labelledby="agenda-title">
        <div className="agenda-heading">
          <h2 id="agenda-title">Agenda</h2>
          <span>{monthLabel} - {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}</span>
        </div>
        {monthEvents.length === 0 && <p className="agenda-empty">No events this month.</p>}
        {agendaDates.map((date) => (
          <section className="agenda-day" key={date} aria-label={formatCalendarDate(date)}>
            <h3>{formatCalendarDate(date)}</h3>
            <ul>
              {monthEvents.filter((event) => event.date === date).map((event) => (
                <li key={event.id} className="agenda-event">
                  <div className="agenda-event-content">
                    <p className="event-time">{event.startTime} - {formatEventEnd(event)} <span>({event.durationMinutes} min)</span></p>
                    <h4>{event.title}</h4>
                    <p className="event-area">{lifeAreas.find((area) => area.id === event.lifeAreaId)?.name}</p>
                    {event.notes && <p className="event-notes">{event.notes}</p>}
                  </div>
                  <div className="event-actions">
                    <button type="button" className="icon-button" title="Edit event" aria-label={`Edit ${event.title}`} onClick={() => editEvent(event)}><Pencil size={18} aria-hidden="true" /></button>
                    <button type="button" className="icon-button delete-event" title="Delete event" aria-label={`Delete ${event.title}`} onClick={() => deleteEvent(event)}><Trash2 size={18} aria-hidden="true" /></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </section>
  )
}