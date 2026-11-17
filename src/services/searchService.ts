import Customer from '../models/Customer'
import Supplier from '../models/Supplier'
import Inventory from '../models/Inventory'
import SalesInvoice from '../models/SalesInvoice'
import PurchaseInvoice from '../models/PurchaseInvoice'
import Expense from '../models/Expense'
import Receivable from '../models/Receivable'
import Payable from '../models/Payable'
import JournalEntry from '../models/JournalEntry'

export interface SearchResult {
  type: 'customer' | 'supplier' | 'inventory' | 'sales_invoice' | 'purchase_invoice' | 'expense' | 'receivable' | 'payable' | 'journal_entry'
  id: string
  title: string
  subtitle?: string
  description?: string
  url: string
  icon?: string
}

export async function globalSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const searchQuery = query.trim()
  const results: SearchResult[] = []

  // Search Customers
  try {
    const customers = await Customer.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { phone: { $regex: searchQuery, $options: 'i' } },
        { trn: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .limit(limit)
      .lean()

    customers.forEach((customer: any) => {
      results.push({
        type: 'customer',
        id: customer._id.toString(),
        title: customer.name,
        subtitle: customer.email || customer.phone,
        description: customer.trn ? `TRN: ${customer.trn}` : undefined,
        url: `/crm-settings/customers?view=${customer._id}`,
        icon: 'Users',
      })
    })
  } catch (error) {
    console.error('Error searching customers:', error)
  }

  // Search Suppliers
  try {
    const suppliers = await Supplier.find({
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { phone: { $regex: searchQuery, $options: 'i' } },
        { trn: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .limit(limit)
      .lean()

    suppliers.forEach((supplier: any) => {
      results.push({
        type: 'supplier',
        id: supplier._id.toString(),
        title: supplier.name,
        subtitle: supplier.email || supplier.phone,
        description: supplier.trn ? `TRN: ${supplier.trn}` : undefined,
        url: `/crm-settings/suppliers?view=${supplier._id}`,
        icon: 'Building2',
      })
    })
  } catch (error) {
    console.error('Error searching suppliers:', error)
  }

  // Search Inventory
  try {
    const inventory = await Inventory.find({
      $or: [
        { product_name: { $regex: searchQuery, $options: 'i' } },
        { sku: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .limit(limit)
      .lean()

    inventory.forEach((item: any) => {
      results.push({
        type: 'inventory',
        id: item._id.toString(),
        title: item.product_name,
        subtitle: item.sku,
        description: `Stock: ${item.quantity_on_hand || 0}`,
        url: `/inventory/view/${item._id}`,
        icon: 'Package',
      })
    })
  } catch (error) {
    console.error('Error searching inventory:', error)
  }

  // Search Sales Invoices
  try {
    const salesInvoices = await SalesInvoice.find({
      $or: [
        { invoice_number: { $regex: searchQuery, $options: 'i' } },
        { reference_number: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .populate('customer_id', 'name')
      .limit(limit)
      .lean()

    salesInvoices.forEach((invoice: any) => {
      results.push({
        type: 'sales_invoice',
        id: invoice._id.toString(),
        title: `Invoice #${invoice.invoice_number}`,
        subtitle: invoice.customer_id?.name || 'Unknown Customer',
        description: `Amount: AED ${invoice.total_amount?.toLocaleString() || '0'}`,
        url: `/sales-invoices/view/${invoice._id}`,
        icon: 'FileText',
      })
    })
  } catch (error) {
    console.error('Error searching sales invoices:', error)
  }

  // Search Purchase Invoices
  try {
    const purchaseInvoices = await PurchaseInvoice.find({
      $or: [
        { invoice_number: { $regex: searchQuery, $options: 'i' } },
        { reference_number: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .populate('vendor_id', 'name')
      .limit(limit)
      .lean()

    purchaseInvoices.forEach((invoice: any) => {
      results.push({
        type: 'purchase_invoice',
        id: invoice._id.toString(),
        title: `Invoice #${invoice.invoice_number}`,
        subtitle: invoice.vendor_id?.name || 'Unknown Vendor',
        description: `Amount: AED ${invoice.total_amount?.toLocaleString() || '0'}`,
        url: `/purchase-invoices/view/${invoice._id}`,
        icon: 'ShoppingCart',
      })
    })
  } catch (error) {
    console.error('Error searching purchase invoices:', error)
  }

  // Search Expenses
  try {
    const expenses = await Expense.find({
      $or: [
        { description: { $regex: searchQuery, $options: 'i' } },
        { reference: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .limit(limit)
      .lean()

    expenses.forEach((expense: any) => {
      results.push({
        type: 'expense',
        id: expense._id.toString(),
        title: expense.description || expense.reference || 'Expense',
        subtitle: expense.type,
        description: `Amount: AED ${expense.amount?.toLocaleString() || '0'}`,
        url: `/expenses/view/${expense._id}`,
        icon: 'Receipt',
      })
    })
  } catch (error) {
    console.error('Error searching expenses:', error)
  }

  // Search Receivables
  try {
    const receivables = await Receivable.find({
      invoice_number: { $regex: searchQuery, $options: 'i' },
    })
      .populate('customer_id', 'name')
      .limit(limit)
      .lean()

    receivables.forEach((receivable: any) => {
      results.push({
        type: 'receivable',
        id: receivable._id.toString(),
        title: `AR #${receivable.invoice_number}`,
        subtitle: receivable.customer_id?.name || 'Unknown Customer',
        description: `Balance: AED ${receivable.balance_due?.toLocaleString() || '0'}`,
        url: `/receivables/view/${receivable._id}`,
        icon: 'CreditCard',
      })
    })
  } catch (error) {
    console.error('Error searching receivables:', error)
  }

  // Search Payables
  try {
    const payables = await Payable.find({
      bill_number: { $regex: searchQuery, $options: 'i' },
    })
      .populate('vendor_id', 'name')
      .limit(limit)
      .lean()

    payables.forEach((payable: any) => {
      results.push({
        type: 'payable',
        id: payable._id.toString(),
        title: `AP #${payable.bill_number}`,
        subtitle: payable.vendor_id?.name || 'Unknown Vendor',
        description: `Balance: AED ${payable.balance_due?.toLocaleString() || '0'}`,
        url: `/payables/view/${payable._id}`,
        icon: 'CreditCard',
      })
    })
  } catch (error) {
    console.error('Error searching payables:', error)
  }

  // Search Journal Entries
  try {
    const journalEntries = await JournalEntry.find({
      $or: [
        { journal_id: { $regex: searchQuery, $options: 'i' } },
        { reference: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ],
    })
      .limit(limit)
      .lean()

    journalEntries.forEach((entry: any) => {
      results.push({
        type: 'journal_entry',
        id: entry._id.toString(),
        title: entry.journal_id || entry.reference || 'Journal Entry',
        subtitle: entry.description,
        description: `Date: ${new Date(entry.date).toLocaleDateString()}`,
        url: `/ledger/manage?journal=${entry._id}`,
        icon: 'BookOpen',
      })
    })
  } catch (error) {
    console.error('Error searching journal entries:', error)
  }

  // Limit total results and return
  return results.slice(0, limit)
}


