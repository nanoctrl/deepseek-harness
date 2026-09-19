// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import {
  SpeechController, SPEECH_RATES, type SpeechAudio, type SpeechSynthesize,
} from '../src/client/speech-controller.ts'
import { segmentText } from '../src/client/speech-segment.ts'

/** Elemento de audio falso: jsdom no implementa la reproducción real. */
class FakeAudio {
  static instances: FakeAudio[] = []
  playbackRate = 1
  currentTime = 0
  duration = 10
  paused = true
  src: string
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeupdate: (() => void) | null = null
  playCount = 0
  pauseCount = 0

  constructor(src: string) { this.src = src; FakeAudio.instances.push(this) }

  play = async (): Promise<void> => { this.playCount += 1; this.paused = false }
  pause = (): void => { this.pauseCount += 1; this.paused = true }
  // El controlador suelta el audio quitando el src; el fake lo refleja para que
  // el test pueda observar que el elemento quedó vacío.
  removeAttribute = (name: string): void => { if (name === 'src') this.src = '' }
  load = (): void => { /* idem */ }
}

/** Caché de segmentos ya sintetizados, para observar la destrucción del audio. */
function cacheOf(controller: SpeechController): Map<number, string> {
  return (controller as unknown as { urls: Map<number, string> }).urls
}

/** Frase de ~157 caracteres, para forzar varios segmentos al encadenarlas. */
function sentence(n: number): string {
  return `Oración número ${n} ` + 'palabra '.repeat(20).trim() + '.'
}

/** Prosa que supera el máximo por segmento y da más de un segmento. */
const LONG = [1, 2, 3, 4].map(sentence).join(' ')

const ID = 'm1' as MessageId

/** Espera a que el controlador asiente tras una operación asíncrona. */
async function settle(): Promise<void> {
  await vi.waitFor(() => { expect(FakeAudio.instances.length).toBeGreaterThan(0) })
  await Promise.resolve()
}

describe('SpeechController', () => {
  let texts: string[]
  let synthesize: Mock<SpeechSynthesize>
  let controller: SpeechController

  beforeEach(() => {
    FakeAudio.instances = []
    texts = []
    window.localStorage.clear()
    vi.stubGlobal('Audio', FakeAudio)
    synthesize = vi.fn(async (text: string): Promise<SpeechAudio> => {
      texts.push(text)
      return { b64: 'QUFB', mime: 'audio/mp4' }
    })
    controller = new SpeechController(synthesize, text => text)
  })

  afterEach(() => {
    controller.dispose()
    vi.unstubAllGlobals()
  })

  it('reproduce el primer segmento con una URL de datos y publica playing', async () => {
    controller.play(ID, 'Hola mundo.')
    await settle()
    const view = controller.getSnapshot()
    expect(view.phase).toBe('playing')
    expect(view.messageId).toBe(ID)
    expect(view.total).toBe(1)
    expect(view.segment).toBe(0)
    expect(FakeAudio.instances).toHaveLength(1)
    expect(FakeAudio.instances[0]?.src).toBe('data:audio/mp4;base64,QUFB')
    expect(FakeAudio.instances[0]?.playCount).toBe(1)
  })

  it('precalienta el segmento siguiente mientras suena el actual', async () => {
    const total = segmentText(LONG).length
    expect(total).toBeGreaterThan(1)
    controller.play(ID, LONG)
    await settle()
    // El precalentamiento pide el segmento 1 sin que haga falta terminarlo.
    await vi.waitFor(() => { expect(texts.length).toBe(2) })
    expect(controller.getSnapshot().segment).toBe(0)
  })

  it('avanza al segmento siguiente cuando termina el anterior', async () => {
    const total = segmentText(LONG).length
    controller.play(ID, LONG)
    await settle()
    FakeAudio.instances[0]?.onended?.()
    await vi.waitFor(() => { expect(controller.getSnapshot().segment).toBe(1) })
    expect(controller.getSnapshot().total).toBe(total)
  })

  it('vuelve a reposo al terminar el último segmento', async () => {
    controller.play(ID, 'Único.')
    await settle()
    FakeAudio.instances[0]?.onended?.()
    await vi.waitFor(() => { expect(controller.getSnapshot().phase).toBe('idle') })
    expect(controller.getSnapshot().messageId).toBeNull()
  })

  it('alterna pausa y reanudación sobre el mensaje cargado', async () => {
    controller.play(ID, 'Hola mundo.')
    await settle()
    controller.play(ID, 'Hola mundo.')
    expect(controller.getSnapshot().phase).toBe('paused')
    controller.play(ID, 'Hola mundo.')
    await vi.waitFor(() => { expect(controller.getSnapshot().phase).toBe('playing') })
  })

  it('aplica la velocidad al audio en curso y la persiste', async () => {
    controller.play(ID, 'Hola mundo.')
    await settle()
    // El ciclo arranca en 1x, que es el segundo escalón: sigue 1.25x.
    const desde = SPEECH_RATES.indexOf(controller.getSnapshot().rate)
    const esperada = SPEECH_RATES[(desde + 1) % SPEECH_RATES.length]
    controller.cycleRate()
    const rate = controller.getSnapshot().rate
    expect(rate).toBe(esperada)
    expect(FakeAudio.instances[0]?.playbackRate).toBe(rate)
    expect(window.localStorage.getItem('dsh-voice-dictation.rate')).toBe(String(rate))
  })

  it('recuerda la velocidad guardada en el siguiente controlador', () => {
    window.localStorage.setItem('dsh-voice-dictation.rate', '1.5')
    const otro = new SpeechController(synthesize, text => text)
    expect(otro.getSnapshot().rate).toBe(1.5)
    otro.dispose()
  })

  it('ignora una velocidad guardada que no está en el ciclo', () => {
    window.localStorage.setItem('dsh-voice-dictation.rate', '9')
    const otro = new SpeechController(synthesize, text => text)
    expect(otro.getSnapshot().rate).toBe(1)
    otro.dispose()
  })

  it('publica el fallo de síntesis como código, sin copia traducible', async () => {
    synthesize.mockRejectedValueOnce(new Error('boom del host'))
    controller.play(ID, 'Hola mundo.')
    await vi.waitFor(() => { expect(controller.getSnapshot().phase).toBe('error') })
    expect(controller.getSnapshot().error).toEqual({ code: 'synthesis', detail: 'boom del host' })
  })

  it('publica no-text cuando no queda prosa para leer', async () => {
    controller.play(ID, '   ')
    await vi.waitFor(() => { expect(controller.getSnapshot().phase).toBe('error') })
    expect(controller.getSnapshot().error).toEqual({ code: 'no-text' })
    expect(synthesize).not.toHaveBeenCalled()
  })

  it('pronuncia la prosa que devuelve el normalizador, no el texto crudo', async () => {
    const normalizado = new SpeechController(synthesize, () => 'Prosa ya limpia.')
    normalizado.play(ID, '**crudo**')
    await vi.waitFor(() => { expect(texts).toEqual(['Prosa ya limpia.']) })
    normalizado.dispose()
  })

  it('corta y descarta todo al detener', async () => {
    controller.play(ID, 'Hola mundo.')
    await settle()
    controller.stop()
    const view = controller.getSnapshot()
    expect(view.phase).toBe('idle')
    expect(view.messageId).toBeNull()
    expect(view.total).toBe(0)
    expect(FakeAudio.instances[0]?.pauseCount).toBeGreaterThan(0)
  })

  it('cambiar de mensaje corta el anterior', async () => {
    controller.play(ID, 'Primero.')
    await settle()
    controller.play('m2' as MessageId, 'Segundo.')
    await vi.waitFor(() => {
      const view = controller.getSnapshot()
      expect([view.messageId, view.phase]).toEqual(['m2', 'playing'])
    })
  })

  it('reparte el progreso del segmento en curso', async () => {
    controller.play(ID, 'Hola mundo.')
    await settle()
    const audio = FakeAudio.instances[0]
    if (audio === undefined) throw new Error('sin audio')
    audio.currentTime = 5
    audio.ontimeupdate?.()
    expect(controller.getSnapshot().progress).toBeCloseTo(0.5, 5)
  })

  it('descarta cada segmento apenas termina de sonar', async () => {
    expect(segmentText(LONG).length).toBeGreaterThan(1)
    controller.play(ID, LONG)
    await settle()
    // El precalentamiento mantiene listo el que sigue mientras suena el actual.
    await vi.waitFor(() => { expect(cacheOf(controller).size).toBeGreaterThan(1) })
    FakeAudio.instances[0]?.onended?.()
    await vi.waitFor(() => { expect(controller.getSnapshot().segment).toBe(1) })
    // El que ya sonó no sobrevive a su audición.
    expect(cacheOf(controller).has(0)).toBe(false)
  })

  it('destruye todo el audio cuando termina el mensaje', async () => {
    controller.play(ID, 'Único.')
    await settle()
    FakeAudio.instances[0]?.onended?.()
    await vi.waitFor(() => { expect(controller.getSnapshot().phase).toBe('idle') })
    expect(cacheOf(controller).size).toBe(0)
    expect(FakeAudio.instances[0]?.src).toBe('')
  })

  it('destruye todo el audio cuando se detiene a mitad', async () => {
    controller.play(ID, LONG)
    await settle()
    expect(cacheOf(controller).size).toBeGreaterThan(0)
    controller.stop()
    expect(cacheOf(controller).size).toBe(0)
    expect(FakeAudio.instances[0]?.src).toBe('')
  })

  it('destruye todo el audio cuando la lectura falla', async () => {
    synthesize.mockRejectedValueOnce(new Error('sin red'))
    controller.play(ID, 'Hola mundo.')
    await vi.waitFor(() => { expect(controller.getSnapshot().phase).toBe('error') })
    expect(cacheOf(controller).size).toBe(0)
  })
})
