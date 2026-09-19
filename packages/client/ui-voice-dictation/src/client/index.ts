/**
 * Registers the voice dictation mic into the composer's `conversation.input.left`
 * hole and wires its transcription to the host `voiceTranscribe` Remote.
 *
 * The same package also owns read-aloud: one control per finalized assistant
 * message in `conversation.chat.assistant-actions`, plus the Ctrl+N shortcut in
 * `conversation.input.overlay` that reads the last one. Both share one
 * SpeechController, so starting a second message cuts the first.
 */
import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the api-remotes Context merge (ctx.remote and the
// voiceTranscribe namespace contributed by the host voice-dictation Remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls ui-conversation's SlotMap merge (the 'conversation.input.left' entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ui-chat's SlotMap merge (the assistant-actions entry).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { TranscribeResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { insertAtCaret } from './composer-insert.ts'
import { SpeakButton } from './SpeakButton.tsx'
import { SpeakShortcut } from './SpeakShortcut.tsx'
import { SpeakToggle } from './SpeakToggle.tsx'
import { SpeechController, type SpeechAudio } from './speech-controller.ts'
import { toSpeakable } from './speech-markdown.ts'
import type { VoiceSpeakInjected, VoiceShortcutInjected, VoiceToggleInjected } from './contract/slots.ts'
import { VoiceButton } from './VoiceButton.tsx'
import { en, NS, zh } from './locales.ts'

export type { VoiceButtonProps } from './VoiceButton.tsx'
export type {
  VoiceDictationInjected, VoiceShortcutInjected, VoiceShortcutProps,
  VoiceSpeakInjected, VoiceSpeakProps, VoiceToggleInjected, VoiceToggleProps,
} from './contract/slots.ts'
export type { SpeechAudio, SpeechPhase, SpeechSynthesize, SpeechView } from './speech-controller.ts'
export type { SpokenMessage } from './speech-text.ts'

/** Services required by the voice dictation plugin. */
export const inject = ['slots', 'remote', 'remote.voiceTranscribe', 'locale', 'sessions']

/**
 * Client plugin body: the composer mic, the per-message read-aloud control, and
 * the Ctrl+N shortcut over one shared speech player.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-voice-dictation: dictionaries')
  const t = ctx.locale.bind(NS)

  const transcribe = async (payload: { b64: string; ext: string; durationMs?: number }): Promise<TranscribeResult> => {
    const result = await ctx.remote.voiceTranscribe.transcribe(payload)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  // La sesión destino se resuelve por su id, no por el compositor que esté a la
  // vista: el compositor de entrada es por sesión y `for(actx)` es la vía
  // soportada para alcanzar el de una sesión concreta. Una sesión ya descargada
  // no tiene compositor, y ahí la transcripción se rechaza en vez de perderse.
  const insert = (sessionId: SessionId, text: string): boolean => {
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return false
    const conversation = actx.get('conversation')
    if (conversation === undefined) return false
    return insertAtCaret(conversation.input.for(actx), text)
  }

  const synthesize = async (text: string): Promise<SpeechAudio> => {
    const carried = await ctx.remote.voiceTranscribe.synthesize({ text })
    if (!carried.ok) throw new Error(carried.error.message)
    const value = carried.value
    if (!value.ok || !value.b64) throw new Error(value.error ?? 'empty audio')
    return { b64: value.b64, mime: value.mime ?? 'audio/mp4' }
  }

  // Los avisos se arman por llamada, no una vez al cargar: así siguen el idioma
  // que esté activo cuando el usuario le pide leer un mensaje.
  const speech = new SpeechController(
    synthesize,
    text => toSpeakable(text, {
      codeBlock: (language, lines) => (language === ''
        ? t('speak.blockCodePlain', { lines })
        : t('speak.blockCode', { language, lines })),
      table: (rows, cols, columns) => t('speak.blockTable', { rows, cols, columns }),
      tableOversized: (rows, cols) => t('speak.blockTableOversized', { rows, cols }),
      list: count => t('speak.blockList', { count }),
      image: alt => (alt === '' ? t('speak.image') : t('speak.imageAlt', { alt })),
    }),
  )
  ctx.effect(() => () => { speech.dispose() }, 'ui-voice-dictation: speech player')

  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: 'voice-dictation', order: 0, label: () => t('mic.titleIdle') },
      (props: { sessionId: SessionId }) =>
        React.createElement(VoiceButton, { ...props, transcribe, insert, t }),
    ))

  // Orden 1: queda inmediatamente a la derecha del micrófono.
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'speak-toggle',
    order: 1,
    label: () => t('speak.playLast'),
    locale: NS,
    inject: (): VoiceToggleInjected => ({
      hooks: { speech },
      play: (messageId, text) => { speech.play(messageId, text) },
      stop: () => { speech.stop() },
    }),
  }, SpeakToggle))

  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'speak',
    order: 20,
    label: () => t('speak.idle'),
    locale: NS,
    inject: (): VoiceSpeakInjected => ({
      hooks: { speech },
      play: (messageId, text) => { speech.play(messageId, text) },
      cycleRate: () => { speech.cycleRate() },
      stop: () => { speech.stop() },
    }),
  }, SpeakButton))

  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: 'speak-shortcut',
    order: 3,
    inject: (): VoiceShortcutInjected => ({
      hooks: { speech },
      play: (messageId, text) => { speech.play(messageId, text) },
      stop: () => { speech.stop() },
    }),
  }, SpeakShortcut))
}
