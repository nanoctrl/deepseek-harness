/** Registers the instance-monitor panel into the sidebar's `sidebar.monitor` hole. */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the api-remotes Context merge (ctx.remote and the
// instanceMonitor namespace contributed by the host instance-monitor Remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.monitor' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {
  InstanceAction,
  InstanceActionResult,
  InstanceMonitorSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InstanceMonitorInjected } from './contract/slots.ts'
import { InstanceMonitorPanel } from './InstanceMonitorPanel.tsx'
import { en, zh, type InstanceMonitorKey } from './locales.ts'

export type { InstanceMonitorInjected } from './contract/slots.ts'
export type { InstanceMonitorKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Instance monitor panel copy. */
    instanceMonitor: InstanceMonitorKey
  }
}

/** Dictionary namespace owned by this plugin (the monitor panel copy). */
const NS = 'instanceMonitor'

/** Services required by the instance-monitor plugin. */
export const inject = ['slots', 'locale', 'remote', 'remote.instanceMonitor']

/**
 * Register the panel once ui-sidebar's `sidebar.monitor` declaration is live.
 * @param ctx - Client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-instance-monitor: dictionaries')

  const injectFace = (): InstanceMonitorInjected => ({
    load: async (): Promise<InstanceMonitorSnapshot> => {
      const result = await ctx.remote.instanceMonitor.list()
      if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
    act: async (payload: InstanceAction): Promise<InstanceActionResult> => {
      const result = await ctx.remote.instanceMonitor.action(payload)
      if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`)
      }
      return result.value
    },
  })

  ctx.slots.inject('sidebar.monitor', () => ctx.slots.register({
    name: 'sidebar.monitor',
    locale: NS,
    inject: injectFace,
  }, InstanceMonitorPanel))
}
