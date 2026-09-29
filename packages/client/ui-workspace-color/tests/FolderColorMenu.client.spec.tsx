// @vitest-environment jsdom
/**
 * FolderColorMenu: the tint rows a Workspace header menu shows, the row that
 * reads as the applied tint, and the one write each selection makes.
 */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { en as commonEn } from '@deepseek-ai/dsh-client-locale/src/locales/en.ts'
import type { WorkspaceColor } from '@deepseek-ai/dsh-host-workspace-color'
import { FolderColorMenu, type FolderColorMenuProps } from '../src/client/FolderColorMenu.tsx'
import { TINT_TOKEN } from '../src/client/colors.ts'
// Type-only: pulls this plugin's LocaleNamespaceMap entry, which types the seat.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t: FolderColorMenuProps['t'] = makeTranslate(en, commonEn)
const wid = (id: string) => id as WorkspaceId

/** Selector hook over a fixed snapshot (the renderer builds these at the binding site). */
function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

// The framework seats every root-scope slot receives; these rows read none of them.
const seats: GlobalStandardProps = {
  useSessions: hook({ ids: [], byId: {}, phase: 'ready', projectionsBySession: {} }),
  useWorkspaces: hook({
    items: [], archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  }),
  useSessionStatus: hook(new Map()),
  useSessionRetainInfo: () => undefined,
  usePanelInfo: hook({ activePanelId: null }),
  useResource: () => ({ status: 'none', value: undefined, failure: undefined, reload: () => {} }),
}

/**
 * Render the rows with the owner share the browser hands the entry. The owner
 * carries the tint as the CSS color the row paints, so the fixture converts.
 */
function mount(current: WorkspaceColor | undefined): ReturnType<typeof vi.fn> {
  const setColor = vi.fn(async () => {})
  const props: FolderColorMenuProps = {
    ...seats,
    workspaceId: wid('w1'),
    title: 'Project',
    color: current === undefined ? undefined : TINT_TOKEN[current],
    setColor,
    t,
  }
  render(<FolderColorMenu {...props} />)
  return setColor
}

const labels = (): Array<string | null> => screen.getAllByRole('menuitem').map(row => row.textContent)

describe('FolderColorMenu', () => {
  it('lists every tint with the reset last', () => {
    mount('blue')
    expect(labels()).toEqual([
      'Red', 'Pink', 'Purple', 'Indigo',
      'Blue', 'Cyan', 'Teal',
      'Green', 'Lime',
      'Yellow', 'Orange', 'Deep Orange',
      'Brown', 'Blue Grey',
      'Default',
    ])
  })

  it('rings only the tint the workspace already carries', () => {
    mount('green')
    const marked = screen.getAllByRole('menuitem')
      .filter(row => row.querySelector('[class*="swatchCurrent"]') !== null)
    expect(marked.map(row => row.textContent)).toEqual(['Green'])
  })

  it('sets the applied tint name in bold, and only that one', () => {
    mount('green')
    const bold = screen.getAllByRole('menuitem')
      .filter(row => row.querySelector('[class*="labelCurrent"]') !== null)
    expect(bold.map(row => row.textContent)).toEqual(['Green'])
  })

  it('marks Default while the workspace carries no tint', () => {
    mount(undefined)
    const marked = screen.getAllByRole('menuitem')
      .filter(row => row.querySelector('[class*="swatchCurrent"]') !== null)
    expect(marked.map(row => row.textContent)).toEqual(['Default'])
  })

  it('writes the picked tint for this workspace', () => {
    const setColor = mount('blue')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cyan' }))
    expect(setColor).toHaveBeenCalledWith('w1', 'cyan')
  })

  it('writes the reset as default', () => {
    const setColor = mount('blue')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Default' }))
    expect(setColor).toHaveBeenCalledWith('w1', 'default')
  })
})
