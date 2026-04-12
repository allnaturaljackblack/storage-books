'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { filterTransactions, applyExpenseFilter, buildPL, formatCurrency } from '@/lib/reports/pl'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export default function DealRoomPage() {
  const [transactions, setTransactions] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const [companyFilter, setCompanyFilter] = useState('all')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [capRate, setCapRate] = useState('')
  const [propertyValue, setPropertyValue] = useState('')
  const [annualize, setAnnualize] = useState(true)

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

  const dateFrom = `${year}-01-01`
  const dateTo = `${year}-12-31`

  let filtered = transactions.filter(t => {
    if (t.date < dateFrom || t.date > dateTo) return false
    if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
    return true
  })

  // Deal room = detailed P&L (accrual) with OpEx only
  const opexFiltered = applyExpenseFilter(filterTransactions(filtered, 'detailed'), categories, 'opex_only')

  // Full P&L (all expense types) for the addback schedule
  const fullFiltered = filterTransactions(filtered, 'detailed')

  const opexPL = buildPL(opexFiltered, categories)
  const fullPL = buildPL(fullFiltered, categories)

  // Addback schedule: all expense transactions NOT tagged as opex, grouped by category
  const addbackTx = fullFiltered.filter(t =>
    t.amount < 0 && t.expense_type !== 'opex'
  )
  const categoryMap = {}
  categories.forEach(c => { categoryMap[c.id] = c })
  const addbackByCategory = Object.values(
    addbackTx.reduce((acc, t) => {
      const cat = t.category_id ? categoryMap[t.category_id] : null
      const catName = cat ? cat.name : 'Uncategorized'
      const key = catName
      if (!acc[key]) acc[key] = { name: catName, total: 0, types: new Set() }
      acc[key].total += Math.abs(t.amount)
      if (t.expense_type) acc[key].types.add(t.expense_type)
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total)
  const totalAddbacks = addbackByCategory.reduce((s, r) => s + r.total, 0)

  // Annualization: count distinct months with data, scale to 12
  const monthsWithData = new Set(opexFiltered.map(t => t.date.slice(0, 7))).size || 1
  const annFactor = annualize && monthsWithData < 12 ? 12 / monthsWithData : 1
  const isAnnualized = annFactor > 1

  function ann(val) { return val * annFactor }

  // Annualized P&L figures
  const annIncome = opexPL.income.map(([name, amt]) => [name, ann(amt)])
  const annExpenses = opexPL.expenses.map(([name, amt]) => [name, ann(amt)])
  const annTotalIncome = ann(opexPL.totalIncome)
  const annTotalExpenses = ann(opexPL.totalExpenses)
  const normalizedNOI = annTotalIncome - annTotalExpenses

  const impliedValue = capRate ? (normalizedNOI / (parseFloat(capRate) / 100)) : null
  const capRateFromValue = propertyValue ? (normalizedNOI / parseFloat(propertyValue) * 100) : null

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Deal Room</h1>
          <p className="text-slate-500 text-sm mt-0.5">Normalized P&L for bank submissions and sale underwriting</p>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
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
          <label className="block text-xs font-medium text-slate-500 mb-1">Cap Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={capRate}
            onChange={e => setCapRate(e.target.value)}
            placeholder="e.g. 6.5"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 w-28"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Property Value ($)</label>
          <input
            type="number"
            value={propertyValue}
            onChange={e => setPropertyValue(e.target.value)}
            placeholder="e.g. 2000000"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 w-36"
          />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setAnnualize(a => !a)}
              className={`relative w-9 h-5 rounded-full transition-colors ${annualize ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${annualize ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-slate-600 font-medium">Annualize</span>
          </label>
        </div>
      </div>
      {isAnnualized && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-700 flex items-center gap-2">
          <span className="font-semibold">Annualized</span>
          <span className="text-blue-500">—</span>
          <span>{monthsWithData} month{monthsWithData !== 1 ? 's' : ''} of data scaled to 12 months ({annFactor.toFixed(2)}× factor). All figures below reflect a full-year run rate.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
            Gross Revenue{isAnnualized ? ' (Ann.)' : ''}
          </p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(annTotalIncome)}</p>
          {isAnnualized && <p className="text-xs text-emerald-600 mt-1">Actual: {formatCurrency(opexPL.totalIncome)}</p>}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
            Operating Expenses{isAnnualized ? ' (Ann.)' : ''}
          </p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(annTotalExpenses)}</p>
          {isAnnualized && <p className="text-xs text-red-600 mt-1">Actual: {formatCurrency(opexPL.totalExpenses)}</p>}
        </div>
        <div className={`border rounded-xl p-4 ${normalizedNOI >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${normalizedNOI >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            Normalized NOI{isAnnualized ? ' (Ann.)' : ''}
          </p>
          <p className={`text-2xl font-bold ${normalizedNOI >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(normalizedNOI)}</p>
          {isAnnualized && <p className={`text-xs mt-1 ${normalizedNOI >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Actual: {formatCurrency(opexPL.noi)}</p>}
        </div>
      </div>

      {/* Valuation */}
      {(impliedValue || capRateFromValue) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Valuation</h3>
            <span className="text-xs text-slate-400">
              Based on {isAnnualized ? `annualized NOI (${monthsWithData}mo × ${annFactor.toFixed(2)})` : 'full-year NOI'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {impliedValue && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Implied Value at {capRate}% cap rate</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(impliedValue)}</p>
                <p className="text-xs text-slate-400 mt-1">NOI {formatCurrency(normalizedNOI)} ÷ {capRate}%</p>
              </div>
            )}
            {capRateFromValue && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Cap Rate at {formatCurrency(parseFloat(propertyValue))} value</p>
                <p className="text-xl font-bold text-slate-900">{capRateFromValue.toFixed(2)}%</p>
                <p className="text-xs text-slate-400 mt-1">NOI {formatCurrency(normalizedNOI)} ÷ {formatCurrency(parseFloat(propertyValue))}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Normalized Operating P&L */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-900 text-sm">Normalized Operating P&L</h2>
            <p className="text-xs text-slate-500 mt-0.5">OpEx only — for bank & buyer review</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Revenue</p>
              {annIncome.map(([name, amt]) => (
                <div key={name} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-600">{name}</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100 mt-2">
                <span>Total Revenue</span>
                <span className="font-mono text-emerald-600">{formatCurrency(annTotalIncome)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Operating Expenses</p>
              {annExpenses.map(([name, amt]) => (
                <div key={name} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-600">{name}</span>
                  <span className="font-mono text-red-500">{formatCurrency(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100 mt-2">
                <span>Total OpEx</span>
                <span className="font-mono text-red-500">{formatCurrency(annTotalExpenses)}</span>
              </div>
            </div>
            <div className={`rounded-lg p-3 ${normalizedNOI >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex justify-between font-bold text-sm">
                <span>NOI{isAnnualized ? ' (Annualized)' : ''}</span>
                <span className={`font-mono ${normalizedNOI >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(normalizedNOI)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Addback Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-900 text-sm">Add-Back & Non-Recurring Schedule</h2>
            <p className="text-xs text-slate-500 mt-0.5">All non-OpEx expenses — excluded from normalized NOI</p>
          </div>
          <div className="p-5">
            {addbackByCategory.length === 0 ? (
              <p className="text-sm text-slate-400">All expenses in this period are tagged as OpEx.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 text-xs font-semibold text-slate-500">Category</th>
                    <th className="text-left py-1.5 text-xs font-semibold text-slate-500">Tags</th>
                    <th className="text-right py-1.5 text-xs font-semibold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {addbackByCategory.map(row => (
                    <tr key={row.name}>
                      <td className="py-1.5 text-slate-600 pr-2">{row.name}</td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {row.types.size === 0 ? (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-500">Untagged</span>
                          ) : (
                            [...row.types].map(type => (
                              <span key={type} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                type === 'one_time' ? 'bg-orange-50 text-orange-700' :
                                type === 'capex' ? 'bg-amber-50 text-amber-700' :
                                type === 'owner_addback' ? 'bg-purple-50 text-purple-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {type === 'one_time' ? 'One-Time' :
                                 type === 'capex' ? 'CapEx' :
                                 type === 'owner_addback' ? 'Add-Back' : type}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-mono text-slate-600">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td colSpan={2} className="py-2 text-sm font-semibold">Total Add-Backs</td>
                    <td className="py-2 text-right font-mono font-semibold text-slate-900">{formatCurrency(totalAddbacks)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
