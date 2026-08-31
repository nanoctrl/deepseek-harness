/**
 * Sidebar monitor slot contract: the registrant-private injected share for
 * the `sidebar.monitor` hole declared by ui-sidebar. The owner share (`wide`,
 * `expandSidebar`) arrives through PropsRuntime<'sidebar.monitor'>.
 */
// Type-only: pulls ui-sidebar's SlotMap merge (the 'sidebar.monitor' entry)
// into this program so PropsRuntime<'sidebar.monitor'> resolves.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {
  InstanceAction,
  InstanceActionResult,
  InstanceMonitorSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'

/** Registrant-private share injected into the monitor panel component. */
export interface InstanceMonitorInjected {
  /** Fetch the latest snapshot from the host instance monitor. */
  load(): Promise<InstanceMonitorSnapshot>
  /** Run one stop/restart action against a discovered instance. */
  act(payload: InstanceAction): Promise<InstanceActionResult>
}
