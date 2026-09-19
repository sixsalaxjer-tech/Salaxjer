// Typed application errors carrying a Thai user-facing message and an English technical code.
// Per spec section 21/22: technical detail is logged (masked), the user only ever sees `userMessage`.

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'ALLOCATION_IMBALANCE'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'BACKUP_INVALID'
  | 'BACKUP_VERSION_UNSUPPORTED'
  | 'RECONCILIATION_ERROR'
  | 'NOT_FOUND'
  | 'PERIOD_CLOSED'
  | 'UNKNOWN'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string
  readonly cause?: unknown

  constructor(code: AppErrorCode, userMessage: string, cause?: unknown) {
    super(userMessage)
    this.name = 'AppError'
    this.code = code
    this.userMessage = userMessage
    this.cause = cause
  }
}

export function toAppError(err: unknown, fallbackMessage: string): AppError {
  if (err instanceof AppError) return err
  return new AppError('UNKNOWN', fallbackMessage, err)
}
