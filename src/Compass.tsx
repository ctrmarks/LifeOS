import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { formatCalendarDate, formatDuration, hoursInput, isDate, isLifeAreaUsed, parseHours } from './domain'
import type { CalendarEvent, CompassData, CompassItem, LifeArea } from './model'
import CompassTime from './CompassTime'

const statuses = ['active', 'later', 'done'] as const
const types = ['task', 'goal', 'commitment', 'dream'] as const
const label = (value: string) => value[0].toUpperCase() + value.slice(1)

function ItemEditor({ item, areas, isNew, onSave, onCancel }: {
  item: CompassItem; areas: LifeArea[]; isNew: boolean
  onSave: (item: CompassItem) => void; onCancel: () => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    try {
      const title = value('title')
      const type = value('type') as CompassItem['type']
      const status = value('status') as CompassItem['status']
      const lifeAreaId = value('lifeAreaId')
      const dueDate = value('dueDate') || null
      if (!title) throw new Error('Enter a title. Spaces alone do not count.')
      if (!types.includes(type) || !statuses.includes(status)) throw new Error('Choose a valid type and status.')
      if (!areas.some((area) => area.id === lifeAreaId)) throw new Error('Choose a life area.')
      if (dueDate !== null && !isDate(dueDate)) throw new Error('Enter a valid due date, or leave it blank.')
      const next = { ...item, title, type, status, lifeAreaId, dueDate, notes: value('notes'), suggested: false }
      onSave(next.planningRole === 'outcome' ? { ...next, weeklyMinutes: null }
        : { ...next, weeklyMinutes: parseHours(value('weeklyHours')) })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The item could not be saved.')
    }
  }
  return (
    <section className="event-editor" aria-labelledby="item-editor-title">
      <h2 id="item-editor-title">{isNew ? 'Add item' : 'Edit item'}</h2>
      <form onSubmit={submit} onChange={() => setError('')}>
        <div className="event-field"><label htmlFor="item-title">Item title</label><input id="item-title" name="title" autoFocus required maxLength={10000} defaultValue={item.title} /></div>
        <div className="event-fields">
          <div className="event-field"><label htmlFor="item-type">Type</label><select id="item-type" name="type" defaultValue={item.type}>{types.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></div>
          <div className="event-field"><label htmlFor="item-status">Item status</label><select id="item-status" name="status" defaultValue={item.status}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></div>
          <div className="event-field"><label htmlFor="item-area">Life area</label><select id="item-area" name="lifeAreaId" required defaultValue={item.lifeAreaId}><option value="" disabled>Choose a life area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
        </div>
        <div className="event-fields">
          <div className="event-field"><label htmlFor="item-due">Due date (optional)</label><input id="item-due" name="dueDate" type="date" min="0001-01-01" max="9999-12-31" defaultValue={item.dueDate ?? ''} /></div>
          {item.planningRole === 'activity' && <div className="event-field"><label htmlFor="item-hours">Weekly estimate (hours, optional)</label><input id="item-hours" name="weeklyHours" inputMode="decimal" defaultValue={hoursInput(item.weeklyMinutes)} /></div>}
        </div>
        {item.planningRole === 'outcome' && <p className="compass-context">Overarching outcome: no separate time allocation. Its projects carry the estimates.</p>}
        <div className="event-field"><label htmlFor="item-notes">Why it matters / notes</label><textarea id="item-notes" name="notes" rows={3} maxLength={10000} defaultValue={item.notes} /></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="event-actions"><button className="primary" type="submit">Save item</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button></div>
      </form>
    </section>
  )
}

function AreaEditor({ area, onSave, onCancel }: { area: LifeArea; onSave: (area: LifeArea) => void; onCancel: () => void }) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
      if (!name) throw new Error('Enter a life-area name.')
      onSave({ ...area, name })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The life area could not be saved.')
    }
  }
  return (
    <section className="event-editor" aria-labelledby="area-editor-title">
      <h2 id="area-editor-title">Life area</h2>
      <form onSubmit={submit} onChange={() => setError('')}>
        <div className="event-field"><label htmlFor="area-name">Life-area name</label><input id="area-name" name="name" autoFocus required maxLength={10000} defaultValue={area.name} /></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="event-actions"><button type="submit" className="primary">Save life area</button><button type="button" className="secondary" onClick={onCancel}>Cancel</button></div>
      </form>
    </section>
  )
}

type Editor = { kind: 'item'; item: CompassItem; isNew: boolean } | { kind: 'area'; area: LifeArea; isNew: boolean }

export default function Compass({ data, calendarEvents, onChange }: {
  data: CompassData; calendarEvents: CalendarEvent[]; onChange: (data: CompassData) => void
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const addItemButton = useRef<HTMLButtonElement>(null)
  const addAreaButton = useRef<HTMLButtonElement>(null)
  const filterControl = useRef<HTMLSelectElement>(null)
  const items = data.compassItems.filter((item) => filter === 'all' || item.status === filter)

  function openEditor(next: Editor) {
    if (editor && !window.confirm('Discard the open form?')) return
    setEditorVersion((value) => value + 1)
    setError('')
    setMessage('')
    setEditor(next)
  }
  function closeEditor() {
    if (editor?.kind === 'area') addAreaButton.current?.focus()
    else addItemButton.current?.focus()
    setEditor(null)
  }
  function saveDirection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const statement = String(form.get('statement') ?? '').trim()
    const why = String(form.get('why') ?? '').trim()
    if (!statement || !why) { setError('Enter both a north-star statement and why it matters.'); return }
    onChange({ ...data, northStar: { statement, why } })
    setError('')
    setMessage('Direction updated.')
  }
  function saveItem(item: CompassItem) {
    const compassItems = editor?.isNew ? [...data.compassItems, item] : data.compassItems.map((entry) => entry.id === item.id ? item : entry)
    onChange({ ...data, compassItems })
    setFilter('all')
    setMessage('Item updated.')
    closeEditor()
  }
  function changeStatus(item: CompassItem, status: CompassItem['status']) {
    if (filter !== 'all' && filter !== status) filterControl.current?.focus()
    onChange({ ...data, compassItems: data.compassItems.map((entry) => entry.id === item.id ? { ...entry, status, suggested: status === 'later' ? entry.suggested : false } : entry) })
    setMessage(`Item moved to ${label(status)}.`)
  }
  function deleteItem(item: CompassItem) {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    onChange({ ...data, compassItems: data.compassItems.filter((entry) => entry.id !== item.id) })
    if (editor?.kind === 'item' && editor.item.id === item.id) closeEditor()
    setMessage('Item deleted.')
    addItemButton.current?.focus()
  }
  function saveArea(area: LifeArea) {
    if (data.lifeAreas.some((entry) => entry.id !== area.id && entry.name.trim().toLocaleLowerCase('en-GB') === area.name.toLocaleLowerCase('en-GB'))) throw new Error('Choose a unique life-area name.')
    const lifeAreas = editor?.isNew ? [...data.lifeAreas, area] : data.lifeAreas.map((entry) => entry.id === area.id ? area : entry)
    onChange({ ...data, lifeAreas })
    setMessage('Life area updated. Existing references are retained.')
    closeEditor()
  }
  function deleteArea(area: LifeArea) {
    if (isLifeAreaUsed(data, calendarEvents, area.id)) {
      setError('This life area is used by an item, event, time log or maker target. Reassign those references before deleting it.')
      return
    }
    if (!window.confirm(`Delete life area "${area.name}"? This cannot be undone.`)) return
    onChange({ ...data, lifeAreas: data.lifeAreas.filter((entry) => entry.id !== area.id) })
    if (editor?.kind === 'area' && editor.area.id === area.id) closeEditor()
    setError('')
    setMessage('Life area deleted.')
    addAreaButton.current?.focus()
  }

  return (
    <section className="compass" aria-label="Compass">
      {error && <p className="field-error" role="alert">{error}</p>}
      <p className="compass-message" role="status">{message}</p>
      <section className="north-star" aria-labelledby="north-star-title">
        <h2 id="north-star-title">North star</h2>
        <p className="north-star-statement">{data.northStar.statement}</p><p>{data.northStar.why}</p>
        <details><summary>Edit north star</summary>
          <form onSubmit={saveDirection}>
            <div className="event-field"><label htmlFor="statement">Current direction</label><textarea id="statement" name="statement" rows={2} maxLength={10000} required defaultValue={data.northStar.statement} /></div>
            <div className="event-field"><label htmlFor="why">Why it matters</label><textarea id="why" name="why" rows={2} maxLength={10000} required defaultValue={data.northStar.why} /></div>
            <button type="submit" className="primary">Save direction</button>
          </form>
        </details>
      </section>
      <CompassTime data={data} onChange={onChange} />
      <section className="compass-items" aria-labelledby="items-title">
        <div className="compass-section-heading"><h2 id="items-title">Items</h2><button ref={addItemButton} type="button" className="primary" onClick={() => openEditor({
          kind: 'item', isNew: true,
          item: { id: crypto.randomUUID(), title: '', type: 'task', lifeAreaId: '', status: 'later', dueDate: null, weeklyMinutes: null, notes: '', suggested: false, planningRole: 'activity' },
        })}><Plus size={18} aria-hidden="true" /> Add item</button></div>
        <div className="event-field compass-filter"><label htmlFor="item-filter">View status</label><select ref={filterControl} id="item-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All items</option>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></div>
        {editor?.kind === 'item' && <ItemEditor key={editorVersion} item={editor.item} isNew={editor.isNew} areas={data.lifeAreas} onSave={saveItem} onCancel={closeEditor} />}
        {items.length === 0 && <p className="compass-context">No items in this view.</p>}
        <ul className="compass-item-list">
          {items.map((item) => (
            <li key={item.id} className="compass-item">
              <div className="compass-item-content">
                <h3>{item.title}</h3>
                <div className="item-meta"><span>{label(item.type)}</span><span>{data.lifeAreas.find((area) => area.id === item.lifeAreaId)?.name}</span>{item.suggested && <span>Starter suggestion</span>}</div>
                <p className="compass-context">{item.planningRole === 'outcome' ? 'Overarching outcome - no separate time allocation' : item.weeklyMinutes === null ? item.status === 'active' ? 'Active without an estimate' : 'No weekly estimate' : `${formatDuration(item.weeklyMinutes)} per week${item.status !== 'active' ? ' (not in active plan)' : ''}`}</p>
                {item.dueDate && <p className="compass-context">Due {formatCalendarDate(item.dueDate, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                {item.notes && <p className="compass-notes">{item.notes}</p>}
              </div>
              <div className="compass-item-controls">
                <div className="event-field"><label htmlFor={`status-${item.id}`}>Status</label><select id={`status-${item.id}`} aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => changeStatus(item, event.target.value as CompassItem['status'])}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></div>
                <div className="event-actions"><button type="button" className="icon-button" title="Edit item" aria-label={`Edit item ${item.title}`} onClick={() => openEditor({ kind: 'item', item, isNew: false })}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="icon-button delete-event" title="Delete item" aria-label={`Delete item ${item.title}`} onClick={() => deleteItem(item)}><Trash2 size={18} aria-hidden="true" /></button></div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <details className="life-areas"><summary>Life areas</summary>
        <button ref={addAreaButton} type="button" className="secondary" onClick={() => openEditor({ kind: 'area', isNew: true, area: { id: crypto.randomUUID(), name: '' } })}><Plus size={18} aria-hidden="true" /> Add life area</button>
        {editor?.kind === 'area' && <AreaEditor key={editorVersion} area={editor.area} onSave={saveArea} onCancel={closeEditor} />}
        <ul className="area-list">{data.lifeAreas.map((area) => <li key={area.id}><span>{area.name}</span><div className="event-actions"><button type="button" className="icon-button" title="Edit life area" aria-label={`Edit life area ${area.name}`} onClick={() => openEditor({ kind: 'area', area, isNew: false })}><Pencil size={18} aria-hidden="true" /></button><button type="button" className="icon-button delete-event" title="Delete life area" aria-label={`Delete life area ${area.name}`} onClick={() => deleteArea(area)}><Trash2 size={18} aria-hidden="true" /></button></div></li>)}</ul>
      </details>
    </section>
  )
}