// Auto-categorization rules engine

// Rules with company_id = null apply to all facilities
// Rules with company_id set only apply when importing for that company
// Keywords support comma-separated values — ANY match triggers the rule
// e.g. "MARATHON, LOWE'S, CIRCLE K" will match any of those vendors

export function applyRules(transactions, rules, companyId) {
  // Filter rules: keep global rules + rules scoped to this company
  const applicable = rules.filter(r => !r.company_id || r.company_id === companyId)

  return transactions.map(t => {
    // Don't overwrite if already has both category and type
    if (t.category_id && t.expense_type) return t

    const desc = (t.description || '').toUpperCase().trim()

    for (const rule of applicable) {
      // Support comma-separated keywords — split and check each one
      const keywords = (rule.keyword || '')
        .split(',')
        .map(k => k.trim().toUpperCase())
        .filter(Boolean)

      const matched = keywords.some(keyword => {
        if (!keyword) return false
        if (rule.match_type === 'contains') return desc.includes(keyword)
        if (rule.match_type === 'starts_with') return desc.startsWith(keyword)
        if (rule.match_type === 'exact') return desc === keyword
        return false
      })

      if (matched) {
        return {
          ...t,
          category_id: t.category_id || rule.category_id || '',
          expense_type: t.expense_type || rule.expense_type || '',
          auto_matched: true,
        }
      }
    }

    return t
  })
}
