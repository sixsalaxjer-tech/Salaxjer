import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { computeNetBalances, computeSuggestedTransfers, excludeExpensesInClearedWeeks } from '@/domain/rules/settlement'
import { pushSettlement } from '@/infrastructure/sync/syncEngine'
import { nowIso, isValidIsoDate } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import { APP_CONFIG } from '@/shared/constants/config'
import type { NetBalance, SuggestedTransfer } from '@/domain/rules/settlement'
import type { Settlement } from '@/domain/entities/types'

export interface SettlementSummary {
  balances: NetBalance[]
  suggestedTransfers: SuggestedTransfer[]
}

/** FR-007 Settlement, aware of per-week clears (see excludeExpensesInClearedWeeks): a week
 * marked "เคลียร์ยอด" on WeeklySummaryCard drops out of the running balance on its own — no
 * matching settlement transfer needs to be recorded by hand for it. */
export async function getSettlementSummary(householdId: string, currency: string): Promise<SettlementSummary> {
  const [expenses, settlements, weekSettlements] = await Promise.all([
    db.expenses.where('householdId').equals(householdId).toArray(),
    db.settlements.where('householdId').equals(householdId).toArray(),
    db.weekSettlements.where('householdId').equals(householdId).toArray()
  ])
  const outstandingExpenses = excludeExpensesInClearedWeeks(expenses, weekSettlements)

  const expenseIds = new Set(outstandingExpenses.map((e) => e.expenseId))
  const allAllocations = await db.expenseAllocations.toArray()
  const allocations = allAllocations.filter((a) => expenseIds.has(a.expenseId))

  const balances = computeNetBalances(currency, outstandingExpenses, allocations, settlements)
  const suggestedTransfers = computeSuggestedTransfers(currency, balances)
  return { balances, suggestedTransfers }
}

export interface RecordSettlementInput {
  householdId: string
  fromMemberId: string
  toMemberId: string
  amount: number
  settlementDate: string
  note?: string
}

/** FR-007: recording a repayment reduces the outstanding balance between the two members. */
export async function recordSettlement(input: RecordSettlementInput): Promise<Settlement> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError('VALIDATION_ERROR', 'จำนวนเงินต้องมากกว่า 0')
  }
  if (input.fromMemberId === input.toMemberId) {
    throw new AppError('VALIDATION_ERROR', 'ผู้จ่ายและผู้รับต้องไม่ใช่คนเดียวกัน')
  }
  if (!isValidIsoDate(input.settlementDate)) {
    throw new AppError('VALIDATION_ERROR', 'วันที่ไม่ถูกต้อง')
  }
  const now = nowIso()
  const settlement: Settlement = {
    settlementId: uuidv4(),
    householdId: input.householdId,
    fromMemberId: input.fromMemberId,
    toMemberId: input.toMemberId,
    amount: input.amount,
    settlementDate: input.settlementDate,
    status: 'confirmed',
    note: input.note,
    createdAt: now,
    updatedAt: now
  }
  await db.transaction('rw', db.settlements, db.auditLogs, async () => {
    await db.settlements.add(settlement)
    await recordAudit(db.auditLogs, {
      householdId: input.householdId,
      entityType: 'settlement',
      entityId: settlement.settlementId,
      action: 'confirm_settlement',
      details: { amount: settlement.amount }
    })
  })
  if (APP_CONFIG.syncEnabled) void pushSettlement(settlement)
  return settlement
}

export async function listSettlements(householdId: string): Promise<Settlement[]> {
  const items = await db.settlements.where('householdId').equals(householdId).toArray()
  return items.sort((a, b) => (a.settlementDate < b.settlementDate ? 1 : -1))
}

export async function voidSettlement(settlementId: string): Promise<void> {
  let updated: Settlement | undefined
  await db.transaction('rw', db.settlements, db.auditLogs, async () => {
    const existing = await db.settlements.get(settlementId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบรายการ')
    updated = { ...existing, status: 'voided', updatedAt: nowIso() }
    await db.settlements.put(updated)
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'settlement',
      entityId: settlementId,
      action: 'void_settlement',
      details: {}
    })
  })
  if (APP_CONFIG.syncEnabled && updated) void pushSettlement(updated)
}
