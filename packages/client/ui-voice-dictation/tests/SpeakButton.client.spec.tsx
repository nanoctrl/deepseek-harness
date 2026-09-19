// @vitest-environment jsdom
/**
 * SpeakButton: el control de lectura de un mensaje. Cubre que el botón alterna
 * pausa, que el chip de velocidad cicla y —lo que importa para la privacidad—
 * que detener es un control propio y visible, distinto de pausar.
 */
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ChatSnapshot, UseChat } from '@deepseek-ai/dsh-client-ui-chat/client'
import { SpeakButton } from '../src/client/SpeakButton.tsx'
import { zh } from '../src/client/locales.ts'
import type { SpeechView } from '../src/client/speech-controller.ts'

afterEach(cleanup)

const MSG = 'm-1' as MessageId
const t = makeTranslate(zh, commonZh)

/** Snapshot mínimo: un nodo de cola de turno con el cierre del mensaje. */
const SNAPSHOT = {
  order: ['k1'],
  nodes: {
    get: (key: string) => (key === 'k1'
      ? { kind: 'turn-tail', data: { closing: { finalNode: { messageId: MSG }, blocks: [{ kind: 'text', text: 'Hola mundo.' }] } } }
      : undefined),
  },
} as unknown as ChatSnapshot

/** Snapshot sin prosa: el control no debe aparecer. */
const EMPTY = {
  order: ['k1'],
  nodes: { get: () => ({ kind: 'turn-tail', data: { closing: { finalNode: { messageId: MSG }, blocks: [] } } }) },
} as unknown as ChatSnapshot

const IDLE: SpeechView = Object.freeze({
  phase: 'idle', messageId: null, rate: 1, segment: 0, total: 0, progress: 0, error: null,
})

/** Fuente observable mínima, con la misma identidad estable que exige el hook. */
function source(initial: SpeechView) {
  let value = initial
  const listeners = new Set<() => void>()
  const subscribe = (fn: () => void): (() => void) => {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }
  const use = (selector: (view: SpeechView) => unknown): unknown =>
    useSyncExternalStore(subscribe, () => selector(value))
  return {
    set(next: SpeechView) { value = next; for (const l of listeners) l() },
    use,
  }
}

/** Monta el control con verbos espiados y una vista dada. */
function mount(view: SpeechView, snapshot: ChatSnapshot = SNAPSHOT) {
  const store = source(view)
  const play = vi.fn()
  const cycleRate = vi.fn()
  const stop = vi.fn()
  const useChat = ((selector: (s: ChatSnapshot) => unknown) => selector(snapshot)) as unknown as UseChat
  const props = {
    messageId: MSG, useChat, useSpeech: store.use, play, cycleRate, stop, t,
  } as unknown as Parameters<typeof SpeakButton>[0]
  render(<SpeakButton {...props} />)
  return { play, cycleRate, stop, store }
}

describe('SpeakButton', () => {
  it('no dibuja nada cuando el mensaje no tiene prosa', () => {
    mount(IDLE, EMPTY)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('lee el mensaje al hacer clic', () => {
    const { play } = mount(IDLE)
    fireEvent.click(screen.getByRole('button', { name: t('speak.idle') }))
    expect(play).toHaveBeenCalledWith(MSG, 'Hola mundo.')
  })

  it('mientras suena ofrece pausa y detener por separado', () => {
    mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 2 })
    expect(screen.getByRole('button', { name: t('speak.playing') })).toBeDefined()
    expect(screen.getByRole('button', { name: t('speak.stop') })).toBeDefined()
  })

  it('detener llama a stop, no a play', () => {
    const { stop, play } = mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 2 })
    fireEvent.click(screen.getByRole('button', { name: t('speak.stop') }))
    expect(stop).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()
  })

  it('en pausa también deja detener', () => {
    const { stop } = mount({ ...IDLE, phase: 'paused', messageId: MSG, total: 2 })
    fireEvent.click(screen.getByRole('button', { name: t('speak.stop') }))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('el chip de velocidad cicla', () => {
    const { cycleRate } = mount({ ...IDLE, phase: 'playing', messageId: MSG, rate: 1.5, total: 2 })
    fireEvent.click(screen.getByRole('button', { name: `${t('speak.rate')} 1.5x` }))
    expect(cycleRate).toHaveBeenCalledTimes(1)
  })

  it('reacciona a un cambio de estado del reproductor', () => {
    const { store } = mount(IDLE)
    expect(screen.queryByRole('button', { name: t('speak.stop') })).toBeNull()
    act(() => { store.set({ ...IDLE, phase: 'playing', messageId: MSG, total: 3 }) })
    expect(screen.getByRole('button', { name: t('speak.stop') })).toBeDefined()
  })
})
