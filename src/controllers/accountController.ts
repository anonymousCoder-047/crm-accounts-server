import { Request, Response } from 'express'
import {
  createAccount,
  listAccounts,
  getAccountById,
  getAccountByAccountId,
  updateAccount,
  deleteAccount,
  updateOpeningBalance,
} from '../services/accountService'

export const createAccountHandler = async (req: Request, res: Response) => {
  try {
    const account = await createAccount(req.body)
    res.status(201).json({ success: true, data: account })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await listAccounts({
      q: req.query.q as string,
      account_type: req.query.account_type as any,
      is_active: req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined,
    })
    res.json({ success: true, data: accounts })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAccount = async (req: Request, res: Response) => {
  try {
    const account = await getAccountById(req.params.id)
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }
    res.json({ success: true, data: account })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAccountByAccountIdHandler = async (req: Request, res: Response) => {
  try {
    const account = await getAccountByAccountId(req.params.accountId)
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }
    res.json({ success: true, data: account })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateAccountHandler = async (req: Request, res: Response) => {
  try {
    const account = await updateAccount(req.params.id, req.body)
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }
    res.json({ success: true, data: account })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteAccountHandler = async (req: Request, res: Response) => {
  try {
    const account = await deleteAccount(req.params.id)
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }
    res.json({ success: true, data: account })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateOpeningBalanceHandler = async (req: Request, res: Response) => {
  try {
    const { opening_balance } = req.body
    if (opening_balance === undefined) {
      return res.status(400).json({ success: false, message: 'opening_balance is required' })
    }
    const account = await updateOpeningBalance(req.params.id, opening_balance)
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }
    res.json({ success: true, data: account })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

