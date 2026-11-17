import mongoose, { Document, Schema } from 'mongoose'

export type LedgerAccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

export type LedgerAccountSubType =
  | 'Current Asset'
  | 'Non-Current Asset'
  | 'Contra Asset'
  | 'Current Liability'
  | 'Non-Current Liability'
  | 'Owner Capital'
  | 'Retained Earnings'
  | 'Reserves'
  | 'Operating Revenue'
  | 'Non-Operating Revenue'
  | 'Operating Expense'
  | 'Non-Operating Expense'
  | 'COGS'

export interface IGeneralLedger extends Document {
  ledger_id: string
  account_id: string
  account_name: string
  account_type?: LedgerAccountType
  account_sub_type?: LedgerAccountSubType
  date: Date
  debit: number
  credit: number
  running_balance: number // Calculated running balance for this account
  journal_reference: mongoose.Types.ObjectId // Reference to JournalEntry
  journal_id?: string // Journal entry ID for easy lookup
  source_module?:
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
  description?: string
  reference?: string // Invoice number, etc.
  createdAt: Date
  updatedAt: Date
}

const GeneralLedgerSchema: Schema = new Schema(
  {
    ledger_id: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    account_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    account_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    account_type: {
      type: String,
      enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
      index: true,
    },
    account_sub_type: {
      type: String,
      enum: [
        'Current Asset',
        'Non-Current Asset',
        'Contra Asset',
        'Current Liability',
        'Non-Current Liability',
        'Owner Capital',
        'Retained Earnings',
        'Reserves',
        'Operating Revenue',
        'Non-Operating Revenue',
        'Operating Expense',
        'Non-Operating Expense',
        'COGS',
      ],
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    debit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    credit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    running_balance: {
      type: Number,
      required: true,
      default: 0,
    },
    journal_reference: {
      type: Schema.Types.ObjectId,
      ref: 'JournalEntry',
      required: true,
      index: true,
    },
    journal_id: {
      type: String,
      trim: true,
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
      ],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    reference: {
      type: String,
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
)

// Indexes for efficient querying (only compound indexes - single field indexes are defined in schema)
GeneralLedgerSchema.index({ account_id: 1, date: 1 })
GeneralLedgerSchema.index({ date: 1, account_id: 1 })
GeneralLedgerSchema.index({ account_type: 1, date: 1 })
GeneralLedgerSchema.index({ account_type: 1, account_sub_type: 1, date: 1 })
// Note: journal_reference index removed - already indexed in schema definition
GeneralLedgerSchema.index({ source_module: 1, date: 1 })

// Auto-generate ledger_id if not provided
GeneralLedgerSchema.pre('save', async function (next) {
  const doc = this as any as IGeneralLedger
  
  if (!doc.ledger_id) {
    // Use a more robust method to generate unique IDs
    // Find the highest existing ledger_id number and increment
    const lastEntryResult = await mongoose.model('GeneralLedger')
      .findOne({ ledger_id: { $exists: true, $ne: null } })
      .sort({ ledger_id: -1 })
      .select('ledger_id')
      .lean()
    
    const lastEntry = lastEntryResult as { ledger_id?: string } | null
    
    let nextNumber = 1
    if (lastEntry && lastEntry.ledger_id) {
      // Extract number from last ledger_id (format: GL-00000021)
      const match = lastEntry.ledger_id.match(/GL-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      } else {
        // Fallback: use count if pattern doesn't match
        const count = await mongoose.model('GeneralLedger').countDocuments()
        nextNumber = count + 1
      }
    } else {
      // Fallback: use count if no entries found
      const count = await mongoose.model('GeneralLedger').countDocuments()
      nextNumber = count + 1
    }
    
    // Generate unique ID and check for collisions (retry if needed)
    let attempts = 0
    let ledgerId = `GL-${String(nextNumber).padStart(8, '0')}`
    
    while (attempts < 10) {
      const exists = await mongoose.model('GeneralLedger').findOne({ ledger_id: ledgerId })
      if (!exists) {
        break
      }
      nextNumber++
      ledgerId = `GL-${String(nextNumber).padStart(8, '0')}`
      attempts++
    }
    
    doc.ledger_id = ledgerId
  }

  next()
})

export default mongoose.model<IGeneralLedger>('GeneralLedger', GeneralLedgerSchema)

