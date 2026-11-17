import { AccountingEngine } from './accountingEngine'
import { getAccountLedger, generateTrialBalance } from './ledgerService'

/**
 * Example 1 — Sales Invoice
 *
 * Input JSON:
 *
 * {
 *   "type": "sales_invoice",
 *   "payload": {
 *     "invoiceId": "INV-1001",
 *     "invoiceNumber": "INV-1001",
 *     "date": "2025-01-10T00:00:00.000Z",
 *     "totalNet": 1000,
 *     "cogsAmount": 600,
 *     "createdBy": "<user-id>"
 *   }
 * }
 */
export async function exampleSalesInvoice(userId: string) {
  const { journal_id } = await AccountingEngine.post({
    type: 'sales_invoice',
    payload: {
      invoiceId: 'INV-1001',
      invoiceNumber: 'INV-1001',
      date: new Date('2025-01-10'),
      totalNet: 1000,
      cogsAmount: 600,
      createdBy: userId,
    },
  })

  const arLedger = await getAccountLedger('1200')
  const revenueLedger = await getAccountLedger('4000')
  const cogsLedger = await getAccountLedger('5000')
  const inventoryLedger = await getAccountLedger('1300')
  const trialBalance = await generateTrialBalance()

  return {
    journal_id,
    ledgers: {
      accounts_receivable: arLedger,
      revenue: revenueLedger,
      cogs: cogsLedger,
      inventory: inventoryLedger,
    },
    trialBalance,
  }
}

/**
 * Example 2 — Customer Payment
 *
 * Input JSON:
 *
 * {
 *   "type": "receivable_payment",
 *   "payload": {
 *     "paymentId": "PAY-2001",
 *     "referenceNumber": "RCPT-2001",
 *     "date": "2025-01-15T00:00:00.000Z",
 *     "amount": 1000,
 *     "createdBy": "<user-id>"
 *   }
 * }
 */
export async function exampleCustomerPayment(userId: string) {
  const { journal_id } = await AccountingEngine.post({
    type: 'receivable_payment',
    payload: {
      paymentId: 'PAY-2001',
      referenceNumber: 'RCPT-2001',
      date: new Date('2025-01-15'),
      amount: 1000,
      createdBy: userId,
    },
  })

  const cashLedger = await getAccountLedger('1000')
  const arLedger = await getAccountLedger('1200')
  const trialBalance = await generateTrialBalance()

  return {
    journal_id,
    ledgers: {
      cash: cashLedger,
      accounts_receivable: arLedger,
    },
    trialBalance,
  }
}

/**
 * Example 3 — Purchase Invoice
 */
export async function examplePurchaseInvoice(userId: string) {
  const { journal_id } = await AccountingEngine.post({
    type: 'purchase_invoice',
    payload: {
      purchaseId: 'PINV-3001',
      referenceNumber: 'PINV-3001',
      date: new Date('2025-01-20'),
      amount: 800,
      isInventory: true,
      createdBy: userId,
    },
  })

  const inventoryLedger = await getAccountLedger('1300')
  const apLedger = await getAccountLedger('2100')
  const trialBalance = await generateTrialBalance()

  return {
    journal_id,
    ledgers: {
      inventory: inventoryLedger,
      accounts_payable: apLedger,
    },
    trialBalance,
  }
}

/**
 * Example 4 — Supplier Payment
 */
export async function exampleSupplierPayment(userId: string) {
  const { journal_id } = await AccountingEngine.post({
    type: 'payable_payment',
    payload: {
      paymentId: 'SPAY-4001',
      referenceNumber: 'SPAY-4001',
      date: new Date('2025-01-25'),
      amount: 800,
      createdBy: userId,
    },
  })

  const cashLedger = await getAccountLedger('1000')
  const apLedger = await getAccountLedger('2100')
  const trialBalance = await generateTrialBalance()

  return {
    journal_id,
    ledgers: {
      cash: cashLedger,
      accounts_payable: apLedger,
    },
    trialBalance,
  }
}

/**
 * Example 5 — Expense
 */
export async function exampleExpense(userId: string) {
  const { journal_id } = await AccountingEngine.post({
    type: 'expense',
    payload: {
      expenseId: 'EXP-5001',
      referenceNumber: 'EXP-5001',
      date: new Date('2025-02-01'),
      amount: 300,
      createdBy: userId,
      payFromCash: true,
    },
  })

  const expenseLedger = await getAccountLedger('6000')
  const cashLedger = await getAccountLedger('1000')
  const trialBalance = await generateTrialBalance()

  return {
    journal_id,
    ledgers: {
      expense: expenseLedger,
      cash: cashLedger,
    },
    trialBalance,
  }
}

/**
 * Example 6 — Inventory Adjustment
 */
export async function exampleInventoryAdjustment(userId: string) {
  const { journal_id } = await AccountingEngine.post({
    type: 'inventory_adjustment',
    payload: {
      adjustmentId: 'ADJ-6001',
      referenceNumber: 'ADJ-6001',
      date: new Date('2025-02-10'),
      inventoryDelta: -100,
      createdBy: userId,
    },
  })

  const inventoryLedger = await getAccountLedger('1300')
  const cogsLedger = await getAccountLedger('5000')
  const trialBalance = await generateTrialBalance()

  return {
    journal_id,
    ledgers: {
      inventory: inventoryLedger,
      cogs: cogsLedger,
    },
    trialBalance,
  }
}



