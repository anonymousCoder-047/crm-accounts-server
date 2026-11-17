import Inventory, { IInventory } from '../models/Inventory'
import InventoryTransaction, { IInventoryTransaction } from '../models/InventoryTransaction'
import { FilterQuery } from 'mongoose'
import { createJournalEntry } from './journalEntryService'
import { IJournalEntryLine } from '../models/JournalEntry'
import { generateInventoryJournalEntry, InventoryJournalEntryInput } from './inventoryJournalService'
import { createExpense, ExpenseInput } from './expenseService'
import Account, { IAccount } from '../models/Account'

export interface InventoryInput {
  sku: string
  product_name: string
  category?: string
  description?: string
  unit_cost: number
  selling_price: number
  quantity_on_hand?: number
  reorder_level?: number
  reorder_quantity?: number
  opening_stock?: number
  inventory_valuation_method?: 'FIFO' | 'Weighted Average'
  tax_percent?: number
  is_active?: boolean
  
  // Legacy fields for backward compatibility
  serialNumber?: string
  name?: string
  supplier?: string
  qty?: number
  productionDate?: Date
  expiryDate?: Date
  unit?: string
  brand?: string
  costPrice?: number
  vat?: number
  status?: 'normal' | 'pending_purchase' | 'pending_delivery'
  priceInclusiveMaterialCost?: boolean
  materialCostComponents?: Array<{
    account_id: string
    account_name: string
    amount: number
    description?: string
  }>
}

export interface StockMovementInput {
  product_id: string
  type: 'purchase' | 'sale' | 'adjustment_in' | 'adjustment_out' | 'return_in' | 'return_out'
  reference: string
  reference_id?: string
  quantity: number
  unit_cost: number
  date?: Date
  notes?: string
  createdBy?: string
  createJournalEntry?: boolean // Whether to create accounting entries
}

export interface COGSCalculation {
  quantity: number
  unit_cost: number
  total_cost: number
}

/**
 * Calculate COGS using Weighted Average method
 */
export async function calculateWeightedAverageCOGS(
  productId: string,
  quantity: number
): Promise<COGSCalculation> {
  const product = await Inventory.findById(productId)
  if (!product) {
    throw new Error('Product not found')
  }

  // Get all purchase transactions for this product
  const purchaseTransactions = await InventoryTransaction.find({
    product_id: productId,
    type: { $in: ['purchase', 'adjustment_in', 'return_in'] },
  }).sort({ date: 1 })

  if (purchaseTransactions.length === 0) {
    // No purchase history, use current unit_cost
    return {
      quantity,
      unit_cost: product.unit_cost,
      total_cost: quantity * product.unit_cost,
    }
  }

  // Calculate weighted average
  let totalQuantity = 0
  let totalCost = 0

  for (const transaction of purchaseTransactions) {
    totalQuantity += transaction.quantity
    totalCost += transaction.total_cost
  }

  const weightedAverageCost = totalQuantity > 0 ? totalCost / totalQuantity : product.unit_cost

  return {
    quantity,
    unit_cost: weightedAverageCost,
    total_cost: quantity * weightedAverageCost,
  }
}

/**
 * Calculate COGS using FIFO method
 */
export async function calculateFIFOCOGS(
  productId: string,
  quantity: number
): Promise<COGSCalculation> {
  const product = await Inventory.findById(productId)
  if (!product) {
    throw new Error('Product not found')
  }

  // Get all purchase transactions sorted by date (oldest first)
  const purchaseTransactions = await InventoryTransaction.find({
    product_id: productId,
    type: { $in: ['purchase', 'adjustment_in', 'return_in'] },
  }).sort({ date: 1 })

  if (purchaseTransactions.length === 0) {
    // No purchase history, use current unit_cost
    return {
      quantity,
      unit_cost: product.unit_cost,
      total_cost: quantity * product.unit_cost,
    }
  }

  // FIFO: Use oldest inventory first
  let remainingQuantity = quantity
  let totalCost = 0
  let weightedCost = 0

  for (const transaction of purchaseTransactions) {
    if (remainingQuantity <= 0) break

    const quantityToUse = Math.min(remainingQuantity, transaction.quantity)
    totalCost += quantityToUse * transaction.unit_cost
    remainingQuantity -= quantityToUse
  }

  // If we still need more quantity, use current unit_cost for remaining
  if (remainingQuantity > 0) {
    totalCost += remainingQuantity * product.unit_cost
  }

  const averageUnitCost = quantity > 0 ? totalCost / quantity : product.unit_cost

  return {
    quantity,
    unit_cost: averageUnitCost,
    total_cost: totalCost,
  }
}

/**
 * Record stock movement and update inventory
 */
export async function recordStockMovement(
  input: StockMovementInput
): Promise<{ transaction: IInventoryTransaction; inventory: IInventory }> {
  const product = await Inventory.findById(input.product_id)
  if (!product) {
    throw new Error('Product not found')
  }

  // Calculate quantity change based on transaction type
  let quantityChange = 0
  if (['purchase', 'adjustment_in', 'return_in'].includes(input.type)) {
    quantityChange = input.quantity
  } else if (['sale', 'adjustment_out', 'return_out'].includes(input.type)) {
    quantityChange = -input.quantity
  }

  // Calculate total cost
  const totalCost = input.quantity * input.unit_cost

  // Create transaction record
  const transaction = await InventoryTransaction.create({
    product_id: input.product_id,
    type: input.type,
    reference: input.reference,
    reference_id: input.reference_id,
    quantity: input.quantity,
    unit_cost: input.unit_cost,
    total_cost: totalCost,
    date: input.date || new Date(),
    notes: input.notes,
    createdBy: input.createdBy,
  })

  // Update inventory quantity
  const newQuantity = (product.quantity_on_hand || product.qty || 0) + quantityChange
  
  // Update unit_cost if this is a purchase (for weighted average)
  let updatedUnitCost = product.unit_cost
  if (input.type === 'purchase' && product.inventory_valuation_method === 'Weighted Average') {
    // Calculate new weighted average
    const currentTotalCost = product.quantity_on_hand * product.unit_cost
    const newTotalCost = currentTotalCost + totalCost
    const newTotalQuantity = product.quantity_on_hand + input.quantity
    updatedUnitCost = newTotalQuantity > 0 ? newTotalCost / newTotalQuantity : product.unit_cost
  }

  const inventory = await Inventory.findByIdAndUpdate(
    input.product_id,
    {
      quantity_on_hand: newQuantity,
      unit_cost: updatedUnitCost,
      // Sync legacy fields
      qty: newQuantity,
      costPrice: updatedUnitCost,
    },
    { new: true }
  )

  if (!inventory) {
    throw new Error('Failed to update inventory')
  }

  // Create journal entry if requested
  if (input.createJournalEntry && input.createdBy) {
    const journalEntryInput: InventoryJournalEntryInput = {
      product_id: input.product_id,
      transaction_type: input.type,
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      total_cost: totalCost,
      reference_id: input.reference_id,
      reference: input.reference,
      date: input.date || new Date(),
      createdBy: input.createdBy,
      notes: input.notes,
    }

    const journalResult = await generateInventoryJournalEntry(journalEntryInput)
    if (!journalResult.success) {
      console.error('Failed to create journal entry:', journalResult.message)
      // Don't throw error - inventory transaction is still valid even if journal entry fails
    }
  }

  return { transaction, inventory }
}

/**
 * Reverse inventory transactions (delete them and restore quantities)
 * Used when sales/purchase invoices are deleted or updated
 */
export async function reverseInventoryTransactions(
  reference: string,
  referenceId?: string
): Promise<void> {
  const InventoryTransaction = (await import('../models/InventoryTransaction')).default
  const mongoose = await import('mongoose')
  
  // Find all transactions for this reference
  const query: any = { reference }
  if (referenceId) {
    // Handle both string and ObjectId
    try {
      query.reference_id = mongoose.Types.ObjectId.isValid(referenceId) 
        ? new mongoose.Types.ObjectId(referenceId)
        : referenceId
    } catch {
      query.reference_id = referenceId
    }
  }
  
  const transactions = await InventoryTransaction.find(query).lean()
  
  // Reverse each transaction
  for (const tx of transactions) {
    const product = await Inventory.findById(tx.product_id)
    if (!product) continue
    
    // Calculate reverse quantity change
    let quantityChange = 0
    if (['purchase', 'adjustment_in', 'return_in'].includes(tx.type)) {
      // Reverse purchase: subtract quantity
      quantityChange = -tx.quantity
    } else if (['sale', 'adjustment_out', 'return_out'].includes(tx.type)) {
      // Reverse sale: add quantity back
      quantityChange = tx.quantity
    }
    
    // Update inventory quantity
    const newQuantity = (product.quantity_on_hand || product.qty || 0) + quantityChange
    
    await Inventory.findByIdAndUpdate(
      tx.product_id,
      {
        quantity_on_hand: newQuantity,
        qty: newQuantity,
      },
      { new: true }
    )
    
    // Delete the transaction
    await InventoryTransaction.findByIdAndDelete(tx._id)
  }
}

/**
 * Legacy function - now uses the new inventory journal service
 * Kept for backward compatibility
 */
async function createInventoryJournalEntry(
  input: StockMovementInput,
  totalCost: number,
  inventory: IInventory
): Promise<void> {
  // Use the new comprehensive journal entry generator
  const journalEntryInput: InventoryJournalEntryInput = {
    product_id: input.product_id,
    transaction_type: input.type,
    quantity: input.quantity,
    unit_cost: input.unit_cost,
    total_cost: totalCost,
    reference_id: input.reference_id,
    reference: input.reference,
    date: input.date || new Date(),
    createdBy: input.createdBy || '',
    notes: input.notes,
  }

  const result = await generateInventoryJournalEntry(journalEntryInput)
  if (!result.success) {
    throw new Error(result.message)
  }
}

/**
 * Get COGS for a sale transaction
 */
export async function getCOGSForSale(
  productId: string,
  quantity: number
): Promise<COGSCalculation> {
  const product = await Inventory.findById(productId)
  if (!product) {
    throw new Error('Product not found')
  }

  if (product.inventory_valuation_method === 'FIFO') {
    return calculateFIFOCOGS(productId, quantity)
  } else {
    return calculateWeightedAverageCOGS(productId, quantity)
  }
}

/**
 * Create inventory product
 */
export async function createInventory(input: InventoryInput, userId?: string): Promise<IInventory> {
  // Clean up ObjectId fields - convert empty strings to undefined
  const cleanInput: any = { ...input }
  
  // Convert empty strings to undefined for ObjectId fields
  if (cleanInput.supplier === '' || cleanInput.supplier === null) {
    cleanInput.supplier = undefined
  }
  if (cleanInput.brand === '' || cleanInput.brand === null) {
    cleanInput.brand = undefined
  }
  // Note: unit is a string field, not ObjectId, so we can leave it as is
  
  // Set default values for optional fields
  const inventoryData: any = {
    ...cleanInput,
    sku: cleanInput.sku || cleanInput.serialNumber || `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    product_name: cleanInput.product_name || cleanInput.name || '',
    unit_cost: cleanInput.unit_cost !== undefined ? cleanInput.unit_cost : (cleanInput.costPrice !== undefined ? cleanInput.costPrice : 0),
    selling_price: cleanInput.selling_price !== undefined ? cleanInput.selling_price : 0,
    quantity_on_hand: cleanInput.quantity_on_hand !== undefined ? cleanInput.quantity_on_hand : (cleanInput.qty !== undefined ? cleanInput.qty : (cleanInput.opening_stock || 0)),
    opening_stock: cleanInput.opening_stock !== undefined ? cleanInput.opening_stock : (cleanInput.quantity_on_hand !== undefined ? cleanInput.quantity_on_hand : (cleanInput.qty || 0)),
    inventory_valuation_method: cleanInput.inventory_valuation_method || 'Weighted Average',
    is_active: cleanInput.is_active !== undefined ? cleanInput.is_active : true,
  }

  // Sync legacy fields
  if (!inventoryData.serialNumber && inventoryData.sku) {
    inventoryData.serialNumber = inventoryData.sku
  }
  if (!inventoryData.name && inventoryData.product_name) {
    inventoryData.name = inventoryData.product_name
  }
  if (!inventoryData.costPrice && inventoryData.unit_cost !== undefined) {
    inventoryData.costPrice = inventoryData.unit_cost
  }
  if (!inventoryData.qty && inventoryData.quantity_on_hand !== undefined) {
    inventoryData.qty = inventoryData.quantity_on_hand
  }
  if (!inventoryData.vat && cleanInput.tax_percent !== undefined) {
    inventoryData.vat = cleanInput.tax_percent
  }
  if (!inventoryData.tax_percent && cleanInput.vat !== undefined) {
    inventoryData.tax_percent = cleanInput.vat
  }

  // Remove undefined ObjectId fields to prevent Mongoose casting errors
  if (inventoryData.supplier === undefined || inventoryData.supplier === null || inventoryData.supplier === '') {
    delete inventoryData.supplier
  }
  if (inventoryData.brand === undefined || inventoryData.brand === null || inventoryData.brand === '') {
    delete inventoryData.brand
  }

  // Set default for priceInclusiveMaterialCost if not provided
  if (inventoryData.priceInclusiveMaterialCost === undefined) {
    inventoryData.priceInclusiveMaterialCost = true
  }

  // Create the inventory item
  const inventory = await Inventory.create(inventoryData)

  // Create journal entry for initial inventory quantity (opening stock)
  if (userId && inventory.quantity_on_hand > 0 && inventory.unit_cost > 0) {
    try {
      const totalCost = inventory.quantity_on_hand * inventory.unit_cost
      
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
          reference: inventory.sku || inventory.serialNumber || String(inventory._id),
          description: `Initial inventory: ${inventory.product_name || inventory.name || inventory.sku} (Qty: ${inventory.quantity_on_hand} @ ${inventory.unit_cost})`,
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
          referenceId: String(inventory._id),
        })
        console.log(`Journal entry created for initial inventory: ${inventory.product_name || inventory.name || inventory.sku}`)
      } else {
        console.warn('Inventory or Owner Equity account not found. Skipping journal entry creation for initial inventory.')
      }
    } catch (journalError: any) {
      console.error('Error creating journal entry for initial inventory:', journalError)
      // Don't fail inventory creation if journal entry fails
    }
  }

  // If material cost components are provided and price is not inclusive, create journal entry for material cost allocation
  // Note: We do NOT create expense entries here - material costs are allocated directly to inventory
  if (
    !inventoryData.priceInclusiveMaterialCost &&
    inventoryData.materialCostComponents &&
    Array.isArray(inventoryData.materialCostComponents) &&
    inventoryData.materialCostComponents.length > 0 &&
    userId
  ) {
    try {
      const totalMaterialCost = inventoryData.materialCostComponents.reduce(
        (sum: number, component: { account_id: string; account_name: string; amount: number; description?: string }) => sum + (component.amount || 0),
        0
      )

      if (totalMaterialCost > 0) {
        // Create a single journal entry allocating material costs to inventory
        // This allocates the material costs directly to inventory without creating expense entries
        const journalEntries: IJournalEntryLine[] = []

        // Debit: Inventory account (sum of all material costs)
        journalEntries.push({
          account_id: 'INVENTORY',
          account_name: 'Inventory',
          debit: totalMaterialCost,
          credit: 0,
        })

        // Credit: Each expense/material cost account (individual material costs)
        for (const component of inventoryData.materialCostComponents) {
          if (component.amount > 0 && component.account_id && component.account_name) {
            journalEntries.push({
              account_id: component.account_id,
              account_name: component.account_name,
              debit: 0,
              credit: component.amount,
            })
          }
        }

        // Create single journal entry for material cost allocation
        await createJournalEntry({
          date: new Date(),
          reference: inventory.sku || inventory.serialNumber || String(inventory._id),
          description: `Material cost allocation for inventory item: ${inventoryData.product_name || inventoryData.name || inventoryData.sku}`,
          entries: journalEntries,
          createdBy: userId,
          source_module: 'inventory',
          referenceType: 'Inventory',
          referenceId: String(inventory._id),
        })
      }
    } catch (journalError: any) {
      console.error('Error creating journal entry for material costs:', journalError)
      // Don't fail inventory creation if journal entry fails
    }
  }

  return inventory
}

/**
 * Calculate average purchase price for an inventory item based on purchase transactions
 */
export async function calculateAveragePurchasePrice(productId: string): Promise<{
  averagePrice: number
  purchaseCount: number
  totalQuantity: number
  priceHistory: Array<{ date: Date; unit_cost: number; quantity: number; reference: string }>
}> {
  // Get all purchase transactions for this product
  const purchaseTransactions = await InventoryTransaction.find({
    product_id: productId,
    type: { $in: ['purchase', 'adjustment_in', 'return_in'] },
  })
    .sort({ date: 1 })
    .exec()

  if (purchaseTransactions.length === 0) {
    return {
      averagePrice: 0,
      purchaseCount: 0,
      totalQuantity: 0,
      priceHistory: [],
    }
  }

  // Calculate weighted average
  let totalCost = 0
  let totalQuantity = 0
  const priceHistory = purchaseTransactions.map((tx) => ({
    date: tx.date,
    unit_cost: tx.unit_cost,
    quantity: tx.quantity,
    reference: tx.reference,
  }))

  for (const tx of purchaseTransactions) {
    totalCost += tx.total_cost
    totalQuantity += tx.quantity
  }

  const averagePrice = totalQuantity > 0 ? totalCost / totalQuantity : 0

  return {
    averagePrice,
    purchaseCount: purchaseTransactions.length,
    totalQuantity,
    priceHistory,
  }
}

/**
 * List inventory with filters
 * Includes calculated qty_sold and total_qty from transactions
 */
export async function listInventory(query?: {
  q?: string
  category?: string
  is_active?: boolean
  low_stock?: boolean
  brand?: string
  supplier?: string
}): Promise<Array<IInventory & { qty_sold?: number; total_qty?: number }>> {
  const filter: FilterQuery<IInventory> = {}
  
  if (query?.q) {
    filter.$or = [
      { sku: new RegExp(query.q, 'i') },
      { product_name: new RegExp(query.q, 'i') },
      { description: new RegExp(query.q, 'i') },
      // Legacy fields
      { serialNumber: new RegExp(query.q, 'i') },
      { name: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.category) {
    filter.category = query.category
  }
  
  if (query?.is_active !== undefined) {
    filter.is_active = query.is_active
  }
  
  if (query?.low_stock) {
    filter.$expr = {
      $lte: ['$quantity_on_hand', '$reorder_level'],
    }
  }
  
  if (query?.brand) filter.brand = query.brand as any
  if (query?.supplier) filter.supplier = query.supplier as any

  const inventoryItems = await Inventory.find(filter)
    .populate('supplier')
    .populate('brand')
    .sort({ createdAt: -1 })
    .exec()

  // Calculate average purchase price, qty_sold, and total_qty for each item
  const inventoryWithCalculatedFields = await Promise.all(
    inventoryItems.map(async (item) => {
      const productId = String(item._id)
      const priceData = await calculateAveragePurchasePrice(productId)
      
      // Calculate total_qty: sum of all purchase transactions
      const purchaseTransactions = await InventoryTransaction.find({
        product_id: productId,
        type: { $in: ['purchase', 'adjustment_in', 'return_in'] },
      }).select('quantity').lean()
      const total_qty = purchaseTransactions.reduce((sum, tx) => sum + (tx.quantity || 0), 0)
      
      // Calculate qty_sold: sum of all sale transactions
      const saleTransactions = await InventoryTransaction.find({
        product_id: productId,
        type: { $in: ['sale', 'adjustment_out', 'return_out'] },
      }).select('quantity').lean()
      const qty_sold = saleTransactions.reduce((sum, tx) => sum + (tx.quantity || 0), 0)
      
      // Add calculated fields
      const itemObj = item.toObject() as any
      return {
        ...itemObj,
        average_purchase_price: priceData.averagePrice > 0 ? priceData.averagePrice : (item.unit_cost || item.costPrice || 0),
        purchase_count: priceData.purchaseCount,
        price_history_count: priceData.priceHistory.length,
        qty_sold,
        total_qty,
      }
    })
  )

  return inventoryWithCalculatedFields as Array<IInventory & { qty_sold?: number; total_qty?: number }>
}

/**
 * Get inventory by ID
 */
export async function getInventoryById(id: string): Promise<IInventory | null> {
  return Inventory.findById(id).populate('supplier').populate('brand')
}

/**
 * Update inventory
 */
export async function updateInventory(
  id: string,
  updates: Partial<InventoryInput>
): Promise<IInventory | null> {
  const updateData: any = { ...updates }
  
  // Clean up ObjectId fields - convert empty strings to undefined
  if (updateData.supplier === '' || updateData.supplier === null) {
    updateData.supplier = undefined
  }
  if (updateData.brand === '' || updateData.brand === null) {
    updateData.brand = undefined
  }
  
  // Sync legacy fields
  if (updateData.sku && !updateData.serialNumber) {
    updateData.serialNumber = updateData.sku
  }
  if (updateData.serialNumber && !updateData.sku) {
    updateData.sku = updateData.serialNumber
  }
  if (updateData.product_name && !updateData.name) {
    updateData.name = updateData.product_name
  }
  if (updateData.name && !updateData.product_name) {
    updateData.product_name = updateData.name
  }
  if (updateData.unit_cost !== undefined && updateData.costPrice === undefined) {
    updateData.costPrice = updateData.unit_cost
  }
  if (updateData.costPrice !== undefined && updateData.unit_cost === undefined) {
    updateData.unit_cost = updateData.costPrice
  }
  if (updateData.quantity_on_hand !== undefined && updateData.qty === undefined) {
    updateData.qty = updateData.quantity_on_hand
  }
  if (updateData.qty !== undefined && updateData.quantity_on_hand === undefined) {
    updateData.quantity_on_hand = updateData.qty
  }
  if (updateData.tax_percent !== undefined && updateData.vat === undefined) {
    updateData.vat = updateData.tax_percent
  }
  if (updateData.vat !== undefined && updateData.tax_percent === undefined) {
    updateData.tax_percent = updateData.vat
  }
  
  // Remove undefined/null/empty ObjectId fields to prevent Mongoose casting errors
  if (updateData.supplier === undefined || updateData.supplier === null || updateData.supplier === '') {
    delete updateData.supplier
  }
  if (updateData.brand === undefined || updateData.brand === null || updateData.brand === '') {
    delete updateData.brand
  }
  
  return Inventory.findByIdAndUpdate(id, updateData, { new: true })
}

/**
 * Delete inventory
 */
export async function deleteInventory(id: string): Promise<IInventory | null> {
  return Inventory.findByIdAndDelete(id)
}

/**
 * Get inventory transactions for a product
 */
export async function getInventoryTransactions(
  productId?: string,
  filters?: {
    type?: string
    startDate?: Date
    endDate?: Date
  }
): Promise<IInventoryTransaction[]> {
  const query: FilterQuery<IInventoryTransaction> = {}
  
  if (productId) {
    query.product_id = productId
  }
  
  if (filters?.type) {
    query.type = filters.type as any
  }
  
  if (filters?.startDate || filters?.endDate) {
    query.date = {}
    if (filters.startDate) {
      query.date.$gte = filters.startDate
    }
    if (filters.endDate) {
      query.date.$lte = filters.endDate
    }
  }

  return InventoryTransaction.find(query)
    .populate('product_id')
    .populate('createdBy', 'name email')
    .sort({ date: -1, createdAt: -1 })
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(): Promise<IInventory[]> {
  return Inventory.find({
    is_active: true,
    $expr: {
      $lte: ['$quantity_on_hand', '$reorder_level'],
    },
  })
    .populate('supplier')
    .populate('brand')
    .sort({ quantity_on_hand: 1 })
}

// Legacy functions for backward compatibility
export async function updateInventoryQty(
  productId: string,
  qtyChange: number,
  status?: 'normal' | 'pending_purchase' | 'pending_delivery'
): Promise<IInventory | null> {
  const product = await Inventory.findById(productId)
  if (!product) return null

  const newQty = (product.quantity_on_hand || product.qty || 0) + qtyChange
  const updateData: any = {
    quantity_on_hand: newQty,
    qty: newQty, // Sync legacy field
  }
  
  if (status !== undefined) {
    updateData.status = status
  }

  return Inventory.findByIdAndUpdate(productId, updateData, { new: true })
}

export async function normalizePendingPurchaseStatus(productId: string): Promise<IInventory | null> {
  const product = await Inventory.findById(productId)
  if (!product) return null

  if (product.status === 'pending_purchase') {
    return Inventory.findByIdAndUpdate(productId, { status: 'normal' }, { new: true })
  }
  return product
}
