// Google Sheet CSV parser
// Expected columns:
// Description | Category | Expense | Refund (Yes/No) | Date | Account Source

function normalizeDate(str) {
  if (!str) return null
  const s = str.toString().trim()
  // M/D/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return s
}

function parseDollar(str) {
  if (!str) return null
  const cleaned = parseFloat(str.toString().replace(/[$,\s]/g, ''))
  return isNaN(cleaned) ? null : cleaned
}

// Find a column value case-insensitively
function getCol(row, ...names) {
  const keys = Object.keys(row)
  for (const name of names) {
    const key = keys.find(k => k.trim().toLowerCase() === name.toLowerCase())
    if (key !== undefined) return row[key]
  }
  return undefined
}

function detectSource(accountSource, sheetType) {
  const s = (accountSource || '').toLowerCase()
  // For CC detail sheets, source_type is always credit_card — detect which card
  if (sheetType === 'credit_card') {
    if (s.includes('amex') || s.includes('american express')) return { source: 'amex', source_type: 'credit_card' }
    if (s.includes('chase')) return { source: 'chase', source_type: 'credit_card' }
    return { source: 'manual', source_type: 'credit_card' }
  }
  // Bank-level sheet
  if (s.includes('suncoast')) return { source: 'suncoast', source_type: 'bank' }
  if (s.includes('chase')) return { source: 'chase', source_type: 'bank' }
  if (s.includes('amex') || s.includes('american express')) return { source: 'amex', source_type: 'credit_card' }
  return { source: 'manual', source_type: 'bank' }
}

function detectAutopayment(description) {
  const d = (description || '').toUpperCase()
  return (
    d.includes('AMERICAN EXPRESS') ||
    d.includes('AMEX') ||
    d.includes('AUTOPAY') ||
    d.includes('CREDIT CARD PAYMENT') ||
    d.includes('CREDIT CARD PMT') ||
    d.includes('CHASE PAYMENT') ||
    d.includes('CHASE CREDIT CARD')
  )
}

// Try to match sheet category name to a DB category
function matchCategory(sheetCategoryName, categories) {
  if (!sheetCategoryName || !categories?.length) return null
  const name = sheetCategoryName.trim().toLowerCase()
  // Exact match first
  const exact = categories.find(c => c.name.toLowerCase() === name)
  if (exact) return exact.id
  // Partial match
  const partial = categories.find(c =>
    c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase())
  )
  return partial ? partial.id : null
}

// sheetType: 'bank' (cash-basis, includes CC autopayments) | 'credit_card' (individual CC line items)
export function parseGoogleSheet(rows, categories = [], sheetType = 'bank') {
  return rows
    .map(row => {
      const description = (getCol(row, 'Description', 'description') || '').toString().trim()
      const categoryName = (getCol(row, 'Category', 'category') || '').toString().trim()
      const expenseRaw = getCol(row, 'Expense', 'expense', 'Amount', 'amount')
      const refund = (getCol(row, 'Refund (Yes/No)', 'Refund', 'refund') || '').toString().trim().toLowerCase()
      const dateRaw = getCol(row, 'Date', 'date')
      const accountSource = getCol(row, 'Account Source', 'account source', 'Account', 'Source') || ''

      const date = normalizeDate(dateRaw)
      if (!date) return null

      const rawAmount = parseDollar(expenseRaw)
      if (rawAmount === null) return null

      // Expenses are positive in the sheet → negate
      // Refund = Yes → keep positive (it's money back)
      const isRefund = refund === 'yes' || refund === 'y'
      const amount = isRefund ? Math.abs(rawAmount) : -Math.abs(rawAmount)

      const { source, source_type } = detectSource(accountSource, sheetType)
      const category_id = matchCategory(categoryName, categories)
      const desc = description || categoryName
      const is_autopayment = sheetType === 'bank' ? detectAutopayment(desc) : false

      return {
        date,
        description: desc,
        original_description: desc,
        amount,
        source,
        source_type,
        is_autopayment,
        category_id: category_id || '',
        sheet_category: categoryName,
      }
    })
    .filter(Boolean)
}
