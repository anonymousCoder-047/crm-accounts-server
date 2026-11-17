import JournalEntry, { IJournalEntry, IJournalEntryLine, SourceModule } from '../models/JournalEntry'
import ChartOfAccount from '../models/ChartOfAccount'
import mongoose, { FilterQuery } from 'mongoose'

export interface CreateJournalInput {
  date: Date
  source_module: SourceModule
  reference_id?: string
  reference?: string
  description?: string
  lines: IJournalEntryLine[]
  createdBy: string
  attachments?: string[]
}

export interface JournalFilters {
  startDate?: Date
  endDate?: Date
  source_module?: SourceModule
  account_id?: string
  reference_id?: string
}

async function validateChartOfAccounts(lines: IJournalEntryLine[]): Promise<void> {
  const accountIds = Array.from(new Set(lines.map(l => l.account_id)))
  const accounts = await ChartOfAccount.find({
    account_id: { $in: accountIds },
    is_active: true,
  })
    .select('account_id')
    .lean()

  const validIds = new Set(accounts.map(a => a.account_id))
  const invalid = accountIds.filter(id => !validIds.has(id))

  if (invalid.length > 0) {
    throw new Error(`Invalid or inactive account_ids: ${invalid.join(', ')}`)
  }
}

export async function createJournal(input: CreateJournalInput): Promise<IJournalEntry> {
  await validateChartOfAccounts(input.lines)

  const journal = new JournalEntry({
    date: input.date,
    source_module: input.source_module,
    reference_id: input.reference_id,
    reference: input.reference,
    description: input.description,
    lines: input.lines,
    createdBy: new mongoose.Types.ObjectId(input.createdBy),
    attachments: input.attachments || [],
  })

  const saved = await journal.save()
  return saved
}

export async function reverseJournal(
  originalJournalId: string,
  userId: string,
  options?: { date?: Date; descriptionOverride?: string }
): Promise<IJournalEntry> {
  const original = await JournalEntry.findOne({ journal_id: originalJournalId }).exec()
  if (!original) {
    throw new Error(`Journal with id ${originalJournalId} not found`)
  }

  if (original.isReversal) {
    throw new Error('Cannot reverse a reversal journal')
  }

  if (original.reversedByJournalId) {
    throw new Error(`Journal already reversed by ${original.reversedByJournalId}`)
  }

  const reversedLines: IJournalEntryLine[] = original.lines.map(l => ({
    account_id: l.account_id,
    account_name: l.account_name,
    debit: l.credit,
    credit: l.debit,
  }))

  const reversal = new JournalEntry({
    date: options?.date || new Date(),
    source_module: 'reversal',
    reference_id: original.reference_id,
    reference: original.reference,
    description:
      options?.descriptionOverride ||
      `Reversal of ${original.journal_id}${original.description ? ` - ${original.description}` : ''}`,
    lines: reversedLines,
    createdBy: new mongoose.Types.ObjectId(userId),
    isReversal: true,
    reversedJournalId: original.journal_id,
  })

  const session = await mongoose.startSession()
  try {
    let savedReversal: IJournalEntry
    await session.withTransaction(async () => {
      savedReversal = await reversal.save({ session })

      original.reversedByJournalId = savedReversal!.journal_id
      await original.save({ session })
    })

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return (await JournalEntry.findOne({ journal_id: (reversal as any).journal_id }).exec())!
  } finally {
    await session.endSession()
  }
}

export async function listJournals(filters: JournalFilters = {}): Promise<IJournalEntry[]> {
  const query: FilterQuery<IJournalEntry> = {}

  if (filters.startDate || filters.endDate) {
    query.date = {}
    if (filters.startDate) {
      query.date.$gte = filters.startDate
    }
    if (filters.endDate) {
      query.date.$lte = filters.endDate
    }
  }

  if (filters.source_module) {
    query.source_module = filters.source_module
  }

  if (filters.account_id) {
    query['lines.account_id'] = filters.account_id
  }

  if (filters.reference_id) {
    query.reference_id = filters.reference_id
  }

  return JournalEntry.find(query)
    .populate('createdBy', 'name email')
    .sort({ date: -1, createdAt: -1 })
    .exec()
}

export async function getJournalById(journalId: string): Promise<IJournalEntry | null> {
  return JournalEntry.findOne({ journal_id: journalId })
    .populate('createdBy', 'name email')
    .exec()
}



