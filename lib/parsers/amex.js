// Amex CSV columns:
// Date | Receipt | Description | Card Member | Account # | Amount
// Amount: POSITIVE = charge (expense), NEGATIVE = payment/credit
// Strip: "AUTOPAY PAYMENT" lines (Amex's record of receiving payment — not useful)
// Sign: negate amount so positive becomes negative (expense convention)

function normalizeDate(str) {
  if (!str) return null
  const s = str.trim()
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return s
}

function isPaymentRow(row) {
  const desc = (row['Description'] || '').toUpperCase()
  return (
    desc.includes('AUTOPAY PAYMENT') ||
    desc.includes('PAYMENT - THANK YOU') ||
    desc.includes('PAYMENT RECEIVED') ||
    desc.includes('ONLINE PAYMENT')
  )
}

export function parseAmex(rows) {
  return rows
    .filter(row => !isPaymentRow(row))
    .map(row => {
      // Amex: positive = charge → negate to match our convention (negative = expense)
      const raw = parseFloat((row['Amount'] || '0').replace(/,/g, ''))
      const amount = -raw
      const date = normalizeDate(row['Date'])
      if (isNaN(amount) || !date) return null

      return {
        date,
        description: (row['Description'] || '').trim(),
        original_description: (row['Description'] || '').trim(),
        amount,
        source: 'amex',
        source_type: 'credit_card',
        is_autopayment: false,
      }
    })
    .filter(Boolean)
}
