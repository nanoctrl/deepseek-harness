/**
 * Durable shape of the folder-tint registry: one table keyed by Workspace id.
 *
 * A row stores a bare string, not the closed set this build ships: the palette
 * changes, and a stored tint that a later build no longer knows must stay
 * readable instead of invalidating the whole domain. {@link isWorkspaceColor}
 * is what the Remote validates against, and the reader ignores obsolete rows.
 * @module @deepseek-ai/dsh-host-workspace-color/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceColor } from './types.ts'

/** Every tint this build accepts; a stored value outside it is obsolete. */
export const WORKSPACE_COLORS: readonly WorkspaceColor[] = [
  'default',
  'red', 'pink', 'purple', 'indigo',
  'blue', 'cyan', 'teal',
  'green', 'lime',
  'yellow', 'orange', 'deeporange',
  'brown', 'bluegrey',
]

/**
 * Whether a stored value is a tint this build still knows.
 * @param value - the stored tint.
 * @returns whether it belongs to this build's palette.
 */
export function isWorkspaceColor(value: string): value is WorkspaceColor {
  return WORKSPACE_COLORS.some(color => color === value)
}

/** One stored tint: any string, so a palette change never invalidates the medium. */
export const workspaceColorRecord = z.string()

/**
 * The folder-tint domain: one `colors` table keyed by Workspace id. An absent
 * row means `default`, so the table holds only the workspaces a user tinted.
 */
export const workspaceColorDomainSpec = defineDomain({
  name: 'workspace_color',
  version: 1,
  tables: { colors: domainTable<string, string>(workspaceColorRecord) },
})
