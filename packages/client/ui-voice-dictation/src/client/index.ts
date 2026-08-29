/**
 * Registers the voice dictation mic into the composer's `conversation.input.left`
 * hole and wires its transcription to the host `voiceTranscribe` Remote.
 */
import React from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the api-remotes Context merge (ctx.remote and the
// voiceTranscribe namespace contributed by the host voice-dictation Remote).
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls ui-conversation's SlotMap merge (the 'conversation.input.left' entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TranscribeResult } from '@deepseek-ai/dsh-api-remotes/client'
import { VoiceButton } from './VoiceButton.tsx'

export type { VoiceButtonProps } from './VoiceButton.tsx'

/** Services required by the voice dictation plugin. */
export const inject = ['slots', 'remote', 'remote.voiceTranscribe']

/** Register the mic button once ui-conversation declares `conversation.input.left`. */
export function apply(ctx: ClientContext): void {
  const transcribe = async (payload: { b64: string; ext: string }): Promise<TranscribeResult> => {
    const result = await ctx.remote.voiceTranscribe.transcribe(payload)
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    return result.value
  }

  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: 'voice-dictation', order: 0, label: 'Dictado por voz' },
      (props: { input?: { draft?: string }; inputActions?: { setDraft(text: string): void } }) =>
        React.createElement(VoiceButton, { ...props, transcribe }),
    ),
  )
}
