// @vitest-environment jsdom
/**
 * SpeakToggle: el botón del chatbox, a la derecha del micrófono. Un solo
 * control que se transforma — en reposo lee el último mensaje, y mientras suena
 * pasa a ser el stop que corta esa misma lectura.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import type { UseChat } from '@deepseek-ai/dsh-client-ui-chat/client'
import { SpeakToggle } from '../src/client/SpeakToggle.tsx'
import { zh } from '../src/client/locales.ts'
import type { SpeechView } from '../src/client/speech-controller.ts'
import type { SpokenMessage } from '../src/client/speech-text.ts'

afterEach(cleanup)

const MSG = 'm-1' as MessageId
const LAST: SpokenMessage = { messageId: MSG, text: 'La última respuesta.' }
const t = makeTranslate(zh, commonZh)

const IDLE: SpeechView = Object.freeze({
  phase: 'idle', messageId: null, rate: 1, segment: 0, total: 0, progress: 0, error: null,
})

/** Monta el botón con verbos espiados. */
function mount(view: SpeechView, last: SpokenMessage | null = LAST) {
  const play = vi.fn()
  const stop = vi.fn()
  const useChat = (() => last) as unknown as UseChat
  const useSpeech = ((selector: (v: SpeechView) => unknown) => selector(view)) as never
  const props = { useChat, useSpeech, play, stop, t } as unknown as Parameters<typeof SpeakToggle>[0]
  render(<SpeakToggle {...props} />)
  return { play, stop }
}

describe('SpeakToggle', () => {
  it('en reposo ofrece leer el último mensaje', () => {
    mount(IDLE)
    expect(screen.getByRole('button', { name: t('speak.playLast') })).toBeDefined()
  })

  it('al apretar play reproduce el último mensaje', () => {
    const { play, stop } = mount(IDLE)
    fireEvent.click(screen.getByRole('button', { name: t('speak.playLast') }))
    expect(play).toHaveBeenCalledWith(MSG, 'La última respuesta.')
    expect(stop).not.toHaveBeenCalled()
  })

  it('el mismo botón se transforma en stop mientras suena', () => {
    mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 2 })
    expect(screen.queryByRole('button', { name: t('speak.playLast') })).toBeNull()
    expect(screen.getByRole('button', { name: t('speak.stop') })).toBeDefined()
  })

  it('apretar el stop corta la reproducción y no la reinicia', () => {
    const { play, stop } = mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 2 })
    fireEvent.click(screen.getByRole('button', { name: t('speak.stop') }))
    expect(stop).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()
  })

  it('mientras carga, el segundo clic cancela la espera', () => {
    const { stop } = mount({ ...IDLE, phase: 'loading', messageId: MSG, total: 2 })
    fireEvent.click(screen.getByRole('button', { name: t('speak.loading') }))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('en pausa vuelve a ofrecer la lectura', () => {
    const { play } = mount({ ...IDLE, phase: 'paused', messageId: MSG, total: 2 })
    fireEvent.click(screen.getByRole('button', { name: t('speak.playLast') }))
    expect(play).toHaveBeenCalledWith(MSG, 'La última respuesta.')
  })

  it('sin mensajes del asistente queda deshabilitado', () => {
    mount(IDLE, null)
    const button = screen.getByRole('button', { name: t('speak.playLast') })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: t('speak.playLast') })).toBeDefined()
  })

  it('si ya hay una lectura en curso, el botón sigue disponible sin mensajes', () => {
    mount({ ...IDLE, phase: 'playing', messageId: MSG, total: 1 }, null)
    const button = screen.getByRole('button', { name: t('speak.stop') })
    expect(button.hasAttribute('disabled')).toBe(false)
  })
})
