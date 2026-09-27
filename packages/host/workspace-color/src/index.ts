/**
 * Per-workspace folder tint.
 *
 * Keeps one tint per Workspace id in its own storage domain and serves it over
 * the `workspaceColor` Remote, so a chosen folder color survives a GUI reload
 * without adding a field to the Workspace record. An absent row is `default`:
 * the table stores only workspaces a user actually tinted.
 * @module @deepseek-ai/dsh-host-workspace-color
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import { WORKSPACE_COLORS, workspaceColorDomainSpec } from './spec.ts'
import type {
  SetWorkspaceColorInput, SetWorkspaceColorResult, WorkspaceColor, WorkspaceColorMap,
} from './types.ts'

export type * from './types.ts'

/** Remote-only gateway exposing the durable per-workspace folder tint. */
export default class WorkspaceColorGateway extends TypertRemoteService {
  static inject = ['storageDomain']

  private table?: Promise<KvTable<string, WorkspaceColor>>

  constructor(ctx: Context) {
    super(ctx, 'workspaceColor')
  }

  /**
   * Read every stored tint.
   * @returns tints by Workspace id; untinted workspaces are absent.
   */
  @Remote('all')
  async all(): Promise<WorkspaceColorMap> {
    const colors: Record<string, WorkspaceColor> = {}
    for (const [workspaceId, color] of (await this.requireTable()).entries()) colors[workspaceId] = color
    return { colors }
  }

  /**
   * Store one tint. `default` removes the row rather than storing it, so a
   * reset Workspace costs no durable state.
   * @param input - Workspace identity and tint to store.
   * @returns the applied tint.
   */
  @Remote('set')
  async set(input: SetWorkspaceColorInput): Promise<SetWorkspaceColorResult> {
    const { workspaceId, color } = input
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      throw new TypeError('workspaceColor.set requires a non-empty workspaceId')
    }
    if (!WORKSPACE_COLORS.includes(color)) {
      throw new TypeError(`workspaceColor.set received an unknown color '${color}'`)
    }
    const table = await this.requireTable()
    if (color === 'default') await table.delete(workspaceId)
    else await table.put(workspaceId, color)
    return { workspaceId, color }
  }

  /**
   * Open the tint domain once; concurrent first calls share the same open.
   * @returns the tint table.
   */
  private requireTable(): Promise<KvTable<string, WorkspaceColor>> {
    this.table ??= this.openTable()
    return this.table
  }

  private async openTable(): Promise<KvTable<string, WorkspaceColor>> {
    const domain = await this.ctx.storageDomain.open(workspaceColorDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'workspaceColor.domainClose')
    return domain.table('colors')
  }
}
