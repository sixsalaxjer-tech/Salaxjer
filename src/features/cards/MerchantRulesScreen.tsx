import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { db } from '@/infrastructure/db/db'
import { MERCHANT_RULES } from '@/domain/rules/merchantRules'
import { saveMerchantRule, setMerchantRuleActive, updateMerchantRule } from '@/domain/services/merchantRuleService'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'

/** Master list that classifies credit-card merchants into categories (used by the card import). */
export function MerchantRulesScreen() {
  const { household, categories, activeCategories } = useHousehold()
  const toast = useToast()
  const rules = useLiveQuery(
    () => (household ? db.merchantRules.where('householdId').equals(household.householdId).toArray() : []),
    [household?.householdId]
  )
  const [keyword, setKeyword] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [error, setError] = useState<string>()

  if (!household || !rules) return <LoadingState />
  const category = (id: string) => categories.find((c) => c.categoryId === id)
  const effectiveCategory = categoryId || activeCategories[0]?.categoryId || ''
  const sorted = [...rules].sort(
    (a, b) => Number(b.status === 'active') - Number(a.status === 'active') || a.keyword.localeCompare(b.keyword)
  )

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!household) return
    setError(undefined)
    try {
      await saveMerchantRule(household.householdId, { keyword, description, categoryId: effectiveCategory })
      setKeyword('')
      setDescription('')
      toast.show('success', 'บันทึกกฎแล้ว')
    } catch (err) {
      setError(err instanceof AppError ? err.userMessage : 'บันทึกไม่สำเร็จ')
    }
  }

  return (
    <div className="screen">
      <p>
        กำหนดว่าร้านที่ชื่อมีคำใดคำหนึ่ง จะถูกจัดเข้าหมวดหมู่ไหนตอนนำเข้ารายการบัตรเครดิต ถ้าหลายกฎตรงกัน
        จะใช้กฎที่คำยาวที่สุด
      </p>

      <form className="form" onSubmit={handleAdd}>
        <Field label="คำที่อยู่ในชื่อร้าน" htmlFor="rule-keyword" hint="เช่น SHOPEE, MRT-BEM (ไม่สนตัวพิมพ์เล็ก/ใหญ่)" error={error}>
          <input id="rule-keyword" className="input" required value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </Field>
        <Field label="หมวดหมู่" htmlFor="rule-category">
          <select id="rule-category" className="input" value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)}>
            {activeCategories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ชื่อรายการที่แสดง (ไม่บังคับ)" htmlFor="rule-description" hint="ถ้าเว้นว่าง จะใช้ชื่อร้านตามที่ธนาคารส่งมา">
          <input id="rule-description" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" fullWidth disabled={!effectiveCategory}>
          เพิ่มกฎ
        </Button>
      </form>

      {sorted.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="ยังไม่มีกฎของคุณ"
          description="เพิ่มเอง หรือเลือกหมวดหมู่ตอนนำเข้ารายการ แอปจะจำให้อัตโนมัติ"
        />
      ) : (
        <ul className="settings-list">
          {sorted.map((r) => {
            const inactive = r.status !== 'active'
            const cat = category(r.categoryId)
            return (
              <li key={r.merchantRuleId} className="member-row" style={{ opacity: inactive ? 0.6 : 1 }}>
                <span className="member-row__name">
                  {r.keyword}
                  {r.description ? ` → ${r.description}` : ''}
                </span>
                <select
                  className="input input--compact"
                  aria-label="หมวดหมู่"
                  value={r.categoryId}
                  disabled={inactive}
                  onChange={(e) => void updateMerchantRule(r.merchantRuleId, { categoryId: e.target.value })}
                >
                  {!cat && <option value={r.categoryId}>(ไม่พบหมวดหมู่)</option>}
                  {categories
                    .filter((c) => c.status === 'active' || c.categoryId === r.categoryId)
                    .map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                </select>
                <div className="member-row__actions">
                  <button className="btn btn--ghost btn--small" onClick={() => void setMerchantRuleActive(r.merchantRuleId, inactive)}>
                    {inactive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <section className="card">
        <h2 className="card__title">กฎเริ่มต้นของระบบ (ใช้เมื่อไม่มีกฎของคุณตรงกัน)</h2>
        <ul className="recent-list">
          {MERCHANT_RULES.map((r) => (
            <li key={r.pattern.source} className="recent-list__item">
              <span className="recent-list__desc">{r.pattern.source.replace(/\\/g, '')}</span>
              <span className="recent-list__amount">
                {r.description}
                {r.categoryName ? ` · ${r.categoryName}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
