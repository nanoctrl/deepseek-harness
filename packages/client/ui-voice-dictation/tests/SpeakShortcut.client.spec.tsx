// @vitest-environment jsdom
/**
 * SpeakShortcut: los atajos globales. Ctrl+N lee el último mensaje y corta si
 * ya hay algo sonando; Escape corta; dejar la sesión corta. Lo que se prueba acá
 * es que el audio nunca quede sonando ni retenido sin un control a la vista.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import type { UseChat } from '@deepseek-ai/dsh-client-ui-chat/client'
import { SpeakShortcut } from '../src/client/SpeakShortcut.tsx'
import type { SpeechView } from '../src/client/speech-controller.ts'
import type { SpokenMessage } from '../src/client/speech-text.ts'

afterEach(cleanup)

const MSG = 'm-1' as MessageId
const LAST: SpokenMessage = { messageId: MSG, text: 'La última respuesta.' }

const IDLE: SpeechView = Object.freeze({
  phase: 'idle', messageId: null, rate: 1, segment: 0, total: 0, progress: 0, error: null,
})

/** Monta el asiento invisible con verbos espiados. */
function mount(view: SpeechView, last: SpokenMessage | null = LAST) {
  const play = vi.fn()
  const stop = vi.fn()
  // El texto del último mensaje llega por un selector de Chat; se devuelve
  // directo para no tener que construir un snapshot entero.
  const useChat = (() => last) as unknown as UseChat
  const useSpeech = ((selector: (v: SpeechView) => unknown) => selector(view)) as never
  const props = { useChat, useSpeech, play, stop } as unknown as Parameters<typeof SpeakShortcut>[0]
  const { unmount } = render(<SpeakShortcut {...props} />)
  return { play, stop, unmount }
}

describe('SpeakShortcut', () => {
  it('no dibuja nada', () => {
    mount(IDLE)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.body.textContent).toBe('')
  })

  it('Ctrl+N lee el último mensaje', () => {
    const { play, stop } = mount(IDLE)
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(play).toHaveBeenCalledWith(MSG, 'La última respuesta.')
    expect(stop).not.toHaveBeenCalled()
  })

  it('Ctrl+N otra vez corta en lugar de reiniciar', () => {
    const { play, stop } = mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 1 })
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()
  })

  it('Ctrl+N cancela mientras está cargando', () => {
    const { stop } = mount({ ...IDLE, phase: 'loading', messageId: MSG, total: 1 })
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('Escape corta una lectura en curso', () => {
    const { stop } = mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 1 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('Escape también corta una lectura en pausa', () => {
    const { stop } = mount({ ...IDLE, phase: 'paused', messageId: MSG, total: 1 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('Escape no se secuestra cuando no hay nada sonando', () => {
    const { stop } = mount(IDLE)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(stop).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+N no dispara la lectura', () => {
    const { play } = mount(IDLE)
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true, shiftKey: true })
    expect(play).not.toHaveBeenCalled()
  })

  it('dejar la sesión corta la lectura', () => {
    const { stop, unmount } = mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 1 })
    unmount()
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('sin mensajes no hace nada', () => {
    const { play, stop } = mount(IDLE, null)
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(play).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()
  })
})
