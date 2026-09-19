import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import {
  assertAllocationBalanced,
  computeEqualAllocation,
  computeExactAllocation,
  computePercentageAllocation,
  type AllocationInput,
  type ComputedAllocation
} from '@/domain/rules/allocation'
import { nowIso, isValidIsoDate } from '@/shared/formatting/date'
import { AppError, toAppError } from '@/shared/types/errors'
import { logger } from '@/infrastructure/logging/logger'
import { APP_CONFIG } from '@/shared/constants/config'
import type { AllocationType, Expense, ExpenseAllocation, ExpenseType } from '@/domain/entities/types'

export interface CreateExpenseInput {
  householdId: string
  expenseDate: string
  amount: number
  currency: string
  categoryId: string
  paidByMemberId: string
  expenseType: ExpenseType
  description: string
  tags: string[]
  status: 'draft' | 'active'
  allocationType: AllocationType
  /** Ignored for 'personal' (the payer is the sole responsible member). */
  allocationEntries: AllocationInput[]
  adjustmentReason?: string
  /** Stable per form-submission-attempt so retries never create a duplicate row (VAL-012, BR-009). */
  idempotencyKey: string
}

type ExpenseHeaderInput = Omit<CreateExpenseInput, 'idempotencyKey'>

function validateHeader(input: ExpenseHeaderInput): void {
  if (!Number.isFinite(input.amount) || (input.amount <= 0 && input.expenseType !== 'adjustment')) {
    throw new AppError('VALIDATION_ERROR', 'ไม่สามารถบันทึกรายการได้ กรุณาตรวจสอบข้อมูลที่จำเป็น')
  }
  if (input.expenseType === 'adjustment' && !input.adjustmentReason?.trim()) {
    throw new AppError('VALIDATION_ERROR', 'รายการปรับปรุงต้องระบุเหตุผล')
  }
  if (!isValidIsoDate(input.expenseDate)) {
    throw new AppError('VALIDATION_ERROR', 'ไม่สามารถบันทึกรายการได้ กรุณาตรวจสอบข้อมูลที่จำเป็น')
  }
  if (!input.paidByMemberId || !input.categoryId) {
    throw new AppError('VALIDATION_ERROR', 'ไม่สามารถบันทึกรายการได้ กรุณาตรวจสอบข้อมูลที่จำเป็น')
  }
}

function computeAllocations(input: ExpenseHeaderInput): ComputedAllocation[] {
  if (input.expenseType === 'personal' || input.expenseType === 'income') {
    return [{ memberId: input.paidByMemberId, allocationType: 'equal', allocatedAmount: input.amount }]
  }
  if (input.expenseType === 'adjustment') {
    const memberId = input.allocationEntries[0]?.memberId ?? input.paidByMemberId
    return [{ memberId, allocationType: 'equal', allocatedAmount: input.amount }]
  }
  // shared / advance / household require an explicit allocation.
  if (input.allocationEntries.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'ไม่ให้บันทึก Shared/Advance ที่ไม่มี Allocation')
  }
  switch (input.allocationType) {
    case 'equal':
      return computeEqualAllocation(
        input.amount,
        input.currency,
        input.allocationEntries.map((e) => e.memberId)
      )
    case 'exact':
      return computeExactAllocation(input.amount, input.currency, input.allocationEntries)
    case 'percentage':
      return computePercentageAllocation(input.amount, input.currency, input.allocationEntries)
  }
}

/**
 * FR-003 validation "ผู้จ่ายต้อง Active ณ วันที่บันทึก". The schema does not track a member's
 * historical active/inactive periods, so the MVP interpretation is: the payer must be active
 * right now. An already-recorded expense from a now-inactive member is left untouched (FR-002).
 */
async function assertPayerActiveOnDate(paidByMemberId: string, _expenseDate: string): Promise<void> {
  const member = await db.members.get(paidByMemberId)
  if (!member || member.status !== 'active') {
    throw new AppError('VALIDATION_ERROR', 'ไม่สามารถบันทึกรายการได้ กรุณาตรวจสอบข้อมูลที่จำเป็น')
  }
}

/**
 * FR-003/FR-004 + spec section 22 Transaction Handling: validate header, validate allocation,
 * generate UUID, save expense, save allocations, create audit log, create sync queue entry — all
 * inside a single Dexie transaction so a mid-write failure leaves no partial record (NFR-003).
 */
export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  validateHeader(input)

  return db.transaction(
    'rw',
    db.expenses,
    db.expenseAllocations,
    db.members,
    db.auditLogs,
    db.syncQueue,
    async () => {
      // Idempotency guard (VAL-012, BR-009): if this exact submission attempt already landed
      // (e.g. a retried tap while offline), return the existing record instead of duplicating it.
      const already = await db.expenses.where('idempotencyKey').equals(input.idempotencyKey).first()
      if (already) return already

      await assertPayerActiveOnDate(input.paidByMemberId, input.expenseDate)
      const allocations = computeAllocations(input)
      if (input.status === 'active') {
        assertAllocationBalanced(input.amount, input.currency, allocations)
      }

      const now = nowIso()
      const expense: Expense = {
        expenseId: uuidv4(),
        householdId: input.householdId,
        expenseDate: input.expenseDate,
        amount: input.amount,
        currency: input.currency,
        categoryId: input.categoryId,
        paidByMemberId: input.paidByMemberId,
        expenseType: input.expenseType,
        description: input.description.trim(),
        tags: input.tags,
        status: input.status,
        syncStatus: 'local_only',
        clientUpdatedAt: now,
        version: 1,
        idempotencyKey: input.idempotencyKey,
        adjustmentReason: input.adjustmentReason
      }

      await db.expenses.add(expense)
      for (const a of allocations) {
        const record: ExpenseAllocation = {
          allocationId: uuidv4(),
          expenseId: expense.expenseId,
          memberId: a.memberId,
          allocationType: a.allocationType,
          percentage: a.percentage,
          allocatedAmount: a.allocatedAmount
        }
        await db.expenseAllocations.add(record)
      }

      await recordAudit(db.auditLogs, {
        householdId: input.householdId,
        entityType: 'expense',
        entityId: expense.expenseId,
        action: 'create_expense',
        actorMemberId: input.paidByMemberId,
        details: { amount: expense.amount, expenseType: expense.expenseType, status: expense.status }
      })

      if (APP_CONFIG.syncEnabled) {
        await db.syncQueue.add({
          queueId: uuidv4(),
          entityType: 'expense',
          entityId: expense.expenseId,
          operation: 'create',
          payload: JSON.stringify(expense),
          idempotencyKey: input.idempotencyKey,
          retryCount: 0,
          status: 'pending'
        })
      }

      logger.log('createExpense', 'success', { entityType: 'expense', entityId: expense.expenseId })
      return expense
    }
  ).catch((err) => {
    logger.log('createExpense', 'error', { errorCode: err instanceof AppError ? err.code : 'UNKNOWN' })
    throw toAppError(err, 'บันทึกไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ')
  })
}

export interface UpdateExpenseInput extends Omit<CreateExpenseInput, 'idempotencyKey'> {
  expenseId: string
}

export async function updateExpense(input: UpdateExpenseInput): Promise<Expense> {
  validateHeader(input)
  return db.transaction(
    'rw',
    db.expenses,
    db.expenseAllocations,
    db.members,
    db.auditLogs,
    async () => {
      const existing = await db.expenses.get(input.expenseId)
      if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบรายการ')
      if (existing.status === 'voided') {
        throw new AppError('VALIDATION_ERROR', 'ไม่สามารถแก้ไขรายการที่ถูกยกเลิกแล้ว')
      }
      await assertPayerActiveOnDate(input.paidByMemberId, input.expenseDate)
      const allocations = computeAllocations(input)
      if (input.status === 'active') {
        assertAllocationBalanced(input.amount, input.currency, allocations)
      }

      const updated: Expense = {
        ...existing,
        expenseDate: input.expenseDate,
        amount: input.amount,
        currency: input.currency,
        categoryId: input.categoryId,
        paidByMemberId: input.paidByMemberId,
        expenseType: input.expenseType,
        description: input.description.trim(),
        tags: input.tags,
        status: input.status,
        clientUpdatedAt: nowIso(),
        version: existing.version + 1,
        adjustmentReason: input.adjustmentReason
      }
      await db.expenses.put(updated)
      await db.expenseAllocations.where('expenseId').equals(input.expenseId).delete()
      for (const a of allocations) {
        await db.expenseAllocations.add({
          allocationId: uuidv4(),
          expenseId: input.expenseId,
          memberId: a.memberId,
          allocationType: a.allocationType,
          percentage: a.percentage,
          allocatedAmount: a.allocatedAmount
        })
      }
      await recordAudit(db.auditLogs, {
        householdId: existing.householdId,
        entityType: 'expense',
        entityId: input.expenseId,
        action: 'update_expense',
        details: { amount: updated.amount }
      })
      return updated
    }
  )
}

/** BR-006: soft delete / void so history and (future) sync remain consistent. */
export async function voidExpense(expenseId: string, actorMemberId?: string): Promise<void> {
  await db.transaction('rw', db.expenses, db.auditLogs, async () => {
    const existing = await db.expenses.get(expenseId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบรายการ')
    await db.expenses.put({
      ...existing,
      status: 'voided',
      clientUpdatedAt: nowIso(),
      version: existing.version + 1
    })
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'expense',
      entityId: expenseId,
      action: 'void_expense',
      actorMemberId,
      details: {}
    })
  })
}

/**
 * Transactions screen "Duplicate" action: creates a new Draft copy (today's date) with the same
 * header and allocations so the user can review before it counts toward the dashboard (BR-010).
 */
export async function duplicateExpense(expenseId: string): Promise<Expense> {
  return db.transaction('rw', db.expenses, db.expenseAllocations, db.auditLogs, async () => {
    const source = await db.expenses.get(expenseId)
    if (!source) throw new AppError('NOT_FOUND', 'ไม่พบรายการ')
    const sourceAllocations = await db.expenseAllocations.where('expenseId').equals(expenseId).toArray()

    const now = nowIso()
    const copy: Expense = {
      ...source,
      expenseId: uuidv4(),
      expenseDate: nowIso().slice(0, 10),
      status: 'draft',
      syncStatus: 'local_only',
      clientUpdatedAt: now,
      serverUpdatedAt: undefined,
      version: 1,
      deletedAt: undefined,
      idempotencyKey: uuidv4()
    }
    await db.expenses.add(copy)
    for (const a of sourceAllocations) {
      await db.expenseAllocations.add({ ...a, allocationId: uuidv4(), expenseId: copy.expenseId })
    }
    await recordAudit(db.auditLogs, {
      householdId: copy.householdId,
      entityType: 'expense',
      entityId: copy.expenseId,
      action: 'create_expense',
      details: { duplicatedFrom: expenseId }
    })
    return copy
  })
}

export interface ExpenseFilters {
  householdId: string
  searchText?: string
  memberId?: string
  categoryId?: string
  expenseType?: ExpenseType
  status?: Expense['status']
  fromDate?: string
  toDate?: string
}

/** FR-009: local-only search/filter, combinable, always excludes soft-deleted rows. */
export async function listExpenses(filters: ExpenseFilters): Promise<Expense[]> {
  let items = await db.expenses.where('householdId').equals(filters.householdId).toArray()
  items = items.filter((e) => !e.deletedAt)
  if (filters.memberId) items = items.filter((e) => e.paidByMemberId === filters.memberId)
  if (filters.categoryId) items = items.filter((e) => e.categoryId === filters.categoryId)
  if (filters.expenseType) items = items.filter((e) => e.expenseType === filters.expenseType)
  if (filters.status) items = items.filter((e) => e.status === filters.status)
  if (filters.fromDate) items = items.filter((e) => e.expenseDate >= filters.fromDate!)
  if (filters.toDate) items = items.filter((e) => e.expenseDate <= filters.toDate!)
  if (filters.searchText?.trim()) {
    const q = filters.searchText.trim().toLowerCase()
    items = items.filter(
      (e) => e.description.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q))
    )
  }
  return items.sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1))
}
