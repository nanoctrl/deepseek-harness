/**
 * Voice dictation STT host.
 *
 * Exposes a `voiceTranscribe` Remote that the browser client calls with a
 * base64-encoded audio clip. The host writes the bytes to a temp file, ensures
 * the claude-voice `whisper-server` daemon is up, runs `transcribe.py` against
 * it via `node:child_process`, and returns the transcribed text. Paths and the
 * model are Config so a deployment can point at a different checkout.
 * @module @deepseek-ai/dsh-host-voice-dictation
 */

import { execFile, spawn } from 'node:child_process'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import type { TranscribePayload, TranscribeResult } from './types.ts'

export type * from './types.ts'

/** Where the claude-voice checkout lives by default. */
const DEFAULT_VOICE_ROOT = '/Users/nahuelmaeso/Desktop/claude-software/claude-voice'
/** Whisper model kept warm by the claude-voice daemon. */
const DEFAULT_MODEL = 'large-v3-turbo'

/** Plugin configuration. */
export interface Config {
  /** Root of the claude-voice project (has `whisper-env/bin/python`). */
  voiceRoot?: string
  /** Whisper model name (must match the daemon's socket). Default `large-v3-turbo`. */
  model?: string
  /** Language hint; `auto` detects. Default `auto`. */
  language?: string
  /** Wait budget for the daemon socket to appear in ms. Default 30000. */
  serverWaitMs?: number
  /** Transcription command timeout in ms. Default 180000. */
  timeoutMs?: number
}

/** Strip ANSI escapes (the spinner's colors) and control characters from stderr. */
function cleanErr(raw: string): string {
  return raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Minimal request the liveness probe sends; the missing path fails fast. */
const PING_AUDIO = '/tmp/__voice-dictation-ping__.wav'

/**
 * Whether the whisper server is alive, probed with a complete request/response.
 * A connect-and-drop probe would reach the server's broken-pipe path (its error
 * reply lands on a closed socket) and kill it, so always finish the exchange.
 */
function serverReady(sock: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createConnection({ path: sock })
    let settled = false
    const finish = (live: boolean): void => {
      if (settled) return
      settled = true
      probe.destroy()
      resolve(live)
    }
    probe.once('connect', () => {
      probe.write(JSON.stringify({ audio_path: PING_AUDIO, language: null }) + '\n')
      probe.end()
    })
    probe.on('data', () => {}) // drain the reply so the socket closes cleanly
    probe.once('error', () => finish(false))
    probe.once('close', () => finish(true))
    const timer = setTimeout(() => finish(false), 5000)
    timer.unref()
  })
}

/**
 * Run `transcribe.py` on one audio file and return its stdout (the text). On a
 * server failure `transcribe.py` prints `Error: …` to stderr and exits 0 with an
 * empty stdout, so surface that hint instead of swallowing it.
 */
function transcribeFile(root: string, model: string, language: string, tmpPath: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const py = join(root, 'whisper-env', 'bin', 'python')
    const script = join(root, 'transcribe.py')
    let stderrBuf = ''
    const child = execFile(py, [script, tmpPath, model, language], { timeout: timeoutMs, encoding: 'utf8' }, (err, stdout) => {
      if (err) { reject(err); return }
      const text = (stdout || '').trim()
      if (text) { resolve(text); return }
      const hint = cleanErr(stderrBuf)
      const at = hint.lastIndexOf('Error:')
      if (at !== -1) { reject(new Error(hint.slice(at + 'Error:'.length).trim() || hint)); return }
      // Genuinely empty transcript (silence) — the spinner note is not an error.
      resolve('')
    })
    child.stderr?.on('data', (chunk) => { stderrBuf += String(chunk) })
  })
}

/** Start (detached) the whisper server and wait until its socket answers a probe. */
async function ensureServer(root: string, model: string, waitMs: number): Promise<void> {
  const sock = `/tmp/whisper-server-${model}.sock`
  // A stale socket file can outlive its server (the daemon closes after 30 min of
  // idle), so probe for a live listener — a dead socket must be restarted, not
  // treated as ready.
  if (await serverReady(sock)) return
  // Clear a stale socket before starting; the waiter below must not see a dead
  // file as readiness (the daemon unbinds and recreates it after loading).
  try { if (existsSync(sock)) unlinkSync(sock) } catch { /* best-effort */ }
  const py = join(root, 'whisper-env', 'bin', 'python')
  const server = join(root, 'whisper-server.py')
  try {
    spawn(py, [server, model], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    /* best-effort: the socket poll below or the transcribe call surfaces failure */
  }
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    // Wait for the socket file (readiness), then confirm with a real probe.
    if (existsSync(sock) && await serverReady(sock)) return
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

/** Remote-only gateway exposing the audio→text transcription. */
export class VoiceDictationGateway extends TypertRemoteService {
  static Config: z<Config> = z.object({
    voiceRoot: z.string().default(DEFAULT_VOICE_ROOT),
    model: z.string().default(DEFAULT_MODEL),
    language: z.string().default('auto'),
    serverWaitMs: z.number().default(30000),
    timeoutMs: z.number().default(180000),
  })

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'voiceTranscribe')
  }

  /**
   * Transcribe a base64 audio clip. Writes the bytes to a temp file, ensures the
   * whisper server is up, runs `transcribe.py`, and returns the text (or the
   * reason it failed).
   */
  @Remote('transcribe')
  async transcribe(payload: TranscribePayload): Promise<TranscribeResult> {
    try {
      const b64 = payload && typeof payload.b64 === 'string' ? payload.b64 : ''
      if (!b64) return { ok: false, error: 'Audio vacío' }
      const ext = (payload?.ext || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm'
      const root = this.config.voiceRoot ?? DEFAULT_VOICE_ROOT
      const model = this.config.model ?? DEFAULT_MODEL
      const language = this.config.language ?? 'auto'
      const tmp = join(tmpdir(), `dsh-stt-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`)
      writeFileSync(tmp, Buffer.from(b64, 'base64'))
      try {
        await ensureServer(root, model, this.config.serverWaitMs ?? 30000)
        const text = (await transcribeFile(root, model, language, tmp, this.config.timeoutMs ?? 180000)).trim()
        if (!text) return { ok: false, error: 'Transcripción vacía' }
        return { ok: true, text }
      } finally {
        try { unlinkSync(tmp) } catch { /* best-effort */ }
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}

export default VoiceDictationGateway
