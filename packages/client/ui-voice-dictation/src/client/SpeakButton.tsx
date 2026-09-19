/**
 * Control de lectura de un mensaje finalizado del asistente: play/pausa, barra
 * de avance del mensaje y chip de velocidad. Se suma a la fila de acciones del
 * mensaje (copiar, ramificar, feedback) sin desplazar a las que ya estaban.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/SpeakButton
 */

import type { ReactElement } from 'react'
import type { VoiceSpeakProps } from './contract/slots.ts'
import type { SpeechError, SpeechPhase } from './speech-controller.ts'
import { pauseIcon, playIcon, stopIcon, waitIcon } from './speech-icons.tsx'
import { assistantTextOf } from './speech-text.ts'
import css from './SpeakButton.module.css'

/** Clave de diccionario de cada fallo que publica el reproductor. */
const ERROR_KEY = {
  'no-text': 'speak.errorNoText',
  synthesis: 'speak.errorSynthesis',
  playback: 'speak.errorPlayback',
} as const

/** Velocidad como etiqueta corta: `1x`, `1.25x`. */
function formatRate(rate: number): string {
  return `${rate}x`
}

/** Texto del fallo: copia traducida más el detalle técnico del host. */
function failureText(t: VoiceSpeakProps['t'], error: SpeechError): string {
  return error.detail === undefined ? t(ERROR_KEY[error.code]) : `${t(ERROR_KEY[error.code])} — ${error.detail}`
}

/** Etiqueta accesible del control para la fase en curso. */
function labelFor(t: VoiceSpeakProps['t'], phase: SpeechPhase, failure: string): string {
  switch (phase) {
    case 'loading': return t('speak.loading')
    case 'playing': return t('speak.playing')
    case 'paused': return t('speak.paused')
    case 'error': return `${failure} — ${t('speak.retryHint')}`
    case 'idle': return t('speak.idle')
  }
}

/**
 * Uno de los controles de lectura del mensaje.
 * @param props - la identidad del mensaje, el snapshot de Chat, el reproductor
 * y la copia traducida.
 * @returns el botón con su barra de avance y su chip de velocidad.
 */
export function SpeakButton({
  messageId, useChat, useSpeech, play, cycleRate, stop, t,
}: VoiceSpeakProps): ReactElement | null {
  const text = useChat(snapshot => assistantTextOf(snapshot, messageId))
  const owned = useSpeech(view => view.messageId === messageId)
  const phase = useSpeech(view => (view.messageId === messageId ? view.phase : 'idle'))
  const rate = useSpeech(view => view.rate)
  const segment = useSpeech(view => (view.messageId === messageId ? view.segment : 0))
  const total = useSpeech(view => (view.messageId === messageId ? view.total : 0))
  const progress = useSpeech(view => (view.messageId === messageId ? view.progress : 0))
  const error = useSpeech(view => (view.messageId === messageId ? view.error : null))

  // Un mensaje sin prosa (por ejemplo, sólo llamadas a herramientas) no tiene
  // nada que leer: no aporta control.
  if (!text.trim()) return null

  const failure = error === null ? '' : failureText(t, error)
  const label = owned ? labelFor(t, phase, failure) : t('speak.idle')
  const done = total > 0 ? Math.min(1, (segment + progress) / total) : 0

  return (
    <>
      <button
        type="button"
        className={css.action}
        title={label}
        aria-label={label}
        aria-pressed={phase === 'playing'}
        data-active={owned || undefined}
        onClick={() => { play(messageId, text) }}
      >
        {phase === 'loading' ? <span className={css.spin}>{waitIcon()}</span>
          : phase === 'playing' ? pauseIcon() : playIcon()}
      </button>
      {owned && phase !== 'error' && (
        <span className={css.meter} title={t('speak.progress')} aria-hidden="true">
          <span className={css.bar} style={{ width: `${Math.round(done * 100)}%` }} />
        </span>
      )}
      {owned && phase !== 'loading' && (
        <button
          type="button"
          className={css.rate}
          title={t('speak.rate')}
          aria-label={`${t('speak.rate')} ${formatRate(rate)}`}
          onClick={cycleRate}
        >
          {formatRate(rate)}
        </button>
      )}
      {/* Detener corta y destruye; pausar sólo suspende. Son acciones distintas
          y la destrucción necesita un control propio, no un atajo escondido. */}
      {owned && (
        <button
          type="button"
          className={css.action}
          title={t('speak.stop')}
          aria-label={t('speak.stop')}
          onClick={stop}
        >
          {stopIcon()}
        </button>
      )}
      {owned && phase === 'error' && <span className={css.failure} role="status">{failure}</span>}
    </>
  )
}
