/**
 * The sidebar instance-monitor trigger and modal: the sidebar shows a single
 * "ds-monitor" button above Settings; clicking it opens a modal that polls the
 * host `instanceMonitor` Remote and renders one row per discovered localhost
 * instance with its health status and the guarded stop/restart actions.
 */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { InstanceMonitorSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InstanceMonitorInjected } from './contract/slots.ts'
import css from './InstanceMonitorPanel.module.css'

/** Full component props: shell owner share, injected callbacks, and the locale seat. */
export type InstanceMonitorPanelProps =
  PropsRuntime<'sidebar.monitor'> & InstanceMonitorInjected & PropsLocale<'instanceMonitor'>

/** Polling cadence for the host snapshot while the modal is open. */
const POLL_MS = 15000

/** Format an epoch timestamp as HH:MM:SS local time. */
function formatTime(epochMs: number): string {
  const date = new Date(epochMs)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** The collapsed sidebar trigger plus the instance-monitor modal. */
export function InstanceMonitorPanel(props: InstanceMonitorPanelProps): ReactElement | null {
  const { wide, load, act, t } = props
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<InstanceMonitorSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<number>>(new Set<number>())

  useEffect(() => {
    if (!wide || !open) return
    let alive = true
    const poll = async (): Promise<void> => {
      try {
        const next = await load()
        if (alive) {
          setSnapshot(next)
          setError(null)
        }
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause))
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [wide, open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!wide) return null

  // Ports with nothing listening are not instances; only reachable rows count.
  const instances = snapshot?.instances.filter(instance => instance.status !== 'down') ?? null

  const run = async (port: number, kind: 'stop' | 'restart'): Promise<void> => {
    const confirmed = window.confirm(kind === 'stop' ? t('confirm.stop') : t('confirm.restart'))
    if (!confirmed) return
    setBusy(previous => new Set(previous).add(port))
    try {
      await act({ port, kind })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy((previous) => {
        const next = new Set(previous)
        next.delete(port)
        return next
      })
    }
  }

  return (
    <>
      <button type="button" className={css.trigger} onClick={() => setOpen(true)}>
        {t('trigger.label')}
      </button>
      {open && createPortal(
        <div className={css.backdrop} onClick={() => setOpen(false)}>
          <div
            className={css.modal}
            role="dialog"
            aria-modal="true"
            onClick={event => event.stopPropagation()}
          >
            <div className={css.modalHeader}>
              <div className={css.title}>{t('panel.title')}</div>
              <button type="button" className={css.close} onClick={() => setOpen(false)}>
                {t('modal.close')}
              </button>
            </div>
            {error !== null && (
              <div className={css.error}>{t('panel.error')}: {error}</div>
            )}
            {instances !== null && instances.length === 0 && error === null && (
              <div className={css.empty}>{t('panel.empty')}</div>
            )}
            <div className={css.list}>
              {instances?.map(instance => (
                <div key={instance.port} className={css.row}>
                  <span className={clsx(css.dot, css[instance.status])} />
                  <span className={css.port}>:{instance.port}</span>
                  {instance.isCurrent && <span className={css.badge}>{t('row.current')}</span>}
                  <span className={css.status}>
                    {instance.status === 'up'
                      ? t('status.up')
                      : instance.status === 'degraded'
                        ? t('status.degraded')
                        : t('status.down')}
                  </span>
                  {instance.httpStatus !== null && (
                    <span className={css.http}>{t('row.http')} {instance.httpStatus}</span>
                  )}
                  <span className={css.spacer} />
                  <button
                    type="button"
                    className={css.action}
                    disabled={instance.isCurrent || instance.status === 'down' || busy.has(instance.port)}
                    onClick={() => void run(instance.port, 'stop')}
                  >
                    {t('action.stop')}
                  </button>
                  <button
                    type="button"
                    className={css.action}
                    disabled={instance.isCurrent || instance.status === 'down' || busy.has(instance.port)}
                    onClick={() => void run(instance.port, 'restart')}
                  >
                    {t('action.restart')}
                  </button>
                </div>
              ))}
            </div>
            {snapshot !== null && (
              <div className={css.meta}>{t('panel.lastChecked')} {formatTime(snapshot.checkedAt)}</div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
