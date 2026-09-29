/**
 * The workspace row menu's folder-tint rows: one swatch row per tint, the
 * current one ringed and bold. Rendered from `sidebar.workspaces.row.menu.item`,
 * so the rows join the menu's keyboard walk and focus return like any other row.
 */
import type { CSSProperties, ReactElement } from 'react'
import clsx from 'clsx'
import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FolderColorInjected } from './contract/slots.ts'
import { TINT_LABEL, TINT_ORDER, TINT_TOKEN } from './colors.ts'
import css from './FolderColorMenu.module.css'

/** Full component props: the ui-workspace owner share, the injected writer, and the locale seat. */
export type FolderColorMenuProps =
  PropsRuntime<'sidebar.workspaces.row.menu.item'> & FolderColorInjected & PropsLocale<'workspaceColor'>

/**
 * The folder-tint rows, legend first. The owner share carries the row's tint
 * as the CSS color it paints, so the applied one is the row whose token
 * matches it.
 */
export function FolderColorMenu(props: FolderColorMenuProps): ReactElement {
  const { workspaceId, color, setColor, t } = props
  return (
    <>
      <div className={css.legend} role="presentation">{t('menu.legend')}</div>
      {TINT_ORDER.map((tint, index) => (
        <MenuItemButton
          key={tint}
          icon={(
            <span
              className={clsx(css.swatch, TINT_TOKEN[tint] === color && css.swatchCurrent)}
              style={{ '--tint': TINT_TOKEN[tint] } as CSSProperties}
            />
          )}
          separatorBefore={index === 0}
          onSelect={() => { void setColor(workspaceId, tint) }}
        >
          {/* The applied tint reads bold too, so the menu states the choice in
              text and not only through the ring around its swatch. */}
          <span className={clsx(TINT_TOKEN[tint] === color && css.labelCurrent)}>{t(TINT_LABEL[tint])}</span>
        </MenuItemButton>
      ))}
    </>
  )
}
