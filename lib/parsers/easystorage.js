// Easy Storage Solutions deposit summary parser
// Columns: Date | Processed | Adjustments | Fees | Net Amount | Status
// Only imports rows with Status = "Processed"
// Uses Net Amount as income (positive)

function parseDate(str) {
  if (!str) return null
  // "1/1/2026 06:37PM" → strip time, parse date
  const datePart = str.toString().trim().split(' ')[0]
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

function parseDollar(str) {
  if (!str) return null
  const cleaned = parseFloat(str.toString().replace(/[$,\s]/g, ''))
  return isNaN(cleaned) ? null : cleaned
}

function getCol(row, ...names) {
  const keys = Object.keys(row)
  for (const name of names) {
    const key = keys.find(k => k.trim().toLowerCase() === name.toLowerCase())
    if (key !== undefined) return row[key]
  }
  return undefined
}

export function parseEasyStorage(rows) {
  return rows
    .map(row => {
      const status = (getCol(row, 'Status', 'status') || '').toString().trim().toLowerCase()
      if (status !== 'processed') return null

      const dateRaw = getCol(row, 'Date', 'date')
      const date = parseDate(dateRaw)
      if (!date) return null

      const netRaw = getCol(row, 'Net Amount', 'net amount', 'Net', 'net')
      const amount = parseDollar(netRaw)
      if (amount === null) return null

      return {
        date,
        description: 'Deposit ACH MerchPayout SV9T',
        original_description: 'Deposit ACH MerchPayout SV9T',
        amount: Math.abs(amount), // always positive — income
        source: 'easystorage',
        source_type: 'bank',
        is_autopayment: false,
        category_id: '',
      }
    })
    .filter(Boolean)
}
