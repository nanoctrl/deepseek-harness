/**
 * Composer mic slot contract: the registrant-private injected share for the
 * `conversation.input.left` hole declared by ui-conversation. The owner share
 * (`input`, `inputActions`) arrives through PropsRuntime<'conversation.input.left'>.
 */
// Type-only: pulls ui-conversation's SlotMap merge (the 'conversation.input.left'
// entry) into this program so PropsRuntime<'conversation.input.left'> resolves.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TranscribeResult } from '@deepseek-ai/dsh-api-remotes/client'

/** Registrant-private share injected into the voice button component. */
export interface VoiceDictationInjected {
  /** Transcribe a base64 audio clip via the host `voiceTranscribe` Remote. */
  transcribe(payload: { b64: string; ext: string }): Promise<TranscribeResult>
}
