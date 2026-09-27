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
import { FolderColorMenu } from './FolderColorMenu.tsx'
import type { FolderColorInjected } from './contract/slots.ts'
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
 * Folder tints published for the workspace row's folder glyph. ui-workspace
 * reads this service when the plugin is installed and falls back to an empty
 * map otherwise, so the edge runs one way: this plugin knows ui-workspace's
 * slot contract, never the reverse.
 */
export interface WorkspaceColorTints {
  /**
   * Current tint per Workspace id.
   * @returns tints by Workspace id; untinted workspaces are absent.
   */
  snapshot(): Readonly<Record<string, string>>
  /**
   * Observe tint changes.
   * @param listener - called after every published change.
   * @returns unsubscribe.
   */
  subscribe(listener: () => void): () => void
}

/** Services required by the workspace-color plugin. */
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceColor']

/**
 * Publish the tint map and register the folder-tint rows.
 * @param ctx - Client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace-color: dictionaries')

  const tints = createSnapshotStore<Readonly<Record<string, string>>>({})
  let loading: Promise<void> | undefined
  const loadOnce = (): Promise<void> => {
    loading ??= ctx.remote.workspaceColor.all().then((result) => {
      if (result.ok) tints.set(result.value.colors)
    })
    return loading
  }

  const tintService: WorkspaceColorTints = {
    snapshot: () => tints.getSnapshot(),
    subscribe: (listener) => {
      // The first reader is what asks the Host for the stored tints: adding the
      // plugin must not put a request on the wire by itself, and a composition
      // that never renders a Workspace row issues none.
      void loadOnce()
      return tints.subscribe(listener)
    },
  }
  ctx.effect(() => ctx.provide('workspaceColorTints', tintService), 'ui-workspace-color: tint service')

  const publish = (workspaceId: string, color: string | undefined): void => {
    const next: Record<string, string> = {}
    for (const [id, tint] of Object.entries(tints.getSnapshot())) {
      if (id !== workspaceId) next[id] = tint
    }
    if (color !== undefined) next[workspaceId] = color
    tints.set(next)
  }

  const injectFace = (): FolderColorInjected => ({
    setColor: async (workspaceId, color) => {
      const result = await ctx.remote.workspaceColor.set({ workspaceId, color })
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      publish(workspaceId, color === 'default' ? undefined : color)
    },
  })

  ctx.slots.inject('sidebar.workspaces.row.menu.item', () => ctx.slots.register({
    name: 'sidebar.workspaces.row.menu.item',
    id: 'workspace-color',
    locale: NS,
    inject: injectFace,
  }, FolderColorMenu))
}
