import { createJournal, CreateJournalInput } from './journalService'
import { IJournalEntryLine, SourceModule } from '../models/JournalEntry'

export const ACCOUNT_MAP = {
  SALES_REVENUE: '4000',
  ACCOUNTS_RECEIVABLE: '1200',
  CASH: '1000',
  INVENTORY: '1300',
  COGS: '5000',
  ACCOUNTS_PAYABLE: '2100',
  EXPENSE_DEFAULT: '6000',
} as const

export type PostingContext =
  | {
      type: 'sales_invoice'
      payload: {
        invoiceId: string
        invoiceNumber?: string
        date: Date
        totalNet: number
        taxAmount?: number
        cogsAmount?: number
        createdBy: string
      }
    }
  | {
      type: 'receivable_payment'
      payload: {
        paymentId: string
        referenceNumber?: string
        date: Date
        amount: number
        createdBy: string
        useBank?: boolean
      }
    }
  | {
      type: 'purchase_invoice'
      payload: {
        purchaseId: string
        referenceNumber?: string
        date: Date
        amount: number
        isInventory: boolean
        createdBy: string
      }
    }
  | {
      type: 'payable_payment'
      payload: {
        paymentId: string
        referenceNumber?: string
        date: Date
        amount: number
        createdBy: string
        useBank?: boolean
      }
    }
  | {
      type: 'expense'
      payload: {
        expenseId: string
        referenceNumber?: string
        date: Date
        amount: number
        createdBy: string
        payFromCash?: boolean
      }
    }
  | {
      type: 'inventory_adjustment'
      payload: {
        adjustmentId: string
        referenceNumber?: string
        date: Date
        inventoryDelta: number
        createdBy: string
      }
    }

function buildSalesInvoiceLines(ctx: PostingContext & { type: 'sales_invoice' }): IJournalEntryLine[] {
  const { totalNet, cogsAmount = 0 } = ctx.payload

  const lines: IJournalEntryLine[] = [
    // DR Accounts Receivable
    {
      account_id: ACCOUNT_MAP.ACCOUNTS_RECEIVABLE,
      debit: totalNet,
      credit: 0,
    },
    // CR Revenue
    {
      account_id: ACCOUNT_MAP.SALES_REVENUE,
      debit: 0,
      credit: totalNet,
    },
  ]

  if (cogsAmount > 0) {
    lines.push(
      // DR COGS
      {
        account_id: ACCOUNT_MAP.COGS,
        debit: cogsAmount,
        credit: 0,
      },
      // CR Inventory
      {
        account_id: ACCOUNT_MAP.INVENTORY,
        debit: 0,
        credit: cogsAmount,
      }
    )
  }

  return lines
}

function buildReceivablePaymentLines(
  ctx: PostingContext & { type: 'receivable_payment' }
): IJournalEntryLine[] {
  const { amount, useBank } = ctx.payload
  const cashAccountId = ACCOUNT_MAP.CASH // could be extended to BANK vs CASH

  return [
    {
      account_id: cashAccountId,
      debit: amount,
      credit: 0,
    },
    {
      account_id: ACCOUNT_MAP.ACCOUNTS_RECEIVABLE,
      debit: 0,
      credit: amount,
    },
  ]
}

function buildPurchaseInvoiceLines(
  ctx: PostingContext & { type: 'purchase_invoice' }
): IJournalEntryLine[] {
  const { amount, isInventory } = ctx.payload
  const debitAccountId = isInventory ? ACCOUNT_MAP.INVENTORY : ACCOUNT_MAP.EXPENSE_DEFAULT

  return [
    {
      account_id: debitAccountId,
      debit: amount,
      credit: 0,
    },
    {
      account_id: ACCOUNT_MAP.ACCOUNTS_PAYABLE,
      debit: 0,
      credit: amount,
    },
  ]
}

function buildPayablePaymentLines(
  ctx: PostingContext & { type: 'payable_payment' }
): IJournalEntryLine[] {
  const { amount } = ctx.payload
  const cashAccountId = ACCOUNT_MAP.CASH

  return [
    {
      account_id: ACCOUNT_MAP.ACCOUNTS_PAYABLE,
      debit: amount,
      credit: 0,
    },
    {
      account_id: cashAccountId,
      debit: 0,
      credit: amount,
    },
  ]
}

function buildExpenseLines(ctx: PostingContext & { type: 'expense' }): IJournalEntryLine[] {
  const { amount, payFromCash } = ctx.payload
  const creditAccountId = payFromCash ? ACCOUNT_MAP.CASH : ACCOUNT_MAP.ACCOUNTS_PAYABLE

  return [
    {
      account_id: ACCOUNT_MAP.EXPENSE_DEFAULT,
      debit: amount,
      credit: 0,
    },
    {
      account_id: creditAccountId,
      debit: 0,
      credit: amount,
    },
  ]
}

function buildInventoryAdjustmentLines(
  ctx: PostingContext & { type: 'inventory_adjustment' }
): IJournalEntryLine[] {
  const { inventoryDelta } = ctx.payload

  if (inventoryDelta === 0) {
    throw new Error('inventoryDelta cannot be zero')
  }

  if (inventoryDelta > 0) {
    // Increase inventory: DR Inventory / CR Inventory Adjustment (equity or contra-expense)
    return [
      {
        account_id: ACCOUNT_MAP.INVENTORY,
        debit: inventoryDelta,
        credit: 0,
      },
      {
        account_id: ACCOUNT_MAP.COGS, // could be a dedicated inventory adjustment account
        debit: 0,
        credit: inventoryDelta,
      },
    ]
  } else {
    const abs = Math.abs(inventoryDelta)
    // Decrease inventory: DR Inventory Adjustment / CR Inventory
    return [
      {
        account_id: ACCOUNT_MAP.COGS,
        debit: abs,
        credit: 0,
      },
      {
        account_id: ACCOUNT_MAP.INVENTORY,
        debit: 0,
        credit: abs,
      },
    ]
  }
}

export async function post(context: PostingContext) {
  let source_module: SourceModule
  let lines: IJournalEntryLine[]
  let reference_id: string
  let reference: string | undefined
  let date: Date
  let createdBy: string
  let description: string | undefined

  switch (context.type) {
    case 'sales_invoice':
      source_module = 'sales_invoice'
      lines = buildSalesInvoiceLines(context)
      reference_id = context.payload.invoiceId
      reference = context.payload.invoiceNumber
      date = context.payload.date
      createdBy = context.payload.createdBy
      description = `Sales invoice ${reference_id}`
      break
    case 'receivable_payment':
      source_module = 'receivable_payment'
      lines = buildReceivablePaymentLines(context)
      reference_id = context.payload.paymentId
      reference = context.payload.referenceNumber
      date = context.payload.date
      createdBy = context.payload.createdBy
      description = `Customer payment ${reference_id}`
      break
    case 'purchase_invoice':
      source_module = 'purchase_invoice'
      lines = buildPurchaseInvoiceLines(context)
      reference_id = context.payload.purchaseId
      reference = context.payload.referenceNumber
      date = context.payload.date
      createdBy = context.payload.createdBy
      description = `Purchase invoice ${reference_id}`
      break
    case 'payable_payment':
      source_module = 'payable_payment'
      lines = buildPayablePaymentLines(context)
      reference_id = context.payload.paymentId
      reference = context.payload.referenceNumber
      date = context.payload.date
      createdBy = context.payload.createdBy
      description = `Supplier payment ${reference_id}`
      break
    case 'expense':
      source_module = 'expense'
      lines = buildExpenseLines(context)
      reference_id = context.payload.expenseId
      reference = context.payload.referenceNumber
      date = context.payload.date
      createdBy = context.payload.createdBy
      description = `Expense ${reference_id}`
      break
    case 'inventory_adjustment':
      source_module = 'inventory'
      lines = buildInventoryAdjustmentLines(context)
      reference_id = context.payload.adjustmentId
      reference = context.payload.referenceNumber
      date = context.payload.date
      createdBy = context.payload.createdBy
      description = `Inventory adjustment ${reference_id}`
      break
    default:
      // Exhaustive check
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _exhaustive: never = context
      throw new Error('Unsupported posting context type')
  }

  const input: CreateJournalInput = {
    date,
    source_module,
    reference_id,
    reference,
    description,
    lines,
    createdBy,
  }

  const journal = await createJournal(input)
  return { journal_id: journal.journal_id, journal }
}

export const AccountingEngine = {
  post,
}



