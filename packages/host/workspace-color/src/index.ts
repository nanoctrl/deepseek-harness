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
import { isWorkspaceColor, workspaceColorDomainSpec } from './spec.ts'
import type {
  SetWorkspaceColorInput, SetWorkspaceColorResult, WorkspaceColor, WorkspaceColorMap,
} from './types.ts'

export type * from './types.ts'
export { WORKSPACE_COLORS, isWorkspaceColor } from './spec.ts'

/** Remote-only gateway exposing the durable per-workspace folder tint. */
export default class WorkspaceColorGateway extends TypertRemoteService {
  static inject = ['storageDomain']

  private table?: Promise<KvTable<string, string>>

  constructor(ctx: Context) {
    super(ctx, 'workspaceColor')
  }

  /**
   * Read every tint this build still knows.
   * @returns tints by Workspace id; untinted and obsolete rows are absent.
   */
  @Remote('all')
  async all(): Promise<WorkspaceColorMap> {
    const colors: Record<string, WorkspaceColor> = {}
    for (const [workspaceId, stored] of (await this.requireTable()).entries()) {
      // A tint a later build dropped stays in the medium untouched and is
      // simply not reported: changing the palette must not lose color choices.
      if (isWorkspaceColor(stored)) colors[workspaceId] = stored
    }
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
    // The wire carries a bare string: the declared member set is what a
    // typed caller sends, not what an untyped one may.
    if (!isWorkspaceColor(color)) {
      throw new TypeError(`workspaceColor.set received an unknown color '${String(color)}'`)
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
  private requireTable(): Promise<KvTable<string, string>> {
    this.table ??= this.openTable()
    return this.table
  }

  private async openTable(): Promise<KvTable<string, string>> {
    const domain = await this.ctx.storageDomain.open(workspaceColorDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'workspaceColor.domainClose')
    return domain.table('colors')
  }
}
