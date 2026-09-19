import { describe, expect, it } from 'vitest'
import { toSpokenToken } from '../src/client/speech-tokens.ts'

describe('toSpokenToken', () => {
  it('separa un nombre en snake_case', () => {
    expect(toSpokenToken('run_search_background')).toBe('run search background')
  })

  it('separa un nombre en kebab-case', () => {
    expect(toSpokenToken('voice-dictation-plugin')).toBe('voice dictation plugin')
  })

  it('separa un nombre en camelCase', () => {
    expect(toSpokenToken('maxRetries')).toBe('max Retries')
    expect(toSpokenToken('getUserById')).toBe('get User By Id')
  })

  it('separa un nombre en PascalCase', () => {
    expect(toSpokenToken('HttpClient')).toBe('Http Client')
  })

  it('separa la sigla de la palabra que la sigue', () => {
    expect(toSpokenToken('HTTPServer')).toBe('HTTP Server')
  })

  it('conserva las mayúsculas: una sigla debe sonar como sigla', () => {
    expect(toSpokenToken('API_KEY_V2')).toBe('API KEY V2')
  })

  it('pronuncia una llamada por su nombre, sin argumentos', () => {
    expect(toSpokenToken('deploy()')).toBe('deploy')
    expect(toSpokenToken('foo(bar, baz)')).toBe('foo')
  })

  it('una ruta se dice como una sucesión de nombres', () => {
    expect(toSpokenToken('src/client/index.ts')).toBe('src client index.ts')
    expect(toSpokenToken('a\\b\\c')).toBe('a b c')
  })

  it('quita las marcas de una opción de línea de comandos', () => {
    expect(toSpokenToken('--force')).toBe('force')
    expect(toSpokenToken('-v')).toBe('v')
  })

  it('conserva los puntos de una versión o una extensión', () => {
    expect(toSpokenToken('v2.1.0')).toBe('v2.1.0')
    expect(toSpokenToken('transcribe.py')).toBe('transcribe.py')
  })

  it('descarta los signos de agrupación', () => {
    expect(toSpokenToken('array[0]')).toBe('array 0')
    // Los dos puntos se conservan: marcan una pausa al leerlos.
    expect(toSpokenToken('{ a: 1 }')).toBe('a: 1')
  })

  it('no toca una palabra común', () => {
    expect(toSpokenToken('hola')).toBe('hola')
    expect(toSpokenToken('Mendoza')).toBe('Mendoza')
  })

  it('separa un apellido con prefijo, que se dice separado', () => {
    expect(toSpokenToken('McDonald')).toBe('Mc Donald')
  })

  it('tolera un fragmento vacío', () => {
    expect(toSpokenToken('')).toBe('')
    expect(toSpokenToken('   ')).toBe('')
  })
})
