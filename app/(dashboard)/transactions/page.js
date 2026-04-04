'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import ExpenseTypeBadge from '@/components/ExpenseTypeBadge'
import CommentPanel from '@/components/CommentPanel'

const SOURCE_LABELS = { chase: 'Chase', amex: 'Amex', suncoast: 'Suncoast', manual: 'Manual' }

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [companyFilter, setCompanyFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Edit / comment state
  const [editingId, setEditingId] = useState(null)
  const [commentTxId, setCommentTxId] = useState(null)
  const [userRole, setUserRole] = useState(null)

  const supabase = createClient()

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: tx }, { data: co }, { data: cat }, { data: roleData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name, type)')
        .order('date', { ascending: false })
        .limit(500),
      supabase.from('companies').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('user_roles').select('role').single(),
    ])
    setTransactions(tx || [])
    setCompanies(co || [])
    setCategories(cat || [])
    setUserRole(roleData?.role || 'viewer')
    setLoading(false)
  }

  async function updateTransaction(id, updates) {
    await supabase.from('transactions').update(updates).eq('id', id)
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    setEditingId(null)
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const filtered = transactions.filter(t => {
    if (companyFilter !== 'all' && t.company_id !== companyFilter) return false
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false
    if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo && t.date > dateTo) return false
    if (search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const isOwner = userRole === 'owner'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
        <span className="text-sm text-slate-500">{filtered.length} transactions</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 w-48"
        />
        <select
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="all">All Entities</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="all">All Sources</option>
          {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <span className="self-center text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        {(companyFilter !== 'all' || sourceFilter !== 'all' || categoryFilter !== 'all' || search || dateFrom || dateTo) && (
          <button
            onClick={() => { setCompanyFilter('all'); setSourceFilter('all'); setCategoryFilter('all'); setSearch(''); setDateFrom(''); setDateTo('') }}
            className="text-sm text-slate-500 hover:text-slate-800 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No transactions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(t => {
                const company = companies.find(c => c.id === t.company_id)
                const editing = editingId === t.id
                return (
                  <tr key={t.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-2.5 text-slate-800 max-w-xs">
                      {editing ? (
                        <input
                          defaultValue={t.description}
                          onBlur={e => updateTransaction(t.id, { description: e.target.value })}
                          autoFocus
                          className="border border-slate-300 rounded px-2 py-0.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      ) : (
                        <span className="truncate block max-w-xs">{t.description}</span>
                      )}
                      {t.is_autopayment && (
                        <span className="text-xs text-slate-400 ml-1">(autopay)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{company?.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      {isOwner ? (
                        <select
                          value={t.category_id || ''}
                          onChange={e => updateTransaction(t.id, { category_id: e.target.value || null })}
                          className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 max-w-40"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-600">{t.categories?.name || 'Uncategorized'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isOwner && t.amount < 0 ? (
                        <select
                          value={t.expense_type || ''}
                          onChange={e => updateTransaction(t.id, { expense_type: e.target.value || null })}
                          className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="">— Type —</option>
                          <option value="opex">OpEx</option>
                          <option value="one_time">One-Time</option>
                          <option value="capex">CapEx</option>
                          <option value="owner_addback">Add-Back</option>
                        </select>
                      ) : (
                        <ExpenseTypeBadge type={t.expense_type} />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {SOURCE_LABELS[t.source] || t.source}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.amount >= 0 ? '+' : ''}{parseFloat(t.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setCommentTxId(t.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          title="Comments"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </button>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => setEditingId(editing ? null : t.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTransaction(t.id)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {commentTxId && (
        <CommentPanel transactionId={commentTxId} onClose={() => setCommentTxId(null)} />
      )}
    </div>
  )
}
