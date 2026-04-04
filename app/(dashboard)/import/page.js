'use client'
import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/utils/supabase/client'
import { parseChase } from '@/lib/parsers/chase'
import { parseAmex } from '@/lib/parsers/amex'
import { parseSuncoast } from '@/lib/parsers/suncoast'
import ExpenseTypeBadge from '@/components/ExpenseTypeBadge'

const PARSERS = {
  chase: parseChase,
  amex: parseAmex,
  suncoast: parseSuncoast,
}

const SOURCE_LABELS = {
  chase: 'Chase Bank',
  amex: 'American Express',
  suncoast: 'Suncoast Credit Union',
}

export default function ImportPage() {
  const [companies, setCompanies] = useState([])
  const [categories, setCategories] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [source, setSource] = useState('chase')
  const [rows, setRows] = useState([])
  const [step, setStep] = useState(1) // 1=upload, 2=review, 3=done
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const fileRef = useRef()
  const supabase = createClient()

  useEffect(() => {
    loadCompanies()
    loadCategories()
  }, [])

  async function loadCompanies() {
    const { data } = await supabase.from('companies').select('*').order('name')
    setCompanies(data || [])
    if (data && data.length > 0) setCompanyId(data[0].id)
  }

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories(data || [])
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parser = PARSERS[source]
        if (!parser) return
        const parsed = parser(result.data)
        setRows(parsed.map(r => ({ ...r, category_id: '', expense_type: '', skip: false })))
        setStep(2)
      },
    })
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function toggleSkip(i) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, skip: !r.skip } : r))
  }

  async function saveTransactions() {
    setSaving(true)
    const toSave = rows
      .filter(r => !r.skip)
      .map(({ skip, ...r }) => ({
        ...r,
        company_id: companyId,
        category_id: r.category_id || null,
        expense_type: r.expense_type || null,
      }))

    const { error } = await supabase.from('transactions').insert(toSave)
    setSaving(false)
    if (!error) {
      setSavedCount(toSave.length)
      setStep(3)
    } else {
      alert('Error saving: ' + error.message)
    }
  }

  function reset() {
    setRows([])
    setStep(1)
    setSavedCount(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  // Step 1: Upload
  if (step === 1) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Import Transactions</h1>
        <p className="text-slate-500 text-sm mb-6">Upload a CSV from your bank or credit card</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Entity</label>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {companies.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No companies found. Add them in Settings first.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSource(val)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    source === val
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              disabled={!companyId}
              className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:text-sm file:cursor-pointer disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Done
  if (step === 3) {
    return (
      <div className="p-8 max-w-xl">
        <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Import Complete</h2>
          <p className="text-slate-500 text-sm">{savedCount} transactions saved</p>
          <button
            onClick={reset}
            className="mt-6 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-800"
          >
            Import another file
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Review
  const unskipped = rows.filter(r => !r.skip)
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Review Transactions</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unskipped.length} of {rows.length} transactions will be imported from {SOURCE_LABELS[source]}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={saveTransactions}
            disabled={saving || unskipped.length === 0}
            className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Save ${unskipped.length} transactions`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-8"></th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, i) => (
              <tr key={i} className={row.skip ? 'opacity-30' : ''}>
                <td className="px-4 py-2">
                  {row.is_autopayment && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">Auto</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-2 text-slate-800 max-w-xs truncate">{row.description}</td>
                <td className={`px-4 py-2 text-right font-mono font-medium whitespace-nowrap ${row.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={row.category_id}
                    onChange={e => updateRow(i, 'category_id', e.target.value)}
                    disabled={row.skip}
                    className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 min-w-36"
                  >
                    <option value="">— Uncategorized —</option>
                    <optgroup label="Income">
                      {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Expenses">
                      {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  </select>
                </td>
                <td className="px-4 py-2">
                  {row.amount < 0 && (
                    <select
                      value={row.expense_type}
                      onChange={e => updateRow(i, 'expense_type', e.target.value)}
                      disabled={row.skip}
                      className="border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">— Select —</option>
                      <option value="opex">OpEx</option>
                      <option value="one_time">One-Time</option>
                      <option value="capex">CapEx</option>
                      <option value="owner_addback">Add-Back</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleSkip(i)}
                    className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    title={row.skip ? 'Include' : 'Skip'}
                  >
                    {row.skip ? 'Include' : 'Skip'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
