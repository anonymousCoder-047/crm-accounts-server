import mongoose from 'mongoose'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import Auth from '../models/Auth'
import Unit from '../models/Unit'
import PaymentMethod from '../models/PaymentMethod'
import PaymentStatus from '../models/PaymentStatus'
import Account, { type AccountSubType } from '../models/Account'
import { createAccount } from '../services/accountService'
import { getAccountSubType } from '../services/accountSubTypeMapper'
import { generateIncomeStatement } from '../services/financialStatementsService'
import connectDB from '../config/database'

dotenv.config()

async function seedUnits() {
  const defaults = [
    { name: 'Piece', symbol: 'pc', description: 'Single item' },
    { name: 'Box', symbol: 'box', description: 'Box of items' },
    { name: 'Kilogram', symbol: 'kg', description: 'Weight in kilograms' },
    { name: 'Liter', symbol: 'L', description: 'Volume in liters' },
  ]

  for (const u of defaults) {
    const existing = await Unit.findOne({ name: u.name })
    if (!existing) {
      await Unit.create(u)
    }
  }
}

async function seedPaymentMethods() {
  const defaults = [
    { name: 'Cash', description: 'Cash payment' },
    { name: 'Bank Transfer', description: 'Bank transfer payment' },
    { name: 'Credit Card', description: 'Card payment' },
  ]

  for (const pm of defaults) {
    const existing = await PaymentMethod.findOne({ name: pm.name })
    if (!existing) {
      await PaymentMethod.create({ ...pm, isActive: true })
    }
  }
}

async function seedPaymentStatuses() {
  const defaults = ['unpaid', 'partial', 'paid', 'overdue']

  for (const name of defaults) {
    const existing = await PaymentStatus.findOne({ name })
    if (!existing) {
      await PaymentStatus.create({ name, description: name, isActive: true })
    }
  }
}

async function seedChartOfAccounts() {
  const existingAny = await Account.findOne({})
  if (existingAny) return

  const defs: Array<{ account_name: string; account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'; account_sub_type?: AccountSubType }> = [
    // Assets - Current Assets
    { account_name: 'Cash', account_type: 'Asset' as const, account_sub_type: 'Current Asset' },
    { account_name: 'Bank', account_type: 'Asset' as const, account_sub_type: 'Current Asset' },
    { account_name: 'Accounts Receivable', account_type: 'Asset' as const, account_sub_type: 'Current Asset' },
    { account_name: 'Inventory', account_type: 'Asset' as const, account_sub_type: 'Current Asset' },
    // Liabilities - Current Liabilities
    { account_name: 'Accounts Payable', account_type: 'Liability' as const, account_sub_type: 'Current Liability' },
    { account_name: 'Customer Advance Payment', account_type: 'Liability' as const, account_sub_type: 'Current Liability' },
    { account_name: 'VAT Payable', account_type: 'Liability' as const, account_sub_type: 'Current Liability' },
    // Equity - Owner Capital
    { account_name: 'Share Capital', account_type: 'Equity' as const, account_sub_type: 'Owner Capital' },
    // Equity - Retained Earnings
    { account_name: 'Retained Earnings', account_type: 'Equity' as const, account_sub_type: 'Retained Earnings' },
    // Revenue - Operating Revenue
    { account_name: 'Sales Revenue', account_type: 'Revenue' as const, account_sub_type: 'Operating Revenue' },
    // Expenses - COGS
    { account_name: 'Cost of Goods Sold', account_type: 'Expense' as const, account_sub_type: 'COGS' },
    // Expenses - Operating Expenses
    { account_name: 'Rent Expense', account_type: 'Expense' as const, account_sub_type: 'Operating Expense' },
    { account_name: 'Salaries Expense', account_type: 'Expense' as const, account_sub_type: 'Operating Expense' },
  ]

  for (const def of defs) {
    // Auto-assign sub-type if not explicitly provided
    const account_sub_type = def.account_sub_type || getAccountSubType(def.account_name, def.account_type)
    
    await createAccount({
      account_name: def.account_name,
      account_type: def.account_type,
      account_sub_type,
      is_system_account: true,
      opening_balance: 0,
    })
  }
}

async function seedOpeningBalances() {
  // Simple example: ensure opening balances align with Income Statement if needed.
  // In most cases, opening balances are set through the onboarding wizard,
  // so this seeder only ensures the Accounts exist; it does not force balances.
  const cash = await Account.findOne({ account_name: 'Cash' })
  if (cash && (cash.opening_balance === undefined || cash.opening_balance === null)) {
    cash.opening_balance = 0
    cash.current_balance = 0
    await cash.save()
  }
}

async function seedSuperAdmin() {
  // Super admin credentials from environment or defaults
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@crm.com'
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123'
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin'
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || superAdminEmail.split('@')[0]

  // Check if user profile already exists
  let userProfile = await User.findOne({ email: superAdminEmail })

  if (userProfile) {
    // Update existing user to superadmin if not already
    if (userProfile.role !== 'superadmin') {
      userProfile.role = 'superadmin'
      userProfile.isActive = true
      await userProfile.save()
      console.log(`✅ Updated existing user to superadmin: ${superAdminEmail}`)
    } else {
      console.log(`ℹ️  Super admin profile already exists: ${superAdminEmail}`)
    }
  } else {
    // Create new super admin user profile
    userProfile = await User.create({
      name: superAdminName,
      email: superAdminEmail,
      role: 'superadmin',
      isActive: true,
    })
    console.log(`✅ Created super admin user profile: ${superAdminEmail}`)
  }

  // Check if auth credentials already exist (by profile or by email)
  let existingAuth = await Auth.findOne({ user_profile: userProfile._id })
  if (!existingAuth) {
    existingAuth = await Auth.findOne({ email: superAdminEmail })
  }

  if (existingAuth) {
    // Ensure linkage to profile and activation
    const needsLink = !existingAuth.user_profile || existingAuth.user_profile.toString() !== userProfile.id
    if (needsLink || !existingAuth.active) {
      existingAuth.user_profile = new mongoose.Types.ObjectId(userProfile.id)
      existingAuth.active = true
      await existingAuth.save()
      console.log(`✅ Updated/linked existing auth credentials for: ${superAdminEmail}`)
    } else {
      console.log(`ℹ️  Auth credentials already exist and linked: ${superAdminEmail}`)
    }
  } else {
    // Create corresponding auth credentials (hash password)
    const salt = await bcrypt.genSalt(12)
    const hashed = await bcrypt.hash(superAdminPassword, salt)
    await Auth.create({
      username: superAdminUsername,
      email: superAdminEmail,
      password: hashed,
      user_profile: new mongoose.Types.ObjectId(userProfile.id),
      ip_address: '127.0.0.1',
      country: process.env.SUPER_ADMIN_COUNTRY || undefined,
      active: true,
      created_by: new mongoose.Types.ObjectId(userProfile.id),
    } as any)
    console.log(`✅ Created auth credentials for: ${superAdminEmail}`)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Super admin setup completed!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📧 Email:', userProfile.email)
  console.log('👤 Name:', userProfile.name)
  console.log('👔 Username:', superAdminUsername)
  console.log('🔑 Role:', userProfile.role)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  Please change the default password after first login!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

export async function runAllSeeds() {
  await connectDB()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📦 Seeding super admin...')
  await seedSuperAdmin()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📦 Seeding master data (units, payment methods, statuses, chart of accounts)...')
  await seedUnits()
  await seedPaymentMethods()
  await seedPaymentStatuses()
  await seedChartOfAccounts()
  await seedOpeningBalances()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Verify counts
  const userCount = await User.countDocuments({})
  const authCount = await Auth.countDocuments({})
  const accountCount = await Account.countDocuments({})
  console.log(`Counts → users: ${userCount}, auths: ${authCount}, accounts: ${accountCount}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

if (require.main === module) {
  runAllSeeds()
    .then(() => {
      console.log('Default seeds completed')
      process.exit(0)
    })
    .catch(err => {
      console.error('Error running seeds', err)
      process.exit(1)
    })
}


