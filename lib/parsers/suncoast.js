// Suncoast CU CSV columns:
// Posted Date | Transaction Date | Description | Deposit | Withdrawal | Balance
// Deposit: positive amount (income)
// Withdrawal: positive amount → negate (expense)

function normalizeDate(str) {
  if (!str) return null
  const s = str.trim()
  // M/DD/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return s
}

function parseDollar(str) {
  if (!str || str.trim() === '') return null
  return parseFloat(str.replace(/[$,]/g, '').trim())
}

export function parseSuncoast(rows) {
  return rows
    .map(row => {
      const deposit = parseDollar(row['Deposit'])
      const withdrawal = parseDollar(row['Withdrawal'])
      const date = normalizeDate(row['Posted Date'] || row['Transaction Date'])
      if (!date) return null

      let amount = null
      if (deposit !== null && !isNaN(deposit) && deposit !== 0) {
        amount = deposit // positive = income
      } else if (withdrawal !== null && !isNaN(withdrawal) && withdrawal !== 0) {
        amount = -withdrawal // negate to negative = expense
      }

      if (amount === null) return null

      return {
        date,
        description: (row['Description'] || '').trim(),
        original_description: (row['Description'] || '').trim(),
        amount,
        source: 'suncoast',
        source_type: 'bank',
        is_autopayment: false,
      }
    })
    .filter(Boolean)
}
