# Sample Data Seeder Documentation

## Overview

This seeder creates realistic sample data for all major sections of the CRM system, making it easy to test and demonstrate the application with real-looking data.

## What Gets Seeded

The seeder creates sample data for the following sections:

### 1. **Users** (4 additional users)
- Admin, Manager, and User roles
- Realistic employee profiles with departments, positions, and contact information

### 2. **Customers** (8 customers)
- Major UAE companies (Al Futtaim, Emirates NBD, Emaar, etc.)
- Complete contact information including TRN numbers
- Realistic addresses in Dubai and Abu Dhabi

### 3. **Suppliers** (6 suppliers)
- Various trading and distribution companies
- Contact information and TRN numbers
- Located in Dubai business districts

### 4. **Enterprises** (3 enterprises)
- Business entities in different industries
- Financial Services, Trading, and Logistics

### 5. **Brands** (8 brands)
- Popular technology brands (Samsung, Apple, HP, Dell, etc.)
- With descriptions

### 6. **Inventory/Products** (10 products)
- Laptops, Printers, Monitors, and Accessories
- Realistic pricing, quantities, and specifications
- Linked to brands
- Includes reorder levels and quantities

### 7. **Events** (15 events)
- Mix of scheduled, completed, and cancelled events
- Linked to customers
- Various event types (assessment, counseling, event, other)
- Dates spread across past and future

### 8. **Inquiries** (5 inquiries)
- Customer inquiries with different statuses
- Realistic messages and contact information

### 9. **Sales Invoices** (20 invoices)
- Linked to customers and products
- Various payment statuses (paid, unpaid, partial, overdue)
- Realistic line items with quantities, prices, discounts, and VAT
- Dates spread over the last 60 days
- Mix of local and export invoices

### 10. **Purchase Invoices** (15 invoices)
- Linked to suppliers and products
- Bulk purchase quantities
- Various payment statuses
- Dates spread over the last 60 days

### 11. **Expenses** (25 expenses)
- Various categories (rent, utilities, travel, supplies, etc.)
- Linked to suppliers and expense accounts
- Different payment statuses
- Dates spread over the last 90 days

### 12. **Delivery Orders** (8 delivery orders)
- Linked to sales invoices and customers
- Line items with delivery status
- Realistic delivery addresses

### 13. **Receivables** (10 receivables)
- Created from unpaid/partial sales invoices
- Payment history for partial payments
- Linked to customers

### 14. **Payables** (8 payables)
- Created from unpaid/partial purchase invoices
- Payment history for partial payments
- Linked to suppliers

### 15. **Journal Entries** (10 manual entries)
- Various accounting adjustments and transactions
- Bank transfers, accruals, depreciation, adjustments
- Automatically creates General Ledger entries
- Types include:
  - Bank transfers
  - Accrued expenses (salaries, interest)
  - Depreciation entries
  - Prepaid expense adjustments
  - Bad debt write-offs
  - Inventory adjustments
  - Interest income
  - Capital contributions
  - Sales returns/allowances

### 16. **General Ledger Entries** (Auto-generated)
- Automatically created when Journal Entries are created
- Also created from Sales Invoices, Purchase Invoices, Expenses, etc.
- Provides complete transaction history for all accounts
- Used for generating:
  - Trial Balance
  - Income Statement
  - Balance Sheet
  - Cash Flow Statement

## Running the Seeder

### Prerequisites

1. Make sure you have run the default seeder first to create:
   - Super admin user
   - Chart of Accounts
   - Units, Payment Methods, Payment Statuses

```bash
npm run seed
```

### Run Sample Data Seeder

```bash
npm run seed:sample
```

Or directly:

```bash
ts-node src/seeds/seedSampleData.ts
```

## Data Characteristics

### Realistic Data
- All data uses realistic UAE company names, addresses, and phone numbers
- TRN (Tax Registration Numbers) follow UAE format
- Prices are in AED (UAE Dirhams)
- Dates are spread realistically across time periods
- Relationships between entities are properly maintained

### Data Relationships
- Sales Invoices → Customers + Products
- Purchase Invoices → Suppliers + Products
- Delivery Orders → Sales Invoices + Customers
- Events → Customers
- Receivables → Customers + Sales Invoices
- Payables → Suppliers + Purchase Invoices
- Expenses → Suppliers + Users + Expense Accounts
- Inventory → Brands

### Payment Statuses
- **Paid**: Fully paid invoices with payment methods and reference numbers
- **Unpaid**: New invoices not yet paid
- **Partial**: Partially paid with payment history
- **Overdue**: Past due date and not fully paid

## Seeding Order

The seeder runs in a specific order to maintain referential integrity:

1. Users
2. Customers
3. Suppliers
4. Enterprises
5. Brands
6. Inventory (requires Brands)
7. Events (requires Customers)
8. Inquiries
9. Sales Invoices (requires Customers + Inventory)
10. Purchase Invoices (requires Suppliers + Inventory)
11. Expenses (requires Users + Suppliers + Accounts)
12. Delivery Orders (requires Sales Invoices + Customers)
13. Receivables (requires Customers + Sales Invoices)
14. Payables (requires Suppliers + Purchase Invoices)
15. Journal Entries (requires Users + Accounts)
16. General Ledger (auto-generated from Journal Entries)

## Idempotency

The seeder is designed to be safe to run multiple times:
- Checks for existing records before creating
- Skips creation if data already exists
- Logs what was created vs. what already existed

## Data Summary

After seeding, you'll see a summary showing counts for each section:
- Users
- Customers
- Suppliers
- Enterprises
- Brands
- Inventory Items
- Events
- Inquiries
- Sales Invoices
- Purchase Invoices
- Expenses
- Delivery Orders
- Receivables
- Payables
- Journal Entries
- General Ledger Entries
- Journal Entries
- General Ledger Entries

## Notes

- The seeder creates a realistic business scenario with interconnected data
- All monetary values are in AED
- Dates are randomized within realistic ranges
- Some invoices may be marked as overdue if their due dates are in the past
- Export invoices (20% of sales invoices) have no VAT
- Bulk purchase quantities are higher than sales quantities
- **Journal Entries** automatically create **General Ledger** entries
- **Financial Statements** (Trial Balance, Income Statement, Balance Sheet, Cash Flow) are generated dynamically from General Ledger data - no separate seeding needed
- Journal entries include realistic accounting adjustments like accruals, depreciation, and adjustments

## Troubleshooting

### Error: "No brands found"
- Run the default seeder first: `npm run seed`
- Or manually create brands before running sample data seeder

### Error: "No customers found"
- The seeder will create customers, but if it fails, check MongoDB connection

### Error: "No expense accounts found"
- Make sure the default seeder has run to create Chart of Accounts
- Expense accounts are required for expense seeding

### Duplicate Key Errors
- The seeder checks for existing records, but if you see duplicate key errors, some data may already exist
- You can clear the database and re-run, or the seeder will skip existing records

## Customization

You can modify the seeder file (`backend/src/seeds/seedSampleData.ts`) to:
- Change the number of records created
- Adjust date ranges
- Modify pricing ranges
- Add more categories or types
- Change the distribution of statuses

## Integration with Default Seeder

The sample data seeder is designed to work alongside the default seeder:
- Default seeder: Creates system accounts, admin user, master data
- Sample data seeder: Creates business transaction data

Run both for a complete setup:
```bash
npm run seed          # System setup
npm run seed:sample   # Sample business data
```

