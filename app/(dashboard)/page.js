'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { filterTransactions, buildPL, formatCurrency } from '@/lib/reports/pl'

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

function monthPrefix(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function pctChange(current, prior) {
  if (!prior || prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

function PctBadge({ value, invertColor }) {
  if (value === null) return null
  const positive = invertColor ? value < 0 : value >= 0
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {value >= 0 ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [balances, setBalances] = useState([])
  const [uncategorized, setUncategorized] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: tx }, { data: co }, { data: cat }, { data: acc }, { data: bal }] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, type)').order('date', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
      supabase.from('categories').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('monthly_balances').select('*'),
    ])
    setTransactions(tx || [])
    setCompanies(co || [])
    setCategories(cat || [])
    setAccounts(acc || [])
    setBalances(bal || [])
    setUncategorized((tx || []).filter(t => !t.category_id).length)
    setLoading(false)
  }

  // ── Cash position ────────────────────────────────────────────────
  const totalCash = accounts.reduce((sum, acc) => {
    const latest = balances
      .filter(b => b.account_id === acc.id)
      .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month))[0]
    return sum + (latest ? parseFloat(latest.balance) : 0)
  }, 0)
  const hasCashData = accounts.length > 0 && balances.some(b => accounts.find(a => a.id === b.account_id))

  // ── NOI: current month, last month, same month last year ─────────
  function detailedPL(year, month) {
    return buildPL(
      filterTransactions(transactions.filter(t => t.date.startsWith(monthPrefix(year, month))), 'detailed'),
      categories
    )
  }

  const prevMonth = CURRENT_MONTH === 1 ? { y: CURRENT_YEAR - 1, m: 12 } : { y: CURRENT_YEAR, m: CURRENT_MONTH - 1 }

  const currentPL  = detailedPL(CURRENT_YEAR, CURRENT_MONTH)
  const priorPL    = detailedPL(prevMonth.y, prevMonth.m)
  const priorYearPL = detailedPL(CURRENT_YEAR - 1, CURRENT_MONTH)

  const noiVsLastMonth   = pctChange(currentPL.noi, priorPL.noi)
  const noiVsLastYear    = pctChange(currentPL.noi, priorYearPL.noi)
  const revenueVsLastMonth = pctChange(currentPL.totalIncome, priorPL.totalIncome)

  // ── DSCR ─────────────────────────────────────────────────────────
  // YTD loan service payments (interest + principal categories)
  const loanServiceCategories = categories.filter(c =>
    c.name?.toLowerCase().includes('loan service')
  )
  const loanCatIds = new Set(loanServiceCategories.map(c => c.id))
  const ytdPrefix = `${CURRENT_YEAR}-`
  const monthsElapsed = CURRENT_MONTH

  const ytdDebtService = transactions
    .filter(t => t.date.startsWith(ytdPrefix) && loanCatIds.has(t.category_id) && t.amount < 0)
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0)

  const annualizedDebtService = monthsElapsed > 0 ? (ytdDebtService / monthsElapsed) * 12 : 0

  const ytdTx = filterTransactions(transactions.filter(t => t.date.startsWith(ytdPrefix)), 'detailed')
  const ytdPL = buildPL(ytdTx, categories)
  const annualizedNOI = monthsElapsed > 0 ? (ytdPL.noi / monthsElapsed) * 12 : 0
  const dscr = annualizedDebtService > 0 ? annualizedNOI / annualizedDebtService : null

  // ── Monthly P&L for current month ───────────────────────────────
  const monthPL = currentPL

  // Recent transactions
  const recent = transactions.slice(0, 8)

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  const currentMonthName = new Date(CURRENT_YEAR, CURRENT_MONTH - 1).toLocaleString('default', { month: 'long' })
  const prevMonthName = new Date(prevMonth.y, prevMonth.m - 1).toLocaleString('default', { month: 'long' })

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Portfolio Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">{CURRENT_YEAR} — {currentMonthName}</p>
      </div>

      {/* Setup / action alerts */}
      {companies.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Get started by adding your companies</p>
            <Link href="/settings" className="text-sm text-amber-700 underline">Go to Settings →</Link>
          </div>
        </div>
      )}
      {uncategorized > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{uncategorized} transactions</span> are uncategorized.{' '}
            <Link href="/transactions" className="underline">Categorize them →</Link>
          </p>
        </div>
      )}

      {/* ── Portfolio Snapshot ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Portfolio Snapshot</h2>
        <div className="grid grid-cols-4 gap-6 divide-x divide-slate-100">

          {/* Total cash */}
          <div className="pr-6">
            <p className="text-xs font-medium text-slate-400 mb-1">Total Cash Position</p>
            {hasCashData ? (
              <p className={`text-2xl font-bold font-mono ${totalCash >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                {formatCurrency(totalCash)}
              </p>
            ) : (
              <p className="text-lg font-medium text-slate-300">—</p>
            )}
            <Link href="/balances" className="text-xs text-slate-400 hover:text-slate-600 mt-1 inline-block underline">
              {hasCashData ? 'Manage accounts →' : 'Log balances →'}
            </Link>
          </div>

          {/* Current month NOI */}
          <div className="px-6">
            <p className="text-xs font-medium text-slate-400 mb-1">{currentMonthName} NOI</p>
            <p className={`text-2xl font-bold font-mono ${monthPL.noi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(monthPL.noi)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <PctBadge value={noiVsLastMonth} />
              {noiVsLastMonth !== null && (
                <span className="text-xs text-slate-400">vs {prevMonthName}</span>
              )}
            </div>
            {noiVsLastYear !== null && (
              <div className="flex items-center gap-2 mt-0.5">
                <PctBadge value={noiVsLastYear} />
                <span className="text-xs text-slate-400">vs {CURRENT_YEAR - 1}</span>
              </div>
            )}
          </div>

          {/* YTD NOI */}
          <div className="px-6">
            <p className="text-xs font-medium text-slate-400 mb-1">YTD NOI</p>
            <p className={`text-2xl font-bold font-mono ${ytdPL.noi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(ytdPL.noi)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {formatCurrency(ytdPL.totalIncome)} revenue − {formatCurrency(ytdPL.totalExpenses)} expenses
            </p>
          </div>

          {/* DSCR */}
          <div className="pl-6">
            <p className="text-xs font-medium text-slate-400 mb-1">DSCR <span className="font-normal">(annualized)</span></p>
            {dscr !== null ? (
              <>
                <p className={`text-2xl font-bold font-mono ${dscr >= 1.25 ? 'text-emerald-600' : dscr >= 1.0 ? 'text-amber-500' : 'text-red-600'}`}>
                  {dscr.toFixed(2)}x
                </p>
                <p className="text-xs mt-1">
                  <span className={`font-medium ${dscr >= 1.25 ? 'text-emerald-600' : dscr >= 1.0 ? 'text-amber-500' : 'text-red-600'}`}>
                    {dscr >= 1.25 ? 'Strong' : dscr >= 1.0 ? 'Adequate' : 'Below threshold'}
                  </span>
                  <span className="text-slate-400"> — lenders target ≥1.25x</span>
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-slate-300">—</p>
                <p className="text-xs text-slate-400 mt-1">Tag loan payments as "Loan Service"</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Per-entity NOI comparison ──────────────────────────── */}
      {companies.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Entity Comparison — {currentMonthName}</h2>
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(companies.length, 3)}, 1fr)` }}>
            {companies.map(co => {
              const coTx = filterTransactions(
                transactions.filter(t => t.company_id === co.id && t.date.startsWith(monthPrefix(CURRENT_YEAR, CURRENT_MONTH))),
                'detailed'
              )
              const coPL = buildPL(coTx, categories)
              const coPriorTx = filterTransactions(
                transactions.filter(t => t.company_id === co.id && t.date.startsWith(monthPrefix(prevMonth.y, prevMonth.m))),
                'detailed'
              )
              const coPriorPL = buildPL(coPriorTx, categories)
              const coNOIPct = pctChange(coPL.noi, coPriorPL.noi)
              return (
                <div key={co.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3">{co.name}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Revenue</span>
                      <span className="font-mono text-emerald-600">{formatCurrency(coPL.totalIncome)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Expenses</span>
                      <span className="font-mono text-red-500">{formatCurrency(coPL.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                      <span className="text-slate-700">NOI</span>
                      <div className="flex items-center gap-2">
                        <PctBadge value={coNOIPct} />
                        <span className={`font-mono ${coPL.noi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(coPL.noi)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick links ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link href="/forecast" className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Flow Forecast</p>
            <span className="text-slate-300 group-hover:text-slate-500 text-sm">→</span>
          </div>
          <p className="text-sm text-slate-600">90-day projection with one-time items</p>
        </Link>
        <Link href="/reports/pl" className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">P&L Statement</p>
            <span className="text-slate-300 group-hover:text-slate-500 text-sm">→</span>
          </div>
          <p className="text-sm text-slate-600">Full income statement by month or year</p>
        </Link>
        <Link href="/deal-room" className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal Room</p>
            <span className="text-slate-300 group-hover:text-slate-500 text-sm">→</span>
          </div>
          <p className="text-sm text-slate-600">Normalized NOI and cap rate valuation</p>
        </Link>
      </div>

      {/* ── Recent transactions ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Recent Transactions</h2>
          <Link href="/transactions" className="text-xs text-slate-500 hover:text-slate-900 underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-400 text-sm">No transactions yet.</p>
            <Link href="/import" className="text-sm text-slate-600 underline mt-1 inline-block">Import your first CSV →</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {recent.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-400 text-xs whitespace-nowrap w-24">{t.date}</td>
                  <td className="px-5 py-2.5 text-slate-700 truncate max-w-xs">{t.description}</td>
                  <td className="px-5 py-2.5 text-slate-500 text-xs">{t.categories?.name || <span className="text-amber-500">Uncategorized</span>}</td>
                  <td className={`px-5 py-2.5 text-right font-mono font-medium whitespace-nowrap ${parseFloat(t.amount) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {parseFloat(t.amount) >= 0 ? '+' : ''}{parseFloat(t.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
