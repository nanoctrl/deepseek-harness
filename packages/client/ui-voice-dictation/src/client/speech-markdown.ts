/**
 * Convierte el Markdown de un mensaje del asistente en prosa pronunciable.
 *
 * Un mensaje no es texto plano: tiene formato. Leído crudo, el sintetizador
 * pronuncia la sintaxis —la URL de un enlace, las barras de una tabla, los
 * asteriscos de una negrita— y pierde la estructura, que es justamente lo que
 * da sentido a una lista o a una tabla.
 *
 * Esta etapa resuelve las tres cosas antes de que el texto llegue a la voz:
 * descarta la sintaxis, pronuncia los identificadores como se dicen, y decide
 * qué hacer con cada estructura no lineal —leerla si se entiende al oído,
 * remitir a la pantalla si no.
 *
 * Las palabras de los avisos no viven acá: el llamador las aporta ya traducidas.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/speech-markdown
 */

import { toSpokenToken } from './speech-tokens.ts'

/** Avisos hablados con los que se nombra una estructura no lineal. */
export interface StructurePhrases {
  /**
   * Anuncia un bloque de código, cuyo contenido no se lee.
   * @param language - lenguaje declarado en la cerca, o cadena vacía.
   * @param lines - cantidad de líneas del bloque.
   */
  codeBlock(language: string, lines: number): string
  /**
   * Encabeza una tabla cuyas filas sí se leen a continuación.
   * @param rows - cantidad de filas de datos.
   * @param cols - cantidad de columnas.
   * @param columns - encabezados ya unidos, tal como se pronuncian.
   */
  table(rows: number, cols: number, columns: string): string
  /**
   * Remite a la pantalla cuando la tabla es demasiado grande para seguirla de oído.
   * @param rows - cantidad de filas de datos.
   * @param cols - cantidad de columnas.
   */
  tableOversized(rows: number, cols: number): string
  /** Anuncia una lista por su cantidad de elementos. */
  list(count: number): string
  /**
   * Nombra una imagen por su texto alternativo.
   * @param alt - el texto alternativo, posiblemente vacío.
   */
  image(alt: string): string
}

/**
 * Filas máximas de una tabla que se leen en voz alta. Más allá de esto, seguir
 * una tabla de oído deja de ser posible y remitir a la pantalla informa más.
 */
export const TABLE_MAX_ROWS = 10

/** Columnas máximas de una tabla que se leen en voz alta. */
export const TABLE_MAX_COLS = 4

/** Cerca de un bloque de código (``` o ~~~), con su lenguaje declarado. */
const FENCE = /^\s*(?:```|~~~)\s*([A-Za-z0-9+#.-]*)/
/** Encabezado ATX: de uno a seis numerales y el texto. */
const HEADING = /^\s{0,3}#{1,6}\s+/
/** Línea de cita. */
const QUOTE = /^\s{0,3}>\s?/
/** Regla horizontal: tres o más guiones, asteriscos o guiones bajos. */
const RULE = /^\s{0,3}(?:[-*_]\s*){3,}$/
/** Ítem de lista, con viñeta o numerado. */
const ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s+/
/** Fila de tabla Markdown. */
const TABLE_ROW = /^\s*\|.*\|\s*$/
/** Separador de encabezado de tabla (`| --- | :--: |`). */
const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/

/** Código en línea, apartado para que el énfasis no le coma los guiones bajos. */
const CODE_SPAN = /`([^`]*)`/g

/**
 * Marcador con el que se aparta un fragmento literal mientras se aplican las
 * reglas de formato. `\u0000` no aparece en prosa real.
 */
const SLOT = '\u0000'

/** Celdas de una fila de tabla, sin las barras de los extremos. */
function splitRow(row: string): string[] {
  return row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
}

/** Aplica las reglas de formato en línea y devuelve prosa limpia. */
function inline(text: string, phrases: StructurePhrases): string {
  const spans: string[] = []
  const slotFor = (value: string): string => {
    spans.push(value)
    return `${SLOT}${spans.length - 1}${SLOT}`
  }
  // El código en línea y el texto alternativo de una imagen salen del camino:
  // sus guiones bajos y asteriscos son del contenido, no del formato. Y el
  // código se repone ya pronunciable, no literal.
  const guarded = text
    .replace(CODE_SPAN, (_match, code: string) => slotFor(toSpokenToken(code)))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt: string) => slotFor(phrases.image(alt.trim())))
    // Enlaces: se conserva la etiqueta y se descarta el destino, que leído en
    // voz alta es una retahíla de barras y puntos.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    // Autoenlaces y etiquetas HTML.
    .replace(/<((?:https?|mailto):[^>]*)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // Negrita antes que cursiva, para que `**` no se lea como dos cursivas.
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(?=\S)(.*?)(?<=\S)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    // Escapes de Markdown.
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, '$1')
  return guarded
    .replace(new RegExp(`${SLOT}(\\d+)${SLOT}`, 'g'), (_match, index: string) => spans[Number(index)] ?? '')
    // Quitar una etiqueta deja un hueco: sin esto el sintetizador marca una
    // pausa antes del punto.
    .replace(/\s+([.,;:!?…])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cierra la pieza con puntuación de oración, para que el sintetizador pause. */
function sentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[.!?…:;]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * Reescribe un mensaje de Markdown como la prosa que conviene pronunciar.
 * @param markdown - el texto del mensaje, tal como llega del chat.
 * @param phrases - los avisos hablados, ya traducidos por el llamador.
 * @returns prosa plana, con las estructuras no lineales ya resueltas.
 */
export function toSpeakable(markdown: string, phrases: StructurePhrases): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    // Bloque de código: no es prosa y leerlo es ruido, pero callarlo del todo
    // deja al oyente sin saber que hay algo en pantalla. El lenguaje y el
    // tamaño son lo único que sirve saber de oído.
    const fence = FENCE.exec(line)
    if (fence !== null) {
      const language = (fence[1] ?? '').trim()
      i += 1
      let count = 0
      while (i < lines.length && FENCE.exec(lines[i] ?? '') === null) { count += 1; i += 1 }
      i += 1
      out.push(sentence(phrases.codeBlock(language, count)))
      continue
    }
    // Tabla: encabezado, separador y filas. Si es chica se lee; si no, se
    // remite a la pantalla, porque una tabla larga no se sigue de oído.
    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[i + 1] ?? '')) {
      const header = splitRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && TABLE_ROW.test(lines[i] ?? '')) {
        rows.push(splitRow(lines[i] ?? ''))
        i += 1
      }
      const cols = header.length
      if (rows.length > TABLE_MAX_ROWS || cols > TABLE_MAX_COLS) {
        out.push(sentence(phrases.tableOversized(rows.length, cols)))
        continue
      }
      const columns = header.map(cell => inline(cell, phrases)).filter(Boolean).join(', ')
      out.push(sentence(phrases.table(rows.length, cols, columns)))
      // Cada fila se lee en el orden de las columnas anunciadas, con las celdas
      // separadas por comas para que el oyente pueda seguirlas.
      for (const row of rows) {
        const cells = row.map(cell => inline(cell, phrases)).filter(Boolean)
        if (cells.length > 0) out.push(sentence(cells.join(', ')))
      }
      continue
    }
    if (RULE.test(line)) { i += 1; continue }
    const heading = HEADING.exec(line)
    if (heading !== null) {
      out.push(sentence(inline(line.slice(heading[0].length), phrases)))
      i += 1
      continue
    }
    const quote = QUOTE.exec(line)
    if (quote !== null) {
      out.push(sentence(inline(line.slice(quote[0].length), phrases)))
      i += 1
      continue
    }
    // Lista: se anuncian el alto y después los ítems, uno por oración, para que
    // el oyente sepa cuántos vienen y pueda seguirlos.
    if (ITEM.test(line)) {
      const items: string[] = []
      while (i < lines.length && ITEM.test(lines[i] ?? '')) {
        items.push(sentence(inline((lines[i] ?? '').replace(ITEM, ''), phrases)))
        i += 1
      }
      out.push(sentence(phrases.list(items.length)))
      out.push(...items.filter(Boolean))
      continue
    }
    const prose = sentence(inline(line, phrases))
    if (prose) out.push(prose)
    i += 1
  }
  return out.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}
