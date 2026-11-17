/**
 * Payment Method to Account Mapping Utility
 * 
 * Maps payment methods to their respective accounts for journal entries.
 * Handles special cases like bank charges for card payments.
 */

export interface PaymentAccountMapping {
  account_id: string
  account_name: string
  bankCharges?: number // Bank charges amount (for card payments)
  bankChargesPercentage?: number // Bank charges percentage (for card payments)
}

/**
 * Maps payment method to account ID and name
 * 
 * Rules:
 * - "BANK", "Bank Transfer" → Bank Account
 * - "Card", "Credit Card" → Bank Account (with 3.5% bank charges)
 * - "Cash" → Cash Account
 * - Other payment methods → Default to Cash Account
 * 
 * @param paymentMethod - The payment method name (case-insensitive)
 * @returns PaymentAccountMapping with account_id, account_name, and optional bank charges
 */
export function getPaymentAccountMapping(paymentMethod?: string): PaymentAccountMapping {
  if (!paymentMethod) {
    return {
      account_id: 'CASH',
      account_name: 'Cash',
    }
  }

  const normalizedMethod = paymentMethod.toLowerCase().trim()

  // Bank Transfer / Bank payments
  if (normalizedMethod === 'bank' || normalizedMethod === 'bank transfer' || normalizedMethod.includes('bank')) {
    return {
      account_id: 'BANK',
      account_name: 'Bank',
    }
  }

  // Card / Credit Card payments → Bank Account with 3.5% bank charges
  if (
    normalizedMethod === 'card' ||
    normalizedMethod === 'credit card' ||
    normalizedMethod.includes('card') ||
    normalizedMethod.includes('credit')
  ) {
    return {
      account_id: 'BANK',
      account_name: 'Bank',
      bankChargesPercentage: 3.5,
    }
  }

  // Cash payments
  if (normalizedMethod === 'cash') {
    return {
      account_id: 'CASH',
      account_name: 'Cash',
    }
  }

  // Default to Cash for unknown payment methods
  return {
    account_id: 'CASH',
    account_name: 'Cash',
  }
}

/**
 * Calculates bank charges for card payments
 * 
 * @param amount - The payment amount
 * @param percentage - The bank charges percentage (default: 3.5%)
 * @returns The bank charges amount
 */
export function calculateBankCharges(amount: number, percentage: number = 3.5): number {
  return (amount * percentage) / 100
}

/**
 * Formats bank charges description for journal entries
 * Shows total amount + bank fees in the description
 * 
 * @param amount - The payment amount
 * @param bankCharges - The bank charges amount
 * @param baseDescription - The base description for the journal entry
 * @returns Formatted description with bank charges information showing total + fees
 */
export function formatJournalDescriptionWithBankCharges(
  amount: number,
  bankCharges: number,
  baseDescription: string
): string {
  const totalWithFees = amount + bankCharges
  return `${baseDescription} (Total: ${amount.toFixed(2)} + ${bankCharges.toFixed(2)} (3.5% bank fees) = ${totalWithFees.toFixed(2)})`
}

