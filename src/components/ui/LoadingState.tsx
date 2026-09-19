export function LoadingState({ label = 'กำลังโหลดข้อมูล...' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}
