import { describe, expect, it, vi } from 'vitest'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InputState, SessionInput, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { insertAtCaret } from '../src/client/composer-insert.ts'

/** Estado de entrada mínimo: sólo lo que lee la inserción. */
function state(draft: string, draftRev: number): InputState {
  return {
    draft, draftRev, attachmentIds: [], phase: 'plain', occurrences: [], queue: [],
  } as unknown as InputState
}

/**
 * Fachada falsa que se comporta como el editor: rechaza la edición cuando la
 * revisión del span ya no es la vigente, y avisa cuántas veces se intentó.
 */
function facade(draft: string, caret: { start: number; end: number }, options: { stale?: number } = {}) {
  let rev = 1
  let current = draft
  let stale = options.stale ?? 0
  const applied: string[] = []
  const insertText = vi.fn((text: string, span: TokenSpan): boolean => {
    if (stale > 0) { stale -= 1; return false }
    if (span.draftRev !== rev) return false
    current = current.slice(0, span.start) + text + current.slice(span.end)
    rev += 1
    applied.push(current)
    return true
  })
  const input = {
    state: { getSnapshot: () => state(current, rev) } as unknown as SnapshotStore<InputState>,
    caretSpan: () => caret,
    insertText,
  } as unknown as SessionInput
  return { input, insertText, applied, draft: () => current }
}

describe('insertAtCaret', () => {
  it('inserta en el cursor y no reemplaza el resto', () => {
    // "Hola mundo" con el cursor tras "Hola" (offset 4).
    const f = facade('Hola mundo', { start: 4, end: 4 })
    expect(insertAtCaret(f.input, 'che')).toBe(true)
    expect(f.draft()).toBe('Hola che mundo')
  })

  it('agrega un separador cuando el cursor queda pegado a una palabra', () => {
    const f = facade('Hola', { start: 4, end: 4 })
    insertAtCaret(f.input, 'che')
    expect(f.draft()).toBe('Hola che')
  })

  it('no agrega separador si ya hay un espacio antes del cursor', () => {
    const f = facade('Hola ', { start: 5, end: 5 })
    insertAtCaret(f.input, 'che')
    expect(f.draft()).toBe('Hola che')
  })

  it('no agrega separador al insertar al principio', () => {
    const f = facade('mundo', { start: 0, end: 0 })
    insertAtCaret(f.input, 'Hola')
    expect(f.draft()).toBe('Holamundo')
  })

  it('reemplaza sólo la selección cuando hay una', () => {
    const f = facade('Hola mundo feo', { start: 11, end: 14 })
    insertAtCaret(f.input, 'lindo')
    expect(f.draft()).toBe('Hola mundo lindo')
  })

  it('nunca descarta lo que ya estaba escrito', () => {
    const original = 'texto que el usuario ya había escrito en el chatbox'
    const f = facade(original, { start: original.length, end: original.length })
    insertAtCaret(f.input, 'y esto lo dictó')
    expect(f.draft()).toBe(`${original} y esto lo dictó`)
    expect(f.draft().startsWith(original)).toBe(true)
  })

  it('reintenta cuando el editor rechaza por una edición concurrente', () => {
    const f = facade('Hola', { start: 4, end: 4 }, { stale: 1 })
    expect(insertAtCaret(f.input, 'che')).toBe(true)
    expect(f.insertText).toHaveBeenCalledTimes(2)
    expect(f.draft()).toBe('Hola che')
  })

  it('se rinde y avisa cuando no logra aplicarlo', () => {
    const f = facade('Hola', { start: 4, end: 4 }, { stale: 5 })
    expect(insertAtCaret(f.input, 'che')).toBe(false)
    expect(f.draft()).toBe('Hola')
  })
})
