/** Injected writer the folder-tint rows receive from their own apply. */
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { WorkspaceColor } from '@deepseek-ai/dsh-host-workspace-color'

/** Persists one tint for the row's Workspace. */
export interface FolderColorInjected {
  /**
   * Store one tint; `default` clears the stored row.
   * @param workspaceId - the Workspace to tint.
   * @param color - the tint to store.
   */
  setColor: (workspaceId: WorkspaceId, color: WorkspaceColor) => Promise<void>
}
