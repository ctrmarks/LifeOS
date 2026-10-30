import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { formatCalendarDate, formatDuration, getLondonDate, getWeeklyTime, getWeekRange, hoursInput, isDate, parseHours, sumSafe } from './domain'
import type { CompassData, LifeArea, TimeLog } from './model'

function TimeLogEditor({ log, isNew, areas, onSave, onCancel }: {
  log: TimeLog; isNew: boolean; areas: LifeArea[]
  onSave: (log: TimeLog) => void; onCancel: () => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const date = String(form.get('date') ?? '')
    const lifeAreaId = String(form.get('lifeAreaId') ?? '')
    const durationMinutes = Number(form.get('durationMinutes'))
    try {
      if (!isDate(date)) throw new Error('Choose a valid date.')
      getWeekRange(date)
      if (!areas.some((area) => area.id === lifeAreaId)) throw new Error('Choose a life area.')
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) throw new Error('Enter 1 to 1440 whole minutes.')
      onSave({ ...log, date, lifeAreaId, durationMinutes })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The time log could not be saved.')
    }
  }
  return (
    <section className="event-editor" aria-labelledby="log-editor-title">
      <h3 id="log-editor-title">{isNew ? 'Add time log' : 'Edit time log'}</h3>
      <form onSubmit={submit} onChange={() => setError('')}>
        <div className="event-fields">
          <div className="event-field"><label htmlFor="log-date">Log date</label><input id="log-date" name="date" type="date" min="0001-01-01" max="9999-12-26" autoFocus required defaultValue={log.date} /></div>
          <div className="event-field"><label htmlFor="log-duration">Duration (minutes)</label><input id="log-duration" name="durationMinutes" type="number" min={1} max={1440} step={1} required defaultValue={log.durationMinutes || ''} /></div>
          <div className="event-field"><label htmlFor="log-area">Time-log life area</label><select id="log-area" name="lifeAreaId" required defaultValue={log.lifeAreaId}><option value="" disabled>Choose a life area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="event-actions"><button className="primary" type="submit">Save time log</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button></div>
      </form>
    </section>
  )
}

export default function CompassTime({ data, onChange }: { data: CompassData; onChange: (data: CompassData) => void }) {
  const today = getLondonDate()
  const [selectedDate, setSelectedDate] = useState(today)
  const [editor, setEditor] = useState<{ log: TimeLog; isNew: boolean } | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const addButton = useRef<HTMLButtonElement>(null)
  const summary = getWeeklyTime(data, selectedDate)
  const unestimated = data.compassItems.filter((item) => item.status === 'active' && item.planningRole === 'activity' && item.weeklyMinutes === null)
  const logs = data.timeLogs.filter((log) => log.date >= summary.start && log.date <= summary.end)
    .sort((first, second) => first.date.localeCompare(second.date) || first.id.localeCompare(second.id))
  const makerArea = data.lifeAreas.find((area) => area.id === data.weeklySettings.makerAreaId)!

  function chooseWeek(date: string) {
    if (!isDate(date)) return
    try {
      getWeekRange(date)
      if (editor && !window.confirm('Discard the open time-log form?')) return
      setSelectedDate(date)
      setEditor(null)
      setError('')
      setMessage('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Choose a valid week.')
    }
  }
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const availableMinutes = parseHours(String(form.get('available') ?? ''))
      const makerTargetMinutes = parseHours(String(form.get('target') ?? ''))
      const makerAreaId = String(form.get('makerAreaId') ?? '')
      if (!data.lifeAreas.some((area) => area.id === makerAreaId)) throw new Error('Choose a maker-project life area.')
      onChange({ ...data, weeklySettings: { availableMinutes, makerTargetMinutes, makerAreaId } })
      setError('')
      setMessage('Weekly settings updated.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Settings could not be saved.')
    }
  }
  function openLog(log: TimeLog, isNew: boolean) {
    if (editor && !window.confirm('Discard the open time-log form?')) return
    setEditorVersion((value) => value + 1)
    setEditor({ log, isNew })
    setError('')
    setMessage('')
  }
  function closeEditor() {
    setEditor(null)
    addButton.current?.focus()
  }
  function saveLog(log: TimeLog) {
    const timeLogs = editor?.isNew ? [...data.timeLogs, log] : data.timeLogs.map((entry) => entry.id === log.id ? log : entry)
    sumSafe(timeLogs.map((entry) => entry.durationMinutes))
    onChange({ ...data, timeLogs })
    setSelectedDate(log.date)
    setMessage('Time log updated.')
    closeEditor()
  }
  function deleteLog(log: TimeLog) {
    if (!window.confirm(`Delete the ${log.durationMinutes}-minute time log on ${formatCalendarDate(log.date)}? This cannot be undone.`)) return
    onChange({ ...data, timeLogs: data.timeLogs.filter((entry) => entry.id !== log.id) })
    if (editor?.log.id === log.id) closeEditor()
    setMessage('Time log deleted.')
    addButton.current?.focus()
  }

  return (
    <section className="weekly-time" aria-labelledby="weekly-time-title">
      <div className="compass-section-heading"><h2 id="weekly-time-title">Time trade-offs</h2><button ref={addButton} type="button" className="primary" onClick={() => openLog({ id: crypto.randomUUID(), date: today >= summary.start && today <= summary.end ? today : summary.start, lifeAreaId: '', durationMinutes: 0 }, true)}><Plus size={18} aria-hidden="true" /> Log time</button></div>
      <div className="week-controls">
        <div className="event-field"><label htmlFor="week-date">Week containing</label><input id="week-date" type="date" min="0001-01-01" max="9999-12-26" value={selectedDate} onChange={(event) => chooseWeek(event.target.value)} /></div>
        <button type="button" className="secondary" onClick={() => chooseWeek(getLondonDate())}>This week</button>
      </div>
      <p className="week-range">Monday {formatCalendarDate(summary.start, { day: 'numeric', month: 'short', year: 'numeric' })} - Sunday {formatCalendarDate(summary.end, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      <p className="compass-context">Current standing weekly plan, including when viewing historical actual logs. Calendar events do not count as actual time.</p>
      <p className="compass-context">Hours inputs are rounded to the nearest minute. Blank means unset; zero is an explicit zero.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <p className="compass-message" role="status">{message}</p>
      <details className="weekly-settings"><summary>Weekly settings</summary>
        <form onSubmit={saveSettings}>
          <div className="event-fields">
            <div className="event-field"><label htmlFor="weekly-available">Available weekly hours outside work and essential needs</label><input id="weekly-available" name="available" inputMode="decimal" defaultValue={hoursInput(data.weeklySettings.availableMinutes)} /></div>
            <div className="event-field"><label htmlFor="weekly-target">Maker-project target (hours/week)</label><input id="weekly-target" name="target" inputMode="decimal" defaultValue={hoursInput(data.weeklySettings.makerTargetMinutes)} /></div>
            <div className="event-field"><label htmlFor="maker-area">Maker-project life area</label><select id="maker-area" name="makerAreaId" defaultValue={data.weeklySettings.makerAreaId}>{data.lifeAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
          </div>
          <button type="submit" className="primary">Save weekly settings</button>
        </form>
      </details>
      <dl className="budget-summary time-summary">
        <div><dt>Current planned time</dt><dd>{formatDuration(summary.totalMinutes)}</dd></div>
        <div><dt>Actual logged this week</dt><dd>{formatDuration(summary.actualMinutes)}</dd></div>
        <div><dt>Current maker-project plan</dt><dd>{formatDuration(summary.makerMinutes)}</dd></div>
      </dl>
      <p className="compass-context">Available weekly time: {data.weeklySettings.availableMinutes === null ? 'Not set' : formatDuration(data.weeklySettings.availableMinutes)}. Maker-project target: {data.weeklySettings.makerTargetMinutes === null ? 'Not set' : formatDuration(data.weeklySettings.makerTargetMinutes)}.</p>
      {summary.overCapacityMinutes !== null && summary.overCapacityMinutes > 0 && <p className="budget-warning" role="status">Planned commitments exceed available time by {formatDuration(summary.overCapacityMinutes)}.</p>}
      {summary.makerShortfallMinutes !== null && summary.makerShortfallMinutes > 0 && <p className="budget-warning" role="status">Maker-project estimates are {formatDuration(summary.makerShortfallMinutes)} below your target for {makerArea.name}.</p>}
      {unestimated.length > 0 && <section className="unestimated" aria-labelledby="unestimated-title"><h3 id="unestimated-title">Active without estimates ({unestimated.length})</h3><p className="compass-context">Not included in planned totals; outcomes have no separate allocation.</p><ul>{unestimated.map((item) => <li key={item.id}>{item.title}</li>)}</ul></section>}
      <table className="time-table">
        <caption>Current standing weekly plan versus selected-week actuals</caption>
        <thead><tr><th scope="col">Life area</th><th scope="col">Current plan</th><th scope="col">Actual logged</th></tr></thead>
        <tbody>{summary.areas.map((area) => <tr key={area.areaId}><th scope="row">{data.lifeAreas.find((entry) => entry.id === area.areaId)?.name}</th><td>{formatDuration(area.plannedMinutes)}{area.unestimatedCount > 0 && <span className="compass-context time-unestimated">{area.unestimatedCount} unestimated</span>}</td><td>{formatDuration(area.actualMinutes)}</td></tr>)}</tbody>
      </table>
      {editor && <TimeLogEditor key={editorVersion} log={editor.log} isNew={editor.isNew} areas={data.lifeAreas} onSave={saveLog} onCancel={closeEditor} />}
      <details className="time-log-list" open><summary>Manual time logs ({logs.length})</summary>
        {logs.length === 0 && <p className="compass-context">No time logged for this week.</p>}
        <ul>{logs.map((log) => {
          const areaName = data.lifeAreas.find((area) => area.id === log.lifeAreaId)?.name
          const dateLabel = formatCalendarDate(log.date, { day: 'numeric', month: 'short', year: 'numeric' })
          return <li key={log.id}><div><strong>{areaName}</strong><p className="compass-context">{dateLabel} - {formatDuration(log.durationMinutes)}</p></div><div className="event-actions"><button type="button" className="icon-button" title="Edit time log" aria-label={`Edit time log ${dateLabel} for ${areaName}`} onClick={() => openLog(log, false)}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="icon-button delete-event" title="Delete time log" aria-label={`Delete time log ${dateLabel} for ${areaName}`} onClick={() => deleteLog(log)}><Trash2 size={18} aria-hidden="true" /></button></div></li>
        })}</ul>
      </details>
    </section>
  )
}