/**
 * Contratos de los asientos que ocupa el plugin.
 *
 * El dictado ocupa `conversation.input.left`. La lectura en voz alta ocupa dos:
 * `conversation.chat.assistant-actions` (un control por mensaje finalizado) y
 * `conversation.input.overlay` (el atajo global, que no dibuja nada). Los tres
 * asientos comparten el reproductor inyectado.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/contract/slots
 */

// Type-only: pulls ui-conversation's SlotMap merge (input.left and input.overlay).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ui-chat's SlotMap merge (conversation.chat.assistant-actions).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MessageId, TranscribeResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls this package's LocaleNamespaceMap merge (the 'voice-dictation' seat).
import type {} from '../locales.ts'
import type { SpeechView } from '../speech-controller.ts'

/** Traductor del namespace de copia que posee este plugin. */
export type VoiceDictationTranslate = PropsLocale<'voice-dictation'>['t']

/** Compartido privado del registrante inyectado en el botón de dictado. */
export interface VoiceDictationInjected {
  /** Transcribe un clip base64 contra el Remote `voiceTranscribe` del host. */
  transcribe: (payload: { b64: string; ext: string; durationMs?: number }) => Promise<TranscribeResult>
  /**
   * Inserta la transcripción en el cursor del compositor de una sesión, sin
   * reemplazar lo que ya haya escrito.
   * @param sessionId - sesión donde se grabó el audio.
   * @param text - la transcripción a insertar.
   * @returns si la edición se aplicó; un compositor ya inexistente la rechaza.
   */
  insert: (sessionId: SessionId, text: string) => boolean
}

/** Compartido privado detrás del control de lectura de un mensaje. */
export interface VoiceSpeakInjected {
  hooks: {
    /** Reproductor compartido por todos los controles de la sesión. */
    speech: HostObservable<SpeechView>
  }
  /**
   * Lee un mensaje, o alterna pausa sobre el que ya está cargado.
   * @param messageId - mensaje que queda como dueño del reproductor.
   * @param text - prosa a leer.
   */
  play(messageId: MessageId, text: string): void
  /** Pasa a la velocidad siguiente del ciclo. */
  cycleRate(): void
  /** Corta la lectura y destruye el audio retenido. */
  stop(): void
}

/** Props completas del control de lectura de un mensaje finalizado. */
export type VoiceSpeakProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<VoiceSpeakInjected>
  & PropsLocale<'voice-dictation'>

/** Compartido privado detrás del asiento del atajo global. */
export interface VoiceShortcutInjected {
  hooks: {
    /** Reproductor compartido por todos los controles de la sesión. */
    speech: HostObservable<SpeechView>
  }
  /**
   * Lee un mensaje, o alterna pausa sobre el que ya está cargado.
   * @param messageId - mensaje que queda como dueño del reproductor.
   * @param text - prosa a leer.
   */
  play(messageId: MessageId, text: string): void
  /** Corta la lectura en curso. */
  stop(): void
}

/** Props completas del asiento del atajo global. */
export type VoiceShortcutProps =
  PropsRuntime<'conversation.input.overlay'>
  & InjectFace<VoiceShortcutInjected>

/** Compartido privado detrás del botón de lectura del chatbox. */
export interface VoiceToggleInjected {
  hooks: {
    /** Reproductor compartido por todos los controles de la sesión. */
    speech: HostObservable<SpeechView>
  }
  /**
   * Lee un mensaje, o alterna pausa sobre el que ya está cargado.
   * @param messageId - mensaje que queda como dueño del reproductor.
   * @param text - prosa a leer.
   */
  play(messageId: MessageId, text: string): void
  /** Corta la lectura en curso y destruye el audio retenido. */
  stop(): void
}

/** Props completas del botón de lectura del chatbox. */
export type VoiceToggleProps =
  PropsRuntime<'conversation.input.left'>
  & InjectFace<VoiceToggleInjected>
  & PropsLocale<'voice-dictation'>
