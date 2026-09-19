/**
 * Cómo se pronuncia un fragmento de código.
 *
 * Un identificador escrito para los ojos no se lee de corrido: `run_search_background`
 * tiene tres palabras, `HttpClient` tiene dos, `src/client/index.ts` tiene una
 * ruta, y `deploy()` es una llamada cuyo nombre importa y cuyos paréntesis no.
 * El sintetizador no lo sabe: recibe texto y pronuncia lo que ve. Esta etapa
 * traduce la escritura a la lectura antes de que el texto llegue a la voz.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/speech-tokens
 */

/** Símbolos que separan palabras y sólo aportan una pausa al leerlos. */
const SEPARATORS = /[\\/_-]+/g
/** Signos de agrupación y comillas: no se pronuncian. */
const GROUPING = /[[\]{}();'"]/g
/** Operadores sueltos: leerlos como símbolos es ruido. */
const OPERATORS = /[<>=+*&|!?~^%$@#]+/g

/**
 * Reescribe un fragmento de código como se dice en voz alta.
 *
 * Las mayúsculas se conservan: `API` debe sonar como sigla y no como una
 * palabra inventada, y quien decide eso es el motor de voz, no esta función.
 * @param code - el contenido literal de un fragmento en línea.
 * @returns el mismo contenido separado en palabras pronunciables.
 */
export function toSpokenToken(code: string): string {
  return code
    .trim()
    // Una llamada se pronuncia por su nombre; los argumentos son ruido.
    .replace(/\([^()]*\)\s*$/g, ' ')
    .replace(GROUPING, ' ')
    // Separadores de ruta y de nombre compuesto: una pausa, no un símbolo.
    .replace(SEPARATORS, ' ')
    // Frontera de camelCase: minúscula o dígito seguidos de mayúscula.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Frontera de sigla: la última mayúscula de una corrida abre la palabra.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(OPERATORS, ' ')
    // Los puntos se conservan: separan versiones y extensiones, y ahí sí se
    // pronuncian ("índex punto ts").
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .trim()
}
