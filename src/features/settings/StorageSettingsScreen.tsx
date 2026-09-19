import { useEffect, useState } from 'react'
import { getStorageEstimate, formatBytes, type StorageEstimateInfo } from '@/infrastructure/db/storageMonitor'
import { APP_CONFIG } from '@/shared/constants/config'
import { LoadingState } from '@/components/ui/LoadingState'

export function StorageSettingsScreen() {
  const [info, setInfo] = useState<StorageEstimateInfo>()

  useEffect(() => {
    void getStorageEstimate().then(setInfo)
  }, [])

  if (!info) return <LoadingState />

  const warn = info.usagePercent >= APP_CONFIG.storageWarningThresholdPercent

  return (
    <div className="screen">
      <section className="card">
        <h2 className="card__title">การใช้พื้นที่จัดเก็บ</h2>
        {!info.supported ? (
          <p>เบราว์เซอร์นี้ไม่รองรับการตรวจสอบพื้นที่จัดเก็บ</p>
        ) : (
          <>
            <div className="storage-bar">
              <div
                className={`storage-bar__fill${warn ? ' storage-bar__fill--warn' : ''}`}
                style={{ width: `${Math.min(100, info.usagePercent)}%` }}
              />
            </div>
            <p>
              ใช้ไปแล้ว {formatBytes(info.usageBytes)} จาก {formatBytes(info.quotaBytes)} ({info.usagePercent.toFixed(1)}%)
            </p>
            {warn && (
              <p className="field__error" role="alert">
                พื้นที่จัดเก็บใกล้เต็ม กรุณาสำรองข้อมูลหรือลบไฟล์ที่ไม่จำเป็น
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
