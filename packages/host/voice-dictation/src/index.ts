/**
 * Voice dictation STT/TTS host.
 *
 * Exposes a `voiceTranscribe` Remote with two directions. `transcribe` takes a
 * base64-encoded audio clip, writes the bytes to a temp file, ensures the
 * claude-voice `whisper-server` daemon is up, runs `transcribe.py` against it via
 * `node:child_process`, and returns the text. `synthesize` speaks a prose segment
 * with the platform `say` voice, converts the result to AAC with `afconvert`, and
 * returns it base64. Both delete every temp file they create. Paths, the model,
 * and the voice are Config so a deployment can point at a different checkout or
 * voice.
 * @module @deepseek-ai/dsh-host-voice-dictation
 */

import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import type {
  SynthesizePayload, SynthesizeResult, TranscribePayload, TranscribeResult,
} from './types.ts'

export type * from './types.ts'

/** Where the claude-voice checkout lives by default. */
const DEFAULT_VOICE_ROOT = '/Users/nahuelmaeso/Desktop/claude-software/claude-voice'
/** Whisper model kept warm by the claude-voice daemon. */
const DEFAULT_MODEL = 'large-v3-turbo'
/**
 * Kokoro voice. `ef_dora` is the only female Spanish voice in Kokoro v1.0, and
 * the model is local: the checkpoint and the voice bank live in the
 * claude-voice checkout, so nothing leaves the machine.
 */
const DEFAULT_KOKORO_VOICE = 'ef_dora'
/** macOS voice used by the `say` engine. Paulina is the es_MX female voice. */
const DEFAULT_SAY_VOICE = 'Paulina'
/**
 * AAC bit rate for spoken audio. Speech stays intelligible far below the rates
 * music needs, and the client receives the bytes as base64, so the payload is
 * what the default is chosen for: 48 kbps is about 360 KB per spoken minute.
 */
const DEFAULT_TTS_BITRATE = 48000
/**
 * Longest prose one `synthesize` call accepts, in characters. The client splits
 * a message into segments well below this, so the ceiling only guards a direct
 * caller against a request whose reply would be unusably large.
 */
const TTS_MAX_CHARS = 4000
/** Budget for one synthesis step: a `say`/`afconvert` run, or one socket round trip. */
const TTS_STEP_TIMEOUT_MS = 60000
/** Unix socket the claude-voice Kokoro daemon listens on. */
const TTS_SOCKET = '/tmp/tts-server.sock'
/** Budget for one local TTS request, model already warm. */
const TTS_REQUEST_TIMEOUT_MS = 120000
/**
 * Age at which a synthesis temporary is treated as an orphan. Every normal path
 * removes its file as soon as it has been read, so anything this old survived a
 * killed process; the age also keeps a concurrent synthesis out of the sweep.
 */
const TTS_ORPHAN_AGE_MS = 10 * 60 * 1000

/** Engines this plugin can speak through. Both run entirely on this machine. */
export type TtsEngine = 'kokoro' | 'say'

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
  /** Synthesis engine. Default `kokoro`. */
  ttsEngine?: TtsEngine
  /** Voice of the chosen engine. Default `ef_dora` for kokoro, `Paulina` for say. */
  ttsVoice?: string
  /** AAC bit rate for synthesized speech. Default 48000. */
  ttsBitrate?: number
  /** Wait budget for the local TTS daemon to accept a request, in ms. Default 30000. */
  ttsWaitMs?: number
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

/** Resolve when one platform tool exits zero; reject with its captured stderr. */
function runTool(file: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderrBuf = ''
    const child = execFile(file, [...args], { timeout: TTS_STEP_TIMEOUT_MS, encoding: 'utf8' }, (err) => {
      if (!err) { resolve(); return }
      const hint = cleanErr(stderrBuf)
      reject(new Error(hint || err.message))
    })
    child.stderr?.on('data', (chunk) => { stderrBuf += String(chunk) })
  })
}

/** What one TTS daemon request answered: the written file, or a refusal. */
type TtsReply = { path: string; duration: number } | { error: string }

/**
 * Run one request against the local Kokoro daemon.
 *
 * The exchange always completes. An empty `text` is a valid request the daemon
 * refuses and answers, so probing with it costs nothing and synthesizes
 * nothing. A connect-and-drop would instead leave `tts-server.py` sending its
 * error reply to a closed socket, and that broken pipe is raised outside its
 * inner handler and ends the process.
 */
function ttsRequest(sock: string, body: Record<string, unknown>, timeoutMs: number): Promise<TtsReply> {
  return new Promise((resolve, reject) => {
    const client = createConnection({ path: sock })
    let data = ''
    let settled = false
    const finish = (error: Error | null, value?: TtsReply): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      client.destroy()
      if (error !== null) reject(error)
      else if (value !== undefined) resolve(value)
      else reject(new Error('Respuesta vacía del servidor TTS local'))
    }
    // Todo camino que llama a `finish` se registra después de esta línea, así
    // que el temporizador ya está asignado cuando el cierre lo cancela.
    const timer = setTimeout(() => { finish(new Error('El servidor TTS local no respondió a tiempo')) }, timeoutMs)
    timer.unref()
    client.once('connect', () => { client.write(`${JSON.stringify(body)}\n`) })
    client.on('data', (chunk) => { data += String(chunk) })
    client.once('error', (error) => { finish(error) })
    client.once('close', () => {
      let reply: unknown
      try {
        reply = JSON.parse(data.trim())
      } catch {
        finish(new Error('Respuesta inválida del servidor TTS local'))
        return
      }
      if (typeof reply !== 'object' || reply === null) {
        finish(new Error('Respuesta inválida del servidor TTS local'))
        return
      }
      const record = reply as { error?: unknown; path?: unknown; duration?: unknown }
      if (typeof record.error === 'string') { finish(null, { error: record.error }); return }
      if (typeof record.path !== 'string') {
        finish(new Error('El servidor TTS local no devolvió ningún archivo'))
        return
      }
      finish(null, { path: record.path, duration: typeof record.duration === 'number' ? record.duration : 0 })
    })
  })
}

/** Whether the daemon answers. A refusal still proves the accept loop is alive. */
async function ttsServerReady(sock: string): Promise<boolean> {
  try {
    await ttsRequest(sock, { text: '' }, 5000)
    return true
  } catch {
    return false
  }
}

/** Start the Kokoro daemon (detached) and wait until it answers a request. */
async function startTtsServer(root: string, waitMs: number): Promise<void> {
  if (await ttsServerReady(TTS_SOCKET)) return
  // The daemon binds only after loading its model, so a stale socket file must
  // not be mistaken for readiness.
  try { if (existsSync(TTS_SOCKET)) unlinkSync(TTS_SOCKET) } catch { /* best-effort */ }
  const py = join(root, 'tts-env', 'bin', 'python')
  const server = join(root, 'tts-server.py')
  try {
    spawn(py, [server], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    /* best-effort: the poll below or the real request surfaces the failure */
  }
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    if (existsSync(TTS_SOCKET) && await ttsServerReady(TTS_SOCKET)) return
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('El servidor TTS local no arrancó')
}

/**
 * Remove synthesis temporaries an earlier process left behind.
 *
 * Both engines delete their files the moment they have been read, so the only
 * survivors are orphans from a killed process. This covers both this plugin's
 * own prefixes and the Kokoro daemon's `tts_` files, which the daemon writes and
 * never removes; deleting a file another process still has open is harmless on
 * this platform, and the age guard keeps it away from live work.
 */
function sweepOrphanedAudio(): void {
  const cutoff = Date.now() - TTS_ORPHAN_AGE_MS
  let names: string[]
  try {
    names = readdirSync(tmpdir())
  } catch {
    return // sin /tmp legible no hay nada que barrer
  }
  for (const name of names) {
    if (!name.startsWith('dsh-tts-') && !name.startsWith('tts_')) continue
    const path = join(tmpdir(), name)
    try {
      if (statSync(path).mtimeMs < cutoff) unlinkSync(path)
    } catch {
      /* best-effort: otro proceso pudo borrarlo primero */
    }
  }
}

/** Remote-only gateway exposing the audio→text and text→audio directions. */
export class VoiceDictationGateway extends TypertRemoteService {
  static Config: z<Config> = z.object({
    voiceRoot: z.string().default(DEFAULT_VOICE_ROOT),
    model: z.string().default(DEFAULT_MODEL),
    language: z.string().default('auto'),
    serverWaitMs: z.number().default(30000),
    timeoutMs: z.number().default(180000),
    ttsEngine: z.union(['kokoro', 'say']).default('kokoro'),
    // Empty means "the chosen engine's own default"; the voice names of the two
    // engines are not interchangeable.
    ttsVoice: z.string().default(''),
    ttsBitrate: z.number().default(DEFAULT_TTS_BITRATE),
    ttsWaitMs: z.number().default(30000),
  })

  /** In-flight daemon start, so concurrent segments share one launch. */
  private ttsStart: Promise<void> | null = null

  /** Whether this instance already swept leftovers from earlier processes. */
  private swept = false

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
        // whisper corre ~1.8x tiempo real en CPU; escalar el timeout con la
        // duración (3x + 30 s de margen) y topar en 1 h para evitar colgarse.
        const durMs = typeof payload.durationMs === 'number' && payload.durationMs > 0 ? payload.durationMs : 0
        const timeoutMs = Math.min(3_600_000, Math.max(this.config.timeoutMs ?? 180_000, durMs * 3 + 30_000))
        const text = (await transcribeFile(root, model, language, tmp, timeoutMs)).trim()
        if (!text) return { ok: false, error: 'Transcripción vacía' }
        return { ok: true, text }
      } finally {
        try { unlinkSync(tmp) } catch { /* best-effort */ }
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Speak one prose segment. Writes the text to a temp file, runs the platform
   * `say` voice into an intermediate AIFF, converts it to AAC, and returns the
   * bytes base64. Every temp file, including the intermediate, is removed before
   * returning, so the spoken text leaves no artifact on disk.
   */
  /**
   * Speak one prose segment and return the bytes base64. Both engines run on
   * this machine: `kokoro` uses the claude-voice Kokoro ONNX daemon, `say` uses
   * the macOS voice. Every temp file, including the daemon's own WAV, is removed
   * before returning, so the spoken text leaves no artifact on disk.
   */
  @Remote('synthesize')
  async synthesize(payload: SynthesizePayload): Promise<SynthesizeResult> {
    try {
      // Un payload sin `text` se reduce a cadena vacía y lo rechaza el guard de
      // abajo, en vez de escapar como TypeError.
      const text = (payload.text || '').trim()
      if (!text) return { ok: false, error: 'Texto vacío' }
      if (text.length > TTS_MAX_CHARS) {
        return { ok: false, error: `Texto demasiado largo: ${text.length} caracteres (máximo ${TTS_MAX_CHARS})` }
      }
      const engine: TtsEngine = this.config.ttsEngine ?? 'kokoro'
      const voice = this.config.ttsVoice || (engine === 'say' ? DEFAULT_SAY_VOICE : DEFAULT_KOKORO_VOICE)
      // Primera síntesis de esta instancia: barrer lo que dejó un proceso muerto
      // antes de empezar a escribir temporales nuevos.
      if (!this.swept) {
        this.swept = true
        sweepOrphanedAudio()
      }
      return engine === 'say' ? await this.speakWithSay(text, voice) : await this.speakWithKokoro(text, voice)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Speak through the local Kokoro daemon, which keeps the model warm. */
  private async speakWithKokoro(text: string, voice: string): Promise<SynthesizeResult> {
    const root = this.config.voiceRoot ?? DEFAULT_VOICE_ROOT
    // El cliente precalienta el segmento siguiente mientras suena el actual, así
    // que dos pedidos pueden llegar juntos: comparten un solo arranque.
    this.ttsStart ??= startTtsServer(root, this.config.ttsWaitMs ?? 30000)
      .finally(() => { this.ttsStart = null })
    await this.ttsStart
    const reply = await ttsRequest(TTS_SOCKET, { text, voice, speed: 1 }, TTS_REQUEST_TIMEOUT_MS)
    if ('error' in reply) return { ok: false, error: reply.error }
    const m4aPath = join(tmpdir(), `dsh-tts-${Date.now()}-${Math.floor(Math.random() * 1e6)}.m4a`)
    try {
      const bitrate = String(this.config.ttsBitrate ?? DEFAULT_TTS_BITRATE)
      await runTool('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', bitrate, reply.path, m4aPath])
      return { ok: true, b64: readFileSync(m4aPath).toString('base64'), mime: 'audio/mp4' }
    } finally {
      // El WAV lo escribió el demonio y él nunca lo borra.
      for (const path of [reply.path, m4aPath]) {
        try { unlinkSync(path) } catch { /* best-effort */ }
      }
    }
  }

  /** Speak through the macOS `say` voice; no daemon and no network involved. */
  private async speakWithSay(text: string, voice: string): Promise<SynthesizeResult> {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const txtPath = join(tmpdir(), `dsh-tts-${stamp}.txt`)
    const aiffPath = join(tmpdir(), `dsh-tts-${stamp}.aiff`)
    const m4aPath = join(tmpdir(), `dsh-tts-${stamp}.m4a`)
    try {
      writeFileSync(txtPath, text, 'utf8')
      const bitrate = String(this.config.ttsBitrate ?? DEFAULT_TTS_BITRATE)
      await runTool('/usr/bin/say', ['-v', voice, '-f', txtPath, '-o', aiffPath])
      await runTool('/usr/bin/afconvert', ['-f', 'm4af', '-d', 'aac', '-b', bitrate, aiffPath, m4aPath])
      return { ok: true, b64: readFileSync(m4aPath).toString('base64'), mime: 'audio/mp4' }
    } finally {
      for (const path of [txtPath, aiffPath, m4aPath]) {
        try { unlinkSync(path) } catch { /* best-effort: a step that never ran left no file */ }
      }
    }
  }
}

export default VoiceDictationGateway
