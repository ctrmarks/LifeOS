import type { CalendarEvent, CompassData, CompassItem, FinanceData } from './model'

export function parseMoney(input: string): number {
  const value = input.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter a non-negative amount with up to two decimal places.')
  }
  const [whole, fraction = ''] = value.split('.')
  const pennies = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')))
  if (!Number.isSafeInteger(pennies)) throw new Error('This amount is too large.')
  return pennies
}

export function sumSafe(values: number[]): number {
  return values.reduce((total, value) => {
    const next = total + value
    if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(next)) {
      throw new Error('Amounts must be non-negative safe integers, including their total.')
    }
    return next
  }, 0)
}

export function moneyInput(value: number | null): string {
  if (value === null) return ''
  const pennies = BigInt(value)
  return `${pennies / 100n}.${String(pennies % 100n).padStart(2, '0')}`
}

export function formatMoney(value: number): string {
  const pennies = BigInt(Math.abs(value))
  const whole = new Intl.NumberFormat('en-GB').format(pennies / 100n)
  return `${value < 0 ? '-' : ''}\u00a3${whole}.${String(pennies % 100n).padStart(2, '0')}`
}

export function getBudgetSummary(data: FinanceData, month: string) {
  const budget = data.budgets.find((entry) => entry.month === month)
  const expenses = data.expenses.filter((expense) => expense.date.slice(0, 7) === month)
  const allocatedPennies = sumSafe(Object.values(budget?.allocations ?? {}))
  const incomePennies = budget?.incomePennies ?? null
  return {
    allocatedPennies,
    unallocatedPennies: incomePennies === null ? null : incomePennies - allocatedPennies,
    spentPennies: sumSafe(expenses.map((expense) => expense.amountPennies)),
    categories: data.financeCategories.map((category) => {
      const plannedPennies = budget?.allocations[category.id] ?? 0
      const spentPennies = sumSafe(expenses.filter((expense) => expense.categoryId === category.id).map((expense) => expense.amountPennies))
      return { categoryId: category.id, plannedPennies, spentPennies, remainingPennies: plannedPennies - spentPennies }
    }),
  }
}

export function isBudgetCategoryUsed(data: FinanceData, categoryId: string): boolean {
  return data.expenses.some((expense) => expense.categoryId === categoryId)
    || data.budgets.some((budget) => Object.hasOwn(budget.allocations, categoryId))
}

export function parseHours(input: string): number | null {
  if (!input.trim()) return null
  const hundredths = parseMoney(input)
  if (hundredths > 16800) throw new Error('Enter no more than 168 hours per week.')
  return Math.round(hundredths * 60 / 100)
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month - 1]
}

export function getLondonDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find((entry) => entry.type === type)!.value
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
}

function dateOnly(value: string): Date {
  if (!isDate(value)) throw new Error('Enter a valid calendar date.')
  const [year, month, day] = value.split('-').map(Number)
  const result = new Date(0)
  result.setUTCFullYear(year, month - 1, day)
  return result
}

export function formatCalendarDate(value: string, options: Intl.DateTimeFormatOptions = {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(dateOnly(value))
}

export function shiftMonth(month: string, offset: number): string {
  const date = dateOnly(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  const year = date.getUTCFullYear()
  if (year < 1 || year > 9999) throw new Error('Choose a year between 0001 and 9999.')
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function getMonthCells(month: string): (string | null)[] {
  const first = dateOnly(`${month}-01`)
  const offset = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= 31; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    if (isDate(date)) cells.push(date)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function formatEventEnd(event: Pick<CalendarEvent, 'startTime' | 'durationMinutes'>): string {
  const [hours, minutes] = event.startTime.split(':').map(Number)
  const end = hours * 60 + minutes + event.durationMinutes
  const time = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  return `${time}${end >= 1440 ? ' (next day)' : ''}`
}

export function getPlannedTime(items: CompassItem[], makerAreaId: string) {
  const activities = items.filter((item) => item.status === 'active' && item.planningRole === 'activity')
  return {
    totalMinutes: sumSafe(activities.map((item) => item.weeklyMinutes ?? 0)),
    makerMinutes: sumSafe(activities.filter((item) => item.lifeAreaId === makerAreaId).map((item) => item.weeklyMinutes ?? 0)),
    unestimatedCount: activities.filter((item) => item.weeklyMinutes === null).length,
  }
}

export function hoursInput(minutes: number | null): string {
  return minutes === null ? '' : (minutes / 60).toFixed(2)
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`
}

export function getWeekRange(value: string) {
  const date = dateOnly(value)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  const asString = () => `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  const start = asString()
  date.setUTCDate(date.getUTCDate() + 6)
  const end = asString()
  if (!isDate(start) || !isDate(end)) throw new Error('Choose a complete week within years 0001 to 9999.')
  return { start, end }
}

export function getWeeklyTime(data: CompassData, selectedDate: string) {
  const week = getWeekRange(selectedDate)
  const plan = getPlannedTime(data.compassItems, data.weeklySettings.makerAreaId)
  const activities = data.compassItems.filter((item) => item.status === 'active' && item.planningRole === 'activity')
  const logs = data.timeLogs.filter((log) => log.date >= week.start && log.date <= week.end)
  return {
    ...week,
    ...plan,
    actualMinutes: sumSafe(logs.map((log) => log.durationMinutes)),
    overCapacityMinutes: data.weeklySettings.availableMinutes === null ? null : Math.max(0, plan.totalMinutes - data.weeklySettings.availableMinutes),
    makerShortfallMinutes: data.weeklySettings.makerTargetMinutes === null ? null : Math.max(0, data.weeklySettings.makerTargetMinutes - plan.makerMinutes),
    areas: data.lifeAreas.map((area) => ({
      areaId: area.id,
      plannedMinutes: sumSafe(activities.filter((item) => item.lifeAreaId === area.id).map((item) => item.weeklyMinutes ?? 0)),
      actualMinutes: sumSafe(logs.filter((log) => log.lifeAreaId === area.id).map((log) => log.durationMinutes)),
      unestimatedCount: activities.filter((item) => item.lifeAreaId === area.id && item.weeklyMinutes === null).length,
    })),
  }
}

export function isLifeAreaUsed(data: CompassData, events: CalendarEvent[], areaId: string): boolean {
  return data.weeklySettings.makerAreaId === areaId
    || data.compassItems.some((item) => item.lifeAreaId === areaId)
    || data.timeLogs.some((log) => log.lifeAreaId === areaId)
    || events.some((event) => event.lifeAreaId === areaId)
}