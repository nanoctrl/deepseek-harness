/**
 * Asiento invisible del atajo global: Ctrl+N lee el último mensaje finalizado
 * del asistente y, si ya hay una lectura en curso, la corta. Escape también
 * corta, que es lo que un reproductor hace en cualquier otra parte.
 *
 * El texto se resuelve en el render, con el mismo hook de Chat que usan los
 * controles por mensaje; el asiento no dibuja nada, sólo aporta los atajos.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/SpeakShortcut
 */

import { useEffect, useRef } from 'react'
import type { VoiceShortcutProps } from './contract/slots.ts'
import type { SpokenMessage } from './speech-text.ts'
import { lastAssistantMessage } from './speech-text.ts'

/** Ctrl+N sin modificadores adicionales, igual que el Ctrl+M del dictado. */
function matchesShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && !event.metaKey
    && (event.key === 'n' || event.key === 'N')
}

/**
 * Los atajos de lectura: Ctrl+N alterna, Escape corta.
 * @param props - el snapshot de Chat y el reproductor compartido.
 * @returns `null`: el asiento no dibuja nada.
 */
export function SpeakShortcut({ useChat, useSpeech, play, stop }: VoiceShortcutProps): null {
  const last = useChat(lastAssistantMessage)
  const phase = useSpeech(view => view.phase)
  const lastRef = useRef<SpokenMessage | null>(null)
  const phaseRef = useRef(phase)
  const stopRef = useRef(stop)

  useEffect(() => { lastRef.current = last }, [last])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { stopRef.current = stop }, [stop])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const phase = phaseRef.current
      const busy = phase === 'loading' || phase === 'playing'
      if (event.key === 'Escape') {
        // Escape sólo es del reproductor cuando hay algo que cortar.
        if (busy || phase === 'paused') { event.preventDefault(); stopRef.current() }
        return
      }
      if (!matchesShortcut(event)) return
      event.preventDefault()
      if (busy) { stopRef.current(); return }
      const target = lastRef.current
      if (target !== null) play(target.messageId, target.text)
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true) }
  }, [play])

  // Dejar la sesión corta la lectura: si no, el audio seguiría sonando sin
  // ningún control a la vista, y retenido.
  useEffect(() => () => { stopRef.current() }, [])

  return null
}
