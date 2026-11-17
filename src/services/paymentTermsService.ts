// Payment Terms Service - provides predefined payment terms
// These can be extended in the future to be stored in DB

export interface PaymentTerm {
  value: string
  label: string
  description?: string
}

export const PREDEFINED_PAYMENT_TERMS: PaymentTerm[] = [
  { value: 'Due on Receipt', label: 'Due on Receipt', description: 'Payment due immediately upon receipt' },
  { value: 'Net 7', label: 'Net 7', description: 'Payment due within 7 days' },
  { value: 'Net 10', label: 'Net 10', description: 'Payment due within 10 days' },
  { value: 'Net 15', label: 'Net 15', description: 'Payment due within 15 days' },
  { value: 'Net 30', label: 'Net 30', description: 'Payment due within 30 days' },
  { value: 'Net 45', label: 'Net 45', description: 'Payment due within 45 days' },
  { value: 'Net 60', label: 'Net 60', description: 'Payment due within 60 days' },
  { value: 'Net 90', label: 'Net 90', description: 'Payment due within 90 days' },
  { value: '2/10 Net 30', label: '2/10 Net 30', description: '2% discount if paid within 10 days, otherwise net 30' },
  { value: '1/15 Net 30', label: '1/15 Net 30', description: '1% discount if paid within 15 days, otherwise net 30' },
  { value: 'End of Month', label: 'End of Month', description: 'Payment due at the end of the month' },
  { value: 'End of Next Month', label: 'End of Next Month', description: 'Payment due at the end of next month' },
]

export function getPaymentTerms(): PaymentTerm[] {
  return PREDEFINED_PAYMENT_TERMS
}

export function getPaymentTermByValue(value: string): PaymentTerm | undefined {
  return PREDEFINED_PAYMENT_TERMS.find(term => term.value === value)
}


