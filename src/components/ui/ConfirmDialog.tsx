import { Button } from '@/components/ui/Button'

export interface ConfirmDialogAction {
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  onSelect: () => void
}

interface ConfirmDialogProps {
  title: string
  description?: string
  actions: ConfirmDialogAction[]
  onDismiss: () => void
}

/** Generic modal used for duplicate warnings (section 17), void confirmation, and restore confirmation. */
export function ConfirmDialog({ title, description, actions, onDismiss }: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onDismiss}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="modal__title">
          {title}
        </h2>
        {description && <p className="modal__description">{description}</p>}
        <div className="modal__actions">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant ?? 'secondary'} onClick={action.onSelect}>
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
