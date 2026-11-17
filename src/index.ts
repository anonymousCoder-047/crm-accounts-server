import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/database'
import authRoutes from './routes/authRoutes'
import eventRoutes from './routes/eventRoutes'
import authDetailsRoutes from './routes/authDetailsRoutes'
import userRoutes from './routes/userRoutes'
import settingsRoutes from './routes/settingsRoutes'
import inventoryRoutes from './routes/inventoryRoutes'
import salesInvoiceRoutes from './routes/salesInvoiceRoutes'
import salesInvoiceTemplateRoutes from './routes/salesInvoiceTemplateRoutes'
import purchaseInvoiceRoutes from './routes/purchaseInvoiceRoutes'
import purchaseInvoiceTemplateRoutes from './routes/purchaseInvoiceTemplateRoutes'
import expenseRoutes from './routes/expenseRoutes'
import receivableRoutes from './routes/receivableRoutes'
import payableRoutes from './routes/payableRoutes'
import deliveryOrderRoutes from './routes/deliveryOrderRoutes'
import deliveryOrderTemplateRoutes from './routes/deliveryOrderTemplateRoutes'
import auditTrailRoutes from './routes/auditTrailRoutes'
import supplierRoutes from './routes/supplierRoutes'
import brandRoutes from './routes/brandRoutes'
import customerRoutes from './routes/customerRoutes'
import unitRoutes from './routes/unitRoutes'
import journalEntryRoutes from './routes/journalEntryRoutes'
import ledgerRoutes from './routes/ledgerRoutes'
import financialStatementsRoutes from './routes/financialStatementsRoutes'
import onboardingRoutes from './routes/onboardingRoutes'
import searchRoutes from './routes/searchRoutes'
import currencyRoutes from './routes/currencyRoutes'
import paymentMethodRoutes from './routes/paymentMethodRoutes'
import paymentStatusRoutes from './routes/paymentStatusRoutes'
import accountRoutes from './routes/accountRoutes'
import chatbotRoutes from './routes/chatbotRoutes'
import accountingRoutes from './routes/accountingRoutes'
import newJournalRoutes from './routes/newJournalRoutes'
import newReportRoutes from './routes/newReportRoutes'
import { auditLogger } from './middleware/auditLogger'
import { errorHandler } from './middleware/errorHandler'
import { logInfo } from './utils/logger'

// Load environment variables
const envResult = dotenv.config()
if (envResult.error) {
  console.warn('Warning: .env file not found or could not be loaded:', envResult.error.message)
} else {
  const envCount = Object.keys(envResult.parsed || {}).length
  console.log(`Loaded ${envCount} environment variables from .env`)
}

const app = express()
const PORT = Number(process.env.PORT) || 5000

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins
    callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Audit logging middleware (should be after body parsing but before routes)
app.use(auditLogger)

// Connect to MongoDB
connectDB()

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/auth-details', authDetailsRoutes)
app.use('/api/users', userRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/sales-invoices', salesInvoiceRoutes)
app.use('/api/sales-invoice-templates', salesInvoiceTemplateRoutes)
app.use('/api/purchase-invoices', purchaseInvoiceRoutes)
app.use('/api/purchase-invoice-templates', purchaseInvoiceTemplateRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/receivables', receivableRoutes)
app.use('/api/payables', payableRoutes)
app.use('/api/delivery-orders', deliveryOrderRoutes)
app.use('/api/delivery-order-templates', deliveryOrderTemplateRoutes)
app.use('/api/audit-trails', auditTrailRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/brands', brandRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/units', unitRoutes)
app.use('/api/currencies', currencyRoutes)
app.use('/api/payment-methods', paymentMethodRoutes)
app.use('/api/payment-statuses', paymentStatusRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/ledger', journalEntryRoutes)
app.use('/api/general-ledger', ledgerRoutes)
app.use('/api/statements', financialStatementsRoutes)
app.use('/api/accounting', accountingRoutes)
app.use('/api/journals', newJournalRoutes)
app.use('/api/accounting-reports', newReportRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/chatbot', chatbotRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CRM API is running' })
})

// Error handler middleware (must be last)
app.use(errorHandler)

// On Vercel the app is invoked as a serverless handler - no listener needed
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const message = `Server is running on port ${PORT}`
    console.log(message)
    console.log(`Access from network: http://<your-ip>:${PORT}`)
    // Log asynchronously without blocking
    logInfo(message, { port: PORT, env: process.env.NODE_ENV || 'development' }, false).catch(console.error)
  })
}

export default app