'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { buildPL, filterTransactions, formatCurrency } from '@/lib/reports/pl'

export default function BalanceSheetPage() {
  const [entries, setEntries] = useState([])
  const [companies, setCompanies] = useState([])
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [companyFilter, setCompanyFilter] = useState('all')
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

  // New entry form
  const [form, setForm] = useState({ name: '', type: 'asset', amount: '', notes: '' })
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: ent }, { data: co }, { data: tx }, { data: cat }, { data: role }] = await Promise.all([
      supabase.from('balance_sheet_entries').select('*').order('created_at'),
      supabase.from('companies').select('*').order('name'),
      supabase.from('transactions').select('*, categories(name, type)').order('date'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('user_roles').select('role').single(),
    ])
    setEntries(ent || [])
    setCompanies(co || [])
    setTransactions(tx || [])
    setCategories(cat || [])
    setUserRole(role?.role || 'viewer')
    setLoading(false)
  }

  const isOwner = userRole === 'owner'

  async function saveEntry(e) {
    e.preventDefault()
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      as_of_date: asOfDate,
      company_id: companyFilter === 'all' ? companies[0]?.id : companyFilter,
    }
    if (editingEntryId) {
      await supabase.from('balance_sheet_entries').update(payload).eq('id', editingEntryId)
    } else {
      await supabase.from('balance_sheet_entries').insert(payload)
    }
    setForm({ name: '', type: 'asset', amount: '', notes: '' })
    setEditingEntryId(null)
    setShowForm(false)
    await loadAll()
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('balance_sheet_entries').delete().eq('id', id)
    await loadAll()
  }

  function startEdit(entry) {
    setForm({ name: entry.name, type: entry.type, amount: entry.amount, notes: entry.notes || '' })
    setEditingEntryId(entry.id)
    setShowForm(true)
  }

  // Filter entries by company
  const filteredEntries = entries.filter(e =>
    companyFilter === 'all' || e.company_id === companyFilter
  )

  const assets = filteredEntries.filter(e => e.type === 'asset')
  const liabilities = filteredEntries.filter(e => e.type === 'liability')
  const totalAssets = assets.reduce((s, e) => s + parseFloat(e.amount), 0)
  const totalLiabilities = liabilities.reduce((s, e) => s + parseFloat(e.amount), 0)

  // Compute retained earnings from P&L (all time, up to asOfDate)
  const txUpToDate = transactions.filter(t =>
    t.date <= asOfDate &&
    (companyFilter === 'all' || t.company_id === companyFilter)
  )
  const filteredTx = filterTransactions(txUpToDate, 'full')
  const pl = buildPL(filteredTx, categories)
  const retainedEarnings = pl.noi

  const totalEquity = totalAssets - totalLiabilities
  const checkFigure = totalAssets - (totalLiabilities + totalEquity)

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Balance Sheet</h1>
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
          <label className="block text-xs font-medium text-slate-500 mb-1">As of Date</label>
          <input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        {isOwner && (
          <button
            onClick={() => { setShowForm(v => !v); setEditingEntryId(null); setForm({ name: '', type: 'asset', amount: '', notes: '' }) }}
            className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            + Add Entry
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && isOwner && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-sm text-slate-900 mb-4">{editingEntryId ? 'Edit Entry' : 'New Entry'}</h3>
          <form onSubmit={saveEntry} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
                placeholder="e.g. Storage Facility Land"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                required
                placeholder="0.00"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes (optional)</label>
              <input
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Mortgage balance, appraisal value, etc."
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">
                {editingEntryId ? 'Save Changes' : 'Add Entry'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-4 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Balance Sheet */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Balance Sheet — as of {asOfDate}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {companyFilter === 'all' ? 'Consolidated (All Entities)' : companies.find(c => c.id === companyFilter)?.name}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Assets */}
          <BSSection
            title="Assets"
            entries={assets}
            total={totalAssets}
            colorClass="text-emerald-600"
            isOwner={isOwner}
            onEdit={startEdit}
            onDelete={deleteEntry}
          />

          {/* Liabilities */}
          <BSSection
            title="Liabilities"
            entries={liabilities}
            total={totalLiabilities}
            colorClass="text-red-600"
            isOwner={isOwner}
            onEdit={startEdit}
            onDelete={deleteEntry}
          />

          {/* Equity */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Equity</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Retained Earnings (from P&L)</span>
                <span className={`font-mono ${retainedEarnings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(retainedEarnings)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Owner's Equity (Assets − Liabilities)</span>
                <span className={`font-mono ${totalEquity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(totalEquity)}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg p-4 bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between text-sm font-semibold">
              <span>Total Assets</span>
              <span className="font-mono text-emerald-600">{formatCurrency(totalAssets)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Total Liabilities</span>
              <span className="font-mono text-red-600">{formatCurrency(totalLiabilities)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2">
              <span>Owner's Equity</span>
              <span className={`font-mono font-bold ${totalEquity >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BSSection({ title, entries, total, colorClass, isOwner, onEdit, onDelete }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-1.5">
        {entries.map(e => (
          <div key={e.id} className="flex justify-between items-center text-sm group">
            <div className="flex items-center gap-2">
              <span className="text-slate-700">{e.name}</span>
              {e.notes && <span className="text-xs text-slate-400">({e.notes})</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-mono ${colorClass}`}>{formatCurrency(parseFloat(e.amount))}</span>
              {isOwner && (
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <button onClick={() => onEdit(e)} className="text-xs text-slate-400 hover:text-slate-700">Edit</button>
                  <button onClick={() => onDelete(e.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-slate-400">No entries</p>}
      </div>
      <div className="flex justify-between items-center text-sm font-semibold mt-3 pt-3 border-t border-slate-100">
        <span>Total {title}</span>
        <span className={`font-mono ${colorClass}`}>{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
