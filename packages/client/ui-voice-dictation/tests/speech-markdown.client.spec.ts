import { describe, expect, it } from 'vitest'
import { toSpeakable, type StructurePhrases } from '../src/client/speech-markdown.ts'

/** Avisos fijos: el módulo no posee copia, la recibe del llamador. */
const P: StructurePhrases = {
  codeBlock: (language, lines) => (language === '' ? `CODIGO ${lines}` : `CODIGO ${language} ${lines}`),
  table: (rows, cols, columns) => `TABLA ${rows}x${cols} ${columns}`,
  tableOversized: (rows, cols) => `TABLA GRANDE ${rows}x${cols}`,
  list: count => `LISTA ${count}`,
  image: alt => (alt === '' ? 'IMAGEN' : `IMAGEN ${alt}`),
}

/** La lectura de un mensaje nunca debe pronunciar sintaxis de Markdown. */
function expectNoSyntax(spoken: string): void {
  for (const marker of ['**', '__', '`', '](', 'http', '|', '#', '~~~']) {
    expect(spoken).not.toContain(marker)
  }
}

describe('toSpeakable', () => {
  it('devuelve vacío cuando no hay nada que decir', () => {
    expect(toSpeakable('', P)).toBe('')
    expect(toSpeakable('   \n\n  ', P)).toBe('')
  })

  it('quita los marcadores de énfasis', () => {
    expect(toSpeakable('**negrita** y *cursiva* y __otra__ y _más_.', P)).toBe('negrita y cursiva y otra y más.')
    expect(toSpeakable('~~tachado~~.', P)).toBe('tachado.')
  })

  it('no aplica las reglas de énfasis al contenido del código', () => {
    expect(toSpeakable('El tipo `a_b_c` y *cursiva*.', P)).toBe('El tipo a b c y cursiva.')
  })

  it('lee la etiqueta de un enlace y descarta el destino', () => {
    expect(toSpeakable('Mirá la [documentación oficial](https://ejemplo.com/a/b?c=1).', P))
      .toBe('Mirá la documentación oficial.')
    expect(toSpeakable('Ver [guía][ref].', P)).toBe('Ver guía.')
    expect(toSpeakable('Auto <https://ejemplo.com> enlace.', P)).toBe('Auto enlace.')
  })

  it('nombra una imagen por su texto alternativo', () => {
    expect(toSpeakable('![Diagrama de flujo](img.png)', P)).toBe('IMAGEN Diagrama de flujo.')
    expect(toSpeakable('![](img.png)', P)).toBe('IMAGEN.')
  })

  it('descarta las etiquetas HTML', () => {
    expect(toSpeakable('Hola <br/> mundo <strong>fuerte</strong>.', P)).toBe('Hola mundo fuerte.')
  })

  it('convierte un encabezado en una oración', () => {
    expect(toSpeakable('## Estado del deploy', P)).toBe('Estado del deploy.')
    expect(toSpeakable('###### Al final', P)).toBe('Al final.')
  })

  it('una cita se lee como prosa', () => {
    expect(toSpeakable('> Esto es una cita.\n> Y sigue.', P)).toBe('Esto es una cita. Y sigue.')
  })

  it('descarta las reglas horizontales', () => {
    expect(toSpeakable('Antes.\n\n---\n\nDespués.', P)).toBe('Antes. Después.')
  })

  it('resuelve los escapes de Markdown', () => {
    expect(toSpeakable('Un \\* literal.', P)).toBe('Un * literal.')
  })

  it('avisa que hay un bloque de código, con su lenguaje y su tamaño', () => {
    expect(toSpeakable('Mirá:\n\n```ts\nconst a = 1\n```\n\nListo.', P)).toBe('Mirá: CODIGO ts 1. Listo.')
    expect(toSpeakable('```\nconst a = 1\nconst b = 2\n```', P)).toBe('CODIGO 2.')
  })

  it('cierra un bloque de código sin cerrar', () => {
    expect(toSpeakable('Antes.\n```\nconst a = 1', P)).toBe('Antes. CODIGO 1.')
  })

  it('lee una tabla chica: encabezados y después cada fila', () => {
    const table = '| Servicio | Estado |\n| --- | --- |\n| api | ok |\n| worker | pendiente |'
    expect(toSpeakable(table, P)).toBe('TABLA 2x2 Servicio, Estado. api, ok. worker, pendiente.')
  })

  it('pronuncia los identificadores que aparecen dentro de una tabla', () => {
    const table = '| Archivo | Estado |\n| --- | --- |\n| `run_search_background` | listo |'
    expect(toSpeakable(table, P)).toBe('TABLA 1x2 Archivo, Estado. run search background, listo.')
  })

  it('remite a la pantalla cuando la tabla es demasiado grande para seguirla', () => {
    const rows = Array.from({ length: 12 }, (_v, n) => `| f${n} | v${n} |`).join('\n')
    const table = `| A | B |\n| --- | --- |\n${rows}`
    expect(toSpeakable(table, P)).toBe('TABLA GRANDE 12x2.')
  })

  it('remite a la pantalla cuando la tabla tiene demasiadas columnas', () => {
    const table = '| a | b | c | d | e |\n| --- | --- | --- | --- | --- |\n| 1 | 2 | 3 | 4 | 5 |'
    expect(toSpeakable(table, P)).toBe('TABLA GRANDE 1x5.')
  })

  it('anuncia una lista y lee cada ítem como una oración', () => {
    expect(toSpeakable('- uno\n- dos\n- tres', P)).toBe('LISTA 3. uno. dos. tres.')
    expect(toSpeakable('1. primero\n2. segundo', P)).toBe('LISTA 2. primero. segundo.')
  })

  it('no confunde una regla horizontal con un ítem de lista', () => {
    expect(toSpeakable('- - -', P)).toBe('')
  })

  it('pronuncia los identificadores del código en línea como se dicen', () => {
    expect(toSpeakable('Corré `run_search_background()` y mirá `src/client/index.ts`.', P))
      .toBe('Corré run search background y mirá src client index.ts.')
  })

  it('procesa una respuesta realista sin pronunciar sintaxis', () => {
    const message = [
      '## Estado del deploy',
      '',
      'El servicio **ya está** en producción. Podés ver el detalle en la [documentación oficial](https://ejemplo.com/docs/deploy/v2).',
      '',
      'Los pasos que faltan son:',
      '',
      '- Rotar la clave `API_KEY_V2` en el vault',
      '- Reiniciar el worker',
      '',
      '| Servicio | Estado |',
      '| --- | --- |',
      '| api | ok |',
      '| worker | pendiente |',
      '',
      'El tipo `HttpClient` vive en `src/client/index.ts`.',
      '',
      'Por último, corré `make deploy --force` y avisame.',
    ].join('\n')
    const spoken = toSpeakable(message, P)
    expectNoSyntax(spoken)
    expect(spoken).toContain('documentación oficial')
    expect(spoken).toContain('LISTA 2')
    // La tabla ya no se saltea: se anuncian sus columnas y se leen sus filas.
    expect(spoken).toContain('TABLA 2x2 Servicio, Estado')
    expect(spoken).toContain('api, ok')
    expect(spoken).toContain('worker, pendiente')
    // Los identificadores se entregan ya pronunciables.
    expect(spoken).toContain('API KEY V2')
    expect(spoken).toContain('Http Client')
    expect(spoken).toContain('src client index.ts')
    expect(spoken).toContain('make deploy force')
  })
})
