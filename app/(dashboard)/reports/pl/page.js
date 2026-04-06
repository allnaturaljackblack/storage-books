'use client'
import { useState, useEffect, useCallback } from 'react'
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
  const [mode, setMode] = useState('detailed') // detailed | non_detailed | full | bank_pl
  const [expenseFilter, setExpenseFilter] = useState('all')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [monthFrom, setMonthFrom] = useState(1)
  const [monthTo, setMonthTo] = useState(12)
  const [view, setView] = useState('monthly')
  const [showByCompany, setShowByCompany] = useState(false)
  const [showPct, setShowPct] = useState(false)

  // Bank P&L state
  const [bankEntity, setBankEntity] = useState('portfolio')
  const [bankIncludedCats, setBankIncludedCats] = useState(new Set())
  const [bankExcludedTxs, setBankExcludedTxs] = useState(new Set())
  const [expandedBankCats, setExpandedBankCats] = useState(new Set())

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

  // Load saved Bank P&L config when entity changes
  const loadBankConfig = useCallback(async (entityId) => {
    const isPortfolio = entityId === 'portfolio'
    const [{ data: cats }, { data: excl }] = await Promise.all([
      isPortfolio
        ? supabase.from('bank_pl_categories').select('category_id').is('company_id', null)
        : supabase.from('bank_pl_categories').select('category_id').eq('company_id', entityId),
      isPortfolio
        ? supabase.from('bank_pl_exclusions').select('transaction_id').is('company_id', null)
        : supabase.from('bank_pl_exclusions').select('transaction_id').eq('company_id', entityId),
    ])
    setBankIncludedCats(new Set((cats || []).map(c => c.category_id)))
    setBankExcludedTxs(new Set((excl || []).map(e => e.transaction_id)))
    setExpandedBankCats(new Set())
  }, [])

  useEffect(() => {
    if (mode === 'bank_pl') loadBankConfig(bankEntity)
  }, [mode, bankEntity])

  async function toggleBankCategory(categoryId) {
    const companyId = bankEntity === 'portfolio' ? null : bankEntity
    if (bankIncludedCats.has(categoryId)) {
      // Remove category
      const q = companyId
        ? supabase.from('bank_pl_categories').delete().eq('category_id', categoryId).eq('company_id', companyId)
        : supabase.from('bank_pl_categories').delete().eq('category_id', categoryId).is('company_id', null)
      await q
      setBankIncludedCats(prev => { const n = new Set(prev); n.delete(categoryId); return n })
      // Also remove any exclusions under this category
      const txInCat = transactions.filter(t => t.category_id === categoryId)
      if (txInCat.length > 0) {
        const ids = txInCat.map(t => t.id)
        const eq = companyId
          ? supabase.from('bank_pl_exclusions').delete().in('transaction_id', ids).eq('company_id', companyId)
          : supabase.from('bank_pl_exclusions').delete().in('transaction_id', ids).is('company_id', null)
        await eq
        setBankExcludedTxs(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })
      }
    } else {
      // Add category
      await supabase.from('bank_pl_categories').insert({ category_id: categoryId, company_id: companyId })
      setBankIncludedCats(prev => new Set([...prev, categoryId]))
    }
  }

  async function toggleBankTransaction(txId) {
    const companyId = bankEntity === 'portfolio' ? null : bankEntity
    if (bankExcludedTxs.has(txId)) {
      // Re-include: remove from exclusions
      const q = companyId
        ? supabase.from('bank_pl_exclusions').delete().eq('transaction_id', txId).eq('company_id', companyId)
        : supabase.from('bank_pl_exclusions').delete().eq('transaction_id', txId).is('company_id', null)
      await q
      setBankExcludedTxs(prev => { const n = new Set(prev); n.delete(txId); return n })
    } else {
      // Exclude
      await supabase.from('bank_pl_exclusions').insert({ transaction_id: txId, company_id: companyId })
      setBankExcludedTxs(prev => new Set([...prev, txId]))
    }
  }

  function toggleExpandBankCat(catId) {
    setExpandedBankCats(prev => {
      const n = new Set(prev)
      n.has(catId) ? n.delete(catId) : n.add(catId)
      return n
    })
  }

  const dateFrom = `${year}-${String(monthFrom).padStart(2, '0')}-01`
  const dateTo = `${year}-${String(monthTo).padStart(2, '0')}-31`

  // Standard P&L filtered transactions
  let filtered = transactions.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false
    if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
    return true
  })
  filtered = filterTransactions(filtered, mode === 'bank_pl' ? 'detailed' : mode)
  filtered = applyExpenseFilter(filtered, expenseFilter)
  const pl = buildPL(filtered, categories)

  // Bank P&L filtered transactions
  const bankDateFiltered = transactions.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false
    if (bankEntity !== 'portfolio' && t.company_id !== bankEntity) return false
    return true
  })
  const bankFiltered = bankDateFiltered.filter(t =>
    bankIncludedCats.has(t.category_id) && !bankExcludedTxs.has(t.id)
  )
  const bankPL = buildPL(bankFiltered, categories)

  // Transactions per category for Bank P&L drill-down (for config panel)
  function txsForBankCategory(catId) {
    return bankDateFiltered.filter(t => t.category_id === catId)
  }

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

  function buildByCompany() {
    if (companyFilter !== 'all') return null
    return companies.map(co => {
      const coTx = applyExpenseFilter(filterTransactions(
        filtered.filter(t => t.company_id === co.id), mode
      ), expenseFilter)
      return { company: co, pl: buildPL(coTx, categories) }
    })
  }
  const byCompany = showByCompany ? buildByCompany() : null

  const modeLabel = {
    detailed: 'Detailed (Accrual)',
    non_detailed: 'Non-Detailed (Cash)',
    full: 'Full',
    bank_pl: 'Bank P&L',
  }

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

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
        {mode !== 'bank_pl' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Entity</label>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="all">All Entities (Consolidated)</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <select value={monthFrom} onChange={e => setMonthFrom(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <select value={monthTo} onChange={e => setMonthTo(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
            <option value="detailed">Detailed (Accrual)</option>
            <option value="non_detailed">Non-Detailed (Cash)</option>
            <option value="full">Full</option>
            <option value="bank_pl">Bank P&L</option>
          </select>
        </div>
        {mode !== 'bank_pl' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Expense Filter</label>
            <select value={expenseFilter} onChange={e => setExpenseFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="all">All Expenses</option>
              <option value="opex_only">OpEx Only</option>
              <option value="exclude_capex">Exclude CapEx</option>
            </select>
          </div>
        )}
        {mode !== 'bank_pl' && (
          <div className="flex gap-2">
            <button onClick={() => setView('summary')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${view === 'summary' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Summary
            </button>
            <button onClick={() => setView('monthly')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${view === 'monthly' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              By Month
            </button>
          </div>
        )}
        {mode !== 'bank_pl' && companyFilter === 'all' && (
          <button onClick={() => setShowByCompany(v => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showByCompany ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Side-by-Side
          </button>
        )}
        <button onClick={() => setShowPct(v => !v)}
          className={`px-3 py-1.5 text-sm rounded-lg border ${showPct ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          % of Revenue
        </button>
      </div>

      {/* ── Bank P&L Mode ───────────────────────────────────────── */}
      {mode === 'bank_pl' ? (
        <div className="flex gap-6 items-start">

          {/* Left: Configuration panel */}
          <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Configure for</p>
              <select value={bankEntity} onChange={e => setBankEntity(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="portfolio">Portfolio (All Entities)</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-2">
                {bankIncludedCats.size} categor{bankIncludedCats.size === 1 ? 'y' : 'ies'} selected
                {bankExcludedTxs.size > 0 && `, ${bankExcludedTxs.size} transaction${bankExcludedTxs.size === 1 ? '' : 's'} excluded`}
              </p>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Income categories */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Income</p>
                <div className="space-y-1">
                  {incomeCategories.map(cat => {
                    const included = bankIncludedCats.has(cat.id)
                    const expanded = expandedBankCats.has(cat.id)
                    const txs = txsForBankCategory(cat.id)
                    return (
                      <div key={cat.id}>
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input type="checkbox" checked={included} onChange={() => toggleBankCategory(cat.id)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                          <span className={`flex-1 text-sm ${included ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                            {cat.name}
                          </span>
                          {included && txs.length > 0 && (
                            <button onClick={() => toggleExpandBankCat(cat.id)}
                              className="text-xs text-slate-400 hover:text-slate-700 font-mono">
                              {expanded ? '▼' : '▶'} {txs.length}
                            </button>
                          )}
                        </div>
                        {included && expanded && txs.length > 0 && (
                          <div className="ml-6 mt-1 mb-2 space-y-0.5 border-l-2 border-slate-100 pl-3">
                            {txs.map(t => {
                              const excluded = bankExcludedTxs.has(t.id)
                              return (
                                <div key={t.id} className="flex items-start gap-2 py-1">
                                  <input type="checkbox" checked={!excluded} onChange={() => toggleBankTransaction(t.id)}
                                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs truncate ${excluded ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
                                      {t.description}
                                    </p>
                                    <p className="text-xs text-slate-400">{t.date} · {formatCurrency(Math.abs(t.amount))}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Expense categories */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Expenses</p>
                <div className="space-y-1">
                  {expenseCategories.map(cat => {
                    const included = bankIncludedCats.has(cat.id)
                    const expanded = expandedBankCats.has(cat.id)
                    const txs = txsForBankCategory(cat.id)
                    return (
                      <div key={cat.id}>
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input type="checkbox" checked={included} onChange={() => toggleBankCategory(cat.id)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                          <span className={`flex-1 text-sm ${included ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                            {cat.name}
                          </span>
                          {included && txs.length > 0 && (
                            <button onClick={() => toggleExpandBankCat(cat.id)}
                              className="text-xs text-slate-400 hover:text-slate-700 font-mono">
                              {expanded ? '▼' : '▶'} {txs.length}
                            </button>
                          )}
                        </div>
                        {included && expanded && txs.length > 0 && (
                          <div className="ml-6 mt-1 mb-2 space-y-0.5 border-l-2 border-slate-100 pl-3">
                            {txs.map(t => {
                              const excluded = bankExcludedTxs.has(t.id)
                              return (
                                <div key={t.id} className="flex items-start gap-2 py-1">
                                  <input type="checkbox" checked={!excluded} onChange={() => toggleBankTransaction(t.id)}
                                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs truncate ${excluded ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
                                      {t.description}
                                    </p>
                                    <p className="text-xs text-slate-400">{t.date} · {formatCurrency(Math.abs(t.amount))}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Bank P&L preview */}
          <div className="flex-1">
            <PLTable pl={bankPL} showPct={showPct}
              title={bankEntity === 'portfolio' ? 'Portfolio — Bank P&L' : (companies.find(c => c.id === bankEntity)?.name + ' — Bank P&L')} />
            {bankIncludedCats.size === 0 && (
              <p className="text-sm text-slate-400 mt-4 text-center">
                Select categories on the left to build your Bank P&L.
              </p>
            )}
          </div>
        </div>

      ) : showByCompany && byCompany ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${byCompany.length}, 1fr)` }}>
          {byCompany.map(({ company, pl: coPL }) => (
            <PLTable key={company.id} pl={coPL} title={company.name} showPct={showPct} />
          ))}
        </div>
      ) : view === 'monthly' && monthlyData ? (
        <MonthlyPLTable monthlyData={monthlyData} months={MONTHS} monthFrom={monthFrom} monthTo={monthTo} year={year} showPct={showPct} />
      ) : (
        <PLTable pl={pl} showPct={showPct} title={companyFilter === 'all' ? 'Consolidated' : companies.find(c => c.id === companyFilter)?.name} />
      )}
    </div>
  )
}

function PLTable({ pl, title, showPct }) {
  const [showIncome, setShowIncome] = useState(true)
  const [showExpenses, setShowExpenses] = useState(true)

  function pct(amt) {
    if (!pl.totalIncome || pl.totalIncome === 0) return '—'
    return (Math.abs(amt) / pl.totalIncome * 100).toFixed(1) + '%'
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-6 space-y-6">
        {/* Income */}
        <div>
          <button onClick={() => setShowIncome(v => !v)}
            className="flex items-center gap-2 w-full text-left mb-3 group">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Income</h3>
            <span className="text-xs text-slate-400 group-hover:text-slate-600">{showIncome ? '▼' : '▶'}</span>
          </button>
          {showIncome && (
            <div className="space-y-1.5">
              {pl.income.map(([name, amt]) => (
                <div key={name} className="flex justify-between items-center text-sm gap-4">
                  <span className="text-slate-700">{name}</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(amt)}</span>
                </div>
              ))}
              {pl.income.length === 0 && <p className="text-sm text-slate-400">No income recorded</p>}
            </div>
          )}
          <div className="flex justify-between items-center text-sm font-semibold mt-3 pt-3 border-t border-slate-100">
            <span>Total Income</span>
            <span className="font-mono text-emerald-600">{formatCurrency(pl.totalIncome)}</span>
          </div>
        </div>

        {/* Expenses */}
        <div>
          <button onClick={() => setShowExpenses(v => !v)}
            className="flex items-center gap-2 w-full text-left mb-3 group">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expenses</h3>
            <span className="text-xs text-slate-400 group-hover:text-slate-600">{showExpenses ? '▼' : '▶'}</span>
          </button>
          {showExpenses && (
            <div className="space-y-1.5">
              {pl.expenses.map(([name, amt]) => (
                <div key={name} className="flex justify-between items-center text-sm gap-4">
                  <span className="text-slate-700 flex-1">{name}</span>
                  {showPct && (
                    <span className="font-mono text-slate-400 text-xs w-12 text-right">{pct(amt)}</span>
                  )}
                  <span className="font-mono text-red-600">{formatCurrency(amt)}</span>
                </div>
              ))}
              {pl.expenses.length === 0 && <p className="text-sm text-slate-400">No expenses recorded</p>}
            </div>
          )}
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

function MonthlyPLTable({ monthlyData, months, monthFrom, monthTo, year, showPct }) {
  const [showIncome, setShowIncome] = useState(true)
  const [showExpenses, setShowExpenses] = useState(true)
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
          {/* Income header row */}
          <tr className="bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => setShowIncome(v => !v)}>
            <td colSpan={keys.length + 2} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="mr-1.5">{showIncome ? '▼' : '▶'}</span>Income
            </td>
          </tr>
          {showIncome && (() => {
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
          {/* Expenses header row */}
          <tr className="bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => setShowExpenses(v => !v)}>
            <td colSpan={keys.length + 2} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="mr-1.5">{showExpenses ? '▼' : '▶'}</span>Expenses
            </td>
          </tr>
          {showExpenses && (() => {
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
                    const monthIncome = monthlyData[k].totalIncome
                    const pct = showPct && row && monthIncome > 0
                      ? (Math.abs(row[1]) / monthIncome * 100).toFixed(1) + '%'
                      : null
                    return (
                      <td key={k} className="px-4 py-2 text-right font-mono text-red-500">
                        {row ? (
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            {pct && <span className="text-slate-400 text-xs">{pct}</span>}
                            {formatCurrency(row[1])}
                          </span>
                        ) : '—'}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-right font-mono font-semibold text-red-500">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      {showPct && keys.reduce((s, k) => s + monthlyData[k].totalIncome, 0) > 0 && (
                        <span className="text-slate-400 text-xs">
                          {(Math.abs(total) / keys.reduce((s, k) => s + monthlyData[k].totalIncome, 0) * 100).toFixed(1)}%
                        </span>
                      )}
                      {formatCurrency(total)}
                    </span>
                  </td>
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
