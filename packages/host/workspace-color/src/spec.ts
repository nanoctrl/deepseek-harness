/**
 * Durable shape of the folder-tint registry: one table keyed by Workspace id.
 * @module @deepseek-ai/dsh-host-workspace-color/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceColor } from './types.ts'

/** Every tint the registry accepts; the array is the single source of the set. */
export const WORKSPACE_COLORS = [
  'default', 'blue', 'green', 'amber', 'red', 'fuchsia', 'deepseek',
] as const satisfies readonly WorkspaceColor[]

/** One stored tint. */
export const workspaceColorRecord = z.enum(WORKSPACE_COLORS)

/**
 * The folder-tint domain: one `colors` table keyed by Workspace id. An absent
 * row means `default`, so the table holds only the workspaces a user tinted.
 */
export const workspaceColorDomainSpec = defineDomain({
  name: 'workspace_color',
  version: 1,
  tables: { colors: domainTable<string, WorkspaceColor>(workspaceColorRecord) },
})
