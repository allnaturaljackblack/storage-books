'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { filterTransactions, applyExpenseFilter, buildPL, formatCurrency } from '@/lib/reports/pl'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function PLPage() {
  const [transactions, setTransactions] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const [companyFilter, setCompanyFilter] = useState('all')
  const [mode, setMode] = useState('detailed') // detailed | non_detailed | full
  const [expenseFilter, setExpenseFilter] = useState('all') // all | opex_only
  const [year, setYear] = useState(CURRENT_YEAR)
  const [monthFrom, setMonthFrom] = useState(1)
  const [monthTo, setMonthTo] = useState(12)
  const [view, setView] = useState('summary') // summary | monthly

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: tx }, { data: co }, { data: cat }] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, type)').order('date'),
      supabase.from('companies').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order'),
    ])
    setTransactions(tx || [])
    setCompanies(co || [])
    setCategories(cat || [])
    setLoading(false)
  }

  const dateFrom = `${year}-${String(monthFrom).padStart(2, '0')}-01`
  const dateTo = `${year}-${String(monthTo).padStart(2, '0')}-31`

  let filtered = transactions.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false
    if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
    return true
  })

  filtered = filterTransactions(filtered, mode)
  filtered = applyExpenseFilter(filtered, expenseFilter)

  const pl = buildPL(filtered, categories)

  function buildMonthlyPL() {
    const months = {}
    for (let m = monthFrom; m <= monthTo; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`
      const monthTx = filtered.filter(t => t.date.startsWith(key))
      months[key] = buildPL(monthTx, categories)
    }
    return months
  }

  const monthlyData = view === 'monthly' ? buildMonthlyPL() : null

  // Group companies for side-by-side view
  function buildByCompany() {
    if (companyFilter !== 'all') return null
    return companies.map(co => {
      const coTx = applyExpenseFilter(filterTransactions(
        filtered.filter(t => t.company_id === co.id), mode
      ), expenseFilter)
      return { company: co, pl: buildPL(coTx, categories) }
    })
  }

  const [showByCompany, setShowByCompany] = useState(false)
  const byCompany = showByCompany ? buildByCompany() : null

  const modeLabel = {
    detailed: 'Detailed (Accrual)',
    non_detailed: 'Non-Detailed (Cash)',
    full: 'Full',
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">P&L Statement</h1>
          <p className="text-sm text-slate-500 mt-0.5">{modeLabel[mode]}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          Print / Export
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Entity</label>
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Entities (Consolidated)</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <select
            value={monthFrom}
            onChange={e => setMonthFrom(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <select
            value={monthTo}
            onChange={e => setMonthTo(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">P&L Mode</label>
          <select
            value={mode}
            onChange={e => setMode(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="detailed">Detailed (Accrual)</option>
            <option value="non_detailed">Non-Detailed (Cash)</option>
            <option value="full">Full</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Expense Filter</label>
          <select
            value={expenseFilter}
            onChange={e => setExpenseFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Expenses</option>
            <option value="opex_only">OpEx Only (for bank)</option>
            <option value="exclude_capex">Exclude CapEx</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('summary')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${view === 'summary' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Summary
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`px-3 py-1.5 text-sm rounded-lg border ${view === 'monthly' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            By Month
          </button>
        </div>
        {companyFilter === 'all' && (
          <button
            onClick={() => setShowByCompany(v => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showByCompany ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Side-by-Side
          </button>
        )}
      </div>

      {/* Side-by-side entity view */}
      {showByCompany && byCompany ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${byCompany.length}, 1fr)` }}>
          {byCompany.map(({ company, pl: coPL }) => (
            <PLTable key={company.id} pl={coPL} title={company.name} />
          ))}
        </div>
      ) : view === 'monthly' && monthlyData ? (
        <MonthlyPLTable monthlyData={monthlyData} months={MONTHS} monthFrom={monthFrom} monthTo={monthTo} year={year} />
      ) : (
        <PLTable pl={pl} title={companyFilter === 'all' ? 'Consolidated' : companies.find(c => c.id === companyFilter)?.name} />
      )}
    </div>
  )
}

function PLTable({ pl, title }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-6 space-y-6">
        {/* Income */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Income</h3>
          <div className="space-y-1.5">
            {pl.income.map(([name, amt]) => (
              <div key={name} className="flex justify-between items-center text-sm">
                <span className="text-slate-700">{name}</span>
                <span className="font-mono text-emerald-600">{formatCurrency(amt)}</span>
              </div>
            ))}
            {pl.income.length === 0 && <p className="text-sm text-slate-400">No income recorded</p>}
          </div>
          <div className="flex justify-between items-center text-sm font-semibold mt-3 pt-3 border-t border-slate-100">
            <span>Total Income</span>
            <span className="font-mono text-emerald-600">{formatCurrency(pl.totalIncome)}</span>
          </div>
        </div>

        {/* Expenses */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Expenses</h3>
          <div className="space-y-1.5">
            {pl.expenses.map(([name, amt]) => (
              <div key={name} className="flex justify-between items-center text-sm">
                <span className="text-slate-700">{name}</span>
                <span className="font-mono text-red-600">{formatCurrency(amt)}</span>
              </div>
            ))}
            {pl.expenses.length === 0 && <p className="text-sm text-slate-400">No expenses recorded</p>}
          </div>
          <div className="flex justify-between items-center text-sm font-semibold mt-3 pt-3 border-t border-slate-100">
            <span>Total Expenses</span>
            <span className="font-mono text-red-600">{formatCurrency(pl.totalExpenses)}</span>
          </div>
        </div>

        {/* NOI */}
        <div className={`rounded-lg p-4 ${pl.noi >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-900">Net Operating Income (NOI)</span>
            <span className={`font-mono font-bold text-lg ${pl.noi >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(pl.noi)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthlyPLTable({ monthlyData, months, monthFrom, monthTo, year }) {
  const keys = Object.keys(monthlyData)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
      <table className="text-sm w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
            {keys.map(k => (
              <th key={k} className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {months[parseInt(k.split('-')[1]) - 1]}
              </th>
            ))}
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          <tr><td colSpan={keys.length + 2} className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 uppercase tracking-wider">Income</td></tr>
          {(() => {
            const allIncome = new Set(keys.flatMap(k => monthlyData[k].income.map(([n]) => n)))
            return [...allIncome].map(name => {
              const total = keys.reduce((s, k) => {
                const row = monthlyData[k].income.find(([n]) => n === name)
                return s + (row ? row[1] : 0)
              }, 0)
              return (
                <tr key={name} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{name}</td>
                  {keys.map(k => {
                    const row = monthlyData[k].income.find(([n]) => n === name)
                    return <td key={k} className="px-4 py-2 text-right font-mono text-emerald-600">{row ? formatCurrency(row[1]) : '—'}</td>
                  })}
                  <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-600">{formatCurrency(total)}</td>
                </tr>
              )
            })
          })()}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-4 py-2 text-slate-900">Total Income</td>
            {keys.map(k => <td key={k} className="px-4 py-2 text-right font-mono text-emerald-600">{formatCurrency(monthlyData[k].totalIncome)}</td>)}
            <td className="px-4 py-2 text-right font-mono text-emerald-600">{formatCurrency(keys.reduce((s, k) => s + monthlyData[k].totalIncome, 0))}</td>
          </tr>
          <tr><td colSpan={keys.length + 2} className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 uppercase tracking-wider">Expenses</td></tr>
          {(() => {
            const allExp = new Set(keys.flatMap(k => monthlyData[k].expenses.map(([n]) => n)))
            return [...allExp].map(name => {
              const total = keys.reduce((s, k) => {
                const row = monthlyData[k].expenses.find(([n]) => n === name)
                return s + (row ? row[1] : 0)
              }, 0)
              return (
                <tr key={name} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-700">{name}</td>
                  {keys.map(k => {
                    const row = monthlyData[k].expenses.find(([n]) => n === name)
                    return <td key={k} className="px-4 py-2 text-right font-mono text-red-500">{row ? formatCurrency(row[1]) : '—'}</td>
                  })}
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-500">{formatCurrency(total)}</td>
                </tr>
              )
            })
          })()}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-4 py-2 text-slate-900">Total Expenses</td>
            {keys.map(k => <td key={k} className="px-4 py-2 text-right font-mono text-red-500">{formatCurrency(monthlyData[k].totalExpenses)}</td>)}
            <td className="px-4 py-2 text-right font-mono text-red-500">{formatCurrency(keys.reduce((s, k) => s + monthlyData[k].totalExpenses, 0))}</td>
          </tr>
          <tr className="border-t-2 border-slate-200">
            <td className="px-4 py-3 font-bold text-slate-900">NOI</td>
            {keys.map(k => {
              const noi = monthlyData[k].noi
              return <td key={k} className={`px-4 py-3 text-right font-mono font-bold ${noi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(noi)}</td>
            })}
            <td className={`px-4 py-3 text-right font-mono font-bold ${keys.reduce((s, k) => s + monthlyData[k].noi, 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(keys.reduce((s, k) => s + monthlyData[k].noi, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
