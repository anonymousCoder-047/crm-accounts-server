import { createSalesInvoice, SalesInvoiceInput, listSalesInvoices } from './salesInvoiceService'
import { createPurchaseInvoice, PurchaseInvoiceInput, listPurchaseInvoices } from './purchaseInvoiceService'
import { createCustomer, listCustomers, getCustomerById } from './customerService'
import { createSupplier, listSuppliers, getSupplierById } from './supplierService'
import { createInventory, listInventory, getInventoryById, InventoryInput } from './inventoryService'
import { createExpense, ExpenseInput } from './expenseService'
import { calculateInvoiceTotals } from './salesInvoiceService'
import { generateIncomeStatement, generateBalanceSheet, generateCashFlowStatement } from './financialStatementsService'
import SalesInvoice from '../models/SalesInvoice'
import PurchaseInvoice from '../models/PurchaseInvoice'
import Inventory from '../models/Inventory'
import Customer from '../models/Customer'
import Supplier from '../models/Supplier'

// Supported intents
type Intent = 'REPORT' | 'CREATE' | 'VIEW' | 'QUERY' | 'HELP' | 'UNKNOWN'

// Supported actions
type Action =
  | 'GET_BALANCE_SHEET'
  | 'GET_INCOME_STATEMENT'
  | 'GET_CASH_FLOW_STATEMENT'
  | 'CREATE_SALES_INVOICE'
  | 'CREATE_PURCHASE_INVOICE'
  | 'CREATE_CUSTOMER'
  | 'CREATE_SUPPLIER'
  | 'CREATE_PRODUCT'
  | 'RECORD_EXPENSE'
  | 'LIST_SALES_INVOICES'
  | 'LIST_PURCHASE_INVOICES'
  | 'GET_CUSTOMER_DETAILS'
  | 'GET_PRODUCT_DETAILS'
  | 'GET_STOCK_LEVEL'
  | 'SEARCH_GLOBAL'
  | null

// Structured response format
interface ChatbotResponse {
  intent: Intent
  action: Action
  confidence: number
  data: Record<string, any>
  reply: string
}

/**
 * Extract numbers from text (prices, quantities, amounts)
 */
function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const num = parseFloat(match[1] || match[2] || match[0])
      if (!isNaN(num)) return num
    }
  }
  return null
}

/**
 * Extract product names from text
 */
function extractProductName(text: string): string | null {
  // Look for patterns like "3x Product Name" or "Product Name @ price"
  const patterns = [
    /\d+\s*x\s+([^@]+?)(?:\s*@|\s*$)/i,
    /(?:product|item|inventory|stock)\s+(?:named|called|for|about)?\s*([^@\d]+?)(?:\s*@|\s*$)/i,
    /(?:create|add|new)\s+(?:product|item|inventory)\s+([^@\d]+?)(?:\s*@|\s*with|\s*$)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      if (name.length > 0 && !/^\d+$/.test(name)) return name
    }
  }
  return null
}

/**
 * Extract customer/supplier names from text
 */
function extractEntityName(text: string, entityType: 'customer' | 'supplier'): string | null {
  const patterns = entityType === 'customer'
    ? [
        /(?:for|to|customer)\s+([^with]+?)(?:\s+with|\s*$)/i,
        /customer\s+(?:named|called|for)?\s*([^?]+?)(?:\s*\?|\s*$)/i,
        /(?:create|add|new)\s+customer\s+(?:named|called)?\s*([^with]+?)(?:\s+with|\s*$)/i,
      ]
    : [
        /(?:from|vendor|supplier)\s+([^with]+?)(?:\s+with|\s*$)/i,
        /(?:supplier|vendor)\s+(?:named|called)?\s*([^with]+?)(?:\s+with|\s*$)/i,
        /(?:create|add|new)\s+(?:supplier|vendor)\s+(?:named|called)?\s*([^with]+?)(?:\s+with|\s*$)/i,
      ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      if (name.length > 0) return name
    }
  }
  return null
}

/**
 * Extract invoice line items from text
 * Format: "3x Product Name @ 223.78 AED"
 */
function extractLineItems(text: string): Array<{ product: string; quantity: number; price?: number; cost?: number }> {
  const items: Array<{ product: string; quantity: number; price?: number; cost?: number }> = []
  const itemPattern = /(\d+)\s*x\s+([^@]+?)\s*@\s*([\d.]+)\s*(?:AED|aed)?/gi
  let match
  
  while ((match = itemPattern.exec(text)) !== null) {
    const quantity = parseInt(match[1], 10)
    const productName = match[2].trim()
    const price = parseFloat(match[3])
    
    if (quantity && productName && !isNaN(price)) {
      items.push({
        product: productName,
        quantity,
        price,
      })
    }
  }
  
  return items
}

/**
 * Determine intent from message
 */
function determineIntent(message: string): { intent: Intent; confidence: number } {
  const lower = message.toLowerCase().trim()
  
  // HELP - highest priority
  if (lower === 'help' || lower.includes('what can you do') || lower.includes('capabilities') || lower.includes('commands')) {
    return { intent: 'HELP', confidence: 1.0 }
  }
  
  // REPORT - Financial statements
  const reportKeywords = ['balance sheet', 'income statement', 'profit', 'p&l', 'profit and loss', 'cash flow', 'cashflow', 'financial position']
  if (reportKeywords.some(keyword => lower.includes(keyword))) {
    return { intent: 'REPORT', confidence: 0.9 }
  }
  
  // CREATE - Creation keywords
  const createKeywords = ['create', 'make', 'generate', 'add', 'new', 'record']
  const hasCreateKeyword = createKeywords.some(keyword => lower.includes(keyword))
  
  // VIEW - View/list keywords
  const viewKeywords = ['show', 'view', 'list', 'display', 'get', 'share']
  const hasViewKeyword = viewKeywords.some(keyword => lower.includes(keyword))
  
  // QUERY - Question keywords
  const queryKeywords = ["what's", "what is", "how much", "tell me", "show me info", "info", "details", "stock", "quantity"]
  const hasQueryKeyword = queryKeywords.some(keyword => lower.includes(keyword))
  
  // CREATE intent detection
  if (hasCreateKeyword) {
    if (lower.includes('invoice') || lower.includes('customer') || lower.includes('supplier') || 
        lower.includes('product') || lower.includes('inventory') || lower.includes('expense') ||
        lower.includes('item')) {
      return { intent: 'CREATE', confidence: 0.85 }
    }
  }
  
  // VIEW intent detection
  if (hasViewKeyword) {
    if (lower.includes('invoice') || lower.includes('sales') || lower.includes('purchase')) {
      return { intent: 'VIEW', confidence: 0.85 }
    }
  }
  
  // QUERY intent detection
  if (hasQueryKeyword) {
    if (lower.includes('customer') || lower.includes('product') || lower.includes('stock') || 
        lower.includes('inventory') || lower.includes('quantity')) {
      return { intent: 'QUERY', confidence: 0.85 }
    }
  }
  
  // SEARCH intent
  if (lower.includes('search') || lower.includes('find') || lower.includes('look for')) {
    return { intent: 'QUERY', confidence: 0.8 }
  }
  
  // Fallback: Try to infer from content
  if (lower.includes('invoice') && (lower.includes('for') || lower.includes('from'))) {
    return { intent: 'CREATE', confidence: 0.7 }
  }
  
  if (lower.includes('customer') || lower.includes('supplier') || lower.includes('product')) {
    if (hasCreateKeyword) return { intent: 'CREATE', confidence: 0.75 }
    if (hasViewKeyword || hasQueryKeyword) return { intent: 'QUERY', confidence: 0.75 }
  }
  
  // If we have numbers and product names, likely CREATE
  if (/\d+\s*x\s+/.test(lower) && lower.includes('@')) {
    return { intent: 'CREATE', confidence: 0.8 }
  }
  
  return { intent: 'UNKNOWN', confidence: 0.3 }
}

/**
 * Parse message and extract structured data
 */
function parseMessage(message: string): ChatbotResponse {
  const lower = message.toLowerCase().trim()
  const { intent, confidence: baseConfidence } = determineIntent(message)
  
  // HELP intent
  if (intent === 'HELP') {
    return {
      intent: 'HELP',
      action: null,
      confidence: 1.0,
      data: {},
      reply: 'You can create invoices, view reports, check stock, and manage customers. Try: "Create sales invoice for John Doe with 2x Product @ 100 AED".',
    }
  }
  
  // REPORT intent
  if (intent === 'REPORT') {
    if (lower.includes('balance sheet') || lower.includes('financial position')) {
    return {
        intent: 'REPORT',
        action: 'GET_BALANCE_SHEET',
        confidence: 0.92,
        data: {},
        reply: 'Here is your balance sheet. You can open the full report for details.',
      }
    }
    
    if (lower.includes('income statement') || lower.includes('profit') || lower.includes('p&l') || lower.includes('profit and loss')) {
      return {
        intent: 'REPORT',
        action: 'GET_INCOME_STATEMENT',
        confidence: 0.92,
        data: {},
        reply: 'Here is your income statement. You can open the full report for details.',
      }
    }
    
    if (lower.includes('cash flow') || lower.includes('cashflow')) {
    return {
        intent: 'REPORT',
        action: 'GET_CASH_FLOW_STATEMENT',
        confidence: 0.92,
        data: {},
        reply: 'Here is your cash flow statement. You can open the full report for details.',
      }
    }
  }
  
  // CREATE intent
  if (intent === 'CREATE') {
    // Sales Invoice
    if (lower.includes('sales invoice') || (lower.includes('invoice') && lower.includes('for'))) {
      const customerName = extractEntityName(message, 'customer')
      const items = extractLineItems(message)
      const hasItems = items.length > 0
      
      if (customerName && hasItems) {
    return {
          intent: 'CREATE',
          action: 'CREATE_SALES_INVOICE',
          confidence: 0.95,
          data: {
            customer_name: customerName,
            items: items.map(item => ({
              product: item.product,
              quantity: item.quantity,
              unit_price: item.price,
              currency: 'AED',
            })),
          },
          reply: `Sales invoice prepared for ${customerName} with ${items.length} item(s).`,
        }
      } else if (customerName || hasItems) {
        return {
          intent: 'CREATE',
          action: 'CREATE_SALES_INVOICE',
          confidence: 0.7,
          data: {
            customer_name: customerName || null,
            items: hasItems ? items.map(item => ({
              product: item.product,
              quantity: item.quantity,
              unit_price: item.price,
              currency: 'AED',
            })) : [],
          },
          reply: `Preparing sales invoice${customerName ? ` for ${customerName}` : ''}${hasItems ? ` with ${items.length} item(s)` : ''}.`,
        }
      }
    }
    
    // Purchase Invoice
    if (lower.includes('purchase invoice') || (lower.includes('invoice') && lower.includes('from'))) {
      const supplierName = extractEntityName(message, 'supplier')
      const items = extractLineItems(message)
      const hasItems = items.length > 0
      
      if (supplierName && hasItems) {
    return {
          intent: 'CREATE',
          action: 'CREATE_PURCHASE_INVOICE',
          confidence: 0.95,
          data: {
            supplier_name: supplierName,
            items: items.map(item => ({
              product: item.product,
              quantity: item.quantity,
              unit_cost: item.price, // Use price as cost for purchase
              currency: 'AED',
            })),
          },
          reply: `Purchase invoice prepared for ${supplierName} with ${items.length} item(s).`,
        }
      } else if (supplierName || hasItems) {
        return {
          intent: 'CREATE',
          action: 'CREATE_PURCHASE_INVOICE',
          confidence: 0.7,
          data: {
            supplier_name: supplierName || null,
            items: hasItems ? items.map(item => ({
              product: item.product,
              quantity: item.quantity,
              unit_cost: item.price,
              currency: 'AED',
            })) : [],
          },
          reply: `Preparing purchase invoice${supplierName ? ` from ${supplierName}` : ''}${hasItems ? ` with ${items.length} item(s)` : ''}.`,
        }
      }
    }
    
    // Customer
    if (lower.includes('customer') && (lower.includes('create') || lower.includes('add') || lower.includes('new'))) {
      const customerName = extractEntityName(message, 'customer') || 
                           message.match(/(?:create|add|new)\s+customer\s+(?:named|called)?\s*([^?]+)/i)?.[1]?.trim() ||
                           null
      
      if (customerName) {
    return {
          intent: 'CREATE',
          action: 'CREATE_CUSTOMER',
          confidence: 0.9,
          data: {
            name: customerName,
          },
          reply: `Customer "${customerName}" will be created.`,
        }
      }
    }
    
    // Supplier
    if ((lower.includes('supplier') || lower.includes('vendor')) && (lower.includes('create') || lower.includes('add') || lower.includes('new'))) {
      const supplierName = extractEntityName(message, 'supplier') ||
                           message.match(/(?:create|add|new)\s+(?:supplier|vendor)\s+(?:named|called)?\s*([^?]+)/i)?.[1]?.trim() ||
                           null
      
      if (supplierName) {
        return {
          intent: 'CREATE',
          action: 'CREATE_SUPPLIER',
          confidence: 0.9,
          data: {
            name: supplierName,
          },
          reply: `Supplier "${supplierName}" will be created.`,
        }
      }
    }
    
    // Product/Inventory
    if ((lower.includes('product') || lower.includes('inventory') || lower.includes('item')) && 
        (lower.includes('create') || lower.includes('add') || lower.includes('new'))) {
      const productName = extractProductName(message) ||
                         message.match(/(?:create|add|new)\s+(?:product|inventory|item)\s+(?:named|called)?\s*([^@\d]+?)(?:\s*@|\s*with|\s*$)/i)?.[1]?.trim() ||
                         null
      const price = extractNumber(message, [/price[:\s]+([\d.]+)/i, /@\s*([\d.]+)/i, /([\d.]+)\s*(?:AED|aed)/i])
      
      if (productName) {
        return {
          intent: 'CREATE',
          action: 'CREATE_PRODUCT',
          confidence: productName ? 0.9 : 0.6,
          data: {
            product_name: productName,
            price: price || null,
            currency: 'AED',
          },
          reply: `Product "${productName}"${price ? ` with price ${price} AED` : ''} will be created.`,
        }
      }
    }
    
    // Expense
    if (lower.includes('expense') && (lower.includes('create') || lower.includes('record') || lower.includes('add'))) {
      const amount = extractNumber(message, [/expense\s+([\d.]+)/i, /amount[:\s]+([\d.]+)/i, /([\d.]+)\s*(?:AED|aed)\s+for/i, /([\d.]+)\s*(?:AED|aed)/i])
      const categoryMatch = message.match(/(?:for|category|type)[:\s]+([^?]+?)(?:\s*\?|\s*$)/i)
      const category = categoryMatch ? categoryMatch[1].trim() : null
      
      if (amount) {
        return {
          intent: 'CREATE',
          action: 'RECORD_EXPENSE',
          confidence: 0.88,
          data: {
            amount,
            currency: 'AED',
            category: category || 'Other',
          },
          reply: `Expense of ${amount} AED${category ? ` for ${category}` : ''} will be recorded.`,
        }
      }
    }
  }
  
  // VIEW intent
  if (intent === 'VIEW') {
    if (lower.includes('sales invoice')) {
      const paymentStatus = lower.includes('unpaid') || lower.includes('pending') ? 'unpaid' :
                           lower.includes('paid') ? 'paid' :
                           lower.includes('partial') ? 'partial' :
                           lower.includes('overdue') ? 'overdue' : undefined
      
      return {
        intent: 'VIEW',
        action: 'LIST_SALES_INVOICES',
        confidence: 0.85,
        data: {
          payment_status: paymentStatus,
        },
        reply: `Fetching sales invoices${paymentStatus ? ` (${paymentStatus})` : ''}.`,
      }
    }
    
    if (lower.includes('purchase invoice')) {
      const paymentStatus = lower.includes('unpaid') || lower.includes('pending') ? 'unpaid' :
                           lower.includes('paid') ? 'paid' :
                           lower.includes('partial') ? 'partial' :
                           lower.includes('overdue') ? 'overdue' : undefined
      
      return {
        intent: 'VIEW',
        action: 'LIST_PURCHASE_INVOICES',
        confidence: 0.85,
        data: {
          payment_status: paymentStatus,
        },
        reply: `Fetching purchase invoices${paymentStatus ? ` (${paymentStatus})` : ''}.`,
      }
    }
  }
  
  // QUERY intent
  if (intent === 'QUERY') {
    // Customer details
    if (lower.includes('customer') && (lower.includes('info') || lower.includes('details') || lower.includes('show') || lower.includes('tell'))) {
      const customerName = extractEntityName(message, 'customer') ||
                           message.match(/(?:customer|about|for)\s+([^?]+)/i)?.[1]?.trim() ||
                           null
      
      if (customerName) {
        return {
          intent: 'QUERY',
          action: 'GET_CUSTOMER_DETAILS',
          confidence: 0.9,
          data: {
            customer_name: customerName,
          },
          reply: `Fetching customer details for ${customerName}.`,
        }
      }
    }
    
    // Product/Stock query
    if ((lower.includes('product') || lower.includes('item') || lower.includes('inventory') || lower.includes('stock')) &&
        (lower.includes("what's") || lower.includes('what is') || lower.includes('how much') || lower.includes('info') || lower.includes('details') || lower.includes('stock') || lower.includes('quantity'))) {
      const productName = extractProductName(message) ||
                         message.match(/(?:product|item|inventory|stock)\s+(?:info|details|for|about)?\s*([^?]+)/i)?.[1]?.trim() ||
                         message.match(/what'?s?\s+(?:the\s+)?(?:stock|quantity)\s+(?:for|of)?\s*([^?]+)/i)?.[1]?.trim() ||
                         null
      
      if (productName) {
        return {
          intent: 'QUERY',
          action: 'GET_STOCK_LEVEL',
          confidence: 0.9,
          data: {
          product: productName,
          },
          reply: `Fetching stock level for ${productName}.`,
        }
      }
      
      // Also try GET_PRODUCT_DETAILS if product name exists
      const altProductName = message.match(/(?:product|item|inventory)\s+([^?]+)/i)?.[1]?.trim()
      if (altProductName) {
        return {
          intent: 'QUERY',
          action: 'GET_PRODUCT_DETAILS',
          confidence: 0.85,
          data: {
            product: altProductName,
          },
          reply: `Fetching product details for ${altProductName}.`,
        }
      }
  }
  
  // Search
    if (lower.includes('search') || lower.includes('find') || lower.includes('look for')) {
    const searchMatch = message.match(/(?:search|find|look for)\s+(.+)/i)
      const query = searchMatch ? searchMatch[1].trim() : null
      
      if (query) {
    return {
          intent: 'QUERY',
          action: 'SEARCH_GLOBAL',
          confidence: 0.85,
          data: {
            query,
          },
          reply: `Searching for "${query}".`,
        }
      }
    }
  }
  
  // UNKNOWN - but try to infer something useful
  // If we have numbers and product names, assume CREATE_SALES_INVOICE
  const items = extractLineItems(message)
  if (items.length > 0) {
    const customerName = extractEntityName(message, 'customer')
    return {
      intent: 'CREATE',
      action: 'CREATE_SALES_INVOICE',
      confidence: 0.7,
      data: {
        customer_name: customerName || null,
        items: items.map(item => ({
          product: item.product,
          quantity: item.quantity,
          unit_price: item.price,
          currency: 'AED',
        })),
      },
      reply: `Preparing sales invoice${customerName ? ` for ${customerName}` : ''} with ${items.length} item(s).`,
    }
  }
  
  // Final fallback
  return {
    intent: 'UNKNOWN',
    action: null,
    confidence: 0.3,
    data: {},
    reply: 'I didn\'t understand that. Type "help" to see what I can do, or try: "Create sales invoice for John Doe with 3x Product @ 100 AED".',
  }
}

/**
 * Find customer by name (fuzzy match)
 */
async function findCustomerByName(customerName: string): Promise<string | null> {
  const customers = await listCustomers({ q: customerName })
  
  const exactMatch = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase())
  if (exactMatch) return String(exactMatch._id)
  
  const partialMatch = customers.find(c => 
    c.name.toLowerCase().includes(customerName.toLowerCase()) ||
    customerName.toLowerCase().includes(c.name.toLowerCase())
  )
  if (partialMatch) return String(partialMatch._id)
  
  if (customers.length > 0) return String(customers[0]._id)
  
  return null
}

/**
 * Find supplier by name (fuzzy match)
 */
async function findSupplierByName(supplierName: string): Promise<string | null> {
  const suppliers = await listSuppliers({ q: supplierName })
  
  const exactMatch = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase())
  if (exactMatch) return String(exactMatch._id)
  
  const partialMatch = suppliers.find(s => 
    s.name.toLowerCase().includes(supplierName.toLowerCase()) ||
    supplierName.toLowerCase().includes(s.name.toLowerCase())
  )
  if (partialMatch) return String(partialMatch._id)
  
  if (suppliers.length > 0) return String(suppliers[0]._id)
  
  return null
}

/**
 * Find inventory item by name (fuzzy match)
 */
async function findInventoryByName(productName: string): Promise<string | null> {
  const inventory = await listInventory({ q: productName, is_active: true })
  
  const exactMatch = inventory.find(item => {
    const name = item.name || item.product_name || ''
    return name.toLowerCase() === productName.toLowerCase()
  })
  if (exactMatch) return String(exactMatch._id)
  
  const partialMatch = inventory.find(item => {
    const name = item.name || item.product_name || ''
    return name.toLowerCase().includes(productName.toLowerCase()) ||
           productName.toLowerCase().includes(name.toLowerCase())
  })
  if (partialMatch) return String(partialMatch._id)
  
  if (inventory.length > 0) return String(inventory[0]._id)
  
  return null
}

/**
 * Process chatbot message and execute actions
 * Returns structured JSON response
 */
export async function processChatbotMessage(
  message: string,
  userId?: string
): Promise<{ message: string; link?: string; linkText?: string }> {
  try {
    // Parse message to get structured response
    const parsed = parseMessage(message)
    console.log('Parsed message:', JSON.stringify(parsed, null, 2))
    
    // If confidence is too low and intent is UNKNOWN, return early
    if (parsed.intent === 'UNKNOWN' && parsed.confidence < 0.5) {
        return {
        message: parsed.reply,
      }
    }
    
    // Execute action based on parsed intent and action
    switch (parsed.action) {
      case 'GET_BALANCE_SHEET':
        try {
          const asOfDate = parsed.data.asOfDate ? new Date(parsed.data.asOfDate) : new Date()
          const balanceSheet = await generateBalanceSheet(asOfDate)
          
          const totalAssets = balanceSheet.assets.total
          const totalLiabilities = balanceSheet.liabilities.total
          const totalEquity = balanceSheet.equity.total
          
          return {
            message: `📊 **Balance Sheet** (as of ${asOfDate.toLocaleDateString()})\n\n**Assets:** ${totalAssets.toFixed(2)} AED\n**Liabilities:** ${totalLiabilities.toFixed(2)} AED\n**Equity:** ${totalEquity.toFixed(2)} AED\n\n**Total:** ${totalAssets.toFixed(2)} AED`,
            link: '/financial-statements/balance-sheet',
            linkText: 'View Full Balance Sheet',
          }
        } catch (error: any) {
          return { message: `Error generating balance sheet: ${error.message}` }
        }
      
      case 'GET_INCOME_STATEMENT':
        try {
          const endDate = new Date()
          const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
          const incomeStatement = await generateIncomeStatement({ startDate, endDate })
          
          const totalExpenses =
            incomeStatement.cogs.total +
            incomeStatement.operating_expenses.total +
            incomeStatement.other_expenses.total +
            incomeStatement.corporate_tax.total

          return {
            message: `📈 **Income Statement** (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})\n\n**Revenue:** ${incomeStatement.revenue.total.toFixed(2)} AED\n**Expenses:** ${totalExpenses.toFixed(2)} AED\n**Net Income:** ${incomeStatement.net_income.toFixed(2)} AED`,
            link: '/financial-statements/income-statement',
            linkText: 'View Full Income Statement',
          }
        } catch (error: any) {
          return { message: `Error generating income statement: ${error.message}` }
        }
      
      case 'GET_CASH_FLOW_STATEMENT':
        try {
          const endDate = new Date()
          const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
          const cashFlow = await generateCashFlowStatement({ startDate, endDate })
          
          return {
            message: `💰 **Cash Flow Statement**\n\n**Operating:** ${cashFlow.operating_activities.total.toFixed(2)} AED\n**Investing:** ${cashFlow.investing_activities.total.toFixed(2)} AED\n**Financing:** ${cashFlow.financing_activities.total.toFixed(2)} AED\n**Net Movement:** ${cashFlow.net_cash_movement.toFixed(2)} AED`,
            link: '/financial-statements/cash-flow',
            linkText: 'View Full Cash Flow',
          }
        } catch (error: any) {
          return { message: `Error generating cash flow: ${error.message}` }
        }
      
      case 'CREATE_SALES_INVOICE':
        try {
          const customerName = parsed.data.customer_name
          const items = parsed.data.items || []
          
          if (!customerName) {
            return { message: 'Please specify a customer name. Example: "Create sales invoice for John Doe with 3x Product @ 100 AED"' }
          }
          
          if (items.length === 0) {
            return { message: 'Please specify items. Example: "Create sales invoice for John Doe with 3x Product @ 100 AED"' }
          }
          
          const customerId = await findCustomerByName(customerName)
          if (!customerId) {
            return { message: `Customer "${customerName}" not found. Please create the customer first.` }
          }
          
          const lineItems = []
          const missingProducts = []
          
          for (const item of items) {
            const productId = await findInventoryByName(item.product)
            if (!productId) {
              missingProducts.push(item.product)
              continue
            }
            
            const inventoryItem = await getInventoryById(productId)
            const unitPrice = item.unit_price || (inventoryItem?.selling_price || 0)
            const vat = inventoryItem?.tax_percent || 5
            const vatAmount = (unitPrice * item.quantity * vat) / 100
            
            lineItems.push({
              product: productId,
              quantity: item.quantity,
              unit_price: unitPrice,
              vat: vatAmount,
              total: (unitPrice * item.quantity) + vatAmount,
            })
          }
          
          if (missingProducts.length > 0) {
            return { message: `Products not found: ${missingProducts.join(', ')}` }
          }
          
          const totals = calculateInvoiceTotals(lineItems)
          const invoiceCount = await SalesInvoice.countDocuments()
          const invoiceNumber = `SI-${(invoiceCount + 1).toString().padStart(4, '0')}`
          
          const invoiceData: SalesInvoiceInput = {
            invoice_number: invoiceNumber,
            customer_id: customerId,
            invoice_date: new Date(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            line_items: lineItems,
            subtotal: totals.subtotal,
            tax_amount: totals.tax_amount,
            discount: totals.discount,
            total_amount: totals.total_amount,
            currency: 'AED',
            payment_status: 'unpaid',
            payment_terms: 'Net 30',
          }
          
          const invoice = await createSalesInvoice(invoiceData, userId)
          const customer = await getCustomerById(customerId)
          
          return {
            message: `✅ Sales invoice ${invoiceNumber} created for ${customer?.name || customerName} with ${lineItems.length} item(s). Total: ${totals.total_amount.toFixed(2)} AED.`,
            link: `/sales-invoices/view/${invoice._id}`,
            linkText: 'View Invoice',
          }
        } catch (error: any) {
          return { message: `Error creating sales invoice: ${error.message}` }
        }
      
      case 'CREATE_PURCHASE_INVOICE':
        try {
          const supplierName = parsed.data.supplier_name
          const items = parsed.data.items || []
          
          if (!supplierName) {
            return { message: 'Please specify a supplier/vendor. Example: "Create purchase invoice from ABC Supplier with 2x Product @ 100 AED"' }
          }
          
          if (items.length === 0) {
            return { message: 'Please specify items. Example: "Create purchase invoice from ABC Supplier with 2x Product @ 100 AED"' }
          }
          
          const supplierId = await findSupplierByName(supplierName)
          if (!supplierId) {
            return { message: `Supplier "${supplierName}" not found. Please create the supplier first.` }
          }
          
          const lineItems = []
          const missingProducts = []
          
          for (const item of items) {
            const productId = await findInventoryByName(item.product)
            if (!productId) {
              missingProducts.push(item.product)
              continue
            }
            
            const inventoryItem = await getInventoryById(productId)
            const unitCost = item.unit_cost || (inventoryItem?.unit_cost || 0)
            const vat = inventoryItem?.tax_percent || 5
            const vatAmount = (unitCost * item.quantity * vat) / 100
            
            lineItems.push({
              product: productId,
              quantity: item.quantity,
              unit_cost: unitCost,
              vat: vatAmount,
              total: (unitCost * item.quantity) + vatAmount,
            })
          }
          
          if (missingProducts.length > 0) {
            return { message: `Products not found: ${missingProducts.join(', ')}` }
          }
          
          const totals = lineItems.reduce((acc, item) => {
            acc.subtotal += item.unit_cost * item.quantity
            acc.tax += item.vat || 0
            return acc
          }, { subtotal: 0, tax: 0 })
          
          const invoiceCount = await PurchaseInvoice.countDocuments()
          const invoiceNumber = `PI-${(invoiceCount + 1).toString().padStart(4, '0')}`
          
          const invoiceData: PurchaseInvoiceInput = {
            invoice_number: invoiceNumber,
            vendor_id: supplierId,
            invoice_date: new Date(),
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            line_items: lineItems,
            subtotal: totals.subtotal,
            tax_amount: totals.tax,
            discount: 0,
            total_amount: totals.subtotal + totals.tax,
            currency: 'AED',
            payment_status: 'unpaid',
            balance_due: totals.subtotal + totals.tax,
            payment_terms: 'Net 30',
          }
          
          const invoice = await createPurchaseInvoice(invoiceData, userId)
          const supplier = await getSupplierById(supplierId)
        
        return {
            message: `✅ Purchase invoice ${invoiceNumber} created for ${supplier?.name || supplierName} with ${lineItems.length} item(s). Total: ${invoiceData.total_amount.toFixed(2)} AED.`,
            link: `/purchase-invoices/view/${invoice._id}`,
            linkText: 'View Invoice',
          }
        } catch (error: any) {
          return { message: `Error creating purchase invoice: ${error.message}` }
        }
      
      case 'CREATE_CUSTOMER':
        try {
          const name = parsed.data.name
          if (!name) {
          return { message: 'Please specify a customer name. Example: "Create customer named John Doe"' }
        }
        
          const newCustomer = await createCustomer({ name })
        return {
            message: `✅ Customer "${name}" created successfully!`,
          link: `/crm-settings/customers?view=${newCustomer._id}`,
          linkText: 'View Customer',
          }
        } catch (error: any) {
          return { message: `Error creating customer: ${error.message}` }
        }
      
      case 'CREATE_SUPPLIER':
        try {
          const name = parsed.data.name
          if (!name) {
          return { message: 'Please specify a supplier name. Example: "Create supplier named ABC Company"' }
        }
        
          const newSupplier = await createSupplier({ name })
        return {
            message: `✅ Supplier "${name}" created successfully!`,
          link: `/crm-settings/suppliers?view=${newSupplier._id}`,
          linkText: 'View Supplier',
          }
        } catch (error: any) {
          return { message: `Error creating supplier: ${error.message}` }
        }
      
      case 'CREATE_PRODUCT':
        try {
          const productName = parsed.data.product_name
          const price = parsed.data.price
          
          if (!productName) {
          return { message: 'Please specify a product name. Example: "Create product Fish Oil with price 223.78"' }
        }
        
        const count = await Inventory.countDocuments()
        const sku = `PROD-${(count + 1).toString().padStart(4, '0')}`
        
        const newProduct = await createInventory({
          sku,
            product_name: productName,
            selling_price: price || 0,
            unit_cost: price ? price * 0.7 : 0,
            quantity_on_hand: 0,
          inventory_valuation_method: 'Weighted Average',
          is_active: true,
        })
        
        return {
            message: `✅ Product "${productName}" created successfully! SKU: ${sku}${price ? `, Price: ${price.toFixed(2)} AED` : ''}`,
          link: `/inventory/view/${newProduct._id}`,
          linkText: 'View Product',
        }
        } catch (error: any) {
          return { message: `Error creating product: ${error.message}` }
        }
      
      case 'RECORD_EXPENSE':
        try {
          const amount = parsed.data.amount
          const category = parsed.data.category || 'Other'
          
          if (!amount) {
            return { message: 'Please specify an amount. Example: "Record expense 500 AED for Rent"' }
        }
        
        if (!userId) {
          return { message: 'User authentication required to create expenses.' }
        }
        
        const Expense = (await import('../models/Expense')).default
        const expenseCount = await Expense.countDocuments()
        const expenseId = `EXP-${(expenseCount + 1).toString().padStart(4, '0')}`
        
        const expenseData: ExpenseInput = {
          expense_id: expenseId,
            category,
            amount,
          currency: 'AED',
          expense_date: new Date(),
            associated_account: category.toUpperCase().replace(/\s+/g, '_') + '_EXPENSE',
          status: 'paid',
            description: `Expense: ${category}`,
            tax_amount: amount * 0.05,
        }
        
        const newExpense = await createExpense(expenseData, userId)
        return {
            message: `✅ Expense recorded successfully! ID: ${expenseId}, Category: ${category}, Amount: ${amount.toFixed(2)} AED`,
          link: `/expenses/view/${newExpense._id}`,
          linkText: 'View Expense',
        }
        } catch (error: any) {
          return { message: `Error recording expense: ${error.message}` }
        }
      
      case 'LIST_SALES_INVOICES':
        try {
          const invoices = await listSalesInvoices({
            payment_status: parsed.data.payment_status,
          })
          
          if (invoices.length === 0) {
            const statusText = parsed.data.payment_status ? `${parsed.data.payment_status} ` : ''
            return {
              message: `No ${statusText}sales invoices found.`,
              link: '/sales-invoices/manage',
              linkText: 'View All Invoices',
            }
          }
          
          const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
          const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
          const statusText = parsed.data.payment_status ? `${parsed.data.payment_status} ` : ''
          
          const customerIds = [...new Set(invoices.map(inv => String(inv.customer_id)))]
          const customers = await Customer.find({ _id: { $in: customerIds } })
          const customerMap = new Map(customers.map(c => [String(c._id), c.name]))
          
          const invoiceList = invoices.slice(0, 5).map(inv => {
            const customerName = customerMap.get(String(inv.customer_id)) || 'Unknown Customer'
            return `• ${inv.invoice_number} - ${customerName} - ${(inv.total_amount || 0).toFixed(2)} AED`
          }).join('\n')
          
          return {
            message: `📄 **${statusText.charAt(0).toUpperCase() + statusText.slice(1)}Sales Invoices** (${invoices.length} found)\n\n${invoiceList}${invoices.length > 5 ? `\n... and ${invoices.length - 5} more` : ''}\n\n**Total Amount:** ${totalAmount.toFixed(2)} AED\n**Outstanding:** ${totalOutstanding.toFixed(2)} AED`,
            link: parsed.data.payment_status ? `/sales-invoices/manage?status=${parsed.data.payment_status}` : '/sales-invoices/manage',
            linkText: 'View All Invoices',
          }
        } catch (error: any) {
          return { message: `Error fetching sales invoices: ${error.message}` }
        }
      
      case 'LIST_PURCHASE_INVOICES':
        try {
          const invoices = await listPurchaseInvoices({
            payment_status: parsed.data.payment_status,
          })
          
          if (invoices.length === 0) {
            const statusText = parsed.data.payment_status ? `${parsed.data.payment_status} ` : ''
            return {
              message: `No ${statusText}purchase invoices found.`,
              link: '/purchase-invoices/manage',
              linkText: 'View All Invoices',
            }
          }
          
          const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
          const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
          const statusText = parsed.data.payment_status ? `${parsed.data.payment_status} ` : ''
          
          const vendorIds = [...new Set(invoices.map(inv => String(inv.vendor_id)))]
          const vendors = await Supplier.find({ _id: { $in: vendorIds } })
          const vendorMap = new Map(vendors.map(v => [String(v._id), v.name]))
          
          const invoiceList = invoices.slice(0, 5).map(inv => {
            const vendorName = vendorMap.get(String(inv.vendor_id)) || 'Unknown Vendor'
            return `• ${inv.invoice_number} - ${vendorName} - ${(inv.total_amount || 0).toFixed(2)} AED`
          }).join('\n')
        
        return {
            message: `📄 **${statusText.charAt(0).toUpperCase() + statusText.slice(1)}Purchase Invoices** (${invoices.length} found)\n\n${invoiceList}${invoices.length > 5 ? `\n... and ${invoices.length - 5} more` : ''}\n\n**Total Amount:** ${totalAmount.toFixed(2)} AED\n**Outstanding:** ${totalOutstanding.toFixed(2)} AED`,
            link: parsed.data.payment_status ? `/purchase-invoices/manage?status=${parsed.data.payment_status}` : '/purchase-invoices/manage',
            linkText: 'View All Invoices',
          }
        } catch (error: any) {
          return { message: `Error fetching purchase invoices: ${error.message}` }
        }
      
      case 'GET_CUSTOMER_DETAILS':
        try {
          const customerName = parsed.data.customer_name
          if (!customerName) {
            return { message: 'Please specify a customer name. Example: "Show customer info for John Doe"' }
          }
          
          const customerId = await findCustomerByName(customerName)
          if (!customerId) {
            return { message: `Customer "${customerName}" not found.` }
          }
          
          const customer = await getCustomerById(customerId)
          if (!customer) {
            return { message: `Customer "${customerName}" not found.` }
          }
          
          const Receivable = (await import('../models/Receivable')).default
          const receivables = await Receivable.find({ customer_id: customerId })
          const totalOutstanding = receivables.reduce((sum, r) => sum + (r.balance_due || 0), 0)
          
          return {
            message: `👤 **${customer.name}**\n\nEmail: ${customer.email || 'N/A'}\nPhone: ${customer.phone || 'N/A'}\nTRN: ${customer.trn || 'N/A'}\nOutstanding: ${totalOutstanding.toFixed(2)} AED`,
            link: `/crm-settings/customers?view=${customerId}`,
            linkText: 'View Customer',
          }
        } catch (error: any) {
          return { message: `Error fetching customer details: ${error.message}` }
        }
      
      case 'GET_PRODUCT_DETAILS':
      case 'GET_STOCK_LEVEL':
        try {
          const productName = parsed.data.product
          if (!productName) {
            return { message: 'Please specify a product name. Example: "What\'s the stock for Fish Oil?"' }
          }
          
          const productId = await findInventoryByName(productName)
          if (!productId) {
            return { message: `Product "${productName}" not found.` }
          }
          
          const product = await getInventoryById(productId)
          if (!product) {
            return { message: `Product "${productName}" not found.` }
          }
          
          const productNameDisplay = product.name || product.product_name || 'Unknown'
          const stock = product.quantity_on_hand || product.qty || 0
          const price = product.selling_price || 0
          const cost = product.unit_cost || 0
        
        return {
            message: `📦 **${productNameDisplay}**\n\nStock: ${stock} units\nSelling Price: ${price.toFixed(2)} AED\nCost: ${cost.toFixed(2)} AED\nValue: ${(stock * cost).toFixed(2)} AED`,
            link: `/inventory/view/${productId}`,
            linkText: 'View Product',
          }
        } catch (error: any) {
          return { message: `Error fetching product details: ${error.message}` }
        }
      
      case 'SEARCH_GLOBAL':
        try {
          const query = parsed.data.query
          if (!query) {
          return { message: 'Please specify what to search for. Example: "Search for John Doe"' }
        }
        
        const { globalSearch } = await import('./searchService')
          const results = await globalSearch(query, 5)
        
        if (results.length === 0) {
            return { message: `No results found for "${query}"` }
        }
        
        const resultsText = results.slice(0, 3).map(r => `• ${r.title} (${r.type})`).join('\n')
        return {
          message: `🔍 Found ${results.length} result(s):\n\n${resultsText}${results.length > 3 ? '\n...' : ''}`,
            link: `/search?q=${encodeURIComponent(query)}`,
          linkText: 'View All Results',
          }
        } catch (error: any) {
          return { message: `Error searching: ${error.message}` }
        }
      
      case null:
        // HELP or UNKNOWN
        return {
          message: parsed.reply,
        }
      
      default:
        return {
          message: parsed.reply || 'Action not yet implemented.',
        }
    }
  } catch (error: any) {
    console.error('Error processing chatbot message:', error)
    console.error('Error stack:', error.stack)
    return {
      message: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again or contact support.`,
    }
  }
}
