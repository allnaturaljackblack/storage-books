// P&L computation helpers

// mode: 'detailed' | 'non_detailed' | 'full'
//   detailed     — individual CC line items + direct bank items (no autopayments)
//   non_detailed — bank transactions only (includes autopayments, ties to bank balance)
//   full         — everything

// expenseFilter: 'all' | 'opex_only' | 'exclude_capex'
//   all          — include everything
//   opex_only    — only opex transactions (for bank/deal room P&L)
//   exclude_capex — exclude capex (CapEx goes to balance sheet)

export function filterTransactions(transactions, mode) {
  if (mode === 'detailed') {
    // CC individual items + bank items that are NOT autopayments
    return transactions.filter(t =>
      t.source_type === 'credit_card' ||
      (t.source_type === 'bank' && !t.is_autopayment)
    )
  }
  if (mode === 'non_detailed') {
    // Bank only (includes autopayments — these tie to monthly bank balances)
    return transactions.filter(t => t.source_type === 'bank')
  }
  // full — everything
  return transactions
}

export function applyExpenseFilter(transactions, expenseFilter) {
  if (expenseFilter === 'opex_only') {
    return transactions.filter(t =>
      t.amount > 0 || // always keep income
      t.expense_type === 'opex' ||
      t.expense_type === null // uncategorized treated as opex
    )
  }
  if (expenseFilter === 'exclude_capex') {
    return transactions.filter(t => t.expense_type !== 'capex')
  }
  return transactions
}

export function buildPL(transactions, categories) {
  const categoryMap = {}
  categories.forEach(c => { categoryMap[c.id] = c })

  const income = {}
  const expenses = {}
  let totalIncome = 0
  let totalExpenses = 0

  transactions.forEach(t => {
    const cat = t.category_id ? categoryMap[t.category_id] : null
    const catName = cat ? cat.name : 'Uncategorized'
    const catType = cat ? cat.type : (t.amount >= 0 ? 'income' : 'expense')

    if (catType === 'income' || t.amount > 0) {
      income[catName] = (income[catName] || 0) + Math.abs(t.amount)
      totalIncome += Math.abs(t.amount)
    } else {
      expenses[catName] = (expenses[catName] || 0) + Math.abs(t.amount)
      totalExpenses += Math.abs(t.amount)
    }
  })

  const noi = totalIncome - totalExpenses

  return {
    income: Object.entries(income).sort((a, b) => b[1] - a[1]),
    expenses: Object.entries(expenses).sort((a, b) => b[1] - a[1]),
    totalIncome,
    totalExpenses,
    noi,
  }
}

export function groupByMonth(transactions) {
  const months = {}
  transactions.forEach(t => {
    const key = t.date.slice(0, 7) // YYYY-MM
    if (!months[key]) months[key] = []
    months[key].push(t)
  })
  return Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}
