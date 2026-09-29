/**
 * The plugin's apply against a real client root: it fills ui-workspace's
 * Workspace header menu list, publishes the tint map the sidebar reads, and
 * its injected writer reaches the workspaceColor Remote.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import { apply, inject, type WorkspaceColorTints } from '../src/client/index.ts'
import type { FolderColorInjected } from '../src/client/contract/slots.ts'

const ROW_MENU = 'sidebar.workspaces.row.menu.item'

/** Boot a client root carrying only the services this plugin declares. */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))

  const set = vi.fn(async (input: { workspaceId: string; color: string }) => ({
    ok: true as const,
    value: { workspaceId: input.workspaceId, color: input.color },
  }))
  const all = vi.fn(async () => ({ ok: true as const, value: { colors: {} } }))
  const workspaceColor = { set, all }
  Object.assign(new TestRemote(ctx), { workspaceColor })
  ctx.provide('remote.workspaceColor', workspaceColor as never)

  // ui-workspace declares the Workspace header menu list this plugin fills.
  const slots = ctx.get('slots') as SlotRegistry
  slots.register(
    { name: 'root', children: { [ROW_MENU]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )

  await ctx.plugin({ inject: [...inject], apply }).await()
  return { ctx, slots, set, all }
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

const tintsOf = (ctx: Context): WorkspaceColorTints => ctx.get('workspaceColorTints') as WorkspaceColorTints

describe('ui-workspace-color apply', () => {
  it('declares the services it drives', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.workspaceColor'])
  })

  it('registers exactly one folder-tint entry into the Workspace header menu', async () => {
    const b = await bench()
    expect(b.slots.entries(ROW_MENU).map(entry => entry.options.id)).toEqual(['workspace-color'])
  })

  it('publishes an empty tint map before anything is read', async () => {
    const b = await bench()
    expect(tintsOf(b.ctx).snapshot()).toEqual({})
    // Adding the plugin puts nothing on the wire by itself.
    expect(b.all).not.toHaveBeenCalled()
  })

  it('writes a picked tint through the Remote and republishes the map', async () => {
    const b = await bench()
    const face = faceOf(entryOf(b.slots)) as FolderColorInjected
    await face.setColor('w1' as never, 'red')

    expect(b.set).toHaveBeenCalledWith({ workspaceId: 'w1', color: 'red' })
    expect(tintsOf(b.ctx).snapshot()).toEqual({ w1: 'red' })
  })

  it('clears the published tint when the pick is default', async () => {
    const b = await bench()
    const face = faceOf(entryOf(b.slots)) as FolderColorInjected
    await face.setColor('w1' as never, 'red')
    await face.setColor('w1' as never, 'default')

    expect(tintsOf(b.ctx).snapshot()).toEqual({})
  })

  it('asks the Host for the stored tints on the first subscription', async () => {
    const b = await bench()
    tintsOf(b.ctx).subscribe(() => {})
    await vi.waitFor(() => { expect(b.all).toHaveBeenCalledOnce() })
  })
})
