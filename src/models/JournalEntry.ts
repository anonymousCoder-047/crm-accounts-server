import mongoose, { Document, Schema } from 'mongoose'

export interface IJournalEntryLine {
  /**
   * Foreign key to ChartOfAccount.account_id
   */
  account_id: string
  /**
   * Optional denormalized account name for convenience in reports
   */
  account_name?: string
  debit: number
  credit: number
}

export type SourceModule =
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'expense'
  | 'inventory'
  | 'receivable'
  | 'payable'
  | 'receivable_payment'
  | 'payable_payment'
  | 'payroll'
  | 'manual'
  | 'reversal'

export interface IJournalEntry extends Document {
  journal_id?: string // Auto-generated journal entry number
  date: Date
  /**
   * Business reference identifier (invoiceId, purchaseId, expenseId, etc.)
   */
  reference_id?: string
  /**
   * Optional human readable reference (invoice number, etc.)
   */
  reference?: string
  description?: string
  lines: IJournalEntryLine[]
  createdBy: mongoose.Types.ObjectId
  source_module: SourceModule
  // Immutable / reversal metadata
  isReversal?: boolean
  reversedJournalId?: string | null
  reversedByJournalId?: string | null
  // Legacy fields for backward compatibility
  referenceType?: 'Sales' | 'Purchase' | 'Expense' | 'Inventory' | 'Payable' | 'Receivable'
  referenceId?: mongoose.Types.ObjectId
  attachments?: string[]
  createdAt: Date
  updatedAt: Date
}

const JournalEntrySchema: Schema = new Schema(
  {
    journal_id: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    reference_id: { type: String, trim: true, index: true },
    reference: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    lines: [
      {
        account_id: { type: String, required: true, trim: true, index: true },
        account_name: { type: String, trim: true },
        debit: { type: Number, required: true, min: 0, default: 0 },
        credit: { type: Number, required: true, min: 0, default: 0 },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source_module: {
      type: String,
      enum: [
        'sales_invoice',
        'purchase_invoice',
        'expense',
        'inventory',
        'receivable',
        'payable',
        'receivable_payment',
        'payable_payment',
        'payroll',
        'manual',
        'reversal',
      ],
      required: true,
      index: true,
    },
    isReversal: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversedJournalId: {
      type: String,
      trim: true,
      index: true,
    },
    reversedByJournalId: {
      type: String,
      trim: true,
      index: true,
    },
    // Legacy fields for backward compatibility
    referenceType: {
      type: String,
      enum: ['Sales', 'Purchase', 'Expense', 'Inventory', 'Payable', 'Receivable'],
      index: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    attachments: [{ type: String, trim: true }],
  },
  { timestamps: true }
)

// Index for efficient querying (only compound indexes - single field indexes are defined in schema)
JournalEntrySchema.index({ date: -1, source_module: 1 })
JournalEntrySchema.index({ source_module: 1, reference: 1 })
// Note: 'lines.account_id' index removed - already indexed in schema definition
JournalEntrySchema.index({ date: -1, referenceType: 1 }) // Legacy index
JournalEntrySchema.index({ referenceType: 1, referenceId: 1 }) // Legacy index

// Auto-generate journal_id if not provided
JournalEntrySchema.pre('save', async function (next) {
  const doc = this as any as IJournalEntry
  
  // Generate journal_id if not provided
  if (!doc.journal_id) {
    const lastEntryResult = await mongoose
      .model<IJournalEntry>('JournalEntry')
      .findOne({ journal_id: { $exists: true, $ne: null } })
      .sort({ journal_id: -1 })
      .select('journal_id')
      .lean()

    let nextNumber = 1
    if (lastEntryResult && lastEntryResult.journal_id) {
      const match = lastEntryResult.journal_id.match(/JE-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      } else {
        const count = await mongoose.model('JournalEntry').countDocuments()
        nextNumber = count + 1
      }
    } else {
      const count = await mongoose.model('JournalEntry').countDocuments()
      nextNumber = count + 1
    }

    doc.journal_id = `JE-${String(nextNumber).padStart(6, '0')}`
  }

  // Validation: Ensure debit = credit
  const lines: IJournalEntryLine[] = doc.lines || []
  
  const totalDebit = lines.reduce((sum: number, e: IJournalEntryLine) => sum + (e.debit || 0), 0)
  const totalCredit = lines.reduce((sum: number, e: IJournalEntryLine) => sum + (e.credit || 0), 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    // Allow small floating point differences
    return next(new Error(`Total debit (${totalDebit}) must equal total credit (${totalCredit})`))
  }

  if (lines.length < 2) {
    return next(new Error('Journal entry must have at least two entries (double-entry accounting)'))
  }

  // Validate that each entry has either debit or credit (not both, not neither)
  for (const entry of lines) {
    if ((entry.debit > 0 && entry.credit > 0) || (entry.debit === 0 && entry.credit === 0)) {
      return next(new Error('Each entry must have either a debit or credit amount, not both or neither'))
    }
  }

  next()
})

/**
 * Enforce immutability for generic update operations.
 * Journals can only be reversed, not updated in place.
 */
function blockMutatingUpdates(this: any, next: (err?: any) => void) {
  const update = this.getUpdate?.()
  if (update && Object.keys(update).length > 0) {
    return next(
      new Error('Journal entries are immutable and cannot be updated. Create a reversing journal instead.')
    )
  }
  next()
}

JournalEntrySchema.pre('findOneAndUpdate', blockMutatingUpdates)
JournalEntrySchema.pre('updateOne', blockMutatingUpdates)
JournalEntrySchema.pre('updateMany', blockMutatingUpdates)

export default mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema)

