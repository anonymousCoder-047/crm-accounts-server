# Chart of Accounts Migration Guide

## Overview
This migration adds `account_sub_type` field to all existing accounts in the database to support proper accounting structure.

## Migration Script
Run the migration script to add sub-types to all existing accounts:

```bash
# From the backend directory
npx ts-node src/scripts/migrateAccountSubTypes.ts
```

Or if using npm scripts:
```bash
npm run migrate:account-sub-types
```

## What the Migration Does

1. **Finds all accounts** without `account_sub_type` field
2. **Determines sub-type** based on account name and type using intelligent mapping
3. **Updates accounts** with appropriate sub-types
4. **Verifies migration** completion

## Account Sub-Type Mapping Rules

### Assets
- **Current Asset**: Cash, Bank, Accounts Receivable, Inventory, Prepaid expenses
- **Non-Current Asset**: Fixed Assets, Long-term investments
- **Contra Asset**: Accumulated Depreciation, Allowances

### Liabilities
- **Current Liability**: Accounts Payable, Tax Payable, Short-term loans
- **Non-Current Liability**: Long-term loans, Bonds payable

### Equity
- **Owner Capital**: Owner Equity, Share Capital
- **Retained Earnings**: Retained Earnings, Current Year Earnings
- **Reserves**: Any reserve accounts

### Revenue
- **Operating Revenue**: Sales Income, Service Income
- **Non-Operating Revenue**: Interest Income, Other Income, Gains

### Expenses
- **COGS**: Cost of Goods Sold
- **Operating Expense**: Rent, Utilities, Salaries, Supplies, Marketing
- **Non-Operating Expense**: Interest Expense, Bank Charges, Penalties

## After Migration

1. **Verify accounts** have sub-types assigned
2. **Review financial reports** to ensure proper grouping
3. **Update any custom accounts** manually if needed

## Notes

- The migration is **idempotent** - safe to run multiple times
- Accounts with existing sub-types are **not modified**
- The migration uses intelligent name matching to determine sub-types
- Manual review recommended for accounts with unusual names

