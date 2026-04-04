'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatCurrency } from '@/lib/reports/pl'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const BANK_ACCOUNTS = [
  { name: 'Chase Checking', source: 'chase' },
  { name: 'Suncoast Checking', source: 'suncoast' },
  { name: 'Suncoast Savings', source: 'suncoast' },
  { name: 'AmEx Balance', source: 'amex' },
]

export default function BalancesPage() {
  const [balances, setBalances] = useState([])
  const [companies, setCompanies] = useState([])
  const [transactions, setTransactions] = useState([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [editing, setEditing] = useState({}) // { key: value } where key = `companyId_accountName_year_month`
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: bal }, { data: co }, { data: tx }, { data: role }] = await Promise.all([
      supabase.from('monthly_balances').select('*'),
      supabase.from('companies').select('*').order('name'),
      supabase.from('transactions').select('date, amount, company_id, source_type').order('date'),
      supabase.from('user_roles').select('role').single(),
    ])
    setBalances(bal || [])
    setCompanies(co || [])
    setTransactions(tx || [])
    setUserRole(role?.role || 'viewer')
    if (co && co.length > 0) setCompanyFilter(co[0].id)
    setLoading(false)
  }

  const isOwner = userRole === 'owner'

  function getBalance(companyId, accountName, month) {
    return balances.find(b =>
      b.company_id === companyId &&
      b.account_name === accountName &&
      b.year === year &&
      b.month === month
    )
  }

  function editKey(companyId, accountName, month) {
    return `${companyId}_${accountName}_${year}_${month}`
  }

  function handleEdit(companyId, accountName, month, value) {
    setEditing(prev => ({ ...prev, [editKey(companyId, accountName, month)]: value }))
  }

  async function saveBalance(companyId, accountName, month) {
    const key = editKey(companyId, accountName, month)
    const value = editing[key]
    if (value === undefined || value === '') return

    setSaving(true)
    const existing = getBalance(companyId, accountName, month)
    if (existing) {
      await supabase.from('monthly_balances').update({ balance: parseFloat(value) }).eq('id', existing.id)
    } else {
      await supabase.from('monthly_balances').insert({
        company_id: companyId,
        account_name: accountName,
        source: BANK_ACCOUNTS.find(a => a.name === accountName)?.source,
        year,
        month,
        balance: parseFloat(value),
      })
    }
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n })
    await loadAll()
    setSaving(false)
  }

  // Compute transaction totals per month for reconciliation
  function getMonthlyTxTotal(companyId, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return transactions
      .filter(t => t.company_id === companyId && t.date.startsWith(prefix) && t.source_type === 'bank')
      .reduce((s, t) => s + parseFloat(t.amount), 0)
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  const selectedCompany = companies.find(c => c.id === companyFilter)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Monthly Bank Balances</h1>
        <p className="text-slate-500 text-sm mt-0.5">Enter month-end balances to reconcile against imported transactions</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Entity</label>
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
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
      </div>

      {/* Balance Entry Grid */}
      {companyFilter && (
        <div className="space-y-6">
          {BANK_ACCOUNTS.map(account => (
            <div key={account.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-sm text-slate-900">{account.name}</h3>
                <p className="text-xs text-slate-400">{selectedCompany?.name}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-32">Month</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Month-End Balance</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Net Transactions</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Prior Balance</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Expected Balance</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MONTHS.map((monthName, idx) => {
                      const month = idx + 1
                      const bal = getBalance(companyFilter, account.name, month)
                      const priorBal = getBalance(companyFilter, account.name, month - 1)
                      const balance = bal ? parseFloat(bal.balance) : null
                      const priorBalance = priorBal ? parseFloat(priorBal.balance) : null
                      const netTx = getMonthlyTxTotal(companyFilter, month)
                      const expected = priorBalance !== null ? priorBalance + netTx : null
                      const variance = balance !== null && expected !== null ? balance - expected : null
                      const key = editKey(companyFilter, account.name, month)
                      const editVal = editing[key]

                      return (
                        <tr key={month} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-600 font-medium">{monthName} {year}</td>
                          <td className="px-4 py-2.5 text-right">
                            {isOwner ? (
                              <input
                                type="number"
                                step="0.01"
                                value={editVal !== undefined ? editVal : (balance !== null ? balance : '')}
                                onChange={e => handleEdit(companyFilter, account.name, month, e.target.value)}
                                onBlur={() => saveBalance(companyFilter, account.name, month)}
                                placeholder="—"
                                className="w-32 text-right border border-slate-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                            ) : (
                              <span className="font-mono text-slate-700">{balance !== null ? formatCurrency(balance) : '—'}</span>
                            )}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono text-sm ${netTx >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {netTx !== 0 ? (netTx >= 0 ? '+' : '') + formatCurrency(netTx) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-sm">
                            {priorBalance !== null ? formatCurrency(priorBalance) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-sm">
                            {expected !== null ? formatCurrency(expected) : '—'}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono text-sm font-medium ${
                            variance === null ? 'text-slate-300' :
                            Math.abs(variance) < 1 ? 'text-emerald-600' :
                            'text-red-600'
                          }`}>
                            {variance !== null ? (Math.abs(variance) < 0.01 ? '✓' : formatCurrency(variance)) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Saving...
        </div>
      )}
    </div>
  )
}
