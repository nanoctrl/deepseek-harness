/** Audio payload from the browser recorder, base64-encoded. */
export interface TranscribePayload {
  /** Base64-encoded audio bytes. */
  readonly b64: string
  /** Container hint (e.g. `webm` or `m4a`). Default `webm`. */
  readonly ext?: string
}

/** Result of one transcription attempt. */
export interface TranscribeResult {
  readonly ok: boolean
  /** Transcribed text when `ok`. */
  readonly text?: string
  /** Human-readable failure reason when `!ok`. */
  readonly error?: string
}
