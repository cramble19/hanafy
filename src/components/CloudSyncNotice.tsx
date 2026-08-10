import { Check, Download, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export type CloudSyncNoticeStatus =
  | 'idle'
  | 'loading'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'conflict'
  | 'offline'
  | 'disabled'
  | 'preview'

type Props = {
  profile: 'hana' | 'cramble'
  status: CloudSyncNoticeStatus
  hasPendingSave: boolean
  saveConfirmedAt: number | null
  onRetry: () => void
  onExportBackup: () => void
}

const SAVED_NOTICE_DURATION_MS = 2800

export function CloudSyncNotice({
  profile,
  status,
  hasPendingSave,
  saveConfirmedAt,
  onRetry,
  onExportBackup,
}: Props) {
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!saveConfirmedAt) return
    const elapsed = Date.now() - saveConfirmedAt
    if (elapsed >= SAVED_NOTICE_DURATION_MS) {
      setShowSaved(false)
      return
    }
    setShowSaved(true)
    const timer = window.setTimeout(
      () => setShowSaved(false),
      SAVED_NOTICE_DURATION_MS - Math.max(0, elapsed),
    )
    return () => window.clearTimeout(timer)
  }, [saveConfirmedAt])

  const needsRetry =
    hasPendingSave &&
    (status === 'offline' || status === 'error' || status === 'conflict')

  if (!needsRetry && (!showSaved || status !== 'synced')) return null

  if (needsRetry) {
    return (
      <aside
        className="cloud-sync-notice cloud-sync-notice-pending"
        data-profile={profile}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="cloud-sync-notice-heading">
          <Check className="size-4" aria-hidden="true" />
          <strong>Saved on this device</strong>
        </div>
        <p>
          {status === 'offline'
            ? 'Waiting for a connection. Your data will not be discarded.'
            : 'Cloud retrying. Your data will not be discarded.'}
        </p>
        <div className="cloud-sync-notice-actions">
          <button type="button" onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry now
          </button>
          <button type="button" onClick={onExportBackup}>
            <Download className="size-4" aria-hidden="true" />
            Export backup
          </button>
        </div>
      </aside>
    )
  }

  return (
    <div
      className="cloud-sync-notice cloud-sync-notice-saved"
      data-profile={profile}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Check className="size-4" aria-hidden="true" />
      <span>Saved to cloud</span>
    </div>
  )
}
