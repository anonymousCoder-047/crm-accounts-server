import { Request, Response } from 'express'
import {
  createInventory,
  deleteInventory,
  getInventoryById,
  listInventory,
  updateInventory,
  recordStockMovement,
  getInventoryTransactions,
  getLowStockProducts,
  calculateAveragePurchasePrice,
} from '../services/inventoryService'
import { generateInventoryJournalEntry } from '../services/inventoryJournalService'
import { getJournalEntriesByReference, deleteJournalEntry, createJournalEntry } from '../services/journalEntryService'
import Account from '../models/Account'

export const createItem = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const item = await createInventory(req.body, userId)
    res.status(201).json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getItems = async (req: Request, res: Response) => {
  try {
    const items = await listInventory({
      q: req.query.q as string,
      category: req.query.category as string,
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
      low_stock: req.query.low_stock === 'true',
      brand: req.query.brand as string,
      supplier: req.query.supplier as string,
    })
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getItem = async (req: Request, res: Response) => {
  try {
    const item = await getInventoryById(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' })
    }
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateItem = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    
    // Get existing inventory before update to find journal entries
    const existingInventory = await getInventoryById(req.params.id)
    if (!existingInventory) {
      return res.status(404).json({ success: false, message: 'Item not found' })
    }

    // Get inventory ID as string
    const inventoryId = typeof existingInventory._id === 'string' 
      ? existingInventory._id 
      : (existingInventory._id as any)?.toString()

    // Check if opening stock or unit cost is being updated (these affect initial inventory journal entry)
    const updatesOpeningStock = req.body.quantity_on_hand !== undefined || req.body.opening_stock !== undefined || req.body.qty !== undefined
    const updatesUnitCost = req.body.unit_cost !== undefined || req.body.costPrice !== undefined

    // Find and delete initial inventory journal entry if opening stock or unit cost is being updated
    if (inventoryId && userId && (updatesOpeningStock || updatesUnitCost)) {
      try {
        // Find journal entries by referenceType and referenceId (for initial inventory entry)
        const journalEntriesByRef = await getJournalEntriesByReference('Inventory', inventoryId)
        
        // Also find by source_module and reference (using SKU/serialNumber)
        const JournalEntry = (await import('../models/JournalEntry')).default
        const referenceValue = existingInventory.sku || existingInventory.serialNumber || String(existingInventory._id)
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'inventory',
          reference: referenceValue,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          // Only delete initial inventory entries (not transaction entries)
          if (entry.description?.includes('Initial inventory')) {
            allJournalEntries.set(String(entry._id), entry)
          }
        })
        journalEntriesBySource.forEach(entry => {
          // Only delete initial inventory entries (not transaction entries)
          if (entry.description?.includes('Initial inventory')) {
            allJournalEntries.set(String(entry._id), entry)
          }
        })

        // Delete initial inventory journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for inventory update:', journalError)
        // Continue with inventory update even if journal entry deletion fails
      }
    }

    // Update the inventory
    const item = await updateInventory(req.params.id, req.body)
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' })
    }

    // Recreate initial inventory journal entry if opening stock or unit cost was updated
    if (userId && (updatesOpeningStock || updatesUnitCost)) {
      try {
        const quantityOnHand = item.quantity_on_hand || item.qty || 0
        const unitCost = item.unit_cost || item.costPrice || 0

        if (quantityOnHand > 0 && unitCost > 0) {
          const totalCost = quantityOnHand * unitCost
          
          // Find Inventory account
          const inventoryAccount = await Account.findOne({ 
            $or: [
              { account_name: 'Inventory' },
              { account_id: 'INVENTORY' }
            ],
            account_type: 'Asset'
          })
          
          // Find Owner Equity account (or Retained Earnings as fallback)
          const equityAccount = await Account.findOne({
            $or: [
              { account_name: 'Owner Equity' },
              { account_name: 'Retained Earnings' },
              { account_name: 'Capital' }
            ],
            account_type: 'Equity'
          })

          if (inventoryAccount && equityAccount) {
            const inventoryAccountId = inventoryAccount.account_id || String(inventoryAccount._id)
            const equityAccountId = equityAccount.account_id || String(equityAccount._id)

            await createJournalEntry({
              date: new Date(),
              reference: item.sku || item.serialNumber || String(item._id),
              description: `Initial inventory: ${item.product_name || item.name || item.sku} (Qty: ${quantityOnHand} @ ${unitCost})`,
              entries: [
                {
                  account_id: inventoryAccountId,
                  account_name: inventoryAccount.account_name,
                  debit: totalCost,
                  credit: 0,
                },
                {
                  account_id: equityAccountId,
                  account_name: equityAccount.account_name,
                  debit: 0,
                  credit: totalCost,
                },
              ],
              createdBy: userId,
              source_module: 'inventory',
              referenceType: 'Inventory',
              referenceId: String(item._id),
            })
          }
        }
      } catch (journalError: any) {
        console.error('Error recreating journal entries for inventory update:', journalError)
        // Continue even if journal entry recreation fails
      }
    }

    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteItem = async (req: Request, res: Response) => {
  try {
    // Get inventory before deletion to find journal entries
    const inventory = await getInventoryById(req.params.id)
    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Item not found' })
    }

    // Get inventory ID as string
    const inventoryId = typeof inventory._id === 'string' 
      ? inventory._id 
      : (inventory._id as any)?.toString()

    // Find and delete all related journal entries
    if (inventoryId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Inventory', inventoryId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const referenceValue = inventory.sku || inventory.serialNumber || String(inventory._id)
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'inventory',
          reference: referenceValue,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for inventory:', journalError)
        // Continue with inventory deletion even if journal entry deletion fails
      }
    }

    const item = await deleteInventory(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' })
    }
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Stock adjustment endpoints
export const adjustStock = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const { product_id, type, quantity, unit_cost, notes, reference } = req.body

    if (!product_id || !type || !quantity || unit_cost === undefined) {
      return res.status(400).json({
        success: false,
        message: 'product_id, type, quantity, and unit_cost are required',
      })
    }

    if (!['adjustment_in', 'adjustment_out'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be adjustment_in or adjustment_out',
      })
    }

    const result = await recordStockMovement({
      product_id,
      type,
      reference: reference || `ADJ-${Date.now()}`,
      quantity,
      unit_cost,
      notes,
      createdBy: userId,
      createJournalEntry: true,
    })

    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Get inventory transactions
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { product_id, type, startDate, endDate } = req.query

    const transactions = await getInventoryTransactions(
      product_id as string,
      {
        type: type as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      }
    )

    res.json({ success: true, data: transactions })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Get low stock products
export const getLowStock = async (req: Request, res: Response) => {
  try {
    const products = await getLowStockProducts()
    res.json({ success: true, data: products })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Generate journal entry for inventory transaction
export const generateJournalEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const {
      product_id,
      transaction_type,
      quantity,
      unit_cost,
      total_cost,
      reference_id,
      reference,
      date,
      notes,
      // Optional account overrides
      inventory_account_id,
      inventory_account_name,
      cogs_account_id,
      cogs_account_name,
      adjustment_account_id,
      adjustment_account_name,
      accounts_payable_account_id,
      accounts_payable_account_name,
      accounts_receivable_account_id,
      accounts_receivable_account_name,
      cash_account_id,
      cash_account_name,
      sales_revenue_account_id,
      sales_revenue_account_name,
    } = req.body

    if (!product_id || !transaction_type || !quantity || !unit_cost) {
      return res.status(400).json({
        success: false,
        message: 'product_id, transaction_type, quantity, and unit_cost are required',
      })
    }

    const calculatedTotalCost = total_cost || quantity * unit_cost

    const result = await generateInventoryJournalEntry({
      product_id,
      transaction_type,
      quantity,
      unit_cost,
      total_cost: calculatedTotalCost,
      reference_id,
      reference,
      date: date ? new Date(date) : new Date(),
      createdBy: userId,
      notes,
      inventory_account_id,
      inventory_account_name,
      cogs_account_id,
      cogs_account_name,
      adjustment_account_id,
      adjustment_account_name,
      accounts_payable_account_id,
      accounts_payable_account_name,
      accounts_receivable_account_id,
      accounts_receivable_account_name,
      cash_account_id,
      cash_account_name,
      sales_revenue_account_id,
      sales_revenue_account_name,
    })

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          journalEntry: result.journalEntry,
          entries: result.entries,
        },
      })
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Get price history for an inventory item
export const getPriceHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const priceData = await calculateAveragePurchasePrice(id)
    res.json({ success: true, data: priceData })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


