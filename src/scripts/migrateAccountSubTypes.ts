/**
 * Migration script to add account_sub_type to existing accounts
 * Run this once to migrate existing accounts
 * 
 * Usage: ts-node backend/src/scripts/migrateAccountSubTypes.ts
 */

import mongoose from 'mongoose'
import Account from '../models/Account'
import { getAccountSubType } from '../services/accountSubTypeMapper'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function migrateAccountSubTypes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-accounts'
    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')

    // Find all accounts without account_sub_type
    const accounts = await Account.find({
      $or: [
        { account_sub_type: { $exists: false } },
        { account_sub_type: null },
        { account_sub_type: '' },
      ],
    })

    console.log(`📊 Found ${accounts.length} accounts to migrate`)

    let migrated = 0
    let skipped = 0

    for (const account of accounts) {
      try {
        // Determine sub-type based on account name and type
        const subType = getAccountSubType(account.account_name, account.account_type)
        
        // Update account
        account.account_sub_type = subType
        await account.save()
        
        migrated++
        console.log(
          `✅ Migrated: ${account.account_name} (${account.account_type}) → ${subType}`
        )
      } catch (error: any) {
        skipped++
        console.error(
          `❌ Failed to migrate ${account.account_name}: ${error.message}`
        )
      }
    }

    console.log(`\n📈 Migration Summary:`)
    console.log(`   ✅ Migrated: ${migrated}`)
    console.log(`   ⏭️  Skipped: ${skipped}`)
    console.log(`   📊 Total: ${accounts.length}`)

    // Verify migration
    const accountsWithoutSubType = await Account.countDocuments({
      $or: [
        { account_sub_type: { $exists: false } },
        { account_sub_type: null },
        { account_sub_type: '' },
      ],
    })

    if (accountsWithoutSubType === 0) {
      console.log('\n✅ All accounts have been migrated successfully!')
    } else {
      console.log(
        `\n⚠️  Warning: ${accountsWithoutSubType} accounts still missing sub-types`
      )
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('✅ Disconnected from MongoDB')
  }
}

// Run migration
if (require.main === module) {
  migrateAccountSubTypes()
    .then(() => {
      console.log('✅ Migration completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration error:', error)
      process.exit(1)
    })
}

export default migrateAccountSubTypes


