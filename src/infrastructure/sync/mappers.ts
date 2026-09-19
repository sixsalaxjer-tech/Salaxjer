// Converts between the app's camelCase domain types (src/domain/entities/types.ts) and the
// snake_case rows used by the Supabase schema (supabase/schema.sql). Kept as pure, isolated
// functions so the sync engine and its tests never touch raw column names directly.
import type {
  Category,
  Expense,
  ExpenseAllocation,
  Household,
  Member,
  Settlement
} from '@/domain/entities/types'

export function householdToDb(h: Household) {
  return {
    id: h.householdId,
    name: h.name,
    base_currency: h.baseCurrency,
    month_start_day: h.monthStartDay,
    updated_at: h.updatedAt,
    version: h.version
  }
}

export function dbToHousehold(row: Record<string, unknown>): Household {
  return {
    householdId: row.id as string,
    name: row.name as string,
    baseCurrency: row.base_currency as string,
    monthStartDay: row.month_start_day as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    version: row.version as number,
    inviteCode: (row.invite_code as string) ?? undefined
  }
}

export function memberToDb(m: Member, householdId: string) {
  return {
    id: m.memberId,
    household_id: householdId,
    display_name: m.displayName,
    role: m.role,
    color: m.color,
    status: m.status,
    updated_at: m.updatedAt
  }
}

export function dbToMember(row: Record<string, unknown>): Member {
  return {
    memberId: row.id as string,
    householdId: row.household_id as string,
    displayName: row.display_name as string,
    role: row.role as Member['role'],
    color: row.color as string,
    status: row.status as Member['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function categoryToDb(c: Category, householdId: string) {
  return {
    id: c.categoryId,
    household_id: householdId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    is_default: c.isDefault,
    status: c.status,
    updated_at: c.updatedAt
  }
}

export function dbToCategory(row: Record<string, unknown>): Category {
  return {
    categoryId: row.id as string,
    householdId: row.household_id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    isDefault: row.is_default as boolean,
    status: row.status as Category['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export function expenseToDb(e: Expense) {
  return {
    id: e.expenseId,
    household_id: e.householdId,
    expense_date: e.expenseDate,
    amount: e.amount,
    currency: e.currency,
    category_id: e.categoryId,
    paid_by_member_id: e.paidByMemberId,
    expense_type: e.expenseType,
    description: e.description,
    tags: e.tags,
    status: e.status,
    client_updated_at: e.clientUpdatedAt,
    version: e.version,
    deleted_at: e.deletedAt ?? null,
    idempotency_key: e.idempotencyKey,
    adjustment_reason: e.adjustmentReason ?? null
  }
}

export function dbToExpense(row: Record<string, unknown>): Expense {
  return {
    expenseId: row.id as string,
    householdId: row.household_id as string,
    expenseDate: row.expense_date as string,
    amount: Number(row.amount),
    currency: row.currency as string,
    categoryId: row.category_id as string,
    paidByMemberId: row.paid_by_member_id as string,
    expenseType: row.expense_type as Expense['expenseType'],
    description: (row.description as string) ?? '',
    tags: (row.tags as string[]) ?? [],
    status: row.status as Expense['status'],
    syncStatus: 'synced',
    clientUpdatedAt: row.client_updated_at as string,
    version: row.version as number,
    deletedAt: (row.deleted_at as string) ?? undefined,
    idempotencyKey: row.idempotency_key as string,
    adjustmentReason: (row.adjustment_reason as string) ?? undefined
  }
}

export function allocationToDb(a: ExpenseAllocation) {
  return {
    id: a.allocationId,
    expense_id: a.expenseId,
    member_id: a.memberId,
    allocation_type: a.allocationType,
    percentage: a.percentage ?? null,
    allocated_amount: a.allocatedAmount
  }
}

export function dbToAllocation(row: Record<string, unknown>): ExpenseAllocation {
  return {
    allocationId: row.id as string,
    expenseId: row.expense_id as string,
    memberId: row.member_id as string,
    allocationType: row.allocation_type as ExpenseAllocation['allocationType'],
    percentage: row.percentage === null ? undefined : Number(row.percentage),
    allocatedAmount: Number(row.allocated_amount)
  }
}

export function settlementToDb(s: Settlement) {
  return {
    id: s.settlementId,
    household_id: s.householdId,
    from_member_id: s.fromMemberId,
    to_member_id: s.toMemberId,
    amount: s.amount,
    settlement_date: s.settlementDate,
    status: s.status,
    proof_attachment_id: s.proofAttachmentId ?? null,
    note: s.note ?? null,
    updated_at: s.updatedAt
  }
}

export function dbToSettlement(row: Record<string, unknown>): Settlement {
  return {
    settlementId: row.id as string,
    householdId: row.household_id as string,
    fromMemberId: row.from_member_id as string,
    toMemberId: row.to_member_id as string,
    amount: Number(row.amount),
    settlementDate: row.settlement_date as string,
    status: row.status as Settlement['status'],
    proofAttachmentId: (row.proof_attachment_id as string) ?? undefined,
    note: (row.note as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}
