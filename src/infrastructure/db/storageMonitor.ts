export interface StorageEstimateInfo {
  usageBytes: number
  quotaBytes: number
  usagePercent: number
  supported: boolean
}

/** VAL-010: warns the user before the browser storage quota is exhausted. */
export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  if (!navigator.storage?.estimate) {
    return { usageBytes: 0, quotaBytes: 0, usagePercent: 0, supported: false }
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return {
    usageBytes: usage,
    quotaBytes: quota,
    usagePercent: quota > 0 ? (usage / quota) * 100 : 0,
    supported: true
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}
