const STYLES = {
  opex: 'bg-blue-50 text-blue-700 border-blue-200',
  one_time: 'bg-orange-50 text-orange-700 border-orange-200',
  capex: 'bg-amber-50 text-amber-700 border-amber-200',
  owner_addback: 'bg-purple-50 text-purple-700 border-purple-200',
}

const LABELS = {
  opex: 'OpEx',
  one_time: 'One-Time',
  capex: 'CapEx',
  owner_addback: 'Add-Back',
}

export default function ExpenseTypeBadge({ type }) {
  if (!type) return null
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STYLES[type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {LABELS[type] || type}
    </span>
  )
}
