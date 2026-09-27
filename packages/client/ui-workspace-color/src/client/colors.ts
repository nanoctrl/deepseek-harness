/**
 * Tint tokens and menu copy for the folder-tint rows.
 *
 * The tokens are ui-theme aliases, never static-scale values: a feature
 * component consumes semantic aliases (docs/web-styling.md). `default` has no
 * token because it keeps the theme's own folder color.
 */
import type { WorkspaceColor } from '@deepseek-ai/dsh-host-workspace-color'
import type { WorkspaceColorKey } from './locales.ts'

/** Theme alias painted by each tint; `default` inherits the folder color. */
export const TINT_TOKEN: Readonly<Record<WorkspaceColor, string | undefined>> = {
  default: undefined,
  blue: 'var(--dsw-alias-workspace-tint-blue)',
  green: 'var(--dsw-alias-workspace-tint-green)',
  amber: 'var(--dsw-alias-workspace-tint-amber)',
  red: 'var(--dsw-alias-workspace-tint-red)',
  fuchsia: 'var(--dsw-alias-workspace-tint-fuchsia)',
  deepseek: 'var(--dsw-alias-workspace-tint-deepseek)',
}

/** Menu order: the tints first, the reset last so it reads as the closing row. */
export const TINT_ORDER: readonly WorkspaceColor[] = [
  'blue', 'green', 'amber', 'red', 'fuchsia', 'deepseek', 'default',
]

/** Locale key naming each tint. */
export const TINT_LABEL: Readonly<Record<WorkspaceColor, WorkspaceColorKey>> = {
  default: 'color.default',
  blue: 'color.blue',
  green: 'color.green',
  amber: 'color.amber',
  red: 'color.red',
  fuchsia: 'color.fuchsia',
  deepseek: 'color.deepseek',
}
