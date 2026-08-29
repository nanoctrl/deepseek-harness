/**
 * Voice dictation mic button in the composer.
 *
 * Click (or Ctrl+M) starts recording; a red circle slides to screen center and
 * grows with the voice. Enter (or a click on the circle) stops and transcribes
 * via the host `voiceTranscribe` Remote, showing an estimated 0→100% progress.
 * On success the text is inserted in the composer and the caret is placed at
 * the end so Enter sends it.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { TranscribeResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { VoiceDictationInjected } from './contract/slots.ts'
import css from './VoiceButton.module.css'

/** Full component props: the injected transcribe callback plus what the button needs. */
export type VoiceButtonProps = {
  /** Live InputState snapshot (draft). */
  input?: { readonly draft?: string }
  /** Input actions for writing the draft. */
  inputActions?: { setDraft(text: string): void }
  /** Injected transcription callback. */
  transcribe(payload: { b64: string; ext: string }): Promise<TranscribeResult>
} & VoiceDictationInjected

type Status = 'idle' | 'recording' | 'transcribing' | 'error'

/** One active recording's handles and timing. */
interface RecorderHolder {
  rec: MediaRecorder
  chunks: Blob[]
  stream: MediaStream
  mime: string
  AC: AudioContext | null
  src: MediaStreamAudioSourceNode | null
  analyser: AnalyserNode | null
  recordStart: number
  durationMs: number
  transcribeStart: number
  rafId: number
  progRaf: number
}

const SHORTCUT = { ctrl: true, shift: false, alt: false, key: 'm' }

function matchesShortcut(event: KeyboardEvent): boolean {
  return event.ctrlKey === SHORTCUT.ctrl
    && event.shiftKey === SHORTCUT.shift
    && event.altKey === SHORTCUT.alt
    && !event.metaKey
    && (event.key === SHORTCUT.key || event.key === SHORTCUT.key.toUpperCase())
}

function micIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={9} y={2} width={6} height={12} rx={3} />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1={12} y1={18} x2={12} y2={22} />
      <line x1={8} y1={22} x2={16} y2={22} />
    </svg>
  )
}

function errIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx={12} cy={12} r={9} />
      <line x1={12} y1={8} x2={12} y2={13} />
      <line x1={12} y1={16.5} x2={12} y2={17} />
    </svg>
  )
}

/** Stop every track and disconnect/close the analyser graph. */
function stopStreamAndAudio(h: RecorderHolder): void {
  if (h.stream) h.stream.getTracks().forEach((t) => { try { t.stop() } catch { /* already stopped */ } })
  try { h.src?.disconnect() } catch { /* noop */ }
  try { h.analyser?.disconnect() } catch { /* noop */ }
  try { if (h.AC && h.AC.state !== 'closed') void h.AC.close() } catch { /* noop */ }
}

/** The composer mic button plus the centered recording/transcription overlay. */
export function VoiceButton(props: VoiceButtonProps): ReactElement {
  const { transcribe, input, inputActions } = props
  const [status, setStatus] = useState<Status>('idle')
  const [err, setErr] = useState('')
  const holderRef = useRef<RecorderHolder | null>(null)
  const circleRef = useRef<HTMLDivElement | null>(null)
  const pctRef = useRef<HTMLSpanElement | null>(null)

  function fail(msg: string): void {
    setErr(msg || 'Error')
    setStatus('error')
    const h = holderRef.current
    if (h) {
      if (h.rafId) cancelAnimationFrame(h.rafId)
      if (h.progRaf) cancelAnimationFrame(h.progRaf)
      stopStreamAndAudio(h)
      holderRef.current = null
    }
  }

  async function start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail('Este navegador no soporta grabación de micrófono')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      fail((e instanceof DOMException && e.name === 'NotAllowedError') ? 'Permiso de micrófono denegado' : 'No se pudo acceder al micrófono')
      return
    }
    let mime = ''
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    for (const t of candidates) {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)) { mime = t; break }
    }
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e && e.data && e.data.size > 0) chunks.push(e.data) }
    rec.onerror = () => fail('Error de grabación')

    let AC: AudioContext | null = null
    let src: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null
    try {
      const ACtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (ACtor && typeof ACtor === 'function') {
        AC = new ACtor()
        src = AC.createMediaStreamSource(stream)
        analyser = AC.createAnalyser()
        analyser.fftSize = 512
        src.connect(analyser)
      }
    } catch { AC = null; src = null; analyser = null }

    holderRef.current = {
      rec, chunks, stream, mime, AC, src, analyser, recordStart: Date.now(),
      durationMs: 0, transcribeStart: 0, rafId: 0, progRaf: 0,
    }
    rec.start()
    setErr('')
    setStatus('recording')
  }

  function stop(): void {
    const h = holderRef.current
    if (!h) { setStatus('idle'); return }
    h.durationMs = Date.now() - h.recordStart
    h.transcribeStart = Date.now()
    setStatus('transcribing')
    h.rec.onstop = () => { stopStreamAndAudio(h); void finalize(h) }
    try { h.rec.stop() } catch { void finalize(h) }
  }

  async function finalize(h: RecorderHolder): Promise<void> {
    let blob: Blob | null = null
    try {
      const mime = (h.rec && h.rec.mimeType) || h.mime || 'audio/webm'
      if (h.chunks && h.chunks.length) blob = new Blob(h.chunks, { type: mime })
    } catch { fail('Error al construir el audio'); return }
    if (!blob) { fail('No se grabó audio'); return }

    let b64 = ''
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(String(fr.result))
        fr.onerror = () => reject(fr.error)
        fr.readAsDataURL(blob as Blob)
      })
      b64 = dataUrl.split(',')[1] || ''
    } catch { fail('Error al leer el audio'); return }
    if (!b64) { fail('Audio vacío'); return }

    const ext = (blob.type && blob.type.indexOf('mp4') !== -1) ? 'm4a' : 'webm'
    let res: TranscribeResult
    try {
      res = await transcribe({ b64, ext })
    } catch (e) { fail('Error de conexión: ' + (e instanceof Error ? e.message : String(e))); return }

    if (res && res.ok && res.text) {
      const text = res.text.trim()
      if (h.progRaf) cancelAnimationFrame(h.progRaf)
      if (pctRef.current) pctRef.current.textContent = '100%'
      const cur = (input && input.draft) || ''
      const newDraft = text ? (cur ? (cur + ' ' + text) : text) : cur
      if (text && inputActions && typeof inputActions.setDraft === 'function') {
        inputActions.setDraft(newDraft)
      }
      setStatus('idle')
      setErr('')
      // Place the caret at the end so Enter sends immediately.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
          const tas = document.querySelectorAll('textarea')
          for (const ta of tas) {
            if (ta.value === newDraft) {
              ta.focus()
              const len = ta.value.length
              ta.setSelectionRange(len, len)
              break
            }
          }
        } catch { /* best-effort */ }
      }))
    } else {
      fail((res && res.error) || 'Error de transcripción')
    }
  }

  function onClick(): void {
    if (status === 'transcribing') return
    if (status === 'recording') { stop(); return }
    void start()
  }

  // Voice-driven burst on the centered circle while recording.
  useEffect(() => {
    if (status !== 'recording') return
    const h = holderRef.current
    const node = circleRef.current
    if (!h || !h.analyser || !node) return
    const data = new Uint8Array(h.analyser.fftSize)
    let phase = 0
    let raf = 0
    const tick = (): void => {
      // Colores: rotación lenta (~15s por ciclo) para transición gradual.
      phase = (phase + 0.4) % 360
      h.analyser?.getByteTimeDomainData(data)
      let sum = 0
      let peak = 0
      for (let i = 0; i < data.length; i++) {
        const v = ((data[i] ?? 128) - 128) / 128
        sum += v * v
        const a = v < 0 ? -v : v
        if (a > peak) peak = a
      }
      const rms = Math.sqrt(sum / data.length)
      const level = Math.min(1, rms * 2.5 + peak * 1.4)
      const scale = 1 + level * 0.85
      const spread = Math.round(level * 45)
      node.style.transform = 'scale(' + scale.toFixed(3) + ')'
      node.style.boxShadow =
        '0 0 ' + spread + 'px hsl(' + Math.round(phase) + ',100%,62%)' + ',' +
        '0 0 ' + (spread + 10) + 'px hsl(' + Math.round((phase + 80) % 360) + ',100%,60%)' + ',' +
        '0 0 ' + (spread + 20) + 'px hsl(' + Math.round((phase + 160) % 360) + ',100%,58%)' + ',' +
        '0 0 ' + (spread + 30) + 'px hsl(' + Math.round((phase + 240) % 360) + ',100%,55%)'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    h.rafId = raf
    return () => cancelAnimationFrame(h.rafId)
  }, [status])

  // Estimated 0→99% progress while transcribing.
  useEffect(() => {
    if (status !== 'transcribing') return
    const h = holderRef.current
    const pctEl = pctRef.current
    if (!pctEl) return
    const durMs = (h && h.durationMs) || 0
    const est = Math.max(7000, durMs * 1.8 + 4000)
    let raf = 0
    const tick = (): void => {
      const elapsed = Date.now() - ((h && h.transcribeStart) || Date.now())
      const pct = Math.min(99, Math.round(elapsed / est * 100))
      pctEl.textContent = pct + '%'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    if (h) h.progRaf = raf
    return () => cancelAnimationFrame(raf)
  }, [status])

  // Global keyboard: Ctrl+M toggles recording; Enter stops / Escape cancels.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (matchesShortcut(event)) {
        event.preventDefault()
        if (status === 'idle') void start()
        else if (status === 'recording') stop()
        return
      }
      if (status === 'recording') {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); stop() }
        else if (event.key === 'Escape') { fail('Cancelado') }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [status])

  const hidden = status === 'recording' || status === 'transcribing'
  const cls = css.btn
    + (status === 'recording' ? ' ' + css.recording : '')
    + (status === 'error' ? ' ' + css.error : '')
    + (hidden ? ' ' + css.hidden : '')
  const title = status === 'recording'
    ? 'Grabando — Ctrl+M / Enter o clic para detener'
    : status === 'transcribing'
      ? 'Transcribiendo…'
      : (status === 'error' ? (err || 'Reintentar dictado') : 'Dictado por voz (Ctrl+M)')

  const buttonEl = (
    <button type="button" className={cls} title={title} aria-label={title} onClick={onClick} style={hidden ? { visibility: 'hidden' } : undefined}>
      {status === 'recording' || status === 'transcribing' ? null : status === 'error' ? errIcon() : micIcon()}
    </button>
  )

  let overlay: ReactElement | null = null
  if (status === 'recording') {
    overlay = (
      <div className={css.overlay}>
        <div className={css.stage}>
          <div className={css.circle} ref={circleRef} onClick={stop} title="Detener" />
        </div>
      </div>
    )
  } else if (status === 'transcribing') {
    overlay = (
      <div className={css.overlay}>
        <div className={css.track}>
          <div className={css.ring} />
          <span className={css.pct} ref={pctRef}>0%</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {buttonEl}
      {overlay}
    </>
  )
}
