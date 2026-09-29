/**
 * The plugin's apply against a real client root: it fills ui-workspace's
 * Workspace header menu list and hands the tint map to the store ui-workspace
 * repaints its rows from.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceColor } from '@deepseek-ai/dsh-host-workspace-color'
import { apply, inject } from '../src/client/index.ts'
import type { FolderColorInjected } from '../src/client/contract/slots.ts'

const ROW_MENU = 'sidebar.workspaces.row.menu.item'
const RED = 'var(--dsw-alias-workspace-tint-red)'

/** Boot a client root carrying only the services this plugin declares. */
async function bench(stored: Readonly<Record<string, WorkspaceColor>> = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))

  const set = vi.fn(async (input: { workspaceId: string; color: WorkspaceColor }) => ({
    ok: true as const,
    value: { workspaceId: input.workspaceId, color: input.color },
  }))
  const all = vi.fn(async () => ({ ok: true as const, value: { colors: stored } }))
  const workspaceColor = { set, all }
  Object.assign(new TestRemote(ctx), { workspaceColor })
  ctx.provide('remote.workspaceColor', workspaceColor as never)

  // ui-workspace's shares: the list this plugin fills and the store it writes.
  const tints = createSnapshotStore<Readonly<Record<string, string>>>({})
  ctx.provide('workspaceRowTints', { set: (next: Readonly<Record<string, string>>) => { tints.set(next) } })
  const slots = ctx.get('slots') as SlotRegistry
  slots.register(
    { name: 'root', children: { [ROW_MENU]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )

  await ctx.plugin({ inject: [...inject], apply }).await()
  return { ctx, slots, set, all, tints }
}

/** The plugin's one entry in the Workspace header menu list. */
function entryOf(slots: SlotRegistry): StoredEntry {
  const found = slots.entries(ROW_MENU).find(candidate => candidate.options.id === 'workspace-color')
  if (found === undefined) throw new Error('the folder-tint entry was not registered')
  return found
}

/** That entry's injected face; the plugin's factory ignores the positional store actions. */
function faceOf(entry: StoredEntry): object {
  if (entry.inject === undefined) throw new Error('the folder-tint entry declares no inject face')
  return entry.inject()
}

describe('ui-workspace-color apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.workspaceColor'])
  })

  it('registers exactly one folder-tint entry into the Workspace header menu', async () => {
    const b = await bench()
    expect(b.slots.entries(ROW_MENU).map(entry => entry.options.id)).toEqual(['workspace-color'])
  })

  it('hands the stored tints to ui-workspace as CSS colors', async () => {
    const b = await bench({ w1: 'red', w2: 'indigo' })
    await vi.waitFor(() => {
      expect(b.tints.getSnapshot()).toEqual({ w1: RED, w2: 'var(--dsw-alias-workspace-tint-indigo)' })
    })
  })

  it('writes a picked tint through the Remote and republishes it', async () => {
    const b = await bench({ w1: 'red' })
    await vi.waitFor(() => { expect(b.tints.getSnapshot()).toEqual({ w1: RED }) })

    const face = faceOf(entryOf(b.slots)) as FolderColorInjected
    await face.setColor('w2' as never, 'teal')

    expect(b.set).toHaveBeenCalledWith({ workspaceId: 'w2', color: 'teal' })
    expect(b.tints.getSnapshot()).toEqual({ w1: RED, w2: 'var(--dsw-alias-workspace-tint-teal)' })
  })

  it('drops a tint when the pick is default', async () => {
    const b = await bench({ w1: 'red' })
    await vi.waitFor(() => { expect(b.tints.getSnapshot()).toEqual({ w1: RED }) })

    const face = faceOf(entryOf(b.slots)) as FolderColorInjected
    await face.setColor('w1' as never, 'default')

    expect(b.tints.getSnapshot()).toEqual({})
  })
})
