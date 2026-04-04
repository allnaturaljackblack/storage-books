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
  const opexFiltered = applyExpenseFilter(filterTransactions(filtered, 'detailed'), 'opex_only')

  // Full P&L (all expense types) for the addback schedule
  const fullFiltered = filterTransactions(filtered, 'detailed')

  const opexPL = buildPL(opexFiltered, categories)
  const fullPL = buildPL(fullFiltered, categories)

  // Addback schedule: one-time + capex + owner addback transactions
  const addbackTx = fullFiltered.filter(t =>
    t.expense_type === 'one_time' || t.expense_type === 'capex' || t.expense_type === 'owner_addback'
  )
  const totalAddbacks = addbackTx.reduce((s, t) => s + Math.abs(t.amount), 0)
  const normalizedNOI = opexPL.noi

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
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Gross Revenue</p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(opexPL.totalIncome)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Operating Expenses</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(opexPL.totalExpenses)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${normalizedNOI >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${normalizedNOI >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Normalized NOI</p>
          <p className={`text-2xl font-bold ${normalizedNOI >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(normalizedNOI)}</p>
        </div>
      </div>

      {/* Valuation */}
      {(impliedValue || capRateFromValue) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Valuation</h3>
          <div className="grid grid-cols-2 gap-4">
            {impliedValue && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Implied Value at {capRate}% cap rate</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(impliedValue)}</p>
              </div>
            )}
            {capRateFromValue && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Cap Rate at {formatCurrency(parseFloat(propertyValue))} value</p>
                <p className="text-lg font-bold text-slate-900">{capRateFromValue.toFixed(2)}%</p>
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
              {opexPL.income.map(([name, amt]) => (
                <div key={name} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-600">{name}</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100 mt-2">
                <span>Total Revenue</span>
                <span className="font-mono text-emerald-600">{formatCurrency(opexPL.totalIncome)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Operating Expenses</p>
              {opexPL.expenses.map(([name, amt]) => (
                <div key={name} className="flex justify-between text-sm py-0.5">
                  <span className="text-slate-600">{name}</span>
                  <span className="font-mono text-red-500">{formatCurrency(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100 mt-2">
                <span>Total OpEx</span>
                <span className="font-mono text-red-500">{formatCurrency(opexPL.totalExpenses)}</span>
              </div>
            </div>
            <div className={`rounded-lg p-3 ${normalizedNOI >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex justify-between font-bold text-sm">
                <span>NOI</span>
                <span className={`font-mono ${normalizedNOI >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(normalizedNOI)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Addback Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-900 text-sm">Add-Back & Non-Recurring Schedule</h2>
            <p className="text-xs text-slate-500 mt-0.5">Items excluded from normalized NOI</p>
          </div>
          <div className="p-5">
            {addbackTx.length === 0 ? (
              <p className="text-sm text-slate-400">No one-time, CapEx, or add-back items in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-1.5 text-xs font-semibold text-slate-500">Description</th>
                    <th className="text-left py-1.5 text-xs font-semibold text-slate-500">Type</th>
                    <th className="text-right py-1.5 text-xs font-semibold text-slate-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {addbackTx.map(t => (
                    <tr key={t.id}>
                      <td className="py-1.5 text-slate-600 pr-2 max-w-36 truncate">{t.description}</td>
                      <td className="py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          t.expense_type === 'one_time' ? 'bg-orange-50 text-orange-700' :
                          t.expense_type === 'capex' ? 'bg-amber-50 text-amber-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>
                          {t.expense_type === 'one_time' ? 'One-Time' : t.expense_type === 'capex' ? 'CapEx' : 'Add-Back'}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono text-slate-600">{formatCurrency(Math.abs(t.amount))}</td>
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
