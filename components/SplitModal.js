'use client'
import { useState, useEffect } from 'react'

export default function SplitModal({ transaction, categories, onConfirm, onClose }) {
  const total = Math.abs(parseFloat(transaction.amount))
  const isExpense = parseFloat(transaction.amount) < 0

  const [splits, setSplits] = useState([
    {
      description: transaction.description + ' — Interest',
      category_id: categories.find(c => c.name === 'Mortgage / Loan Interest')?.id || '',
      expense_type: 'opex',
      amount: '',
    },
    {
      description: transaction.description + ' — Principal',
      category_id: '',
      expense_type: 'capex',
      amount: '',
    },
  ])

  const splitTotal = splits.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const remaining = Math.round((total - splitTotal) * 100) / 100
  const isBalanced = Math.abs(remaining) < 0.01

  function updateSplit(i, field, value) {
    setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function addSplit() {
    setSplits(prev => [...prev, { description: transaction.description, category_id: '', expense_type: '', amount: '' }])
  }

  function removeSplit(i) {
    if (splits.length <= 2) return
    setSplits(prev => prev.filter((_, idx) => idx !== i))
  }

  // Auto-fill last split with remaining amount
  function fillRemaining(i) {
    if (remaining <= 0) return
    updateSplit(i, 'amount', remaining.toFixed(2))
  }

  function handleConfirm() {
    if (!isBalanced) return
    const result = splits.map(s => ({
      ...transaction,
      description: s.description,
      original_description: transaction.original_description || transaction.description,
      amount: isExpense ? -(parseFloat(s.amount)) : parseFloat(s.amount),
      category_id: s.category_id || null,
      expense_type: s.expense_type || null,
      auto_matched: false,
    }))
    onConfirm(result)
  }

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Split Transaction</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{transaction.description}</span>
            <span className="mx-2">·</span>
            <span className={`font-mono font-medium ${isExpense ? 'text-red-600' : 'text-emerald-600'}`}>
              {isExpense ? '-' : '+'}{total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </span>
            <span className="mx-2">·</span>
            <span>{transaction.date}</span>
          </div>
        </div>

        {/* Splits */}
        <div className="p-5 space-y-3">
          {splits.map((s, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Split {i + 1}</span>
                {splits.length > 2 && (
                  <button onClick={() => removeSplit(i)} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
                )}
              </div>

              <input
                value={s.description}
                onChange={e => updateSplit(i, 'description', e.target.value)}
                placeholder="Description"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={s.category_id}
                  onChange={e => updateSplit(i, 'category_id', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">— Category —</option>
                  <optgroup label="Income">
                    {incomeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Expenses">
                    {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                </select>

                <select
                  value={s.expense_type}
                  onChange={e => updateSplit(i, 'expense_type', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="">— Type —</option>
                  <option value="opex">OpEx</option>
                  <option value="one_time">One-Time</option>
                  <option value="capex">CapEx</option>
                  <option value="owner_addback">Add-Back</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={s.amount}
                  onChange={e => updateSplit(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                {remaining > 0 && (
                  <button
                    onClick={() => fillRemaining(i)}
                    className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded px-2 py-1.5 bg-white whitespace-nowrap"
                  >
                    Fill {remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={addSplit}
            className="w-full py-2 text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            + Add another split
          </button>
        </div>

        {/* Balance indicator + confirm */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className={`text-sm font-medium ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
            {isBalanced ? (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Balanced
              </span>
            ) : (
              <span>
                {remaining > 0
                  ? `${remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} unallocated`
                  : `${Math.abs(remaining).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} over`
                }
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isBalanced}
              className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm Split
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
