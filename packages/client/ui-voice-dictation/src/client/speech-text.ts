/**
 * Lectura del texto del asistente desde el snapshot de Chat: la prosa de un
 * mensaje puntual (para el control de cada mensaje) y la del último mensaje
 * finalizado (para el atajo global).
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/speech-text
 */

import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  AssistantBlock, ChatConversationViewNode, ChatSnapshot, FinalAssistantChatData, TurnTailChatData,
} from '@deepseek-ai/dsh-client-ui-chat/client'

/** Un mensaje finalizado del asistente con la prosa que se lee en voz alta. */
export interface SpokenMessage {
  readonly messageId: MessageId
  readonly text: string
}

/** Concatena la prosa visible de un ciclo del asistente. */
export function assistantText(blocks: readonly AssistantBlock[]): string {
  return blocks.flatMap(block => block.kind === 'text' ? [block.text] : []).join('')
}

/** El cierre que lleva el nodo; cualquier nodo que no sea cola de turno no aporta. */
function closingOf(node: ChatConversationViewNode): FinalAssistantChatData | null {
  if (node.kind !== 'turn-tail') return null
  // `data` es `unknown` en el nodo base; el `kind` ya identificó el payload.
  return (node.data as TurnTailChatData).closing
}

/**
 * Prosa de un mensaje durable del asistente.
 * @param snapshot - snapshot actual del target Chat.
 * @param messageId - mensaje durable que el control direcciona.
 * @returns la prosa del mensaje, o cadena vacía mientras no esté cargado.
 */
export function assistantTextOf(snapshot: ChatSnapshot, messageId: MessageId): string {
  for (const key of snapshot.order) {
    const node = snapshot.nodes.get(key)
    if (node === undefined) continue
    const closing = closingOf(node)
    if (closing !== null && closing.finalNode.messageId === messageId) return assistantText(closing.blocks)
  }
  return ''
}

/**
 * Memo por snapshot. El selector corre en cada publicación del Chat y el
 * recorrido es lineal en nodos; además esto mantiene estable la identidad del
 * resultado entre lecturas del mismo snapshot, que es lo que el hook necesita.
 */
const LAST_CACHE = new WeakMap<ChatSnapshot, SpokenMessage | null>()

/**
 * Último mensaje finalizado del asistente en la ventana cargada.
 * @param snapshot - snapshot actual del target Chat.
 * @returns el último mensaje con prosa, o `null` si todavía no hay ninguno.
 */
export function lastAssistantMessage(snapshot: ChatSnapshot): SpokenMessage | null {
  const cached = LAST_CACHE.get(snapshot)
  if (cached !== undefined) return cached
  const found = computeLast(snapshot)
  LAST_CACHE.set(snapshot, found)
  return found
}

/** Recorre los nodos en orden inverso y devuelve el primer cierre con prosa. */
function computeLast(snapshot: ChatSnapshot): SpokenMessage | null {
  for (let i = snapshot.order.length - 1; i >= 0; i--) {
    const key = snapshot.order[i]
    if (key === undefined) continue
    const node = snapshot.nodes.get(key)
    if (node === undefined) continue
    const closing = closingOf(node)
    if (closing === null) continue
    // Un parcial congelado por interrupción no direcciona ningún mensaje durable.
    const messageId = closing.finalNode.messageId
    if (messageId === undefined) continue
    const text = assistantText(closing.blocks)
    if (text.trim()) return { messageId, text }
  }
  return null
}
