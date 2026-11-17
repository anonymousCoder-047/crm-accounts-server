import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import Auth from '../models/Auth'
import Unit from '../models/Unit'
import PaymentMethod from '../models/PaymentMethod'
import PaymentStatus from '../models/PaymentStatus'
import Account, { type AccountType, type AccountSubType } from '../models/Account'
import { getAccountSubType } from '../services/accountSubTypeMapper'
import { createAccount } from '../services/accountService'
import connectDB from '../config/database'

// Load environment variables
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
      console.log(`✅ Seeded unit: ${u.name}`)
    }
  }
}

async function seedPaymentMethods() {
  const defaults = [
    { name: 'Cash', description: 'Cash payment method' },
    { name: 'Bank Transfer', description: 'Bank transfer payment method' },
    { name: 'Credit Card', description: 'Credit card payment method' },
  ]

  for (const pm of defaults) {
    const existing = await PaymentMethod.findOne({ name: pm.name })
    if (!existing) {
      await PaymentMethod.create({ ...pm, isActive: true })
      console.log(`✅ Seeded payment method: ${pm.name}`)
    }
  }
}

async function seedPaymentStatuses() {
  const defaults = ['unpaid', 'partial', 'paid', 'overdue']

  for (const name of defaults) {
    const existing = await PaymentStatus.findOne({ name })
    if (!existing) {
      await PaymentStatus.create({ name, description: name, isActive: true })
      console.log(`✅ Seeded payment status: ${name}`)
    }
  }
}

async function seedChartOfAccountsAndOpeningBalances() {
  const anyAccount = await Account.findOne({})
  if (anyAccount) {
    console.log('ℹ️  Chart of accounts already initialized, skipping default seeding.')
    return
  }

  const accounts: Array<{ name: string; type: AccountType; subType?: AccountSubType; opening?: number }> = [
    // Assets - Current Assets
    { name: 'Cash', type: 'Asset', subType: 'Current Asset', opening: 0 },
    { name: 'Bank', type: 'Asset', subType: 'Current Asset', opening: 0 },
    { name: 'Accounts Receivable', type: 'Asset', subType: 'Current Asset', opening: 0 },
    { name: 'Inventory', type: 'Asset', subType: 'Current Asset', opening: 0 },
    // Liabilities - Current Liabilities
    { name: 'Accounts Payable', type: 'Liability', subType: 'Current Liability', opening: 0 },
    { name: 'Customer Advance Payment', type: 'Liability', subType: 'Current Liability', opening: 0 },
    { name: 'VAT Payable', type: 'Liability', subType: 'Current Liability', opening: 0 },
    // Equity - Owner Capital
    { name: 'Share Capital', type: 'Equity', subType: 'Owner Capital', opening: 0 },
    // Equity - Retained Earnings
    { name: 'Retained Earnings', type: 'Equity', subType: 'Retained Earnings', opening: 0 },
    // Revenue - Operating Revenue
    { name: 'Sales Revenue', type: 'Revenue', subType: 'Operating Revenue', opening: 0 },
    // Expenses - COGS
    { name: 'Cost of Goods Sold', type: 'Expense', subType: 'COGS', opening: 0 },
    // Expenses - Operating Expenses
    { name: 'Rent Expense', type: 'Expense', subType: 'Operating Expense', opening: 0 },
    { name: 'Salaries Expense', type: 'Expense', subType: 'Operating Expense', opening: 0 },
  ]

  for (const acc of accounts) {
    const existing = await Account.findOne({ account_name: acc.name, account_type: acc.type })
    if (!existing) {
      // Auto-assign sub-type if not explicitly provided
      const accountSubType = acc.subType || getAccountSubType(acc.name, acc.type)
      
      // Use createAccount service which handles account_id generation
      const created = await createAccount({
        account_name: acc.name,
        account_type: acc.type,
        account_sub_type: accountSubType,
        is_system_account: true,
        is_active: true,
        opening_balance: acc.opening ?? 0,
        currency: 'AED',
      })
      console.log(`✅ Seeded account: ${created.account_name} (${created.account_type} - ${created.account_sub_type})`)
    }
  }
}

/**
 * Default Super Admin + master data seeder
 * Creates a super admin user profile, auth credentials,
 * and default master data (units, payment methods/statuses, chart of accounts).
 */
const seedSuperAdmin = async () => {
  try {
    // Connect to database
    await connectDB()
    console.log('Seeding using URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-accounts')
    console.log('Active DB:', mongoose.connection.name, 'Host:', mongoose.connection.host)

    // Super admin credentials from environment or defaults
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@crm.com'
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123'
    const superAdminName = process.env.SUPER_ADMIN_NAME || 'Super Admin'
    const superAdminUsername =
      process.env.SUPER_ADMIN_USERNAME || superAdminEmail.split('@')[0]

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

    // Seed master data
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📦 Seeding master data (units, payment methods, statuses, chart of accounts)...')
    await seedUnits()
    await seedPaymentMethods()
    await seedPaymentStatuses()
    await seedChartOfAccountsAndOpeningBalances()

    // Verify counts
    const userCount = await User.countDocuments({})
    const authCount = await Auth.countDocuments({})
    console.log(`Counts → users: ${userCount}, auths: ${authCount}`)

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

    await mongoose.connection.close()
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error seeding super admin:', error.message)
    if (error.code === 11000) {
      console.error('   Duplicate key error - user or auth may already exist')
    }
    await mongoose.connection.close()
    process.exit(1)
  }
}

// Run seeder
seedSuperAdmin()

