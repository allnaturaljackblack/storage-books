'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function SettingsPage() {
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

  const [newCompany, setNewCompany] = useState('')
  const [newCategory, setNewCategory] = useState({ name: '', type: 'expense' })
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState('viewer')

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: co }, { data: cat }, { data: role }, { data: { user } }] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('user_roles').select('role').single(),
      supabase.auth.getUser(),
    ])
    setCompanies(co || [])
    setCategories(cat || [])
    setUserRole(role?.role || null)
    setCurrentUser(user)
    setLoading(false)
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
    await supabase.from('categories').insert({
      name: newCategory.name.trim(),
      type: newCategory.type,
      sort_order: 50,
    })
    setNewCategory({ name: '', type: 'expense' })
    await loadAll()
  }

  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return
    await supabase.from('categories').delete().eq('id', id)
    await loadAll()
  }

  async function claimOwner() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_roles').upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id' })
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
          <p className="text-sm text-amber-700 mb-3">
            No role assigned to your account. Claim owner access to manage this workspace.
          </p>
          <button
            onClick={claimOwner}
            className="bg-amber-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-amber-800"
          >
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
              {isOwner && (
                <button
                  onClick={() => deleteCompany(c.id)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          {companies.length === 0 && (
            <p className="text-sm text-slate-400">No companies yet. Add your first LLC below.</p>
          )}
          {isOwner && (
            <form onSubmit={addCompany} className="flex gap-2 mt-2">
              <input
                value={newCompany}
                onChange={e => setNewCompany(e.target.value)}
                placeholder="e.g. Sunshine Storage LLC"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">
                Add
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Categories */}
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
                  {isOwner && (
                    <button onClick={() => deleteCategory(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                  )}
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
                  {isOwner && (
                    <button onClick={() => deleteCategory(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {isOwner && (
            <form onSubmit={addCategory} className="flex gap-2 pt-2 border-t border-slate-100">
              <input
                value={newCategory.name}
                onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))}
                placeholder="New category name"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <select
                value={newCategory.type}
                onChange={e => setNewCategory(p => ({ ...p, type: e.target.value }))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-slate-800">
                Add
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Account info */}
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
