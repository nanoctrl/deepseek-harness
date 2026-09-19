/**
 * Reproductor de voz del plugin: un único elemento de audio compartido por
 * todos los controles de lectura.
 *
 * El mensaje se trocea en segmentos y se pide de a uno; el siguiente se
 * precalienta mientras suena el actual, así el avance no tiene pausa y el
 * arranque no espera a que se sintetice el mensaje entero. La velocidad se
 * aplica al elemento de audio, de modo que cambiarla no re-sintetiza nada ni
 * pierde la posición.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/speech-controller
 */

import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { segmentText } from './speech-segment.ts'

/** Fase de reproducción del lector. */
export type SpeechPhase = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

/** Código estable del último fallo. El control lo traduce; el reproductor no
 * posee copia traducible. */
export type SpeechErrorCode = 'no-text' | 'synthesis' | 'playback'

/** Fallo del reproductor: el código se traduce y el detalle viene del host. */
export interface SpeechError {
  readonly code: SpeechErrorCode
  /** Detalle técnico del host, cuando lo hay. No es copia traducible. */
  readonly detail?: string
}

/** Estado inmutable del que renderiza cada control de lectura. */
export interface SpeechView {
  readonly phase: SpeechPhase
  /** Mensaje dueño del reproductor, o `null` en reposo. */
  readonly messageId: MessageId | null
  /** Velocidad aplicada al elemento de audio. */
  readonly rate: number
  /** Índice del segmento en curso. */
  readonly segment: number
  /** Cantidad de segmentos del mensaje en curso. */
  readonly total: number
  /** Fracción del segmento en curso ya reproducida, 0..1. */
  readonly progress: number
  /** Último fallo; se limpia al arrancar de nuevo. */
  readonly error: SpeechError | null
}

/** Velocidades por las que cicla el control, de menor a mayor. */
export const SPEECH_RATES: readonly number[] = [0.75, 1, 1.25, 1.5, 2]

/** Clave donde la velocidad elegida sobrevive a una recarga. */
const RATE_STORAGE_KEY = 'dsh-voice-dictation.rate'

/** Audio ya sintetizado que el reproductor consume. */
export interface SpeechAudio {
  readonly b64: string
  readonly mime: string
}

/** Sintetiza un segmento de prosa. */
export type SpeechSynthesize = (text: string) => Promise<SpeechAudio>

const IDLE: SpeechView = Object.freeze({
  phase: 'idle', messageId: null, rate: 1, segment: 0, total: 0, progress: 0, error: null,
})

/** Velocidad guardada, o 1x cuando no hay ninguna utilizable. */
function storedRate(): number {
  try {
    const raw = window.localStorage.getItem(RATE_STORAGE_KEY)
    const value = raw === null ? Number.NaN : Number(raw)
    return SPEECH_RATES.includes(value) ? value : 1
  } catch {
    return 1 // el almacenamiento puede estar bloqueado (modo privado)
  }
}

/** Mensaje legible para una falla desconocida. */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Reproductor compartido. Empezar un mensaje corta el anterior, porque hay un
 * solo elemento de audio: dos lecturas simultáneas no tendrían sentido.
 */
export class SpeechController implements HostObservable<SpeechView> {
  private view: SpeechView = Object.freeze({ ...IDLE, rate: storedRate() })
  private readonly listeners = new Set<() => void>()
  private segments: readonly string[] = []
  private audio: HTMLAudioElement | null = null
  private readonly urls = new Map<number, string>()
  private readonly pending = new Map<number, Promise<string>>()
  /** Invalida el trabajo en vuelo cuando se corta o se cambia de mensaje. */
  private generation = 0

  /**
   * @param synthesize - sintetiza un segmento contra el host.
   * @param toProse - reescribe el mensaje como la prosa que hay que pronunciar.
   */
  constructor(
    private readonly synthesize: SpeechSynthesize,
    private readonly toProse: (text: string) => string,
  ) {}

  /** @returns el estado actual, con identidad estable entre cambios. */
  getSnapshot = (): SpeechView => this.view

  /**
   * @param listener - se llama en cada publicación de estado.
   * @returns el desuscriptor.
   */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Lee un mensaje; sobre el que ya está cargado alterna pausa y reanudación.
   * @param messageId - mensaje que queda como dueño del reproductor.
   * @param text - prosa a leer.
   */
  play(messageId: MessageId, text: string): void {
    if (this.view.messageId === messageId) {
      if (this.view.phase === 'playing') { this.pause(); return }
      if (this.view.phase === 'paused') { void this.resume(); return }
      if (this.view.phase === 'loading') { this.stop(); return }
    }
    void this.start(messageId, text)
  }

  /** Alterna pausa y reanudación del mensaje cargado. */
  toggle(): void {
    if (this.view.phase === 'playing') { this.pause(); return }
    if (this.view.phase === 'paused') void this.resume()
  }

  /** Corta la lectura, descarta el audio y libera el reproductor. */
  stop(): void {
    this.generation++
    this.release()
    this.segments = []
    this.urls.clear()
    this.pending.clear()
    this.publish({ ...IDLE, rate: this.view.rate })
  }

  /**
   * Cambia la velocidad. El segmento en curso la sigue en el acto, sin volver a
   * sintetizar ni perder la posición.
   * @param rate - multiplicador de velocidad.
   */
  setRate(rate: number): void {
    if (this.audio !== null) this.audio.playbackRate = rate
    try { window.localStorage.setItem(RATE_STORAGE_KEY, String(rate)) } catch { /* el almacenamiento es opcional */ }
    this.publish({ ...this.view, rate })
  }

  /** Pasa a la velocidad siguiente del ciclo. */
  cycleRate(): void {
    const at = SPEECH_RATES.indexOf(this.view.rate)
    this.setRate(SPEECH_RATES[(at + 1) % SPEECH_RATES.length] ?? 1)
  }

  /** Suelta el reproductor y todos los suscriptores. */
  dispose(): void {
    this.stop()
    this.listeners.clear()
  }

  /** Arranca un mensaje desde su primer segmento. */
  private async start(messageId: MessageId, text: string): Promise<void> {
    this.generation++
    const generation = this.generation
    this.release()
    this.urls.clear()
    this.pending.clear()
    this.segments = segmentText(this.toProse(text))
    if (this.segments.length === 0) { this.fail('no-text'); return }
    this.publish({
      phase: 'loading', messageId, rate: this.view.rate,
      segment: 0, total: this.segments.length, progress: 0, error: null,
    })
    await this.playSegment(0, generation)
  }

  /** Sintetiza y reproduce un segmento, y deja precalentado el siguiente. */
  private async playSegment(index: number, generation: number): Promise<void> {
    let url: string | null
    try {
      url = await this.urlAt(index, generation)
    } catch (error) {
      if (generation === this.generation) this.fail('synthesis', reasonOf(error))
      return
    }
    if (url === null || generation !== this.generation) return
    // El elemento anterior ya terminó su segmento: se suelta antes de crear el
    // siguiente, para que su audio decodificado no quede vivo detrás.
    this.release()
    const audio = new Audio(url)
    audio.playbackRate = this.view.rate
    audio.onended = () => { void this.advance(index, generation) }
    audio.onerror = () => { if (generation === this.generation) this.fail('playback') }
    audio.ontimeupdate = () => {
      if (generation !== this.generation) return
      const duration = audio.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      this.publish({ ...this.view, progress: Math.min(1, audio.currentTime / duration) })
    }
    this.audio = audio
    this.publish({ ...this.view, phase: 'playing', segment: index, progress: 0 })
    try {
      await audio.play()
    } catch (error) {
      if (generation === this.generation) this.fail('playback', reasonOf(error))
      return
    }
    // Precalentar el siguiente no puede cortar el actual: si falla, el error
    // reaparece recién cuando ese segmento tenga que sonar.
    void this.urlAt(index + 1, generation).catch(() => null)
  }

  /** Pasa al segmento siguiente, o termina cuando no queda ninguno. */
  private async advance(index: number, generation: number): Promise<void> {
    if (generation !== this.generation) return
    const next = index + 1
    // El audio ya reproducido se descarta acá: no sobrevive a su audición. Lo
    // único que queda en memoria es el segmento en curso y el precalentado.
    this.urls.delete(index)
    if (next >= this.segments.length) { this.stop(); return }
    await this.playSegment(next, generation)
  }

  /** Reanuda el elemento de audio ya cargado. */
  private async resume(): Promise<void> {
    const audio = this.audio
    if (audio === null) return
    const generation = this.generation
    try {
      await audio.play()
      if (generation === this.generation) this.publish({ ...this.view, phase: 'playing' })
    } catch (error) {
      if (generation === this.generation) this.fail('playback', reasonOf(error))
    }
  }

  /** Pausa el elemento de audio ya cargado. */
  private pause(): void {
    this.audio?.pause()
    this.publish({ ...this.view, phase: 'paused' })
  }

  /**
   * URL de datos de un segmento.
   * @param index - segmento pedido; fuera de rango devuelve `null`.
   * @param generation - Generación que pide; una obsoleta no publica nada.
   * @returns la URL lista para el elemento de audio.
   */
  private async urlAt(index: number, generation: number): Promise<string | null> {
    if (index >= this.segments.length) return null
    const cached = this.urls.get(index)
    if (cached !== undefined) return cached
    const url = await this.request(index)
    if (generation !== this.generation) return null
    this.urls.set(index, url)
    return url
  }

  /** Sintetiza un segmento, compartiendo la promesa que ya está en vuelo. */
  private request(index: number): Promise<string> {
    const inflight = this.pending.get(index)
    if (inflight !== undefined) return inflight
    const task = this.synthesize(this.segments[index] ?? '')
      .then(audio => `data:${audio.mime};base64,${audio.b64}`)
      .finally(() => { this.pending.delete(index) })
    this.pending.set(index, task)
    return task
  }

  /** Libera el elemento de audio sin publicar estado. */
  private release(): void {
    const audio = this.audio
    if (audio === null) return
    audio.onended = null
    audio.onerror = null
    audio.ontimeupdate = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    this.audio = null
  }

  /** Corta y publica el fallo conservando el mensaje que lo produjo. */
  private fail(code: SpeechErrorCode, detail?: string): void {
    this.release()
    // La lectura terminó mal: no queda audio retenido por si se reintenta.
    this.urls.clear()
    this.publish({ ...this.view, phase: 'error', error: detail === undefined ? { code } : { code, detail }, progress: 0 })
  }

  /** Reemplaza el estado y avisa a los suscriptores. */
  private publish(view: SpeechView): void {
    this.view = Object.freeze(view)
    for (const listener of this.listeners) {
      try { listener() } catch (error) { console.error('[ui-voice-dictation] speech subscriber threw:', error) }
    }
  }
}
