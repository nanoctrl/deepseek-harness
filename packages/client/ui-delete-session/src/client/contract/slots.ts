/**
 * Session-row delete slot contract: the registrant-private injected share for
 * the `sidebar.workspaces.sessionAction` hole declared by ui-workspace. The
 * owner share (sessionId, title, onClose) arrives through
 * PropsRuntime<'sidebar.workspaces.sessionAction'>.
 */
// Type-only: pulls ui-workspace's SlotMap merge (the sessionAction entry) into
// this program so PropsRuntime<'sidebar.workspaces.sessionAction'> resolves.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'

/** Registrant-private share injected into the delete-session row component. */
export interface SessionActionInjected {
  /** Permanently delete one session on the host (refuses live sessions). */
  delete(sessionId: string): Promise<void>
}
