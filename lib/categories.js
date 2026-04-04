export const INCOME_CATEGORIES = [
  'Rental Income',
  'Late Fees',
  'Admin / Setup Fees',
  'Merchandise Sales',
  'Truck Rental Income',
  'Insurance Income',
  'Other Income',
]

export const EXPENSE_CATEGORIES = [
  'Property Tax',
  'Insurance',
  'Utilities',
  'Maintenance & Repairs',
  'Landscaping / Snow Removal',
  'Management Fees',
  'Advertising & Marketing',
  'Software & Subscriptions',
  'Professional Fees',
  'Bank Fees & Charges',
  'Credit Card Fees',
  'Office Supplies',
  'Travel & Auto',
  'Payroll / Labor',
  'Mortgage / Loan Interest',
  'Depreciation',
  'Other Expense',
]

export const ALL_CATEGORIES = [
  ...INCOME_CATEGORIES.map(name => ({ name, type: 'income' })),
  ...EXPENSE_CATEGORIES.map(name => ({ name, type: 'expense' })),
]

export const EXPENSE_TYPES = [
  { value: 'opex', label: 'OpEx', color: 'blue' },
  { value: 'one_time', label: 'One-Time', color: 'orange' },
  { value: 'capex', label: 'CapEx', color: 'amber' },
  { value: 'owner_addback', label: 'Add-Back', color: 'purple' },
]

export const SOURCES = [
  { value: 'chase', label: 'Chase Bank', type: 'bank' },
  { value: 'suncoast', label: 'Suncoast CU', type: 'bank' },
  { value: 'amex', label: 'American Express', type: 'credit_card' },
  { value: 'manual', label: 'Manual Entry', type: 'bank' },
]
