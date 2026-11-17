import mongoose from 'mongoose'
import dotenv from 'dotenv'
import connectDB from '../config/database'
import User from '../models/User'
import Customer from '../models/Customer'
import Supplier from '../models/Supplier'
import Enterprise from '../models/Enterprise'
import Event from '../models/Event'
import Inquiry from '../models/Inquiry'
import Brand from '../models/Brand'
import Inventory from '../models/Inventory'
import SalesInvoice from '../models/SalesInvoice'
import PurchaseInvoice from '../models/PurchaseInvoice'
import Expense from '../models/Expense'
import DeliveryOrder from '../models/DeliveryOrder'
import Receivable from '../models/Receivable'
import Payable from '../models/Payable'
import JournalEntry from '../models/JournalEntry'
import Account from '../models/Account'
import GeneralLedger from '../models/GeneralLedger'
import { createJournalEntry } from '../services/journalEntryService'

dotenv.config()

// Helper function to get random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Helper function to get random date within range
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// Helper function to generate invoice number
function generateInvoiceNumber(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(6, '0')}`
}

async function seedUsers() {
  console.log('📦 Seeding Users...')
  const users = [
    {
      name: 'Ahmed Al Mansoori',
      email: 'ahmed.mansoori@crm.com',
      role: 'admin' as const,
      isActive: true,
      employeeId: 'EMP001',
      department: 'Management',
      position: 'Operations Manager',
      phone: '+971 50 123 4567',
      address: 'Business Bay, Dubai',
      city: 'Dubai',
      country: 'UAE',
      hireDate: new Date('2023-01-15'),
    },
    {
      name: 'Fatima Al Zaabi',
      email: 'fatima.zaabi@crm.com',
      role: 'manager' as const,
      isActive: true,
      employeeId: 'EMP002',
      department: 'Sales',
      position: 'Sales Manager',
      phone: '+971 50 234 5678',
      address: 'Jumeirah, Dubai',
      city: 'Dubai',
      country: 'UAE',
      hireDate: new Date('2023-03-20'),
    },
    {
      name: 'Mohammed Al Shamsi',
      email: 'mohammed.shamsi@crm.com',
      role: 'user' as const,
      isActive: true,
      employeeId: 'EMP003',
      department: 'Sales',
      position: 'Sales Representative',
      phone: '+971 50 345 6789',
      address: 'Deira, Dubai',
      city: 'Dubai',
      country: 'UAE',
      hireDate: new Date('2023-06-10'),
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@crm.com',
      role: 'user' as const,
      isActive: true,
      employeeId: 'EMP004',
      department: 'Finance',
      position: 'Accountant',
      phone: '+971 50 456 7890',
      address: 'Marina, Dubai',
      city: 'Dubai',
      country: 'UAE',
      hireDate: new Date('2023-08-05'),
    },
  ]

  for (const userData of users) {
    const existing = await User.findOne({ email: userData.email })
    if (!existing) {
      await User.create(userData)
      console.log(`  ✅ Created user: ${userData.name}`)
    } else {
      console.log(`  ℹ️  User already exists: ${userData.name}`)
    }
  }
}

async function seedCustomers() {
  console.log('📦 Seeding Customers...')
  const customers = [
    {
      name: 'Al Futtaim Group',
      email: 'procurement@alfuttaim.ae',
      phone: '+971 4 234 5678',
      trn: '100012345600003',
      address: 'Dubai Festival City, Dubai, UAE',
    },
    {
      name: 'Emirates NBD',
      email: 'contact@emiratesnbd.com',
      phone: '+971 4 123 4567',
      trn: '100012345600001',
      address: 'Sheikh Zayed Road, Dubai, UAE',
    },
    {
      name: 'Emaar Properties',
      email: 'info@emaar.ae',
      phone: '+971 4 345 6789',
      trn: '100012345600002',
      address: 'Downtown Dubai, Dubai, UAE',
    },
    {
      name: 'Dubai Airports',
      email: 'corporate@dubaiairports.ae',
      phone: '+971 4 224 5555',
      trn: '100012345600004',
      address: 'Dubai International Airport, Dubai, UAE',
    },
    {
      name: 'ADNOC Distribution',
      email: 'contact@adnoc.ae',
      phone: '+971 2 707 0000',
      trn: '100012345600005',
      address: 'Corniche Road, Abu Dhabi, UAE',
    },
    {
      name: 'Etisalat',
      email: 'business@etisalat.ae',
      phone: '+971 4 200 0000',
      trn: '100012345600006',
      address: 'Etisalat Tower, Dubai, UAE',
    },
    {
      name: 'Majid Al Futtaim',
      email: 'info@maf.ae',
      phone: '+971 4 367 3333',
      trn: '100012345600007',
      address: 'City Centre Deira, Dubai, UAE',
    },
    {
      name: 'Dubai Municipality',
      email: 'info@dm.gov.ae',
      phone: '+971 4 221 5555',
      trn: '100012345600008',
      address: 'Dubai Municipality, Dubai, UAE',
    },
  ]

  for (const customerData of customers) {
    const existing = await Customer.findOne({ email: customerData.email })
    if (!existing) {
      await Customer.create(customerData)
      console.log(`  ✅ Created customer: ${customerData.name}`)
    } else {
      console.log(`  ℹ️  Customer already exists: ${customerData.name}`)
    }
  }
}

async function seedSuppliers() {
  console.log('📦 Seeding Suppliers...')
  const suppliers = [
    {
      name: 'Tech Solutions Middle East',
      email: 'sales@techsolutions.ae',
      phone: '+971 4 123 7890',
      trn: '100098765400001',
      address: 'Dubai Internet City, Dubai, UAE',
    },
    {
      name: 'Global Trading LLC',
      email: 'info@globaltrading.ae',
      phone: '+971 4 234 8901',
      trn: '100098765400002',
      address: 'Jebel Ali Free Zone, Dubai, UAE',
    },
    {
      name: 'Premium Supplies Co.',
      email: 'contact@premiumsupplies.ae',
      phone: '+971 4 345 9012',
      trn: '100098765400003',
      address: 'Business Bay, Dubai, UAE',
    },
    {
      name: 'Office Equipment Distributors',
      email: 'sales@officedist.ae',
      phone: '+971 4 456 0123',
      trn: '100098765400004',
      address: 'Al Quoz Industrial Area, Dubai, UAE',
    },
    {
      name: 'Industrial Materials Ltd',
      email: 'info@industrialmaterials.ae',
      phone: '+971 4 567 1234',
      trn: '100098765400005',
      address: 'Dubai Industrial City, Dubai, UAE',
    },
    {
      name: 'Logistics Partners FZE',
      email: 'operations@logisticspartners.ae',
      phone: '+971 4 678 2345',
      trn: '100098765400006',
      address: 'Dubai Logistics City, Dubai, UAE',
    },
  ]

  for (const supplierData of suppliers) {
    const existing = await Supplier.findOne({ email: supplierData.email })
    if (!existing) {
      await Supplier.create(supplierData)
      console.log(`  ✅ Created supplier: ${supplierData.name}`)
    } else {
      console.log(`  ℹ️  Supplier already exists: ${supplierData.name}`)
    }
  }
}

async function seedEnterprises() {
  console.log('📦 Seeding Enterprises...')
  const enterprises = [
    {
      name: 'Dubai Business Solutions',
      email: 'info@dubaibusiness.ae',
      phone: '+971 4 111 2222',
      address: 'Dubai International Financial Centre, Dubai, UAE',
      industry: 'Financial Services',
      status: 'active' as const,
    },
    {
      name: 'Gulf Trading Corporation',
      email: 'contact@gulftrading.ae',
      phone: '+971 4 222 3333',
      address: 'Sheikh Zayed Road, Dubai, UAE',
      industry: 'Trading',
      status: 'active' as const,
    },
    {
      name: 'Middle East Logistics',
      email: 'info@melogistics.ae',
      phone: '+971 4 333 4444',
      address: 'Jebel Ali Port, Dubai, UAE',
      industry: 'Logistics',
      status: 'active' as const,
    },
  ]

  for (const enterpriseData of enterprises) {
    const existing = await Enterprise.findOne({ email: enterpriseData.email })
    if (!existing) {
      await Enterprise.create(enterpriseData)
      console.log(`  ✅ Created enterprise: ${enterpriseData.name}`)
    } else {
      console.log(`  ℹ️  Enterprise already exists: ${enterpriseData.name}`)
    }
  }
}

async function seedBrands() {
  console.log('📦 Seeding Brands...')
  const brands = [
    { name: 'Samsung', description: 'Electronics and appliances' },
    { name: 'Apple', description: 'Consumer electronics' },
    { name: 'HP', description: 'Computers and printers' },
    { name: 'Dell', description: 'Computer systems' },
    { name: 'Lenovo', description: 'Laptops and computers' },
    { name: 'Canon', description: 'Cameras and printers' },
    { name: 'Xerox', description: 'Office equipment' },
    { name: 'Brother', description: 'Printers and office supplies' },
  ]

  for (const brandData of brands) {
    const existing = await Brand.findOne({ name: brandData.name })
    if (!existing) {
      await Brand.create(brandData)
      console.log(`  ✅ Created brand: ${brandData.name}`)
    } else {
      console.log(`  ℹ️  Brand already exists: ${brandData.name}`)
    }
  }
}

async function seedInventory() {
  console.log('📦 Seeding Inventory...')
  const brands = await Brand.find({})
  if (brands.length === 0) {
    console.log('  ⚠️  No brands found. Please seed brands first.')
    return
  }

  const products = [
    {
      sku: 'LAP-001',
      product_name: 'Dell Latitude 5520 Laptop',
      category: 'Laptops',
      description: '15.6" FHD, Intel Core i7, 16GB RAM, 512GB SSD',
      unit_cost: 3500,
      selling_price: 4200,
      quantity_on_hand: 25,
      reorder_level: 10,
      reorder_quantity: 20,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'Dell')?._id,
    },
    {
      sku: 'LAP-002',
      product_name: 'HP EliteBook 850 G8',
      category: 'Laptops',
      description: '15.6" FHD, Intel Core i5, 8GB RAM, 256GB SSD',
      unit_cost: 2800,
      selling_price: 3400,
      quantity_on_hand: 18,
      reorder_level: 8,
      reorder_quantity: 15,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'HP')?._id,
    },
    {
      sku: 'LAP-003',
      product_name: 'Lenovo ThinkPad X1 Carbon',
      category: 'Laptops',
      description: '14" FHD, Intel Core i7, 16GB RAM, 512GB SSD',
      unit_cost: 4200,
      selling_price: 5000,
      quantity_on_hand: 12,
      reorder_level: 5,
      reorder_quantity: 10,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'Lenovo')?._id,
    },
    {
      sku: 'PRT-001',
      product_name: 'HP LaserJet Pro M404dn',
      category: 'Printers',
      description: 'Monochrome Laser Printer, Network Ready',
      unit_cost: 800,
      selling_price: 1100,
      quantity_on_hand: 35,
      reorder_level: 15,
      reorder_quantity: 25,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'HP')?._id,
    },
    {
      sku: 'PRT-002',
      product_name: 'Canon PIXMA TR8620',
      category: 'Printers',
      description: 'All-in-One Inkjet Printer, WiFi',
      unit_cost: 600,
      selling_price: 850,
      quantity_on_hand: 28,
      reorder_level: 12,
      reorder_quantity: 20,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'Canon')?._id,
    },
    {
      sku: 'PRT-003',
      product_name: 'Xerox VersaLink C405',
      category: 'Printers',
      description: 'Color Multifunction Printer, Network Ready',
      unit_cost: 1500,
      selling_price: 2100,
      quantity_on_hand: 15,
      reorder_level: 8,
      reorder_quantity: 12,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'Xerox')?._id,
    },
    {
      sku: 'MON-001',
      product_name: 'Samsung 27" 4K Monitor',
      category: 'Monitors',
      description: '27" UHD 4K LED Monitor, USB-C',
      unit_cost: 1200,
      selling_price: 1600,
      quantity_on_hand: 40,
      reorder_level: 20,
      reorder_quantity: 30,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'Samsung')?._id,
    },
    {
      sku: 'MON-002',
      product_name: 'Dell UltraSharp 24" Monitor',
      category: 'Monitors',
      description: '24" FHD IPS Monitor, USB Hub',
      unit_cost: 900,
      selling_price: 1200,
      quantity_on_hand: 32,
      reorder_level: 15,
      reorder_quantity: 25,
      tax_percent: 5,
      is_active: true,
      brand: brands.find(b => b.name === 'Dell')?._id,
    },
    {
      sku: 'ACC-001',
      product_name: 'Wireless Mouse - Logitech MX Master 3',
      category: 'Accessories',
      description: 'Wireless Ergonomic Mouse, Bluetooth',
      unit_cost: 250,
      selling_price: 350,
      quantity_on_hand: 60,
      reorder_level: 30,
      reorder_quantity: 50,
      tax_percent: 5,
      is_active: true,
    },
    {
      sku: 'ACC-002',
      product_name: 'USB-C Hub - 7-in-1',
      category: 'Accessories',
      description: 'USB-C Hub with HDMI, USB 3.0, SD Card Reader',
      unit_cost: 120,
      selling_price: 180,
      quantity_on_hand: 75,
      reorder_level: 40,
      reorder_quantity: 60,
      tax_percent: 5,
      is_active: true,
    },
  ]

  for (const productData of products) {
    const existing = await Inventory.findOne({ sku: productData.sku })
    if (!existing) {
      await Inventory.create(productData)
      console.log(`  ✅ Created product: ${productData.product_name}`)
    } else {
      console.log(`  ℹ️  Product already exists: ${productData.product_name}`)
    }
  }
}

async function seedEvents() {
  console.log('📦 Seeding Events...')
  const customers = await Customer.find({}).limit(5)
  if (customers.length === 0) {
    console.log('  ⚠️  No customers found. Please seed customers first.')
    return
  }

  const eventTypes: Array<'assessment' | 'counseling' | 'event' | 'other'> = ['assessment', 'counseling', 'event', 'other']
  const statuses: Array<'scheduled' | 'completed' | 'cancelled'> = ['scheduled', 'completed', 'cancelled']

  const events = []
  const now = new Date()
  const pastDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
  const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days ahead

  for (let i = 0; i < 15; i++) {
    const startTime = randomDate(pastDate, futureDate)
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000) // 2 hours later
    const status = startTime < now ? randomElement(['completed', 'cancelled']) : 'scheduled'

    events.push({
      title: `Meeting with ${randomElement(customers).name}`,
      description: `Business discussion and product presentation for ${randomElement(customers).name}`,
      startTime,
      endTime,
      clientId: randomElement(customers)._id,
      type: randomElement(eventTypes),
      status,
    })
  }

  for (const eventData of events) {
    await Event.create(eventData)
    console.log(`  ✅ Created event: ${eventData.title}`)
  }
}

async function seedInquiries() {
  console.log('📦 Seeding Inquiries...')
  const statuses: Array<'new' | 'contacted' | 'resolved' | 'archived'> = ['new', 'contacted', 'resolved', 'archived']

  const inquiries = [
    {
      name: 'Khalid Al Maktoum',
      email: 'khalid.maktoum@email.com',
      phone: '+971 50 111 2222',
      message: 'Interested in bulk purchase of laptops for our new office. Please provide quotation.',
      status: 'new' as const,
    },
    {
      name: 'Aisha Al Suwaidi',
      email: 'aisha.suwaidi@email.com',
      phone: '+971 50 222 3333',
      message: 'Need information about printer maintenance services and support packages.',
      status: 'contacted' as const,
    },
    {
      name: 'Omar Al Nuaimi',
      email: 'omar.nuaimi@email.com',
      phone: '+971 50 333 4444',
      message: 'Looking for enterprise solutions for our IT infrastructure upgrade project.',
      status: 'resolved' as const,
    },
    {
      name: 'Layla Al Dhaheri',
      email: 'layla.dhaheri@email.com',
      phone: '+971 50 444 5555',
      message: 'Inquiry about monitor specifications and bulk pricing for 50 units.',
      status: 'new' as const,
    },
    {
      name: 'Youssef Al Hameli',
      email: 'youssef.hameli@email.com',
      phone: '+971 50 555 6666',
      message: 'Request for product catalog and technical specifications for all laptop models.',
      status: 'contacted' as const,
    },
  ]

  for (const inquiryData of inquiries) {
    await Inquiry.create(inquiryData)
    console.log(`  ✅ Created inquiry from: ${inquiryData.name}`)
  }
}

async function seedSalesInvoices() {
  console.log('📦 Seeding Sales Invoices...')
  const customers = await Customer.find({})
  const products = await Inventory.find({ is_active: true })

  if (customers.length === 0 || products.length === 0) {
    console.log('  ⚠️  No customers or products found. Please seed them first.')
    return
  }

  // Get the highest existing invoice number to avoid duplicates
  const lastInvoice = await SalesInvoice.findOne({}).sort({ invoice_number: -1 })
  let startNumber = 1
  if (lastInvoice && lastInvoice.invoice_number) {
    const match = lastInvoice.invoice_number.match(/SI-(\d+)/)
    if (match) {
      startNumber = parseInt(match[1], 10) + 1
    }
  }

  const now = new Date()
  const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // 60 days ago

  for (let i = 0; i < 20; i++) {
    const invoiceNumber = generateInvoiceNumber('SI', startNumber + i)
    
    // Check if invoice already exists
    const existing = await SalesInvoice.findOne({ invoice_number: invoiceNumber })
    if (existing) {
      console.log(`  ℹ️  Sales invoice already exists: ${invoiceNumber}`)
      continue
    }

    const customer = randomElement(customers)
    const invoiceDate = randomDate(pastDate, now)
    const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days later

    // Create 1-3 line items
    const numItems = Math.floor(Math.random() * 3) + 1
    const lineItems = []
    let subtotal = 0

    for (let j = 0; j < numItems; j++) {
      const product = randomElement(products)
      const quantity = Math.floor(Math.random() * 5) + 1
      const unitPrice = product.selling_price
      const discount = Math.random() < 0.3 ? Math.floor(Math.random() * 10) : 0 // 30% chance of discount
      const vat = product.tax_percent || 5
      const itemTotal = quantity * unitPrice * (1 - discount / 100)
      const itemVat = itemTotal * (vat / 100)

      lineItems.push({
        product: product._id,
        description: product.product_name,
        quantity,
        unit_price: unitPrice,
        total: itemTotal + itemVat,
        discount,
        vat: itemVat,
      })

      subtotal += itemTotal
    }

    const taxAmount = lineItems.reduce((sum, item) => sum + (item.vat || 0), 0)
    const discount = lineItems.reduce((sum, item) => sum + (item.discount || 0), 0)
    const totalAmount = subtotal + taxAmount

    const paymentStatuses: Array<'unpaid' | 'partial' | 'paid' | 'overdue'> = ['unpaid', 'partial', 'paid', 'overdue']
    let paymentStatus = randomElement(paymentStatuses)
    
    // Adjust status based on due date
    if (dueDate < now && paymentStatus !== 'paid') {
      paymentStatus = 'overdue'
    }

    const balanceDue = paymentStatus === 'paid' ? 0 : totalAmount * (paymentStatus === 'partial' ? 0.5 : 1)

    try {
      const invoice = await SalesInvoice.create({
        invoice_number: invoiceNumber,
        customer_id: customer._id,
        invoice_date: invoiceDate,
        due_date: dueDate,
        line_items: lineItems,
        subtotal,
        tax_amount: taxAmount,
        discount,
        total_amount: totalAmount,
        currency: 'AED',
        payment_status: paymentStatus,
        balance_due: balanceDue,
        payment_terms: 'Net 30',
        notes: `Invoice for ${customer.name}`,
        trn: customer.trn,
        isExportInvoice: Math.random() < 0.2, // 20% export invoices
      })

      console.log(`  ✅ Created sales invoice: ${invoice.invoice_number} - ${customer.name} - AED ${totalAmount.toFixed(2)}`)
    } catch (error: any) {
      if (error.code === 11000) {
        console.log(`  ℹ️  Sales invoice already exists: ${invoiceNumber}`)
      } else {
        console.log(`  ⚠️  Failed to create sales invoice: ${invoiceNumber} - ${error.message}`)
      }
    }
  }
}

async function seedPurchaseInvoices() {
  console.log('📦 Seeding Purchase Invoices...')
  const suppliers = await Supplier.find({})
  const products = await Inventory.find({ is_active: true })

  if (suppliers.length === 0 || products.length === 0) {
    console.log('  ⚠️  No suppliers or products found. Please seed them first.')
    return
  }

  // Get the highest existing invoice number to avoid duplicates
  const lastInvoice = await PurchaseInvoice.findOne({}).sort({ invoice_number: -1 })
  let startNumber = 1
  if (lastInvoice && lastInvoice.invoice_number) {
    const match = lastInvoice.invoice_number.match(/PI-(\d+)/)
    if (match) {
      startNumber = parseInt(match[1], 10) + 1
    }
  }

  const now = new Date()
  const pastDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // 60 days ago

  for (let i = 0; i < 15; i++) {
    const invoiceNumber = generateInvoiceNumber('PI', startNumber + i)
    
    // Check if invoice already exists
    const existing = await PurchaseInvoice.findOne({ invoice_number: invoiceNumber })
    if (existing) {
      console.log(`  ℹ️  Purchase invoice already exists: ${invoiceNumber}`)
      continue
    }

    const supplier = randomElement(suppliers)
    const invoiceDate = randomDate(pastDate, now)
    const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days later

    // Create 1-3 line items
    const numItems = Math.floor(Math.random() * 3) + 1
    const lineItems = []
    let subtotal = 0

    for (let j = 0; j < numItems; j++) {
      const product = randomElement(products)
      const quantity = Math.floor(Math.random() * 10) + 5 // Bulk purchases
      const unitCost = product.unit_cost
      const discount = Math.random() < 0.2 ? Math.floor(Math.random() * 5) : 0 // 20% chance of discount
      const vat = product.tax_percent || 5
      const itemTotal = quantity * unitCost * (1 - discount / 100)
      const itemVat = itemTotal * (vat / 100)

      lineItems.push({
        product: product._id,
        description: product.product_name,
        quantity,
        unit_cost: unitCost,
        total: itemTotal + itemVat,
        discount,
        vat: itemVat,
      })

      subtotal += itemTotal
    }

    const taxAmount = lineItems.reduce((sum, item) => sum + (item.vat || 0), 0)
    const discount = lineItems.reduce((sum, item) => sum + (item.discount || 0), 0)
    const totalAmount = subtotal + taxAmount

    const paymentStatuses: Array<'unpaid' | 'partial' | 'paid' | 'overdue'> = ['unpaid', 'partial', 'paid', 'overdue']
    let paymentStatus = randomElement(paymentStatuses)
    
    // Adjust status based on due date
    if (dueDate < now && paymentStatus !== 'paid') {
      paymentStatus = 'overdue'
    }

    const balanceDue = paymentStatus === 'paid' ? 0 : totalAmount * (paymentStatus === 'partial' ? 0.5 : 1)

    try {
      const invoice = await PurchaseInvoice.create({
        invoice_number: invoiceNumber,
        vendor_id: supplier._id,
        invoice_date: invoiceDate,
        due_date: dueDate,
        line_items: lineItems,
        subtotal,
        tax_amount: taxAmount,
        discount,
        total_amount: totalAmount,
        currency: 'AED',
        payment_status: paymentStatus,
        balance_due: balanceDue,
        payment_terms: 'Net 30',
        notes: `Purchase from ${supplier.name}`,
        trn: supplier.trn,
      })

      console.log(`  ✅ Created purchase invoice: ${invoice.invoice_number} - ${supplier.name} - AED ${totalAmount.toFixed(2)}`)
    } catch (error: any) {
      if (error.code === 11000) {
        console.log(`  ℹ️  Purchase invoice already exists: ${invoiceNumber}`)
      } else {
        console.log(`  ⚠️  Failed to create purchase invoice: ${invoiceNumber} - ${error.message}`)
      }
    }
  }
}

async function seedExpenses() {
  console.log('📦 Seeding Expenses...')
  const suppliers = await Supplier.find({}).limit(3)
  const users = await User.find({}).limit(2)
  const accounts = await Account.find({ account_type: 'Expense' }).limit(5)

  if (users.length === 0 || accounts.length === 0) {
    console.log('  ⚠️  No users or expense accounts found. Please seed them first.')
    return
  }

  const categories = ['rent', 'utilities', 'travel', 'supplies', 'marketing', 'maintenance', 'professional services']
  const paymentMethods = ['Cash', 'Bank Transfer', 'Credit Card']
  const statuses = ['paid', 'unpaid', 'partial']

  const now = new Date()
  const pastDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago

  for (let i = 1; i <= 25; i++) {
    const expenseDate = randomDate(pastDate, now)
    const category = randomElement(categories)
    const amount = Math.floor(Math.random() * 5000) + 500 // 500 to 5500
    const taxAmount = amount * 0.05 // 5% VAT
    const status = randomElement(statuses)

    await Expense.create({
      expense_id: `EXP-${String(i).padStart(6, '0')}`,
      category,
      vendor_id: Math.random() < 0.6 ? randomElement(suppliers)?._id : undefined, // 60% have vendor
      amount,
      currency: 'AED',
      expense_date: expenseDate,
      payment_method: status === 'paid' ? randomElement(paymentMethods) : undefined,
      reference_number: status === 'paid' ? `REF-${Math.floor(Math.random() * 10000)}` : undefined,
      tax_amount: taxAmount,
      description: `${category.charAt(0).toUpperCase() + category.slice(1)} expense for ${category === 'rent' ? 'office rent' : category === 'utilities' ? 'electricity and water' : 'business operations'}`,
      created_by: randomElement(users)._id,
      associated_account: randomElement(accounts).account_name,
      status,
    })

    console.log(`  ✅ Created expense: ${category} - AED ${amount.toFixed(2)}`)
  }
}

async function seedDeliveryOrders() {
  console.log('📦 Seeding Delivery Orders...')
  const salesInvoices = await SalesInvoice.find({}).limit(10)
  const customers = await Customer.find({})

  if (salesInvoices.length === 0) {
    console.log('  ⚠️  No sales invoices found. Please seed sales invoices first.')
    return
  }

  const now = new Date()
  const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

  for (let i = 0; i < Math.min(8, salesInvoices.length); i++) {
    const invoice = salesInvoices[i]
    const customer = customers.find(c => String(c._id) === String(invoice.customer_id)) || customers[0]
    
    // Get products from invoice line items
    const lineItems = invoice.line_items.map(item => ({
      product: item.product,
      qty: item.quantity,
      delivered: Math.random() < 0.7, // 70% delivered
    }))

    const deliveryDate = randomDate(pastDate, now)

    await DeliveryOrder.create({
      serialNumber: `DO-${String(i + 1).padStart(6, '0')}`,
      invoiceNumber: invoice._id,
      date: deliveryDate,
      customer: customer._id,
      deliveryAddress: customer.address || 'Address not specified',
      lineItems,
    })

    console.log(`  ✅ Created delivery order: DO-${String(i + 1).padStart(6, '0')} for invoice ${invoice.invoice_number}`)
  }
}

async function seedReceivables() {
  console.log('📦 Seeding Receivables...')
  const customers = await Customer.find({})
  const salesInvoices = await SalesInvoice.find({ payment_status: { $in: ['unpaid', 'partial', 'overdue'] } })

  if (customers.length === 0 || salesInvoices.length === 0) {
    console.log('  ⚠️  No customers or unpaid invoices found.')
    return
  }

  // Create receivables for unpaid/partial invoices
  for (const invoice of salesInvoices.slice(0, 10)) {
    const customer = customers.find(c => String(c._id) === String(invoice.customer_id))
    if (!customer) continue

    const payments = []
    if (invoice.payment_status === 'partial') {
      // Add partial payment
      payments.push({
        date: new Date(invoice.invoice_date.getTime() + 15 * 24 * 60 * 60 * 1000),
        amount: invoice.total_amount * 0.5,
        paymentMethod: 'Bank Transfer',
        referenceNumber: `PAY-${Math.floor(Math.random() * 10000)}`,
      })
    } else if (invoice.payment_status === 'paid') {
      // Add full payment
      payments.push({
        date: new Date(invoice.invoice_date.getTime() + 20 * 24 * 60 * 60 * 1000),
        amount: invoice.total_amount,
        paymentMethod: 'Bank Transfer',
        referenceNumber: `PAY-${Math.floor(Math.random() * 10000)}`,
      })
    }

    const existing = await Receivable.findOne({ invoice_number: invoice.invoice_number })
    if (!existing) {
      await Receivable.create({
        customer_id: customer._id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total_amount: invoice.total_amount,
        tax_amount: invoice.tax_amount,
        currency: invoice.currency,
        status: invoice.payment_status,
        balance_due: invoice.balance_due,
        payment_terms: invoice.payment_terms || 'Net 30',
        notes: `Receivable for invoice ${invoice.invoice_number}`,
        payments,
      })

      console.log(`  ✅ Created receivable: ${invoice.invoice_number} - ${customer.name} - Balance: AED ${invoice.balance_due.toFixed(2)}`)
    }
  }
}

async function seedPayables() {
  console.log('📦 Seeding Payables...')
  const suppliers = await Supplier.find({})
  const purchaseInvoices = await PurchaseInvoice.find({ payment_status: { $in: ['unpaid', 'partial', 'overdue'] } })

  if (suppliers.length === 0 || purchaseInvoices.length === 0) {
    console.log('  ⚠️  No suppliers or unpaid invoices found.')
    return
  }

  // Create payables for unpaid/partial invoices
  for (const invoice of purchaseInvoices.slice(0, 8)) {
    const supplier = suppliers.find(s => String(s._id) === String(invoice.vendor_id))
    if (!supplier) continue

    const payments = []
    if (invoice.payment_status === 'partial') {
      // Add partial payment
      payments.push({
        date: new Date(invoice.invoice_date.getTime() + 15 * 24 * 60 * 60 * 1000),
        amount: invoice.total_amount * 0.5,
        paymentMethod: 'Bank Transfer',
        referenceNumber: `PAY-${Math.floor(Math.random() * 10000)}`,
      })
    } else if (invoice.payment_status === 'paid') {
      // Add full payment
      payments.push({
        date: new Date(invoice.invoice_date.getTime() + 20 * 24 * 60 * 60 * 1000),
        amount: invoice.total_amount,
        paymentMethod: 'Bank Transfer',
        referenceNumber: `PAY-${Math.floor(Math.random() * 10000)}`,
      })
    }

    const existing = await Payable.findOne({ bill_number: invoice.invoice_number })
    if (!existing) {
      await Payable.create({
        vendor_id: supplier._id,
        bill_number: invoice.invoice_number,
        bill_date: invoice.invoice_date,
        due_date: invoice.due_date,
        total_amount: invoice.total_amount,
        tax_amount: invoice.tax_amount,
        currency: invoice.currency,
        status: invoice.payment_status,
        balance_due: invoice.balance_due,
        payment_terms: invoice.payment_terms || 'Net 30',
        notes: `Payable for invoice ${invoice.invoice_number}`,
        payments,
      })

      console.log(`  ✅ Created payable: ${invoice.invoice_number} - ${supplier.name} - Balance: AED ${invoice.balance_due.toFixed(2)}`)
    }
  }
}

async function seedJournalEntries() {
  console.log('📦 Seeding Journal Entries...')
  const users = await User.find({}).limit(2)
  const accounts = await Account.find({ is_active: true })

  if (users.length === 0 || accounts.length === 0) {
    console.log('  ⚠️  No users or accounts found. Please seed them first.')
    return
  }

  // Get specific accounts for common journal entries
  const cashAccount = accounts.find(a => a.account_name.toLowerCase().includes('cash'))
  const bankAccount = accounts.find(a => a.account_name.toLowerCase().includes('bank'))
  const arAccount = accounts.find(a => a.account_name.toLowerCase().includes('receivable') || a.account_name.toLowerCase().includes('ar'))
  const apAccount = accounts.find(a => a.account_name.toLowerCase().includes('payable') || a.account_name.toLowerCase().includes('ap'))
  const salesAccount = accounts.find(a => a.account_name.toLowerCase().includes('sales') || a.account_name.toLowerCase().includes('revenue'))
  const cogsAccount = accounts.find(a => a.account_name.toLowerCase().includes('cogs') || a.account_name.toLowerCase().includes('cost of goods'))
  const inventoryAccount = accounts.find(a => a.account_name.toLowerCase().includes('inventory'))
  const rentAccount = accounts.find(a => a.account_name.toLowerCase().includes('rent'))
  const salaryAccount = accounts.find(a => a.account_name.toLowerCase().includes('salar'))
  const equityAccount = accounts.find(a => a.account_name.toLowerCase().includes('capital') || a.account_name.toLowerCase().includes('equity'))
  const retainedEarningsAccount = accounts.find(a => a.account_name.toLowerCase().includes('retained'))

  if (!cashAccount || !bankAccount || !salesAccount) {
    console.log('  ⚠️  Required accounts not found. Please ensure Chart of Accounts is seeded.')
    return
  }

  const now = new Date()
  const pastDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago

  const journalEntries = [
    // 1. Bank Transfer - Cash to Bank
    {
      date: randomDate(pastDate, now),
      description: 'Transfer funds from cash to bank account',
      entries: [
        {
          account_id: bankAccount.account_id,
          account_name: bankAccount.account_name,
          debit: 50000,
          credit: 0,
        },
        {
          account_id: cashAccount.account_id,
          account_name: cashAccount.account_name,
          debit: 0,
          credit: 50000,
        },
      ],
      source_module: 'manual' as const,
    },
    // 2. Accrued Salary Expense
    {
      date: randomDate(pastDate, now),
      description: 'Accrued salaries for the month',
      entries: salaryAccount ? [
        {
          account_id: salaryAccount.account_id,
          account_name: salaryAccount.account_name,
          debit: 25000,
          credit: 0,
        },
        {
          account_id: apAccount?.account_id || bankAccount.account_id,
          account_name: apAccount?.account_name || bankAccount.account_name,
          debit: 0,
          credit: 25000,
        },
      ] : [],
      source_module: 'manual' as const,
    },
    // 3. Depreciation Entry
    {
      date: randomDate(pastDate, now),
      description: 'Monthly depreciation on fixed assets',
      entries: [
        {
          account_id: rentAccount?.account_id || accounts.find(a => a.account_type === 'Expense')?.account_id || '',
          account_name: rentAccount?.account_name || 'Depreciation Expense',
          debit: 5000,
          credit: 0,
        },
        {
          account_id: accounts.find(a => a.account_name.toLowerCase().includes('depreciation') || a.account_sub_type === 'Contra Asset')?.account_id || bankAccount.account_id,
          account_name: accounts.find(a => a.account_name.toLowerCase().includes('depreciation'))?.account_name || 'Accumulated Depreciation',
          debit: 0,
          credit: 5000,
        },
      ],
      source_module: 'manual' as const,
    },
    // 4. Prepaid Expense Adjustment
    {
      date: randomDate(pastDate, now),
      description: 'Adjustment for prepaid rent expense',
      entries: rentAccount ? [
        {
          account_id: rentAccount.account_id,
          account_name: rentAccount.account_name,
          debit: 10000,
          credit: 0,
        },
        {
          account_id: accounts.find(a => a.account_type === 'Asset' && a.account_sub_type === 'Current Asset')?.account_id || cashAccount.account_id,
          account_name: accounts.find(a => a.account_type === 'Asset' && a.account_sub_type === 'Current Asset')?.account_name || 'Prepaid Expenses',
          debit: 0,
          credit: 10000,
        },
      ] : [],
      source_module: 'manual' as const,
    },
    // 5. Bad Debt Write-off
    {
      date: randomDate(pastDate, now),
      description: 'Write-off uncollectible accounts receivable',
      entries: arAccount ? [
        {
          account_id: accounts.find(a => a.account_name.toLowerCase().includes('bad debt') || a.account_name.toLowerCase().includes('doubtful'))?.account_id || accounts.find(a => a.account_type === 'Expense')?.account_id || '',
          account_name: accounts.find(a => a.account_name.toLowerCase().includes('bad debt'))?.account_name || 'Bad Debt Expense',
          debit: 2000,
          credit: 0,
        },
        {
          account_id: arAccount.account_id,
          account_name: arAccount.account_name,
          debit: 0,
          credit: 2000,
        },
      ] : [],
      source_module: 'manual' as const,
    },
    // 6. Inventory Adjustment
    {
      date: randomDate(pastDate, now),
      description: 'Inventory count adjustment',
      entries: inventoryAccount && cogsAccount ? [
        {
          account_id: inventoryAccount.account_id,
          account_name: inventoryAccount.account_name,
          debit: 15000,
          credit: 0,
        },
        {
          account_id: cogsAccount.account_id,
          account_name: cogsAccount.account_name,
          debit: 0,
          credit: 15000,
        },
      ] : [],
      source_module: 'manual' as const,
    },
    // 7. Interest Income
    {
      date: randomDate(pastDate, now),
      description: 'Interest earned on bank deposits',
      entries: [
        {
          account_id: bankAccount.account_id,
          account_name: bankAccount.account_name,
          debit: 1500,
          credit: 0,
        },
        {
          account_id: accounts.find(a => a.account_type === 'Revenue' && a.account_sub_type === 'Non-Operating Revenue')?.account_id || salesAccount.account_id,
          account_name: accounts.find(a => a.account_type === 'Revenue' && a.account_sub_type === 'Non-Operating Revenue')?.account_name || 'Interest Income',
          debit: 0,
          credit: 1500,
        },
      ],
      source_module: 'manual' as const,
    },
    // 8. Owner's Capital Contribution
    {
      date: randomDate(pastDate, now),
      description: 'Additional capital contribution from owner',
      entries: equityAccount ? [
        {
          account_id: bankAccount.account_id,
          account_name: bankAccount.account_name,
          debit: 100000,
          credit: 0,
        },
        {
          account_id: equityAccount.account_id,
          account_name: equityAccount.account_name,
          debit: 0,
          credit: 100000,
        },
      ] : [],
      source_module: 'manual' as const,
    },
    // 9. Accrued Interest Expense
    {
      date: randomDate(pastDate, now),
      description: 'Accrued interest on loan',
      entries: [
        {
          account_id: accounts.find(a => a.account_name.toLowerCase().includes('interest') && a.account_type === 'Expense')?.account_id || accounts.find(a => a.account_type === 'Expense')?.account_id || '',
          account_name: accounts.find(a => a.account_name.toLowerCase().includes('interest') && a.account_type === 'Expense')?.account_name || 'Interest Expense',
          debit: 3000,
          credit: 0,
        },
        {
          account_id: accounts.find(a => a.account_type === 'Liability' && a.account_sub_type === 'Current Liability')?.account_id || apAccount?.account_id || bankAccount.account_id,
          account_name: accounts.find(a => a.account_type === 'Liability' && a.account_sub_type === 'Current Liability')?.account_name || 'Accrued Interest',
          debit: 0,
          credit: 3000,
        },
      ],
      source_module: 'manual' as const,
    },
    // 10. Sales Return/Allowance
    {
      date: randomDate(pastDate, now),
      description: 'Sales return and allowance adjustment',
      entries: salesAccount && arAccount ? [
        {
          account_id: accounts.find(a => a.account_name.toLowerCase().includes('return') || a.account_name.toLowerCase().includes('allowance'))?.account_id || salesAccount.account_id,
          account_name: accounts.find(a => a.account_name.toLowerCase().includes('return'))?.account_name || 'Sales Returns',
          debit: 5000,
          credit: 0,
        },
        {
          account_id: arAccount.account_id,
          account_name: arAccount.account_name,
          debit: 0,
          credit: 5000,
        },
      ] : [],
      source_module: 'manual' as const,
    },
  ]

  let createdCount = 0
  for (const entryData of journalEntries) {
    // Skip if entries array is empty (missing required accounts)
    if (entryData.entries.length === 0) {
      continue
    }

    // Validate that all entries have account_id
    const hasValidAccounts = entryData.entries.every(e => e.account_id && e.account_id.trim() !== '')
    if (!hasValidAccounts) {
      continue
    }

    try {
      const user = randomElement(users)
      await createJournalEntry({
        date: entryData.date,
        description: entryData.description,
        entries: entryData.entries,
        createdBy: String(user._id),
        source_module: entryData.source_module,
      })
      createdCount++
      console.log(`  ✅ Created journal entry: ${entryData.description}`)
    } catch (error: any) {
      console.log(`  ⚠️  Failed to create journal entry: ${entryData.description} - ${error.message}`)
    }
  }

  console.log(`  ✅ Created ${createdCount} journal entries (General Ledger entries created automatically)`)
}

export async function seedAllSampleData() {
  await connectDB()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🌱 Starting Sample Data Seeding...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  try {
    await seedUsers()
    await seedCustomers()
    await seedSuppliers()
    await seedEnterprises()
    await seedBrands()
    await seedInventory()
    await seedEvents()
    await seedInquiries()
    await seedSalesInvoices()
    await seedPurchaseInvoices()
    await seedExpenses()
    await seedDeliveryOrders()
    await seedReceivables()
    await seedPayables()
    await seedJournalEntries()

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Sample data seeding completed!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Print summary
    const counts = {
      users: await User.countDocuments({}),
      customers: await Customer.countDocuments({}),
      suppliers: await Supplier.countDocuments({}),
      enterprises: await Enterprise.countDocuments({}),
      brands: await Brand.countDocuments({}),
      inventory: await Inventory.countDocuments({}),
      events: await Event.countDocuments({}),
      inquiries: await Inquiry.countDocuments({}),
      salesInvoices: await SalesInvoice.countDocuments({}),
      purchaseInvoices: await PurchaseInvoice.countDocuments({}),
      expenses: await Expense.countDocuments({}),
      deliveryOrders: await DeliveryOrder.countDocuments({}),
      receivables: await Receivable.countDocuments({}),
      payables: await Payable.countDocuments({}),
      journalEntries: await JournalEntry.countDocuments({}),
      generalLedgerEntries: await GeneralLedger.countDocuments({}),
    }

    console.log('📊 Data Summary:')
    console.log(`   Users: ${counts.users}`)
    console.log(`   Customers: ${counts.customers}`)
    console.log(`   Suppliers: ${counts.suppliers}`)
    console.log(`   Enterprises: ${counts.enterprises}`)
    console.log(`   Brands: ${counts.brands}`)
    console.log(`   Inventory Items: ${counts.inventory}`)
    console.log(`   Events: ${counts.events}`)
    console.log(`   Inquiries: ${counts.inquiries}`)
    console.log(`   Sales Invoices: ${counts.salesInvoices}`)
    console.log(`   Purchase Invoices: ${counts.purchaseInvoices}`)
    console.log(`   Expenses: ${counts.expenses}`)
    console.log(`   Delivery Orders: ${counts.deliveryOrders}`)
    console.log(`   Receivables: ${counts.receivables}`)
    console.log(`   Payables: ${counts.payables}`)
    console.log(`   Journal Entries: ${counts.journalEntries}`)
    console.log(`   General Ledger Entries: ${counts.generalLedgerEntries}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (error) {
    console.error('❌ Error seeding sample data:', error)
    throw error
  }
}

if (require.main === module) {
  seedAllSampleData()
    .then(() => {
      console.log('Sample data seeding completed')
      process.exit(0)
    })
    .catch(err => {
      console.error('Error running sample data seeder', err)
      process.exit(1)
    })
}

