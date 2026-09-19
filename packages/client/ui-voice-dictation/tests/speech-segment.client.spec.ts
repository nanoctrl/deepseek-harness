import { describe, expect, it } from 'vitest'
import {
  segmentText, SPEECH_FIRST_SEGMENT_MAX_CHARS, SPEECH_SEGMENT_MAX_CHARS,
} from '../src/client/speech-segment.ts'

describe('segmentText', () => {
  it('devuelve vacío cuando no hay prosa', () => {
    expect(segmentText('')).toEqual([])
    expect(segmentText('   \n\t  ')).toEqual([])
  })

  it('junta oraciones cortas en un solo segmento', () => {
    expect(segmentText('Hola. ¿Cómo va? Bien.', 400)).toEqual(['Hola. ¿Cómo va? Bien.'])
  })

  it('parte en segmentos cuando se supera el máximo', () => {
    const text = 'Primera oración corta. Segunda oración corta. Tercera oración corta.'
    expect(segmentText(text, 25, 25)).toEqual(['Primera oración corta.', 'Segunda oración corta.', 'Tercera oración corta.'])
  })

  it('corta por límite de palabra una oración más larga que el máximo', () => {
    const pieces = segmentText('uno dos tres cuatro cinco seis', 11, 11)
    expect(pieces).toEqual(['uno dos', 'tres cuatro', 'cinco seis'])
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(11)
  })

  it('corta el primer segmento antes que el resto', () => {
    const pieces = segmentText('Frase de relleno. '.repeat(200))
    const [first, second] = pieces
    expect(first?.length).toBeLessThanOrEqual(SPEECH_FIRST_SEGMENT_MAX_CHARS)
    // El resto usa el tope largo: el arranque se paga una sola vez.
    expect(second?.length).toBeGreaterThan(SPEECH_FIRST_SEGMENT_MAX_CHARS)
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(SPEECH_SEGMENT_MAX_CHARS)
  })

  it('no corta en un punto decimal ni en una abreviatura sin espacio', () => {
    expect(segmentText('Mide 1.5 metros y pesa 2.7 kilos.', 400)).toEqual(['Mide 1.5 metros y pesa 2.7 kilos.'])
  })

  it('normaliza los espacios y no deja segmentos vacíos', () => {
    expect(segmentText('  Hola   mundo.\n\n  Chau.  ', 400)).toEqual(['Hola mundo. Chau.'])
  })

  it('respeta el máximo por defecto', () => {
    const text = 'Frase de relleno. '.repeat(200)
    const pieces = segmentText(text)
    expect(pieces.length).toBeGreaterThan(1)
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(SPEECH_SEGMENT_MAX_CHARS)
  })
})
