export interface LifeArea {
  id: string
  name: string
}

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime: string
  durationMinutes: number
  lifeAreaId: string
  notes: string
}

export interface BudgetCategory {
  id: string
  name: string
}

export interface MonthlyBudget {
  month: string
  incomePennies: number | null
  allocations: Record<string, number>
}

export interface Expense {
  id: string
  amountPennies: number
  date: string
  categoryId: string
  description: string
}

export type CompassItem = {
  id: string
  title: string
  type: 'task' | 'goal' | 'commitment' | 'dream'
  lifeAreaId: string
  status: 'active' | 'later' | 'done'
  dueDate: string | null
  notes: string
  suggested: boolean
} & (
  | { planningRole: 'outcome'; weeklyMinutes: null }
  | { planningRole: 'activity'; weeklyMinutes: number | null }
)

export interface TimeLog {
  id: string
  date: string
  lifeAreaId: string
  durationMinutes: number
}

export interface AppData {
  schemaVersion: 1
  northStar: { statement: string; why: string }
  lifeAreas: LifeArea[]
  weeklySettings: {
    availableMinutes: number | null
    makerTargetMinutes: number | null
    makerAreaId: string
  }
  calendarEvents: CalendarEvent[]
  financeCategories: BudgetCategory[]
  budgets: MonthlyBudget[]
  expenses: Expense[]
  compassItems: CompassItem[]
  timeLogs: TimeLog[]
}

export type FinanceData = Pick<AppData, 'financeCategories' | 'budgets' | 'expenses'>
export type CompassData = Pick<AppData, 'northStar' | 'lifeAreas' | 'weeklySettings' | 'compassItems' | 'timeLogs'>

export function createInitialData(): AppData {
  const starter = (
    id: string,
    title: string,
    lifeAreaId: string,
    type: CompassItem['type'],
    notes: string,
    planningRole: CompassItem['planningRole'] = 'activity',
  ): CompassItem => ({
    id, title, type, lifeAreaId, notes, planningRole,
    status: 'later', dueDate: null, weeklyMinutes: null, suggested: true,
  })

  return {
    schemaVersion: 1,
    northStar: {
      statement: 'Move to New York in 2027 and join an interesting civil engineering technology startup.',
      why: 'Demonstrate practical engineering value through a maker portfolio, while making room for a whole life.',
    },
    lifeAreas: [
      { id: 'maker', name: 'Maker portfolio / New York' },
      { id: 'music', name: 'Cello & music' },
      { id: 'strength', name: 'Strength & recovery' },
      { id: 'football', name: 'Football' },
      { id: 'dance', name: 'Dance' },
      { id: 'social', name: 'Friends & dating' },
      { id: 'other', name: 'Other / exploration' },
    ],
    weeklySettings: { availableMinutes: null, makerTargetMinutes: null, makerAreaId: 'maker' },
    calendarEvents: [],
    financeCategories: ['Rent', 'Food', 'Trips', 'Savings', 'New York'].map((name, index) => ({
      id: `category-${index + 1}`, name,
    })),
    budgets: [],
    expenses: [],
    compassItems: [
      starter('portfolio', 'Build a maker portfolio for New York', 'maker', 'goal', 'An overarching outcome, supported by the facade and reservoir projects. No separate time allocation.', 'outcome'),
      starter('facade', 'Build practical AI facade tools', 'maker', 'goal', 'Draw on civil and facade engineering work to demonstrate practical value.'),
      starter('reservoir', 'Revisit optimal reservoir control', 'maker', 'goal', 'Revisit the Princeton senior thesis using newer computational capabilities.'),
      starter('cello', 'Cello and music', 'music', 'commitment', 'A major creative outlet.'),
      starter('conditioning', 'Strength and conditioning', 'strength', 'commitment', 'Maintain strength and conditioning.'),
      starter('recovery', 'Yoga, sauna and massage', 'strength', 'commitment', 'Make room for recovery.'),
      starter('office', 'Improve comfort at the office', 'strength', 'goal', 'Posture and shoulder, neck and chest comfort.'),
      starter('wawa', 'Wawa football', 'football', 'commitment', 'Friendships, enjoyment and improving at football.'),
      starter('classes', 'Dance classes', 'dance', 'commitment', 'Keep dance part of life.'),
      starter('friends', 'Friends, dating and going out', 'social', 'commitment', 'Make room for relationships and enjoyment.'),
    ],
    timeLogs: [],
  }
}