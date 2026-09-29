/** Registers the workspace row menu's folder-tint rows and publishes the tint map. */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the api-remotes Context merge (ctx.remote and the
// workspaceColor namespace contributed by the host workspace-color Remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls ui-workspace's SlotMap merge (the row menu list).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { WorkspaceColor } from '@deepseek-ai/dsh-host-workspace-color'
import { FolderColorMenu } from './FolderColorMenu.tsx'
import type { FolderColorInjected } from './contract/slots.ts'
import { TINT_TOKEN } from './colors.ts'
import { en, zh, type WorkspaceColorKey } from './locales.ts'

export type { FolderColorInjected } from './contract/slots.ts'
export type { WorkspaceColorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Workspace folder-tint menu copy. */
    workspaceColor: WorkspaceColorKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workspaceColor'

/**
 * The store ui-workspace repaints its Workspace rows from, reached as the
 * `workspaceRowTints` service it registers. It takes the CSS color each row
 * paints, keyed by Workspace id, so the dependency runs one way: this plugin
 * knows ui-workspace's contract, never the reverse.
 */
interface RowTintSink {
  /**
   * Replace the whole tint map.
   * @param next - CSS color per Workspace id.
   */
  set(next: Readonly<Record<string, string>>): void
}

/** Services required by the workspace-color plugin. */
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceColor']

/**
 * Map stored tints to the CSS colors the rows paint. The label is the value
 * the Host stores; the token is what a folder consumes.
 * @param colors - stored tint per Workspace id.
 * @returns the CSS color each Workspace row paints.
 */
function toCss(colors: Readonly<Record<string, WorkspaceColor>>): Readonly<Record<string, string>> {
  const next: Record<string, string> = {}
  for (const [workspaceId, color] of Object.entries(colors)) {
    const token = TINT_TOKEN[color]
    if (token !== undefined) next[workspaceId] = token
  }
  return next
}

/**
 * Publish the tint map and register the folder-tint rows.
 * @param ctx - Client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace-color: dictionaries')

  const tints = createSnapshotStore<Readonly<Record<string, WorkspaceColor>>>({})

  /** Hand the whole map to ui-workspace's store; a composition without it still writes rows. */
  const publish = (next: Readonly<Record<string, WorkspaceColor>>): void => {
    tints.set(next)
    const sink = ctx.get('workspaceRowTints') as RowTintSink | undefined
    sink?.set(toCss(next))
  }

  // Read once at apply: the rows need their tints on their first render, and
  // the composition's Remote answers this endpoint as a boot-time response.
  void ctx.remote.workspaceColor.all().then((result) => {
    if (result.ok) publish(result.value.colors)
  })

  const injectFace = (): FolderColorInjected => ({
    setColor: async (workspaceId, color) => {
      const result = await ctx.remote.workspaceColor.set({ workspaceId, color })
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      const next: Record<string, WorkspaceColor> = {}
      for (const [id, tint] of Object.entries(tints.getSnapshot())) {
        if (id !== workspaceId) next[id] = tint
      }
      if (color !== 'default') next[workspaceId] = color
      publish(next)
    },
  })

  ctx.slots.inject('sidebar.workspaces.row.menu.item', () => ctx.slots.register({
    name: 'sidebar.workspaces.row.menu.item',
    id: 'workspace-color',
    locale: NS,
    inject: injectFace,
  }, FolderColorMenu))
}
