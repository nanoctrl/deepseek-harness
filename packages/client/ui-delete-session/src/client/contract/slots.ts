/**
 * Session-row delete contract: the registrant-private injected share for one
 * `sidebar.workspaces.session.menu.item` row declared by ui-workspace. The
 * owner share (sessionId, displayTitle, useMenuOpenState) arrives through
 * PropsRuntime<'sidebar.workspaces.session.menu.item'>.
 */
// Type-only: pulls ui-workspace's SlotMap merge (the session menu entry) into
// this program so PropsRuntime<'sidebar.workspaces.session.menu.item'> resolves.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'

/** Registrant-private share injected into the delete-session row component. */
export interface SessionActionInjected {
  /** Permanently delete one session on the host (refuses live sessions). */
  deleteSession(sessionId: string): Promise<void>
}
