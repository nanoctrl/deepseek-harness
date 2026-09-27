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
  sky: 'var(--dsw-alias-workspace-tint-sky)',
  navy: 'var(--dsw-alias-workspace-tint-navy)',
  green: 'var(--dsw-alias-workspace-tint-green)',
  lime: 'var(--dsw-alias-workspace-tint-lime)',
  amber: 'var(--dsw-alias-workspace-tint-amber)',
  orange: 'var(--dsw-alias-workspace-tint-orange)',
  red: 'var(--dsw-alias-workspace-tint-red)',
  coral: 'var(--dsw-alias-workspace-tint-coral)',
  fuchsia: 'var(--dsw-alias-workspace-tint-fuchsia)',
  deepseek: 'var(--dsw-alias-workspace-tint-deepseek)',
  lavender: 'var(--dsw-alias-workspace-tint-lavender)',
}

/** Menu order: grouped by hue family, the reset last so it reads as the closing row. */
export const TINT_ORDER: readonly WorkspaceColor[] = [
  'blue', 'sky', 'navy',
  'green', 'lime',
  'amber', 'orange',
  'red', 'coral',
  'fuchsia',
  'deepseek', 'lavender',
  'default',
]

/** Locale key naming each tint. */
export const TINT_LABEL: Readonly<Record<WorkspaceColor, WorkspaceColorKey>> = {
  default: 'color.default',
  blue: 'color.blue',
  sky: 'color.sky',
  navy: 'color.navy',
  green: 'color.green',
  lime: 'color.lime',
  amber: 'color.amber',
  orange: 'color.orange',
  red: 'color.red',
  coral: 'color.coral',
  fuchsia: 'color.fuchsia',
  deepseek: 'color.deepseek',
  lavender: 'color.lavender',
}
