// Technical logging per spec section 19.
// Never log: password, access token, full attachment bytes, or unnecessary personal data.
// Entity IDs are masked (only the first 8 chars kept) since UUIDs can be used to correlate records.

export interface TechnicalLogEntry {
  appVersion: string
  timestamp: string
  operation: string
  entityType?: string
  entityId?: string
  result: 'success' | 'error'
  errorCode?: string
  retryCount?: number
  networkState: 'online' | 'offline'
}

const APP_VERSION = '0.1.0'

function maskId(id?: string): string | undefined {
  if (!id) return undefined
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function networkState(): 'online' | 'offline' {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'
}

class Logger {
  private buffer: TechnicalLogEntry[] = []

  log(
    operation: string,
    result: 'success' | 'error',
    opts: { entityType?: string; entityId?: string; errorCode?: string; retryCount?: number } = {}
  ): void {
    const entry: TechnicalLogEntry = {
      appVersion: APP_VERSION,
      timestamp: new Date().toISOString(),
      operation,
      entityType: opts.entityType,
      entityId: maskId(opts.entityId),
      result,
      errorCode: opts.errorCode,
      retryCount: opts.retryCount,
      networkState: networkState()
    }
    this.buffer.push(entry)
    if (this.buffer.length > 500) this.buffer.shift()
    const line = `[${entry.timestamp}] ${operation} — ${result}${entry.errorCode ? ` (${entry.errorCode})` : ''}`
    if (result === 'error') {
      // eslint-disable-next-line no-console
      console.error(line, entry)
    } else if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(line, entry)
    }
  }

  recent(limit = 100): TechnicalLogEntry[] {
    return this.buffer.slice(-limit)
  }
}

export const logger = new Logger()
