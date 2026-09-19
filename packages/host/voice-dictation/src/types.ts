/** Audio payload from the browser recorder, base64-encoded. */
export interface TranscribePayload {
  /** Base64-encoded audio bytes. */
  readonly b64: string
  /** Container hint (e.g. `webm` or `m4a`). Default `webm`. */
  readonly ext?: string
  /** Recording duration in ms, used to scale the transcription timeout. */
  readonly durationMs?: number
}

/** Result of one transcription attempt. */
export interface TranscribeResult {
  readonly ok: boolean
  /** Transcribed text when `ok`. */
  readonly text?: string
  /** Human-readable failure reason when `!ok`. */
  readonly error?: string
}

/** One segment of assistant prose the browser asks the host to speak. */
export interface SynthesizePayload {
  /** Prose to synthesize. Required and non-blank. */
  readonly text: string
}

/** Result of one speech-synthesis attempt. */
export interface SynthesizeResult {
  readonly ok: boolean
  /** Base64-encoded audio bytes when `ok`. */
  readonly b64?: string
  /** Container MIME type of `b64`. */
  readonly mime?: string
  /** Human-readable failure reason when `!ok`. */
  readonly error?: string
}
