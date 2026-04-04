// Chase CSV columns:
// Card | Transaction Date | Post Date | Description | Category | Type | Amount | Memo
// Amount: negative = expense, positive = income
// Strip: Type === 'Payment' (auto-payments to credit cards — keep but flag)
// Note: we KEEP autopayments but flag them so non-detailed P&L can use them

function normalizeDate(str) {
  if (!str) return null
  const s = str.trim()
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return s
}

function isAutopayment(row) {
  const type = (row['Type'] || '').trim()
  const desc = (row['Description'] || '').toUpperCase()
  return (
    type === 'Payment' ||
    desc.includes('AUTOMATIC PAYMENT') ||
    desc.includes('AUTOPAY') ||
    desc.includes('ONLINE PAYMENT')
  )
}

export function parseChase(rows) {
  return rows
    .map(row => {
      const autopay = isAutopayment(row)
      const amount = parseFloat((row['Amount'] || '0').replace(/,/g, ''))
      const date = normalizeDate(row['Transaction Date'])
      if (isNaN(amount) || !date) return null

      return {
        date,
        description: (row['Description'] || '').trim(),
        original_description: (row['Description'] || '').trim(),
        amount, // negative = expense, positive = income — matches our convention
        source: 'chase',
        source_type: 'bank',
        is_autopayment: autopay,
      }
    })
    .filter(Boolean)
}
