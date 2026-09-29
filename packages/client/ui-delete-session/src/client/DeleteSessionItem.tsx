/**
 * The session-row delete affordance: a destructive row in the session row
 * menu that asks for explicit confirmation and then calls the host
 * `deleteSession` Remote. Live sessions are refused by the host with a clear
 * error.
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { IconTrashOutlineRegular, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionActionInjected } from './contract/slots.ts'

/** Full component props: the ui-workspace owner share, the injected delete callback, and the locale seat. */
export type DeleteSessionItemProps =
  PropsRuntime<'sidebar.workspaces.session.menu.item'> & SessionActionInjected & PropsLocale<'deleteSession'>

/** The destructive "Eliminar sesión" row rendered last in the session row menu. */
export function DeleteSessionItem(props: DeleteSessionItemProps): ReactElement | null {
  const { sessionId, displayTitle, useMenuOpenState, t } = props
  const [, setMenuOpen] = useMenuOpenState()
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    if (busy) return
    if (!window.confirm(t('confirm.message', { title: displayTitle }))) return
    setBusy(true)
    try {
      await props.deleteSession(sessionId)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <MenuItemButton
      icon={<IconTrashOutlineRegular />}
      danger
      separatorBefore
      disabled={busy}
      onSelect={() => {
        setMenuOpen(false)
        void run()
      }}
    >
      {busy ? t('action.busy') : t('action.label')}
    </MenuItemButton>
  )
}
