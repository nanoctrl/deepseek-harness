/**
 * Escritura en el compositor de una sesión, en el cursor y sin reemplazar.
 *
 * `setDraft` sustituye el borrador entero, así que usarlo para añadir texto
 * exige leer antes el borrador vivo: hacerlo con una copia vieja —la que el
 * componente tenía al empezar a grabar— descarta todo lo que se escribió
 * mientras tanto. Y el cursor no está en el estado publicado, así que el único
 * modo de respetarlo es preguntárselo al editor.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/composer-insert
 */

import type { SessionInput, TokenSpan } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Intentos ante una edición concurrente del borrador. */
const ATTEMPTS = 2

/**
 * Inserta texto en el cursor del compositor de una sesión.
 *
 * La inserción va por el span colapsado que devuelve el editor, con control de
 * revisión: si el borrador cambió entre la lectura y la escritura, el editor
 * rechaza la edición en vez de pisar lo que se escribió en el medio. Un
 * reintento cubre la carrera normal de tipeo; si aun así no entra, el llamador
 * se queda con el audio para que el usuario no pierda la transcripción.
 * @param input - la fachada de entrada de la sesión destino.
 * @param text - la transcripción a insertar.
 * @returns si la edición se aplicó.
 */
export function insertAtCaret(input: SessionInput, text: string): boolean {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const state = input.state.getSnapshot()
    const { start, end } = input.caretSpan()
    // Un separador sólo si hace falta: al principio del borrador o pegado a
    // otra palabra. Nunca dos espacios, nunca texto pegado.
    const separator = start === 0 || /\s$/.test(state.draft.slice(0, start)) ? '' : ' '
    const span: TokenSpan = { start, end, draftRev: state.draftRev }
    if (input.insertText(separator + text, span)) return true
  }
  return false
}
