import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  formatCalendarDate, formatMoney, getBudgetSummary, getLondonDate,
  isBudgetCategoryUsed, isDate, moneyInput, parseMoney, sumSafe,
} from './domain'
import type { BudgetCategory, Expense, FinanceData, MonthlyBudget } from './model'

type Editor =
  | { kind: 'category'; category: BudgetCategory; isNew: boolean }
  | { kind: 'expense'; expense: Expense; isNew: boolean }

function CategoryEditor({ category, isNew, onSave, onCancel }: {
  category: BudgetCategory
  isNew: boolean
  onSave: (category: BudgetCategory) => void
  onCancel: () => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
      if (!name) throw new Error('Enter a category name. Spaces alone do not count.')
      onSave({ ...category, name })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The category could not be saved.')
    }
  }
  return (
    <section className="event-editor" aria-labelledby="category-editor-title">
      <h2 id="category-editor-title">{isNew ? 'Add category' : 'Edit category'}</h2>
      <p className="finance-context">Category names apply to every month.</p>
      <form onSubmit={submit} onChange={() => setError('')}>
        <div className="event-field">
          <label htmlFor="category-name">Category name</label>
          <input id="category-name" name="name" autoFocus required maxLength={10000} defaultValue={category.name} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="event-actions">
          <button type="submit" className="primary">Save category</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  )
}

function ExpenseEditor({ expense, isNew, categories, onSave, onCancel }: {
  expense: Expense
  isNew: boolean
  categories: BudgetCategory[]
  onSave: (expense: Expense) => void
  onCancel: () => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    try {
      const amountPennies = parseMoney(value('amount'))
      const date = value('date')
      const categoryId = value('categoryId')
      const description = value('description')
      if (amountPennies === 0) throw new Error('An expense must be greater than zero.')
      if (!isDate(date)) throw new Error('Choose a valid expense date.')
      if (!categories.some((category) => category.id === categoryId)) throw new Error('Choose a category.')
      if (!description) throw new Error('Enter a description. Spaces alone do not count.')
      onSave({ ...expense, amountPennies, date, categoryId, description })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The expense could not be saved.')
    }
  }
  return (
    <section className="event-editor" aria-labelledby="expense-editor-title">
      <h2 id="expense-editor-title">{isNew ? 'Add expense' : 'Edit expense'}</h2>
      <form onSubmit={submit} onChange={() => setError('')}>
        <div className="event-fields">
          <div className="event-field">
            <label htmlFor="expense-amount">Amount (GBP)</label>
            <input id="expense-amount" name="amount" inputMode="decimal" required autoFocus defaultValue={expense.amountPennies ? moneyInput(expense.amountPennies) : ''} />
          </div>
          <div className="event-field">
            <label htmlFor="expense-date">Expense date</label>
            <input id="expense-date" name="date" type="date" min="0001-01-01" max="9999-12-31" required defaultValue={expense.date} />
          </div>
        </div>
        <div className="event-field">
          <label htmlFor="expense-category">Category</label>
          <select id="expense-category" name="categoryId" required defaultValue={expense.categoryId}>
            <option value="" disabled>Choose a category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="event-field">
          <label htmlFor="expense-description">Description</label>
          <input id="expense-description" name="description" required maxLength={10000} defaultValue={expense.description} />
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="event-actions">
          <button type="submit" className="primary">Save expense</button>
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  )
}

export default function Finance({ data, onChange }: { data: FinanceData; onChange: (finance: FinanceData) => void }) {
  const today = getLondonDate()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const categoryButton = useRef<HTMLButtonElement>(null)
  const expenseButton = useRef<HTMLButtonElement>(null)
  const budget = data.budgets.find((entry) => entry.month === month)
  const summary = getBudgetSummary(data, month)
  const monthLabel = formatCalendarDate(`${month}-01`, { month: 'long', year: 'numeric' })
  const expenses = data.expenses.filter((expense) => expense.date.slice(0, 7) === month)
    .sort((first, second) => first.date.localeCompare(second.date) || first.description.localeCompare(second.description))

  function openEditor(next: Editor) {
    if (editor && !window.confirm('Discard the open form?')) return
    setEditorVersion((value) => value + 1)
    setError('')
    setMessage('')
    setEditor(next)
  }

  function closeEditor() {
    if (editor?.kind === 'category') categoryButton.current?.focus()
    else expenseButton.current?.focus()
    setEditor(null)
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const income = String(form.get('income') ?? '').trim()
      const allocations: Record<string, number> = {}
      for (const category of data.financeCategories) {
        const value = String(form.get(`allocation-${category.id}`) ?? '').trim()
        if (value) {
          const amount = parseMoney(value)
          if (amount > 0) allocations[category.id] = amount
        }
      }
      sumSafe(Object.values(allocations))
      const next: MonthlyBudget = { month, incomePennies: income ? parseMoney(income) : null, allocations }
      const budgets = budget ? data.budgets.map((entry) => entry.month === month ? next : entry) : [...data.budgets, next]
      onChange({ ...data, budgets })
      setError('')
      setMessage('Monthly budget updated.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The budget could not be saved.')
    }
  }

  function saveCategory(category: BudgetCategory) {
    if (data.financeCategories.some((entry) => entry.id !== category.id && entry.name.trim().toLocaleLowerCase('en-GB') === category.name.toLocaleLowerCase('en-GB'))) {
      throw new Error('Choose a unique category name.')
    }
    const financeCategories = editor?.isNew ? [...data.financeCategories, category]
      : data.financeCategories.map((entry) => entry.id === category.id ? category : entry)
    onChange({ ...data, financeCategories })
    setMessage('Category updated.')
    closeEditor()
  }

  function deleteCategory(category: BudgetCategory) {
    if (isBudgetCategoryUsed(data, category.id)) {
      setError('This category is used. Clear its budgets in every month and remove or reassign its expenses before deleting it.')
      return
    }
    if (!window.confirm(`Delete category "${category.name}"? This cannot be undone.`)) return
    onChange({ ...data, financeCategories: data.financeCategories.filter((entry) => entry.id !== category.id) })
    if (editor?.kind === 'category' && editor.category.id === category.id) closeEditor()
    setError('')
    setMessage('Category deleted.')
    categoryButton.current?.focus()
  }

  function saveExpense(expense: Expense) {
    const next = editor?.isNew ? [...data.expenses, expense]
      : data.expenses.map((entry) => entry.id === expense.id ? expense : entry)
    sumSafe(next.map((entry) => entry.amountPennies))
    onChange({ ...data, expenses: next })
    setMonth(expense.date.slice(0, 7))
    setError('')
    setMessage('Expense updated.')
    closeEditor()
  }

  function deleteExpense(expense: Expense) {
    if (!window.confirm(`Delete expense "${expense.description}"? This cannot be undone.`)) return
    onChange({ ...data, expenses: data.expenses.filter((entry) => entry.id !== expense.id) })
    if (editor?.kind === 'expense' && editor.expense.id === expense.id) closeEditor()
    setError('')
    setMessage('Expense deleted.')
    expenseButton.current?.focus()
  }

  return (
    <section className="finance" aria-label="Finance">
      <div className="finance-toolbar">
        <div className="event-field">
          <label htmlFor="budget-month">Budget month</label>
          <input id="budget-month" type="month" min="0001-01" max="9999-12" value={month} onChange={(event) => {
            const next = event.target.value
            if (!isDate(`${next}-01`)) return
            if (editor && !window.confirm('Discard the open form?')) return
            setMonth(next)
            setEditor(null)
            setError('')
            setMessage('')
          }} />
        </div>
        <button ref={expenseButton} type="button" className="primary" disabled={data.financeCategories.length === 0} onClick={() => openEditor({
          kind: 'expense', isNew: true,
          expense: { id: crypto.randomUUID(), amountPennies: 0, date: today.startsWith(month) ? today : `${month}-01`, categoryId: '', description: '' },
        })}><Plus size={18} aria-hidden="true" /> Add expense</button>
      </div>
      <p className="finance-context">{monthLabel}. GBP budgets, not bank balances.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <p className="finance-message" role="status">{message}</p>
      {editor?.kind === 'category' && <CategoryEditor key={editorVersion} category={editor.category} isNew={editor.isNew} onSave={saveCategory} onCancel={closeEditor} />}
      {editor?.kind === 'expense' && <ExpenseEditor key={editorVersion} expense={editor.expense} isNew={editor.isNew} categories={data.financeCategories} onSave={saveExpense} onCancel={closeEditor} />}
      <dl className="budget-summary">
        <div><dt>Total allocated</dt><dd>{formatMoney(summary.allocatedPennies)}</dd></div>
        <div><dt>Unallocated income</dt><dd>{summary.unallocatedPennies === null ? 'Income not set' : formatMoney(summary.unallocatedPennies)}</dd></div>
        <div><dt>Total spent</dt><dd>{formatMoney(summary.spentPennies)}</dd></div>
      </dl>
      {summary.unallocatedPennies !== null && summary.unallocatedPennies < 0 && (
        <p className="budget-warning" role="status">Overallocated by {formatMoney(-summary.unallocatedPennies)}. Planned budgets exceed take-home income.</p>
      )}
      <form key={month} className="budget-form" onSubmit={saveBudget}>
        <div className="event-field income-field">
          <label htmlFor="budget-income">Monthly take-home income (GBP)</label>
          <input id="budget-income" name="income" inputMode="decimal" defaultValue={moneyInput(budget?.incomePennies ?? null)} aria-describedby="income-hint" />
          <p id="income-hint" className="finance-context">Optional. Blank means not set; zero means income is zero for this month.</p>
        </div>
        <div className="finance-section-heading">
          <h2>Category budgets</h2>
          <button ref={categoryButton} type="button" className="secondary" onClick={() => openEditor({ kind: 'category', isNew: true, category: { id: crypto.randomUUID(), name: '' } })}>
            <Plus size={18} aria-hidden="true" /> Add category
          </button>
        </div>
        {data.financeCategories.length === 0 && <p className="finance-context">No categories yet. Add one before recording expenses.</p>}
        <ul className="budget-categories">
          {data.financeCategories.map((category) => {
            const totals = summary.categories.find((entry) => entry.categoryId === category.id)!
            return (
              <li key={category.id} className="budget-row">
                <strong className="budget-category-name">{category.name}</strong>
                <div className="event-field budget-planned">
                  <label htmlFor={`allocation-${category.id}`}>Planned budget (GBP)</label>
                  <input id={`allocation-${category.id}`} name={`allocation-${category.id}`} inputMode="decimal" aria-label={`Planned budget for ${category.name} (GBP)`} defaultValue={moneyInput(budget?.allocations[category.id] ?? null)} />
                </div>
                <div className="budget-spent budget-value"><span>Spent</span><strong>{formatMoney(totals.spentPennies)}</strong></div>
                <div className="budget-remaining budget-value">
                  <span>Budget remaining</span><strong>{formatMoney(totals.remainingPennies)}</strong>
                  {totals.remainingPennies < 0 && <span className="field-error">Overspent by {formatMoney(-totals.remainingPennies)}</span>}
                </div>
                <div className="event-actions budget-category-actions">
                  <button type="button" className="icon-button" title="Edit category" aria-label={`Edit category ${category.name}`} onClick={() => openEditor({ kind: 'category', category, isNew: false })}><Pencil size={18} aria-hidden="true" /></button>
                  <button type="button" className="icon-button delete-event" title="Delete category" aria-label={`Delete category ${category.name}`} onClick={() => deleteCategory(category)}><Trash2 size={18} aria-hidden="true" /></button>
                </div>
              </li>
            )
          })}
        </ul>
        <button type="submit" className="primary">Save monthly budget</button>
      </form>
      <section className="expenses" aria-labelledby="expenses-title">
        <div className="finance-section-heading"><h2 id="expenses-title">Expenses</h2><span>{monthLabel} - {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</span></div>
        {expenses.length === 0 && <p className="finance-context">No expenses this month.</p>}
        <ul className="expense-list">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <div className="expense-details">
                <span className="expense-date">{formatCalendarDate(expense.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <h3>{expense.description}</h3>
                <p>{data.financeCategories.find((category) => category.id === expense.categoryId)?.name}</p>
              </div>
              <strong className="expense-amount">{formatMoney(expense.amountPennies)}</strong>
              <div className="event-actions">
                <button type="button" className="icon-button" title="Edit expense" aria-label={`Edit expense ${expense.description}`} onClick={() => openEditor({ kind: 'expense', expense, isNew: false })}><Pencil size={18} aria-hidden="true" /></button>
                <button type="button" className="icon-button delete-event" title="Delete expense" aria-label={`Delete expense ${expense.description}`} onClick={() => deleteExpense(expense)}><Trash2 size={18} aria-hidden="true" /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}