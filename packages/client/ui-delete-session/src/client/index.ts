/** Registers the session-row delete action into ui-workspace's `sidebar.workspaces.sessionAction` hole. */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the api-remotes Context merge (ctx.remote and the
// deleteSession namespace contributed by the host delete-session Remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls ui-workspace's SlotMap merge (the sessionAction entry).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionActionInjected } from './contract/slots.ts'
import { DeleteSessionItem } from './DeleteSessionItem.tsx'
import { zh, en, type DeleteSessionKey } from './locales.ts'

export type { SessionActionInjected } from './contract/slots.ts'
export type { DeleteSessionKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Session delete action copy. */
    deleteSession: DeleteSessionKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'deleteSession'

/** Services required by the delete-session plugin. */
export const inject = ['slots', 'locale', 'remote', 'remote.deleteSession']

/**
 * Register the delete row once ui-workspace's `sidebar.workspaces.sessionAction`
 * declaration is live.
 * @param ctx - Client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-delete-session: dictionaries')

  const injectFace = (): SessionActionInjected => ({
    delete: async (sessionId) => {
      const result = await ctx.remote.deleteSession.delete({ sessionId })
      if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`)
      }
    },
  })

  ctx.slots.inject('sidebar.workspaces.sessionAction', () => ctx.slots.register({
    name: 'sidebar.workspaces.sessionAction',
    id: 'delete-session',
    locale: NS,
    inject: injectFace,
  }, DeleteSessionItem))
}
