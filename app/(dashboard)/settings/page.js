'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const MATCH_TYPE_LABELS = { contains: 'Contains', starts_with: 'Starts with', exact: 'Exact match' }
const EXPENSE_TYPE_LABELS = { opex: 'OpEx', one_time: 'One-Time', capex: 'CapEx', owner_addback: 'Add-Back' }

export default function SettingsPage() {
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

  const [newCompany, setNewCompany] = useState('')
  const [newCategory, setNewCategory] = useState({ name: '', type: 'expense' })
  const [newRule, setNewRule] = useState({ keyword: '', category_id: '', expense_type: '', match_type: 'contains', company_id: '' })
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [editingRule, setEditingRule] = useState(null)

  // Sources state
  const [newSource, setNewSource] = useState('')
  const [renamingSourceId, setRenamingSourceId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: co }, { data: cat }, { data: rul }, { data: src }, { data: role }, { data: { user } }] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('categorization_rules').select('*, categories(name)').order('created_at'),
      supabase.from('sources').select('*').order('name'),
      supabase.from('user_roles').select('role').single(),
      supabase.auth.getUser(),
    ])
    setCompanies(co || [])
    setCategories(cat || [])
    setRules(rul || [])
    setSources(src || [])
    setUserRole(role?.role || null)
    setCurrentUser(user)
    setLoading(false)
  }

  // ── Sources ──────────────────────────────────────────────────────
  async function addSource(e) {
    e.preventDefault()
    if (!newSource.trim()) return
    const { error } = await supabase.from('sources').insert({ name: newSource.trim() })
    if (error) { alert('Error: ' + error.message); return }
    setNewSource('')
    await loadAll()
  }

  async function renameSource(id, oldName) {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === oldName) { setRenamingSourceId(null); return }
    // Update source record
    const { error } = await supabase.from('sources').update({ name: trimmed }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    // Cascade rename to transactions and accounts
    await Promise.all([
      supabase.from('transactions').update({ source: trimmed }).eq('source', oldName),
      supabase.from('accounts').update({ source: trimmed }).eq('source', oldName),
    ])
    setRenamingSourceId(null)
    await loadAll()
  }

  async function deleteSource(id, name) {
    // Check if in use
    const [{ count: txCount }, { count: accCount }] = await Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('source', name),
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('source', name),
    ])
    const total = (txCount || 0) + (accCount || 0)
    const warning = total > 0
      ? `\n\nWarning: ${txCount || 0} transaction(s) and ${accCount || 0} account(s) use this source. They will keep the source name but it won't appear in dropdowns.`
      : ''
    if (!confirm(`Delete source "${name}"?${warning}`)) return
    await supabase.from('sources').delete().eq('id', id)
    await loadAll()
  }

  const isOwner = userRole === 'owner'

  async function addCompany(e) {
    e.preventDefault()
    if (!newCompany.trim()) return
    await supabase.from('companies').insert({ name: newCompany.trim() })
    setNewCompany('')
    await loadAll()
  }

  async function deleteCompany(id) {
    if (!confirm('Delete this company? All associated transactions will also be deleted.')) return
    await supabase.from('companies').delete().eq('id', id)
    await loadAll()
  }

  async function addCategory(e) {
    e.preventDefault()
    if (!newCategory.name.trim()) return
    await supabase.from('categories').insert({ name: newCategory.name.trim(), type: newCategory.type, sort_order: 50 })
    setNewCategory({ name: '', type: 'expense' })
    await loadAll()
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return
    await supabase.from('categories').delete().eq('id', id)
    await loadAll()
  }

  async function addRule(e) {
    e.preventDefault()
    if (!newRule.keyword.trim()) return
    const { error } = await supabase.from('categorization_rules').insert({
      keyword: newRule.keyword.trim(),
      category_id: newRule.category_id || null,
      expense_type: newRule.expense_type || null,
      match_type: newRule.match_type,
      company_id: newRule.company_id || null,
    })
    if (error) { alert('Error: ' + error.message); return }
    setNewRule({ keyword: '', category_id: '', expense_type: '', match_type: 'contains', company_id: '' })
    await loadAll()
  }

  async function deleteRule(id) {
    await supabase.from('categorization_rules').delete().eq('id', id)
    await loadAll()
  }

  function startEditRule(r) {
    setEditingRuleId(r.id)
    setEditingRule({
      keyword: r.keyword,
      match_type: r.match_type,
      category_id: r.category_id || '',
      expense_type: r.expense_type || '',
      company_id: r.company_id || '',
    })
  }

  async function saveEditRule(e) {
    e.preventDefault()
    const { error } = await supabase.from('categorization_rules').update({
      keyword: editingRule.keyword.trim(),
      match_type: editingRule.match_type,
      category_id: editingRule.category_id || null,
      expense_type: editingRule.expense_type || null,
      company_id: editingRule.company_id || null,
    }).eq('id', editingRuleId)
    if (error) { alert('Error: ' + error.message); return }
    setEditingRuleId(null)
    setEditingRule(null)
    await loadAll()
  }

  async function claimOwner() {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('user_roles').upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id' })
    if (error) { alert('Error claiming owner: ' + error.message); return }
    await loadAll()
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading...</div>

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>

      {/* Role setup */}
      {!userRole && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-amber-900 mb-1">First-time setup</h3>
          <p className="text-sm text-amber-700 mb-3">No role assigned. Claim owner access to manage this workspace.</p>
          <button onClick={claimOwner} className="bg-amber-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-amber-800">
            Claim Owner Access
          </button>
        </div>
      )}

      {/* Companies */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Companies / Entities</h2>
          <p className="text-xs text-slate-500 mt-0.5">Your LLC entities</p>
        </div>
        <div className="p-5 space-y-3">
          {companies.map(c => (
            <div key={c.id} className="flex items-center justify-between">
              <span className="text-sm text-slate-800">{c.name}</span>
              {isOwner && <button onClick={() => deleteCompany(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>}
            </div>
          ))}
          {companies.length === 0 && <p className="text-sm text-slate-400">No companies yet.</p>}
          {isOwner && (
            <form onSubmit={addCompany} className="flex gap-2 mt-2">
              <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="e.g. Sunshine Storage LLC"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">Add</button>
            </form>
          )}
        </div>
      </section>

      {/* Sources */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Transaction Sources</h2>
          <p className="text-xs text-slate-500 mt-0.5">Bank and credit card sources used across transactions, imports, and account reconciliation</p>
        </div>
        <div className="p-5 space-y-2">
          {sources.length === 0 && <p className="text-sm text-slate-400">No sources yet.</p>}
          {sources.map(s => (
            <div key={s.id} className="flex items-center justify-between py-1">
              {renamingSourceId === s.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => renameSource(s.id, s.name)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameSource(s.id, s.name)
                    if (e.key === 'Escape') setRenamingSourceId(null)
                  }}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 mr-3"
                />
              ) : (
                <span className="text-sm text-slate-700 font-mono bg-slate-50 px-2 py-0.5 rounded">{s.name}</span>
              )}
              {isOwner && renamingSourceId !== s.id && (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setRenamingSourceId(s.id); setRenameValue(s.name) }}
                    className="text-xs text-slate-400 hover:text-slate-700"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteSource(s.id, s.name)}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {isOwner && (
            <form onSubmit={addSource} className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
              <input
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                placeholder="e.g. Chase Business Checking"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">
                Add
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Auto-Categorization Rules */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Auto-Categorization Rules</h2>
          <p className="text-xs text-slate-500 mt-0.5">Automatically categorize transactions on import by matching description keywords</p>
        </div>
        <div className="p-5 space-y-3">
          {rules.length === 0 && <p className="text-sm text-slate-400">No rules yet. Add one below.</p>}
          {rules.map(r => {
            const scopedCompany = companies.find(c => c.id === r.company_id)
            const isEditing = editingRuleId === r.id

            if (isEditing && editingRule) {
              return (
                <form key={r.id} onSubmit={saveEditRule} className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Keyword</label>
                      <input
                        value={editingRule.keyword}
                        onChange={e => setEditingRule(p => ({ ...p, keyword: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Match Type</label>
                      <select value={editingRule.match_type} onChange={e => setEditingRule(p => ({ ...p, match_type: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="contains">Contains</option>
                        <option value="starts_with">Starts with</option>
                        <option value="exact">Exact match</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                      <select value={editingRule.category_id} onChange={e => setEditingRule(p => ({ ...p, category_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="">— None —</option>
                        <optgroup label="Income">
                          {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                        <optgroup label="Expenses">
                          {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Expense Type</label>
                      <select value={editingRule.expense_type} onChange={e => setEditingRule(p => ({ ...p, expense_type: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="">— None —</option>
                        <option value="opex">OpEx</option>
                        <option value="one_time">One-Time</option>
                        <option value="capex">CapEx</option>
                        <option value="owner_addback">Add-Back</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Facility</label>
                      <select value={editingRule.company_id} onChange={e => setEditingRule(p => ({ ...p, company_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900">
                        <option value="">All Facilities</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800">Save</button>
                    <button type="button" onClick={() => { setEditingRuleId(null); setEditingRule(null) }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                  </div>
                </form>
              )
            }

            return (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{r.keyword}</span>
                  <span className="text-xs text-slate-400">{MATCH_TYPE_LABELS[r.match_type]}</span>
                  <span className="text-xs text-slate-400">→</span>
                  {r.categories && <span className="text-xs text-slate-700 font-medium">{r.categories.name}</span>}
                  {r.expense_type && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                      {EXPENSE_TYPE_LABELS[r.expense_type]}
                    </span>
                  )}
                  {scopedCompany ? (
                    <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-medium">
                      {scopedCompany.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">All facilities</span>
                  )}
                </div>
                {isOwner && (
                  <div className="flex gap-3 ml-3 flex-shrink-0">
                    <button onClick={() => startEditRule(r)} className="text-xs text-slate-400 hover:text-slate-700">Edit</button>
                    <button onClick={() => deleteRule(r.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                  </div>
                )}
              </div>
            )
          })}

          {isOwner && (
            <form onSubmit={addRule} className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Keyword</label>
                  <input
                    value={newRule.keyword}
                    onChange={e => setNewRule(p => ({ ...p, keyword: e.target.value }))}
                    placeholder="e.g. PAYABLI, INSURANCE"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Match Type</label>
                  <select
                    value={newRule.match_type}
                    onChange={e => setNewRule(p => ({ ...p, match_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="contains">Contains</option>
                    <option value="starts_with">Starts with</option>
                    <option value="exact">Exact match</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Category (optional)</label>
                  <select
                    value={newRule.category_id}
                    onChange={e => setNewRule(p => ({ ...p, category_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">— None —</option>
                    <optgroup label="Income">
                      {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Expenses">
                      {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expense Type (optional)</label>
                  <select
                    value={newRule.expense_type}
                    onChange={e => setNewRule(p => ({ ...p, expense_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">— None —</option>
                    <option value="opex">OpEx</option>
                    <option value="one_time">One-Time</option>
                    <option value="capex">CapEx</option>
                    <option value="owner_addback">Add-Back</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Facility (optional — leave blank to apply to all)</label>
                  <select
                    value={newRule.company_id}
                    onChange={e => setNewRule(p => ({ ...p, company_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">All Facilities</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">
                Add Rule
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Chart of Accounts */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Chart of Accounts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Income and expense categories</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Income</h3>
            <div className="space-y-1.5">
              {incomeCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{c.name}</span>
                  {isOwner && <button onClick={() => deleteCategory(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Expenses</h3>
            <div className="space-y-1.5">
              {expenseCategories.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{c.name}</span>
                  {isOwner && <button onClick={() => deleteCategory(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>}
                </div>
              ))}
            </div>
          </div>
          {isOwner && (
            <form onSubmit={addCategory} className="flex gap-2 pt-2 border-t border-slate-100">
              <input value={newCategory.name} onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))}
                placeholder="New category name"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              <select value={newCategory.type} onChange={e => setNewCategory(p => ({ ...p, type: e.target.value }))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">Add</button>
            </form>
          )}
        </div>
      </section>

      {/* Account */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-800">{currentUser?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Role</span>
            <span className={`font-medium ${userRole === 'owner' ? 'text-slate-900' : 'text-slate-600'}`}>
              {userRole || 'No role assigned'}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
