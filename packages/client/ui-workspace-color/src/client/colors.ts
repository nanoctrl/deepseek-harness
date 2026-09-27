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
  red: 'var(--dsw-alias-workspace-tint-red)',
  pink: 'var(--dsw-alias-workspace-tint-pink)',
  purple: 'var(--dsw-alias-workspace-tint-purple)',
  indigo: 'var(--dsw-alias-workspace-tint-indigo)',
  blue: 'var(--dsw-alias-workspace-tint-blue)',
  cyan: 'var(--dsw-alias-workspace-tint-cyan)',
  teal: 'var(--dsw-alias-workspace-tint-teal)',
  green: 'var(--dsw-alias-workspace-tint-green)',
  lime: 'var(--dsw-alias-workspace-tint-lime)',
  yellow: 'var(--dsw-alias-workspace-tint-yellow)',
  orange: 'var(--dsw-alias-workspace-tint-orange)',
  deeporange: 'var(--dsw-alias-workspace-tint-deeporange)',
  brown: 'var(--dsw-alias-workspace-tint-brown)',
  bluegrey: 'var(--dsw-alias-workspace-tint-bluegrey)',
}

/** Menu order: Material Design hue wheel, the reset last so it reads as the closing row. */
export const TINT_ORDER: readonly WorkspaceColor[] = [
  'red', 'pink', 'purple', 'indigo',
  'blue', 'cyan', 'teal',
  'green', 'lime',
  'yellow', 'orange', 'deeporange',
  'brown', 'bluegrey',
  'default',
]

/** Locale key naming each tint. */
export const TINT_LABEL: Readonly<Record<WorkspaceColor, WorkspaceColorKey>> = {
  default: 'color.default',
  red: 'color.red',
  pink: 'color.pink',
  purple: 'color.purple',
  indigo: 'color.indigo',
  blue: 'color.blue',
  cyan: 'color.cyan',
  teal: 'color.teal',
  green: 'color.green',
  lime: 'color.lime',
  yellow: 'color.yellow',
  orange: 'color.orange',
  deeporange: 'color.deeporange',
  brown: 'color.brown',
  bluegrey: 'color.bluegrey',
}
