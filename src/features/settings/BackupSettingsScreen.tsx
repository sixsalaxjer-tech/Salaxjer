import { useRef, useState } from 'react'
import { useHousehold } from '@/app/providers/HouseholdProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { exportBackup, importBackup, serializeBackup, type RestoreMode, type RestoreReport } from '@/infrastructure/backup/backupService'
import { AppError } from '@/shared/types/errors'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function BackupSettingsScreen() {
  const { household } = useHousehold()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exportPassword, setExportPassword] = useState('')
  const [exporting, setExporting] = useState(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const [mode, setMode] = useState<RestoreMode>('validate')
  const [report, setReport] = useState<RestoreReport | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    if (!household) return
    setExporting(true)
    try {
      const file = await exportBackup(household.householdId, exportPassword || undefined)
      const filename = `family-expense-backup-${household.householdId.slice(0, 8)}-${file.exportTimestamp.slice(0, 10)}.json`
      downloadFile(filename, serializeBackup(file))
      toast.show('success', 'ดาวน์โหลดไฟล์สำรองแล้ว')
    } catch (err) {
      toast.show('error', err instanceof AppError ? err.userMessage : 'สำรองข้อมูลไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  async function runImport(effectiveMode: RestoreMode) {
    if (!household || !selectedFile) return
    setImporting(true)
    try {
      const text = await selectedFile.text()
      const result = await importBackup(household.householdId, text, effectiveMode, importPassword || undefined)
      setReport(result)
      if (effectiveMode !== 'validate') {
        toast.show('success', 'กู้คืนข้อมูลเรียบร้อยแล้ว')
      } else {
        toast.show('success', 'ไฟล์สำรองถูกต้อง พร้อมกู้คืน')
      }
    } catch (err) {
      toast.show('error', err instanceof AppError ? err.userMessage : 'ไฟล์สำรองไม่ถูกต้องหรือไม่รองรับ')
      setReport(null)
    } finally {
      setImporting(false)
    }
  }

  function handleImportSubmit() {
    if (mode === 'replace') {
      setPendingConfirm(true)
      return
    }
    void runImport(mode)
  }

  if (!household) return null

  return (
    <div className="screen backup-screen">
      <section className="card">
        <h2 className="card__title">สำรองข้อมูล (Export)</h2>
        <Field
          label="รหัสผ่านเข้ารหัสไฟล์ (ไม่บังคับ)"
          htmlFor="export-password"
          hint="เว้นว่างหากไม่ต้องการเข้ารหัส"
        >
          <input
            id="export-password"
            type="password"
            className="input"
            value={exportPassword}
            onChange={(e) => setExportPassword(e.target.value)}
          />
        </Field>
        <Button onClick={() => void handleExport()} disabled={exporting} fullWidth>
          {exporting ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลดไฟล์สำรอง'}
        </Button>
      </section>

      <section className="card">
        <h2 className="card__title">กู้คืนข้อมูล (Import)</h2>
        <Field label="เลือกไฟล์สำรอง" htmlFor="backup-file">
          <input
            id="backup-file"
            type="file"
            accept="application/json"
            ref={fileInputRef}
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="รหัสผ่าน (ถ้าไฟล์ถูกเข้ารหัส)" htmlFor="import-password">
          <input
            id="import-password"
            type="password"
            className="input"
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
          />
        </Field>
        <Field label="โหมดการกู้คืน" htmlFor="restore-mode">
          <select id="restore-mode" className="input" value={mode} onChange={(e) => setMode(e.target.value as RestoreMode)}>
            <option value="validate">ตรวจสอบไฟล์เท่านั้น (Validate Only)</option>
            <option value="replace">แทนที่ข้อมูลปัจจุบัน (Replace)</option>
            <option value="merge">รวมข้อมูล (Merge)</option>
          </select>
        </Field>
        <Button onClick={handleImportSubmit} disabled={!selectedFile || importing} fullWidth>
          {importing ? 'กำลังประมวลผล...' : 'ดำเนินการ'}
        </Button>

        {report && (
          <div className="restore-report">
            <p>สำเร็จ: {report.success}</p>
            <p>ข้าม: {report.skipped}</p>
            <p>ขัดแย้ง: {report.conflict}</p>
            <p>ผิดพลาด: {report.error}</p>
          </div>
        )}
      </section>

      {pendingConfirm && (
        <ConfirmDialog
          title="ยืนยันการแทนที่ข้อมูล"
          description="ระบบจะสร้างจุดกู้คืนของข้อมูลปัจจุบันก่อน แต่ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่ด้วยไฟล์สำรอง ต้องการดำเนินการต่อหรือไม่?"
          onDismiss={() => setPendingConfirm(false)}
          actions={[
            {
              label: 'ยืนยันแทนที่ข้อมูล',
              variant: 'danger',
              onSelect: () => {
                setPendingConfirm(false)
                void runImport('replace')
              }
            },
            { label: 'ยกเลิก', variant: 'ghost', onSelect: () => setPendingConfirm(false) }
          ]}
        />
      )}
    </div>
  )
}
