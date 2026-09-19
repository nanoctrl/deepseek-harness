/**
 * Botón de lectura del chatbox, a la derecha del micrófono.
 *
 * Es un solo control que se transforma: en reposo lee el último mensaje
 * finalizado del asistente y, mientras suena, pasa a ser el stop que corta esa
 * misma lectura. Es el acceso rápido a lo que el control de cada mensaje ofrece
 * dentro de la fila de acciones, sin tener que buscar el mensaje en el hilo.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/SpeakToggle
 */

import clsx from 'clsx'
import type { ReactElement } from 'react'
import type { VoiceToggleProps } from './contract/slots.ts'
import { playIcon, stopIcon, waitIcon } from './speech-icons.tsx'
import { lastAssistantMessage } from './speech-text.ts'
import css from './SpeakToggle.module.css'

/**
 * El botón de lectura del último mensaje.
 * @param props - el snapshot de Chat, el reproductor compartido y la copia.
 * @returns el control, que alterna entre leer y cortar.
 */
export function SpeakToggle({ useChat, useSpeech, play, stop, t }: VoiceToggleProps): ReactElement {
  const last = useChat(lastAssistantMessage)
  const phase = useSpeech(view => view.phase)
  // Cargando también cuenta como lectura en curso: el segundo clic cancela la
  // espera en vez de encolar otra síntesis.
  const busy = phase === 'playing' || phase === 'loading'
  const label = busy ? (phase === 'loading' ? t('speak.loading') : t('speak.stop')) : t('speak.playLast')

  function onClick(): void {
    if (busy) { stop(); return }
    if (last !== null) play(last.messageId, last.text)
  }

  return (
    <button
      type="button"
      className={clsx(css.btn, busy && css.active)}
      title={label}
      aria-label={label}
      aria-pressed={busy}
      disabled={last === null && !busy}
      onClick={onClick}
    >
      {phase === 'loading' ? <span className={css.spin}>{waitIcon(20)}</span>
        : busy ? stopIcon(20) : playIcon(20)}
    </button>
  )
}
