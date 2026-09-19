/**
 * Trocea el texto de un mensaje del asistente en los segmentos que se mandan a
 * una llamada de síntesis.
 *
 * El mensaje completo se sintetiza mal entero: habría que esperar toda la
 * síntesis antes de oír nada. Segmentar mueve esa espera al primer segmento y
 * deja que los siguientes se precalienten mientras suena el actual.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/speech-segment
 */

/**
 * Caracteres de los segmentos posteriores al primero. Kokoro sintetiza a ~3,7x
 * tiempo real y el siguiente se precalienta mientras suena el actual, así que
 * un segmento largo no cuesta latencia; además Kokoro avisa que las locuciones
 * muy cortas suenan peor, así que no conviene trocear de más.
 */
export const SPEECH_SEGMENT_MAX_CHARS = 280

/**
 * Caracteres del primer segmento. Es el único cuya síntesis se espera antes de
 * que suene nada: a ~3,7x tiempo real, 90 caracteres arrancan cerca de 1,5 s en
 * lugar de los ~5 s que tardaría un segmento lleno.
 */
export const SPEECH_FIRST_SEGMENT_MAX_CHARS = 90

/** Terminadores que cierran una oración. */
const TERMINATORS = '.!?…'

/**
 * Parte la prosa en oraciones conservando el terminador. Un punto sin espacio
 * detrás no cierra oración, así que `1.5` o `Dr.` no cortan.
 */
function sentences(prose: string): string[] {
  const out: string[] = []
  let start = 0
  let i = 0
  while (i < prose.length) {
    const ch = prose[i]
    if (ch === undefined || !TERMINATORS.includes(ch)) { i++; continue }
    let end = i + 1
    while (end < prose.length && TERMINATORS.includes(prose[end] ?? '')) end++
    if (end < prose.length && prose[end] !== ' ') { i = end; continue }
    const sentence = prose.slice(start, end).trim()
    if (sentence) out.push(sentence)
    start = end
    i = end
  }
  const tail = prose.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/** Parte una oración más larga que el máximo, cortando por límite de palabra. */
function hardSplit(piece: string, maxChars: number): string[] {
  if (piece.length <= maxChars) return [piece]
  const out: string[] = []
  let current = ''
  for (const word of piece.split(' ')) {
    if (current && current.length + 1 + word.length > maxChars) { out.push(current); current = word; continue }
    current = current ? `${current} ${word}` : word
  }
  if (current) out.push(current)
  return out
}

/**
 * Segmenta prosa ya pronunciable para leerla en voz alta.
 * @param text - prosa plana; el Markdown lo resuelve `toSpeakable` antes.
 * @param maxChars - máximo de caracteres de los segmentos posteriores.
 * @param firstMaxChars - máximo del primer segmento, que es el único que se espera.
 * @returns segmentos listos para sintetizar; vacío cuando no hay nada que leer.
 */
export function segmentText(
  text: string,
  maxChars: number = SPEECH_SEGMENT_MAX_CHARS,
  firstMaxChars: number = SPEECH_FIRST_SEGMENT_MAX_CHARS,
): string[] {
  const prose = text.replace(/\s+/g, ' ').trim()
  if (!prose) return []
  const out: string[] = []
  let current = ''
  let limit = firstMaxChars
  for (const sentence of sentences(prose)) {
    for (const piece of hardSplit(sentence, maxChars)) {
      if (current && current.length + 1 + piece.length > limit) {
        out.push(current)
        current = piece
        limit = maxChars
        continue
      }
      current = current ? `${current} ${piece}` : piece
    }
  }
  if (current) out.push(current)
  return out
}
