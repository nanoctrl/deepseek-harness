/**
 * The session-row delete affordance: a destructive menu-footer row that asks
 * for explicit confirmation and then calls the host `deleteSession` Remote.
 * Live sessions are refused by the host with a clear error.
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import clsx from 'clsx'
import { IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionActionInjected } from './contract/slots.ts'
import css from './DeleteSessionItem.module.css'

/** Full component props: the ui-workspace owner share, the injected delete callback, and the locale seat. */
export type DeleteSessionItemProps =
  PropsRuntime<'sidebar.workspaces.sessionAction'> & SessionActionInjected & PropsLocale<'deleteSession'>

/** The destructive "Eliminar sesión" row rendered in the session row menu footer. */
export function DeleteSessionItem(props: DeleteSessionItemProps): ReactElement | null {
  const { sessionId, title, onClose, delete: remove, t } = props
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    if (busy) return
    if (!window.confirm(t('confirm.message', { title }))) return
    setBusy(true)
    try {
      await remove(sessionId)
      onClose()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={clsx(css.row, busy && css.busy)}
      onClick={(event) => {
        event.stopPropagation()
        void run()
      }}
      disabled={busy}
    >
      <IconTrashOutline16 />
      <span>{busy ? t('action.busy') : t('action.label')}</span>
    </button>
  )
}
