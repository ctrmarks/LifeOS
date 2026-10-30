import { describe, expect, it } from 'vitest'
import {
  formatCalendarDate, formatEventEnd, formatMoney, getBudgetSummary, getLondonDate, getMonthCells,
  isBudgetCategoryUsed, moneyInput,
  getPlannedTime, isDate, parseHours, parseMoney, shiftMonth, sumSafe,
  formatDuration, getWeeklyTime, getWeekRange, hoursInput, isLifeAreaUsed,
} from './domain'
import { createInitialData } from './model'

describe('Compass weekly trade-offs', () => {
  it('uses inclusive Monday-Sunday dates across months, years and DST', () => {
    expect(getWeekRange('2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(getWeekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
    expect(getWeekRange('2026-03-29')).toEqual({ start: '2026-03-23', end: '2026-03-29' })
    expect(getWeekRange('2026-10-26')).toEqual({ start: '2026-10-26', end: '2026-11-01' })
  })

  it('compares the current Active activity plan against only the selected manual logs', () => {
    const data = createInitialData()
    data.weeklySettings = { availableMinutes: 120, makerTargetMinutes: 240, makerAreaId: 'maker' }
    data.compassItems = data.compassItems.map((item) => {
      if (item.planningRole === 'outcome') return { ...item, status: 'active' as const }
      if (item.id === 'facade') return { ...item, status: 'active' as const, weeklyMinutes: 180 }
      if (item.id === 'cello') return { ...item, status: 'active' as const }
      return { ...item, weeklyMinutes: 600 }
    })
    data.timeLogs = [
      { id: 'monday', date: '2026-10-26', lifeAreaId: 'maker', durationMinutes: 45 },
      { id: 'sunday', date: '2026-11-01', lifeAreaId: 'music', durationMinutes: 60 },
      { id: 'outside', date: '2026-11-02', lifeAreaId: 'maker', durationMinutes: 100 },
    ]
    const summary = getWeeklyTime(data, '2026-10-30')
    expect(summary).toMatchObject({ totalMinutes: 180, makerMinutes: 180, actualMinutes: 105, unestimatedCount: 1, overCapacityMinutes: 60, makerShortfallMinutes: 60 })
    expect(summary.areas.find((area) => area.areaId === 'music')).toEqual({ areaId: 'music', plannedMinutes: 0, actualMinutes: 60, unestimatedCount: 1 })
    expect(getWeeklyTime(data, '2025-01-01')).toMatchObject({ totalMinutes: 180, actualMinutes: 0 })
    data.weeklySettings.availableMinutes = 180
    data.weeklySettings.makerTargetMinutes = 180
    expect(getWeeklyTime(data, '2026-10-30')).toMatchObject({ overCapacityMinutes: 0, makerShortfallMinutes: 0 })
  })

  it('distinguishes unset targets from zero and round-trips whole-minute estimates', () => {
    const data = createInitialData()
    expect(getWeeklyTime(data, '2026-10-30')).toMatchObject({ overCapacityMinutes: null, makerShortfallMinutes: null })
    data.weeklySettings.availableMinutes = 0
    data.weeklySettings.makerTargetMinutes = 0
    expect(getWeeklyTime(data, '2026-10-30')).toMatchObject({ overCapacityMinutes: 0, makerShortfallMinutes: 0 })
    expect(hoursInput(null)).toBe('')
    expect(hoursInput(0)).toBe('0.00')
    for (const minutes of [1, 2, 20, 45, 59, 120, 10080]) expect(parseHours(hoursInput(minutes))).toBe(minutes)
    expect(formatDuration(90)).toBe('1h 30m')
  })

  it('protects area references including Calendar and preserves maker identity after renaming', () => {
    const data = createInitialData()
    const event = { id: 'event', date: '2026-10-30', startTime: '12:00', durationMinutes: 30, title: 'Exploration', lifeAreaId: 'other', notes: '' }
    expect(isLifeAreaUsed(data, [event], 'other')).toBe(true)
    expect(isLifeAreaUsed(data, [], 'maker')).toBe(true)
    expect(isLifeAreaUsed(data, [], 'other')).toBe(false)
    data.lifeAreas[0].name = 'Engineering projects'
    expect(data.weeklySettings.makerAreaId).toBe('maker')
  })
})

describe('monthly budgets', () => {
  it('keeps unset income distinct from zero and formats exact pennies', () => {
    const data = createInitialData()
    expect(getBudgetSummary(data, '2026-10').unallocatedPennies).toBeNull()
    data.budgets = [{ month: '2026-10', incomePennies: 0, allocations: {} }]
    expect(getBudgetSummary(data, '2026-10').unallocatedPennies).toBe(0)
    expect(moneyInput(null)).toBe('')
    expect(moneyInput(0)).toBe('0.00')
    expect(formatMoney(-30)).toBe('-\u00a30.30')
    expect(moneyInput(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91')
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('\u00a390,071,992,547,409.91')
  })

  it('calculates monthly allocation, spending and negative remaining amounts', () => {
    const data = createInitialData()
    data.financeCategories = [{ id: 'food', name: 'Food' }, { id: 'rent', name: 'Rent' }]
    data.budgets = [{ month: '2026-10', incomePennies: 10000, allocations: { food: 6000, rent: 5000 } }]
    data.expenses = [
      { id: 'meal', date: '2026-10-30', amountPennies: 6500, categoryId: 'food', description: 'Meal' },
      { id: 'next', date: '2026-11-01', amountPennies: 100, categoryId: 'rent', description: 'Next month' },
    ]
    expect(getBudgetSummary(data, '2026-10')).toEqual({
      allocatedPennies: 11000, unallocatedPennies: -1000, spentPennies: 6500,
      categories: [
        { categoryId: 'food', plannedPennies: 6000, spentPennies: 6500, remainingPennies: -500 },
        { categoryId: 'rent', plannedPennies: 5000, spentPennies: 0, remainingPennies: 5000 },
      ],
    })
    data.expenses[0] = { ...data.expenses[0], date: '2026-11-01', categoryId: 'rent' }
    expect(getBudgetSummary(data, '2026-10').spentPennies).toBe(0)
    expect(getBudgetSummary(data, '2026-11').categories[1]).toEqual({
      categoryId: 'rent', plannedPennies: 0, spentPennies: 6600, remainingPennies: -6600,
    })
  })

  it('protects categories referenced in any month or expense', () => {
    const data = createInitialData()
    data.budgets = [{ month: '2025-01', incomePennies: null, allocations: { 'category-1': 100 } }]
    data.expenses = [{ id: 'expense', date: '2025-01-01', amountPennies: 10, categoryId: 'category-2', description: 'Test' }]
    expect(isBudgetCategoryUsed(data, 'category-1')).toBe(true)
    expect(isBudgetCategoryUsed(data, 'category-2')).toBe(true)
    expect(isBudgetCategoryUsed(data, 'category-3')).toBe(false)
    expect(() => sumSafe([Number.MAX_SAFE_INTEGER, 1])).toThrow()
  })
})

describe('calendar dates', () => {
  it('builds Monday-first months with leap days and complete weeks', () => {
    const february = getMonthCells('2024-02')
    expect(february.slice(0, 4)).toEqual([null, null, null, '2024-02-01'])
    expect(february.filter(Boolean)).toHaveLength(29)
    expect(getMonthCells('2025-02').filter(Boolean)).toHaveLength(28)
    expect(getMonthCells('2026-03')).toHaveLength(42)
    expect(getMonthCells('2026-06')[0]).toBe('2026-06-01')
    expect(february.length % 7).toBe(0)
    expect(isDate('2025-02-29')).toBe(false)
    expect(isDate('2026-04-31')).toBe(false)
  })

  it('navigates year boundaries without changing a stored date', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
    expect(formatCalendarDate('2026-10-25')).toMatch(/^Sunday,? 25 October 2026$/)
    expect(formatCalendarDate('2026-03-29')).toMatch(/^Sunday,? 29 March 2026$/)
    expect(() => shiftMonth('0001-01', -1)).toThrow()
    expect(() => shiftMonth('9999-12', 1)).toThrow()
  })

  it('uses London Today including the summer offset and DST transitions', () => {
    expect(getLondonDate(new Date('2026-06-01T23:30:00Z'))).toBe('2026-06-02')
    expect(getLondonDate(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01')
    expect(getLondonDate(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-29')
    expect(getLondonDate(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25')
  })

  it('shows nominal end times with an explicit next-day marker', () => {
    expect(formatEventEnd({ startTime: '18:30', durationMinutes: 90 })).toBe('20:00')
    expect(formatEventEnd({ startTime: '23:30', durationMinutes: 60 })).toBe('00:30 (next day)')
    expect(formatEventEnd({ startTime: '00:00', durationMinutes: 1440 })).toBe('00:00 (next day)')
  })
})

describe('foundation calculations', () => {
  it('uses exact pennies and rejects ambiguous or unsafe inputs', () => {
    expect(sumSafe([parseMoney('0.10'), parseMoney('0.20')])).toBe(30)
    expect(parseMoney('123.4')).toBe(12340)
    for (const value of ['', '-1', '1.001', '1e3', 'NaN', '1,000', '90071992547410']) {
      expect(() => parseMoney(value)).toThrow()
    }
    expect(() => sumSafe([Number.MAX_SAFE_INTEGER, 1])).toThrow()
  })

  it('keeps unset hours distinct from zero and rounds to whole minutes', () => {
    expect(parseHours('')).toBeNull()
    expect(parseHours('0')).toBe(0)
    expect(parseHours('1.25')).toBe(75)
    expect(parseHours('0.01')).toBe(1)
    expect(() => parseHours('169')).toThrow()
  })

  it('counts project activities, not their overarching outcome or Later/Done ideas', () => {
    const data = createInitialData()
    const items = data.compassItems.map((item) => {
      if (item.planningRole === 'outcome') return { ...item, status: 'active' as const }
      if (item.id === 'facade') return { ...item, status: 'active' as const, weeklyMinutes: 120 }
      if (item.id === 'reservoir') return { ...item, status: 'active' as const, weeklyMinutes: 180 }
      return { ...item, weeklyMinutes: 60 }
    })
    expect(getPlannedTime(items, 'maker')).toEqual({
      totalMinutes: 300, makerMinutes: 300, unestimatedCount: 0,
    })
    expect(getPlannedTime(items.map((item) => ({ ...item, status: 'done' })), 'maker').totalMinutes).toBe(0)
  })
})