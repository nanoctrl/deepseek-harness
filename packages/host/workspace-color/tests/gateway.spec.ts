/**
 * workspaceColor Remote over the real storage-domain facility on a memory
 * backend: the durable row is what a later reader gets back.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import WorkspaceColorGateway from '../src/index.ts'

/**
 * Boot the storage/domain composition the gateway opens its tint domain
 * through. Reusing a pool models a restart: the medium outlives the process.
 */
async function harness(pool: MemoryMediaPool = new MemoryMediaPool()) {
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  return { ctx, pool, gateway: new WorkspaceColorGateway(ctx) }
}

describe('WorkspaceColorGateway', () => {
  it('starts empty: no Workspace has a tint until one is chosen', async () => {
    const h = await harness()
    expect(await h.gateway.all()).toEqual({ colors: {} })
  })

  it('stores each tint as its own durable row', async () => {
    const h = await harness()
    await h.gateway.set({ workspaceId: 'w1', color: 'red' })
    await h.gateway.set({ workspaceId: 'w2', color: 'purple' })

    expect(await h.gateway.all()).toEqual({ colors: { w1: 'red', w2: 'purple' } })
    // Durability, not caching: the rows are what the medium holds.
    expect(h.pool.media.get('workspace_color')?.tables.get('colors')?.get('w1')).toBe('red')
    expect(h.pool.media.get('workspace_color')?.tables.get('colors')?.get('w2')).toBe('purple')
  })

  it('survives a restart: a fresh composition reads what the previous one wrote', async () => {
    const pool = new MemoryMediaPool()
    const first = await harness(pool)
    await first.gateway.set({ workspaceId: 'w1', color: 'teal' })
    await first.gateway.set({ workspaceId: 'w2', color: 'brown' })
    await first.ctx.fiber.dispose()

    const restarted = await harness(pool)
    expect(await restarted.gateway.all()).toEqual({ colors: { w1: 'teal', w2: 'brown' } })
  })

  it('ignores a tint this build no longer knows instead of failing the domain', async () => {
    const h = await harness()
    await h.gateway.set({ workspaceId: 'w1', color: 'teal' })
    // A tint a previous palette wrote: the schema stores bare strings, so the
    // row stays readable and only the reader decides what it knows.
    h.pool.media.get('workspace_color')?.tables.get('colors')?.set('w2', 'fuchsia')

    expect(await h.gateway.all()).toEqual({ colors: { w1: 'teal' } })
    // The obsolete row does not block further writes.
    await h.gateway.set({ workspaceId: 'w3', color: 'indigo' })
    expect(await h.gateway.all()).toEqual({ colors: { w1: 'teal', w3: 'indigo' } })
  })

  it('clears the row when the tint returns to default', async () => {
    const h = await harness()
    await h.gateway.set({ workspaceId: 'w1', color: 'green' })
    expect(await h.gateway.set({ workspaceId: 'w1', color: 'default' }))
      .toEqual({ workspaceId: 'w1', color: 'default' })
    expect(await h.gateway.all()).toEqual({ colors: {} })
  })

  it('rejects a color outside the closed set without writing', async () => {
    const h = await harness()
    await expect(h.gateway.set({ workspaceId: 'w1', color: 'chartreuse' as never }))
      .rejects.toThrow(/unknown color/)
    expect(await h.gateway.all()).toEqual({ colors: {} })
  })

  it('rejects a blank Workspace id without writing', async () => {
    const h = await harness()
    await expect(h.gateway.set({ workspaceId: '', color: 'blue' })).rejects.toThrow(/non-empty workspaceId/)
    expect(await h.gateway.all()).toEqual({ colors: {} })
  })
})
