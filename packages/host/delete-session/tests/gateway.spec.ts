/**
 * End-to-end gateway integration: the deleteSession Remote against real
 * services — durable JSONL persistence on a real temp root, the real
 * workspace registry, and a sessions stub for the live-session guard.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { SessionId } from '@deepseek-ai/dsh-session'
import DeleteSessionGateway, { DeleteSessionLiveError, DeleteSessionUnknownError } from '../src/index.ts'

const tempRoots: string[] = []

async function makeTempRoot(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `dsh-delete-${name}-`))
  tempRoots.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of tempRoots.splice(0)) await rm(dir, { recursive: true, force: true })
})

/** Boot the real storage/domain/jsonl composition with a sessions stub. */
async function harness(sessionRoot: string) {
  const pool = new MemoryMediaPool()
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)

  // Sessions stub: the gateway (and registry) probe liveness via get(id);
  // the persistence coordinator seeds write-path state from list(), and the
  // registry's live index maps list() entries through `.header`.
  const live = new Map<string, { header: unknown }>()
  ctx.provide('sessions', {
    get: (id: SessionId) => live.get(String(id)),
    list: () => [...live.values()],
  } as never)

  await ctx.plugin(JsonlSessionPersistence, { root: sessionRoot, compression: 'none' })
  return { ctx, pool, live }
}

describe('DeleteSessionGateway integration', () => {
  it('deletes an accounted session end to end: registry, list, and the log directory on disk', async () => {
    const sessionRoot = await makeTempRoot('sessions')
    const cwd = await makeTempRoot('cwd')
    const h = await harness(sessionRoot)
    const id = 'e2e-s1'

    // Materialize the session BEFORE the registry bootstraps so it is
    // accounted into a workspace for its cwd. One event makes it listable
    // (list() excludes zero-event sessions).
    await h.ctx.sessionPersistence.create({ version: 0, id: id as SessionId, createdAt: Date.now(), cwd })
    await h.ctx.sessionPersistence.append(id as SessionId, [
      { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    ] as never)
    await h.ctx.plugin(WorkspaceRegistry)
    const registry = h.ctx.workspaceRegistry
    const gateway = new DeleteSessionGateway(h.ctx)
    expect(registry.list()[0]!.sessionIds).toContain(id)

    const result = await gateway.delete({ sessionId: id })
    expect(result.deleted).toBe(true)

    // Gone from persistence and from registry accounting.
    expect((await h.ctx.sessionPersistence.list()).map(header => header.id)).not.toContain(id)
    expect(registry.list()[0]!.sessionIds).not.toContain(id)
    // Gone from disk: the log directory and the emptied project directory.
    expect(await readdir(sessionRoot)).toEqual([])
  })

  it('refuses live sessions with DeleteSessionLiveError before touching anything', async () => {
    const sessionRoot = await makeTempRoot('live')
    const cwd = await makeTempRoot('cwd-live')
    const h = await harness(sessionRoot)
    const id = 'e2e-live'
    await h.ctx.sessionPersistence.create({ version: 0, id: id as SessionId, createdAt: Date.now(), cwd })
    await h.ctx.sessionPersistence.append(id as SessionId, [
      { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } },
    ] as never)
    h.live.set(id, { header: { version: 0, id: id as SessionId, createdAt: Date.now(), cwd } })
    await h.ctx.plugin(WorkspaceRegistry)
    const gateway = new DeleteSessionGateway(h.ctx)

    await expect(gateway.delete({ sessionId: id })).rejects.toThrow(DeleteSessionLiveError)
    // Nothing was removed from disk (the log directory still exists).
    expect(await readdir(sessionRoot)).not.toEqual([])
  })

  it('rejects unknown sessions with DeleteSessionUnknownError', async () => {
    const sessionRoot = await makeTempRoot('ghost')
    const h = await harness(sessionRoot)
    await h.ctx.plugin(WorkspaceRegistry)
    const gateway = new DeleteSessionGateway(h.ctx)

    await expect(gateway.delete({ sessionId: 'e2e-ghost' })).rejects.toThrow(DeleteSessionUnknownError)
  })
})
