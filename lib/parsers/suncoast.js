// Suncoast CU CSV columns:
// Posted Date | Transaction Date | Description | Deposit | Withdrawal | Balance
// Deposit: positive amount (income)
// Withdrawal: positive amount → negate (expense)

function normalizeDate(str) {
  if (!str) return null
  const s = str.trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return s
}

function parseDollar(str) {
  if (!str) return null
  const s = str.toString().trim()
  if (s === '' || s === '-') return null
  // Handle ($100.00) parenthetical negatives
  const negative = s.startsWith('(') && s.endsWith(')')
  const cleaned = parseFloat(s.replace(/[$,()]/g, '').trim())
  if (isNaN(cleaned)) return null
  return negative ? -Math.abs(cleaned) : cleaned
}

function isAutopayment(description) {
  const d = (description || '').toUpperCase()
  return (
    d.includes('AMERICAN EXPRESS') ||
    d.includes('AMEX') ||
    d.includes('AUTOPAY') ||
    d.includes('AUTOPAYBUS') ||
    d.includes('CHASE CREDIT CRD') ||
    d.includes('CHASE CREDIT CARD') ||
    d.includes('CREDIT CARD PAYMENT') ||
    d.includes('CREDIT CARD PMT')
  )
}

// Find a column value case-insensitively, trimming whitespace from key names
function getCol(row, ...names) {
  const keys = Object.keys(row)
  for (const name of names) {
    const key = keys.find(k => k.trim().toLowerCase() === name.toLowerCase())
    if (key !== undefined) return row[key]
  }
  return undefined
}

export function parseSuncoast(rows) {
  return rows
    .map(row => {
      const depositRaw = getCol(row, 'Deposit', 'deposit', 'Credits', 'credit')
      const withdrawalRaw = getCol(row, 'Withdrawal', 'withdrawal', 'Withdrawals', 'Debits', 'debit')
      const descRaw = getCol(row, 'Description', 'description', 'Memo', 'memo')
      const dateRaw = getCol(row, 'Posted Date', 'posted date', 'Transaction Date', 'transaction date', 'Date', 'date')

      const date = normalizeDate(dateRaw)
      if (!date) return null

      const deposit = parseDollar(depositRaw)
      const withdrawal = parseDollar(withdrawalRaw)

      let amount = null

      // Deposit column has a value → income (positive)
      if (deposit !== null && deposit !== 0) {
        amount = Math.abs(deposit)
      }
      // Withdrawal column has a value → expense (negative)
      else if (withdrawal !== null && withdrawal !== 0) {
        amount = -Math.abs(withdrawal)
      }

      if (amount === null) return null

      return {
        date,
        description: (descRaw || '').toString().trim(),
        original_description: (descRaw || '').toString().trim(),
        amount,
        source: 'Suncoast Checking',
        source_type: 'bank',
        is_autopayment: isAutopayment((descRaw || '').toString()),
      }
    })
    .filter(Boolean)
}
