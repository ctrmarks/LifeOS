import { describe, expect, it } from 'vitest'
import { createInitialData } from './model'
import type { CalendarEvent } from './model'
import { createBackup, loadData, parseBackup, restoreBackup, saveData, STORAGE_KEY, validateData } from './persistence'
import type { StorageAdapter } from './persistence'

function memoryStorage(initial: string | null = null) {
  let raw = initial
  let writes = 0
  return {
    getItem: () => raw,
    setItem: (key: string, value: string) => {
      expect(key).toBe(STORAGE_KEY)
      raw = value
      writes += 1
    },
    get writes() { return writes },
  }
}

describe('backup validation and restore', () => {
  it('exports a dated versioned backup of every record without touching storage', () => {
    const data = createInitialData()
    data.northStar.statement = 'Session edits not yet saved'
    const exported = createBackup(data, new Date('2026-10-30T12:34:56.000Z'))
    expect(exported.filename).toBe('lifeos-v1-2026-10-30T12-34-56-000Z.json')
    expect(parseBackup(exported.json)).toEqual({ schemaVersion: 1, exportedAt: '2026-10-30T12:34:56.000Z', data })
    const storage = memoryStorage('old data')
    expect(storage.writes).toBe(0)
    expect(restoreBackup(exported.json, storage)).toEqual({ ok: true, data })
    expect(loadData(storage)).toEqual({ status: 'ready', data, saved: true })
  })

  it('rejects invalid files, versions, structures, IDs, values and references without writes', () => {
    const data = createInitialData()
    const backup = parseBackup(createBackup(data).json)
    const candidates = [
      'not JSON', 'null', '{}',
      JSON.stringify({ ...backup, schemaVersion: 2 }),
      JSON.stringify({ ...backup, exportedAt: '2026-02-30T12:00:00.000Z' }),
      JSON.stringify({ ...backup, data: { ...data, schemaVersion: 2 } }),
      JSON.stringify({ ...backup, data: { ...data, expenses: null } }),
      JSON.stringify({ ...backup, data: { ...data, compassItems: [...data.compassItems, data.compassItems[0]] } }),
      JSON.stringify({ ...backup, data: { ...data, lifeAreas: [{ id: '__proto__', name: 'Unsafe' }] } }),
      JSON.stringify({ ...backup, data: { ...data, weeklySettings: { ...data.weeklySettings, makerAreaId: 'missing' } } }),
      JSON.stringify({ ...backup, data: { ...data, weeklySettings: { ...data.weeklySettings, availableMinutes: -1 } } }),
    ]
    const raw = JSON.stringify(data)
    const storage = memoryStorage(raw)
    for (const candidate of candidates) {
      expect(() => parseBackup(candidate)).toThrow()
      expect(restoreBackup(candidate, storage).ok).toBe(false)
      expect(storage.getItem()).toBe(raw)
    }
    expect(storage.writes).toBe(0)
  })

  it('preserves previous bytes when a valid restore cannot be saved', () => {
    const original = JSON.stringify(createInitialData())
    const incoming = createInitialData()
    incoming.northStar.statement = 'Replacement direction'
    const storage: StorageAdapter = {
      getItem: () => original,
      setItem: () => { throw new Error('Quota exceeded') },
    }
    expect(restoreBackup(createBackup(incoming).json, storage)).toMatchObject({ ok: false, message: expect.stringContaining('unchanged') })
    expect(storage.getItem(STORAGE_KEY)).toBe(original)
  })

  it('retains corrupt raw data for recovery and can replace it only with valid saved data', () => {
    const storage = memoryStorage('{unreadable')
    expect(loadData(storage)).toMatchObject({ status: 'blocked', raw: '{unreadable' })
    expect(storage.writes).toBe(0)
    expect(restoreBackup(createBackup(createInitialData()).json, storage).ok).toBe(true)
    expect(loadData(storage).status).toBe('ready')
  })
})

describe('versioned browser persistence', () => {
  it('initialises only missing storage, with no fabricated money or time', () => {
    const storage = memoryStorage()
    const result = loadData(storage)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('Expected initial data')
    expect(() => validateData(result.data)).not.toThrow()
    expect(result.saved).toBe(false)
    expect(result.data.budgets).toEqual([])
    expect(result.data.timeLogs).toEqual([])
    expect(result.data.compassItems.every((item) => item.status === 'later' && item.weeklyMinutes === null && item.dueDate === null && item.suggested)).toBe(true)
    expect(storage.writes).toBe(0)
  })

  it('round-trips an edit and never re-seeds deleted suggestions', () => {
    const storage = memoryStorage()
    const data = createInitialData()
    data.northStar.statement = 'My deliberately edited direction'
    data.compassItems = []
    expect(saveData(data, storage)).toEqual({ ok: true })
    expect(loadData(storage)).toEqual({ status: 'ready', data, saved: true })
    expect(storage.writes).toBe(1)
  })

  it('preserves corrupt, incomplete or unsupported data without writes', () => {
    for (const raw of ['{broken', 'null', '{}', JSON.stringify({ ...createInitialData(), schemaVersion: 2 })]) {
      const storage = memoryStorage(raw)
      expect(loadData(storage).status).toBe('blocked')
      expect(storage.getItem()).toBe(raw)
      expect(storage.writes).toBe(0)
    }
  })

  it('rejects broken references, duplicate IDs and estimates on outcomes before saving', () => {
    const valid = createInitialData()
    const invalidValues = [
      { ...valid, lifeAreas: [...valid.lifeAreas, valid.lifeAreas[0]] },
      { ...valid, weeklySettings: { ...valid.weeklySettings, makerAreaId: 'missing' } },
      { ...valid, compassItems: [{ ...valid.compassItems[0], weeklyMinutes: 120 }] },
    ]
    for (const invalid of invalidValues) {
      const storage = memoryStorage(JSON.stringify(invalid))
      expect(loadData(storage).status).toBe('blocked')
      expect(() => validateData(invalid)).toThrow()
      expect(storage.writes).toBe(0)
    }
    const storage = memoryStorage()
    const invalid = createInitialData()
    invalid.weeklySettings.availableMinutes = -1
    expect(saveData(invalid, storage).ok).toBe(false)
    expect(storage.writes).toBe(0)
  })

  it('reports read and write failures without claiming the data is saved', () => {
    const storage: StorageAdapter = {
      getItem: () => { throw new Error('Access denied') },
      setItem: () => { throw new Error('Quota exceeded') },
    }
    expect(loadData(storage).status).toBe('blocked')
    const data = createInitialData()
    expect(saveData(data, storage)).toMatchObject({ ok: false, message: expect.stringContaining('only in memory') })
    expect(data).toEqual(createInitialData())
  })

  it('round-trips event creation, editing and deletion without changing Compass or actual logs', () => {
    const storage = memoryStorage()
    const data = createInitialData()
    data.northStar.statement = 'My saved Compass direction'
    data.weeklySettings.availableMinutes = 600
    data.timeLogs = [{ id: 'existing-log', date: '2026-10-25', lifeAreaId: 'music', durationMinutes: 45 }]
    const original = structuredClone(data)
    const event: CalendarEvent = {
      id: 'calendar-test', title: 'Cello practice', date: '2026-10-25', startTime: '23:30',
      durationMinutes: 60, lifeAreaId: 'music', notes: 'Optional notes',
    }
    const versions = [
      [event],
      [{ ...event, title: 'Updated practice', date: '2026-11-01', durationMinutes: 90 }],
      [],
    ]
    for (const events of versions) {
      const next = { ...data, calendarEvents: events }
      expect(saveData(next, storage)).toEqual({ ok: true })
      const loaded = loadData(storage)
      expect(loaded.status).toBe('ready')
      if (loaded.status !== 'ready') throw new Error('Expected saved calendar data')
      expect(loaded.data.calendarEvents).toEqual(events)
      expect({ ...loaded.data, calendarEvents: [] }).toEqual(original)
    }
  })

  it('rejects invalid event fields without overwriting existing saved data', () => {
    const data = createInitialData()
    const original = JSON.stringify(data)
    const storage = memoryStorage(original)
    const event: CalendarEvent = {
      id: 'calendar-test', title: 'Practice', date: '2026-10-25', startTime: '18:30',
      durationMinutes: 60, lifeAreaId: 'music', notes: '',
    }
    for (const patch of [
      { title: '   ' }, { date: '2026-02-30' }, { startTime: '24:00' },
      { durationMinutes: 0 }, { durationMinutes: 1.5 }, { durationMinutes: 1441 },
      { lifeAreaId: 'missing' },
    ]) {
      expect(saveData({ ...data, calendarEvents: [{ ...event, ...patch }] }, storage).ok).toBe(false)
      expect(storage.getItem()).toBe(original)
    }
    expect(storage.writes).toBe(0)
  })

  it('round-trips financial edits without changing Calendar, Compass or actual logs', () => {
    const storage = memoryStorage()
    const original = createInitialData()
    original.northStar.statement = 'My saved direction'
    original.calendarEvents = [{ id: 'existing', title: 'Cello', date: '2026-10-30', startTime: '18:00', durationMinutes: 60, lifeAreaId: 'music', notes: '' }]
    original.timeLogs = [{ id: 'existing-log', date: '2026-10-29', lifeAreaId: 'music', durationMinutes: 30 }]
    const populated = {
      ...original,
      financeCategories: original.financeCategories.map((category) => category.id === 'category-1' ? { ...category, name: 'Housing' } : category),
      budgets: [{ month: '2026-10', incomePennies: 0, allocations: { 'category-1': 100 } }],
      expenses: [{ id: 'test-expense', date: '2026-10-30', amountPennies: 10, categoryId: 'category-1', description: 'Test' }],
    }
    for (const candidate of [
      populated,
      { ...populated, expenses: [{ ...populated.expenses[0], date: '2026-11-01', categoryId: 'category-2' }] },
      { ...populated, expenses: [] },
    ]) {
      expect(saveData(candidate, storage)).toEqual({ ok: true })
      const loaded = loadData(storage)
      if (loaded.status !== 'ready') throw new Error('Expected saved financial data')
      expect(loaded.data).toEqual(candidate)
      expect({ ...loaded.data, financeCategories: original.financeCategories, budgets: [], expenses: [] }).toEqual(original)
    }
  })

  it('rejects invalid financial amounts and references without overwriting saved data', () => {
    const data = createInitialData()
    const original = JSON.stringify(data)
    const storage = memoryStorage(original)
    const expense = { id: 'test-expense', date: '2026-10-30', amountPennies: 10, categoryId: 'category-1', description: 'Test' }
    const budget = { month: '2026-10', incomePennies: 0, allocations: {} }
    for (const patch of [
      { expenses: [{ ...expense, amountPennies: 0 }] },
      { expenses: [{ ...expense, amountPennies: 1.5 }] },
      { expenses: [{ ...expense, categoryId: 'missing' }] },
      { expenses: [{ ...expense, date: '2026-02-30' }] },
      { budgets: [{ ...budget, incomePennies: -1 }] },
      { budgets: [{ ...budget, incomePennies: Number.MAX_SAFE_INTEGER + 1 }] },
      { budgets: [{ ...budget, allocations: { missing: 10 } }] },
      { budgets: [{ ...budget, allocations: { 'category-1': Number.MAX_SAFE_INTEGER, 'category-2': 1 } }] },
      { budgets: [budget, budget] },
    ]) {
      expect(saveData({ ...data, ...patch }, storage).ok).toBe(false)
      expect(storage.getItem()).toBe(original)
    }
    expect(storage.writes).toBe(0)
  })

  it('round-trips Compass, area, settings and log edits while retaining Calendar and Finance', () => {
    const original = createInitialData()
    original.calendarEvents = [{ id: 'existing', title: 'Project session', date: '2026-10-30', startTime: '18:00', durationMinutes: 60, lifeAreaId: 'maker', notes: '' }]
    original.budgets = [{ month: '2026-10', incomePennies: 0, allocations: { 'category-1': 100 } }]
    original.expenses = [{ id: 'existing-expense', date: '2026-10-30', amountPennies: 10, categoryId: 'category-1', description: 'Existing expense' }]
    const edited = {
      ...original,
      northStar: { statement: 'My updated direction', why: 'My own reasons' },
      lifeAreas: original.lifeAreas.map((area) => area.id === 'maker' ? { ...area, name: 'Engineering projects' } : area),
      weeklySettings: { makerAreaId: 'maker', availableMinutes: 0, makerTargetMinutes: 90 },
      compassItems: original.compassItems.map((item) => item.id === 'facade' && item.planningRole === 'activity' ? { ...item, status: 'active' as const, weeklyMinutes: 90 } : item),
    }
    const log = { id: 'manual', date: '2026-10-30', lifeAreaId: 'maker', durationMinutes: 30 }
    const storage = memoryStorage()
    for (const candidate of [
      { ...edited, timeLogs: [log] },
      { ...edited, timeLogs: [{ ...log, date: '2026-11-02', lifeAreaId: 'music', durationMinutes: 45 }] },
      { ...edited, timeLogs: [], weeklySettings: { ...edited.weeklySettings, availableMinutes: null } },
    ]) {
      expect(saveData(candidate, storage)).toEqual({ ok: true })
      const loaded = loadData(storage)
      if (loaded.status !== 'ready') throw new Error('Expected Compass data')
      expect(loaded.data).toEqual(candidate)
      expect(loaded.data.calendarEvents).toEqual(original.calendarEvents)
      expect(loaded.data.budgets).toEqual(original.budgets)
      expect(loaded.data.expenses).toEqual(original.expenses)
      expect(loaded.data.compassItems.find((item) => item.id === 'classes')).toEqual(original.compassItems.find((item) => item.id === 'classes'))
    }
  })

  it('rejects invalid Compass states, estimates, areas, settings and time logs', () => {
    const data = createInitialData()
    const activity = data.compassItems.find((item) => item.id === 'facade')!
    for (const patch of [
      { compassItems: [{ ...activity, status: 'paused' }] },
      { compassItems: [{ ...activity, dueDate: '2026-02-30' }] },
      { compassItems: [{ ...activity, weeklyMinutes: -1 }] },
      { compassItems: [{ ...activity, weeklyMinutes: 10081 }] },
      { compassItems: [{ ...data.compassItems[0], weeklyMinutes: 60 }] },
      { lifeAreas: data.lifeAreas.filter((area) => area.id !== 'maker') },
      { weeklySettings: { ...data.weeklySettings, availableMinutes: -1 } },
      { timeLogs: [{ id: 'bad-log', date: '2026-10-30', lifeAreaId: 'missing', durationMinutes: 30 }] },
      { timeLogs: [{ id: 'bad-log', date: '2026-10-30', lifeAreaId: 'maker', durationMinutes: 0 }] },
      { timeLogs: [{ id: 'bad-log', date: '2026-10-30', lifeAreaId: 'maker', durationMinutes: 1.5 }] },
    ]) {
      const invalid = { ...data, ...patch }
      expect(() => validateData(invalid)).toThrow()
      const storage = memoryStorage(JSON.stringify(invalid))
      expect(loadData(storage).status).toBe('blocked')
      expect(storage.writes).toBe(0)
    }
  })
})