/**
 * Permanent session deletion gateway.
 *
 * Deletes a session that is neither live nor selected: removes its workspace
 * registry accounting (session account + archive set), drops its projection
 * cache row, and removes its persisted artifacts (log directory, checkpoints)
 * from disk. Live sessions are refused — deleting a running session's log
 * would corrupt it — so the operator archives and closes a session first.
 * @module @deepseek-ai/dsh-host-delete-session
 */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionProjectionCache } from '@deepseek-ai/dsh-session-projection-cache'
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import type { DeleteSessionInput, DeleteSessionResult } from './types.ts'

export type * from './types.ts'

/** The session is live and cannot be deleted without corrupting its log. */
export class DeleteSessionLiveError extends Error {
  constructor(readonly sessionId: string) {
    super(
      `cannot delete session '${sessionId}': the session is live — archive it and close it first`,
    )
    this.name = 'DeleteSessionLiveError'
  }
}

/** No such session exists (live or persisted). */
export class DeleteSessionUnknownError extends Error {
  constructor(readonly sessionId: string) {
    super(`cannot delete session '${sessionId}': no such session`)
    this.name = 'DeleteSessionUnknownError'
  }
}

/** Remote-only gateway exposing permanent session deletion. */
export class DeleteSessionGateway extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'deleteSession')
  }

  /**
   * Permanently delete one session. Refuses live sessions; unknown sessions
   * fail. On success the session is gone from the registry, the projection
   * cache, and the persistence medium.
   */
  @Remote('delete')
  async delete(payload: DeleteSessionInput): Promise<DeleteSessionResult> {
    const { sessionId } = payload
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new TypeError('deleteSession.delete requires a non-empty sessionId')
    }
    const id = sessionId as SessionId

    // 1. Refuse live sessions: the harness writes their logs; deleting under
    //    it would corrupt the running session and its open handles.
    const sessions = this.ctx.get('sessions') as { get(id: SessionId): unknown } | undefined
    if (sessions?.get(id) !== undefined) throw new DeleteSessionLiveError(sessionId)

    // 2. Ground truth: the session must exist in persistence.
    const persistence = this.ctx.get('sessionPersistence') as SessionPersistence | undefined
    if (persistence === undefined) {
      throw new Error('session persistence is unavailable')
    }
    const known = (await persistence.list()).some(header => header.id === id)
    if (!known) throw new DeleteSessionUnknownError(sessionId)

    // 3. Forget registry accounting first (workspace accounts + archive set).
    const registry = this.ctx.get('workspaceRegistry') as WorkspaceRegistry | undefined
    if (registry !== undefined) await registry.removeSession(id)

    // 4. Drop cached projections (fail-soft: a stale row is harmless and
    //    self-heals; removal must not abort the deletion).
    const cache = this.ctx.get('sessionProjectionCache') as SessionProjectionCache | undefined
    cache?.remove(id)

    // 5. Remove persisted artifacts last: after registry accounting is gone,
    //    a partial failure leaves at worst an ungrouped orphan log that the
    //    operator can delete again — never a registered-but-missing session.
    await persistence.remove(id)

    return { deleted: true, detail: '' }
  }
}

export default DeleteSessionGateway
