'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { filterTransactions, buildPL, formatCurrency } from '@/lib/reports/pl'

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

export default function DashboardPage() {
  const [transactions, setTransactions] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [uncategorized, setUncategorized] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: tx }, { data: co }, { data: cat }] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, type)').order('date', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
      supabase.from('categories').select('*'),
    ])
    setTransactions(tx || [])
    setCompanies(co || [])
    setCategories(cat || [])
    setUncategorized((tx || []).filter(t => !t.category_id).length)
    setLoading(false)
  }

  // YTD stats
  const ytdPrefix = `${CURRENT_YEAR}-`
  const ytdTx = filterTransactions(
    transactions.filter(t => t.date.startsWith(ytdPrefix)),
    'detailed'
  )
  const ytdPL = buildPL(ytdTx, categories)

  // Current month stats
  const monthPrefix = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}`
  const monthTx = filterTransactions(
    transactions.filter(t => t.date.startsWith(monthPrefix)),
    'detailed'
  )
  const monthPL = buildPL(monthTx, categories)

  // Recent transactions
  const recent = transactions.slice(0, 10)

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">Year-to-date financial summary — {CURRENT_YEAR}</p>
      </div>

      {/* Setup prompt */}
      {companies.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Get started by adding your companies</p>
            <Link href="/settings" className="text-sm text-amber-700 underline">Go to Settings →</Link>
          </div>
        </div>
      )}

      {/* Uncategorized warning */}
      {uncategorized > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{uncategorized} transactions</span> are uncategorized.{' '}
            <Link href="/transactions" className="underline">Categorize them →</Link>
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <KPICard
          label="YTD Revenue"
          value={formatCurrency(ytdPL.totalIncome)}
          color="emerald"
          sub={`${transactions.filter(t => t.date.startsWith(ytdPrefix)).length} transactions`}
        />
        <KPICard
          label="YTD Expenses"
          value={formatCurrency(ytdPL.totalExpenses)}
          color="red"
          sub="All expense types"
        />
        <KPICard
          label="YTD NOI"
          value={formatCurrency(ytdPL.noi)}
          color={ytdPL.noi >= 0 ? 'blue' : 'red'}
          sub="Revenue − Expenses"
        />
        <KPICard
          label={`${new Date().toLocaleString('default', { month: 'long' })} NOI`}
          value={formatCurrency(monthPL.noi)}
          color={monthPL.noi >= 0 ? 'blue' : 'red'}
          sub="Current month"
        />
      </div>

      {/* Per-entity breakdown */}
      {companies.length > 0 && (
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(companies.length, 3)}, 1fr)` }}>
          {companies.map(co => {
            const coTx = filterTransactions(
              transactions.filter(t => t.company_id === co.id && t.date.startsWith(ytdPrefix)),
              'detailed'
            )
            const coPL = buildPL(coTx, categories)
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
                    <span className={`font-mono ${coPL.noi >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(coPL.noi)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recent transactions */}
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

function KPICard({ label, value, color, sub }) {
  const colors = {
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-bold font-mono ${colors[color] || 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}
