import type { SyncStatus } from '@/domain/entities/types'

const LABELS: Record<SyncStatus, string> = {
  local_only: 'ในเครื่อง',
  pending_sync: 'รอซิงก์',
  syncing: 'กำลังซิงก์',
  synced: 'ซิงก์แล้ว',
  conflict: 'ขัดแย้ง',
  error: 'ผิดพลาด',
  dead_letter: 'ซิงก์ล้มเหลว'
}

/** NFR-010: every record that may need to sync must show a clear status. */
export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return <span className={`badge badge--sync-${status}`}>{LABELS[status]}</span>
}

export function ExpenseStatusBadge({ status }: { status: 'draft' | 'active' | 'voided' }) {
  const labels = { draft: 'แบบร่าง', active: 'ปกติ', voided: 'ยกเลิกแล้ว' }
  return <span className={`badge badge--status-${status}`}>{labels[status]}</span>
}
