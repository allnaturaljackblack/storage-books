'use client'
import { useState, useRef, useEffect } from 'react'

export default function CategoryCombobox({ categories, value, onChange, onCreateCategory, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef()
  const containerRef = useRef()

  const selected = categories.find(c => c.id === value)

  // Filter categories by query
  const filtered = query.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : categories

  const incomeFiltered = filtered.filter(c => c.type === 'income')
  const expenseFiltered = filtered.filter(c => c.type === 'expense')
  const showCreate = query.trim() && !categories.find(c => c.name.toLowerCase() === query.toLowerCase())

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        // Reset query to selected label if user typed but didn't pick
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(cat) {
    onChange(cat.id)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setQuery('')
    inputRef.current?.focus()
    setOpen(true)
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name) return
    const newCat = await onCreateCategory(name)
    if (newCat) {
      onChange(newCat.id)
      setQuery('')
      setOpen(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length === 1) handleSelect(filtered[0])
      else if (showCreate) handleCreate()
    }
  }

  if (disabled) {
    return <span className="text-xs text-slate-400 italic">—</span>
  }

  return (
    <div ref={containerRef} className="relative min-w-40">
      {/* Input / selected display */}
      {selected && !open ? (
        <div className="flex items-center gap-1 group">
          <span className="text-xs text-slate-700 truncate max-w-36">{selected.name}</span>
          <button
            onClick={handleClear}
            className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search category..."
          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white placeholder-slate-400"
        />
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {incomeFiltered.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Income</p>
                {incomeFiltered.map(c => (
                  <button key={c.id} onMouseDown={() => handleSelect(c)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                    {c.name}
                  </button>
                ))}
              </>
            )}
            {expenseFiltered.length > 0 && (
              <>
                <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Expenses</p>
                {expenseFiltered.map(c => (
                  <button key={c.id} onMouseDown={() => handleSelect(c)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                    {c.name}
                  </button>
                ))}
              </>
            )}
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">No categories found</p>
            )}
          </div>

          {/* Create new option */}
          {showCreate && (
            <div className="border-t border-slate-100">
              <button
                onMouseDown={handleCreate}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <span className="w-4 h-4 bg-slate-900 text-white rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                <span>Create <strong>"{query.trim()}"</strong></span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
