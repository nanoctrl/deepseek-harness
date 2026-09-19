/**
 * Glifos que comparten los controles de lectura. Viven aparte para que el
 * control de cada mensaje y el botón del chatbox no dibujen dos veces lo mismo.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/speech-icons
 */

import type { ReactElement } from 'react'

/** Glifo de reproducción. */
export function playIcon(size = 15): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

/** Glifo de pausa. */
export function pauseIcon(size = 15): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x={7} y={5} width={4} height={14} rx={1} />
      <rect x={13} y={5} width={4} height={14} rx={1} />
    </svg>
  )
}

/** Glifo de detención. */
export function stopIcon(size = 15): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x={6} y={6} width={12} height={12} rx={2} />
    </svg>
  )
}

/** Glifo de espera mientras se sintetiza el primer segmento. */
export function waitIcon(size = 15): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      <path d="M12 4a8 8 0 1 0 8 8" />
    </svg>
  )
}
