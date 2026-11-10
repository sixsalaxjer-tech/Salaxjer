import { v4 as uuidv4 } from 'uuid'
import { db } from '@/infrastructure/db/db'
import { recordAudit } from '@/domain/services/auditService'
import { nowIso, isValidIsoDate } from '@/shared/formatting/date'
import { AppError } from '@/shared/types/errors'
import type { CardPayment, CreditCard } from '@/domain/entities/types'

export interface CreditCardInput {
  name: string
  last4?: string
  ownerMemberId?: string
  statementDay: number
  dueDay: number
  creditLimit?: number
  color?: string
}

const CARD_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2']

function validate(input: CreditCardInput): void {
  if (!input.name.trim()) throw new AppError('VALIDATION_ERROR', 'กรุณาระบุชื่อบัตร')
  const isDay = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31
  if (!isDay(input.statementDay) || !isDay(input.dueDay)) {
    throw new AppError('VALIDATION_ERROR', 'วันตัดรอบและวันครบกำหนดต้องเป็นวันที่ 1-31')
  }
  if (input.last4 && !/^\d{4}$/.test(input.last4)) {
    throw new AppError('VALIDATION_ERROR', 'เลขท้ายบัตรต้องเป็นตัวเลข 4 หลัก')
  }
  if (input.creditLimit !== undefined && (!Number.isFinite(input.creditLimit) || input.creditLimit < 0)) {
    throw new AppError('VALIDATION_ERROR', 'วงเงินไม่ถูกต้อง')
  }
}

export async function addCreditCard(householdId: string, input: CreditCardInput): Promise<CreditCard> {
  validate(input)
  const now = nowIso()
  const count = await db.creditCards.where('householdId').equals(householdId).count()
  const card: CreditCard = {
    creditCardId: uuidv4(),
    householdId,
    name: input.name.trim(),
    last4: input.last4 || undefined,
    ownerMemberId: input.ownerMemberId || undefined,
    statementDay: input.statementDay,
    dueDay: input.dueDay,
    creditLimit: input.creditLimit,
    color: input.color ?? CARD_COLORS[count % CARD_COLORS.length],
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  await db.transaction('rw', db.creditCards, db.auditLogs, async () => {
    await db.creditCards.add(card)
    await recordAudit(db.auditLogs, {
      householdId,
      entityType: 'credit_card',
      entityId: card.creditCardId,
      action: 'create_credit_card',
      details: { name: card.name }
    })
  })
  return card
}

export async function updateCreditCard(creditCardId: string, input: CreditCardInput): Promise<void> {
  validate(input)
  await db.transaction('rw', db.creditCards, db.auditLogs, async () => {
    const existing = await db.creditCards.get(creditCardId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบบัตร')
    await db.creditCards.put({
      ...existing,
      name: input.name.trim(),
      last4: input.last4 || undefined,
      ownerMemberId: input.ownerMemberId || undefined,
      statementDay: input.statementDay,
      dueDay: input.dueDay,
      creditLimit: input.creditLimit,
      updatedAt: nowIso()
    })
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'credit_card',
      entityId: creditCardId,
      action: 'update_credit_card',
      details: { name: input.name.trim() }
    })
  })
}

/** Cards are never hard-deleted: expenses and payments keep pointing at them. */
export async function setCreditCardActive(creditCardId: string, active: boolean): Promise<void> {
  await db.transaction('rw', db.creditCards, db.auditLogs, async () => {
    const existing = await db.creditCards.get(creditCardId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบบัตร')
    await db.creditCards.put({ ...existing, status: active ? 'active' : 'inactive', updatedAt: nowIso() })
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'credit_card',
      entityId: creditCardId,
      action: active ? 'reactivate_credit_card' : 'deactivate_credit_card',
      details: { name: existing.name }
    })
  })
}

export async function recordCardPayment(input: {
  creditCardId: string
  amount: number
  paymentDate: string
  note?: string
}): Promise<CardPayment> {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !isValidIsoDate(input.paymentDate)) {
    throw new AppError('VALIDATION_ERROR', 'กรุณาระบุจำนวนเงินและวันที่ให้ถูกต้อง')
  }
  return db.transaction('rw', db.creditCards, db.cardPayments, db.auditLogs, async () => {
    const card = await db.creditCards.get(input.creditCardId)
    if (!card) throw new AppError('NOT_FOUND', 'ไม่พบบัตร')
    const now = nowIso()
    const payment: CardPayment = {
      cardPaymentId: uuidv4(),
      householdId: card.householdId,
      creditCardId: card.creditCardId,
      amount: input.amount,
      paymentDate: input.paymentDate,
      note: input.note?.trim() || undefined,
      status: 'confirmed',
      createdAt: now,
      updatedAt: now
    }
    await db.cardPayments.add(payment)
    await recordAudit(db.auditLogs, {
      householdId: card.householdId,
      entityType: 'card_payment',
      entityId: payment.cardPaymentId,
      action: 'create_card_payment',
      details: { creditCardId: card.creditCardId, amount: payment.amount }
    })
    return payment
  })
}

export async function voidCardPayment(cardPaymentId: string): Promise<void> {
  await db.transaction('rw', db.cardPayments, db.auditLogs, async () => {
    const existing = await db.cardPayments.get(cardPaymentId)
    if (!existing) throw new AppError('NOT_FOUND', 'ไม่พบรายการชำระ')
    if (existing.status === 'voided') return
    await db.cardPayments.put({ ...existing, status: 'voided', updatedAt: nowIso() })
    await recordAudit(db.auditLogs, {
      householdId: existing.householdId,
      entityType: 'card_payment',
      entityId: cardPaymentId,
      action: 'void_card_payment',
      details: { amount: existing.amount }
    })
  })
}
