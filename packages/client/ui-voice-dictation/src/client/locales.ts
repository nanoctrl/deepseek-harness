/**
 * Diccionarios del namespace `voice-dictation`: la copia del dictado y la de la
 * lectura en voz alta. El chino es el conjunto de claves de referencia; el
 * inglés se verifica completo contra él.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/client/locales
 */

/** Namespace que posee este plugin. */
export const NS = 'voice-dictation'

/** Diccionario en chino simplificado, y conjunto de claves de referencia. */
export const zh = {
  'mic.titleIdle': '语音听写（Ctrl+M）',
  'mic.insertFailed': '无法插入到该会话的输入框，录音已保留',
  'mic.titleRecording': '正在录音 — 双击掌或双击指、Ctrl+M、Enter 或点击可停止',
  'mic.titleTranscribing': '正在转写…',
  'mic.titleRetry': '重试听写',
  'mic.retryHint': ' — 点击重试',
  'mic.download': '下载录音',
  'mic.stop': '停止',
  'mic.unsupported': '当前浏览器不支持麦克风录音',
  'mic.denied': '麦克风权限被拒绝',
  'mic.unavailable': '无法访问麦克风',
  'mic.recordFailed': '录音出错',
  'mic.blobFailed': '构建音频出错',
  'mic.empty': '没有录到音频',
  'mic.readFailed': '读取音频出错',
  'mic.audioEmpty': '音频为空',
  'mic.connection': '连接出错',
  'mic.transcribeFailed': '转写失败',
  'mic.cancelled': '已取消',
  'mic.error': '出错了',
  'speak.idle': '朗读（Ctrl+N 朗读最后一条消息）',
  'speak.playLast': '朗读最后一条消息（Ctrl+N）',
  'speak.loading': '取消朗读',
  'speak.playing': '暂停朗读',
  'speak.paused': '继续朗读',
  'speak.rate': '朗读速度',
  'speak.progress': '朗读进度',
  'speak.retryHint': '点击重试',
  'speak.stop': '停止朗读',
  'speak.blockCode': '代码块，{language}。共 {lines} 行。',
  'speak.blockCodePlain': '代码块。共 {lines} 行。',
  'speak.blockTable': '{rows} 乘 {cols} 的表格。列：{columns}。',
  'speak.blockTableOversized': '屏幕上有一个 {rows} 乘 {cols} 的表格，建议直接看屏幕。',
  'speak.blockList': '列表，共 {count} 项。',
  'speak.image': '这里有一张图片。',
  'speak.imageAlt': '图片：{alt}。',
  'speak.errorNoText': '没有可朗读的文本',
  'speak.errorSynthesis': '语音合成失败',
  'speak.errorPlayback': '无法播放音频',
} satisfies Record<string, string>

/** Unión de claves del namespace. */
export type VoiceDictationKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copia del dictado y de la lectura en voz alta. */
    'voice-dictation': VoiceDictationKey
  }
}

/** Diccionario en inglés, verificado completo contra el conjunto de claves chino. */
export const en = {
  'mic.titleIdle': 'Voice dictation (Ctrl+M)',
  'mic.insertFailed': 'Could not insert into that session\'s composer; the recording was kept',
  'mic.titleRecording': 'Recording — double clap, double snap, Ctrl+M, Enter, or click to stop',
  'mic.titleTranscribing': 'Transcribing…',
  'mic.titleRetry': 'Retry dictation',
  'mic.retryHint': ' — click to retry',
  'mic.download': 'Download recording',
  'mic.stop': 'Stop',
  'mic.unsupported': 'This browser cannot record from a microphone',
  'mic.denied': 'Microphone permission denied',
  'mic.unavailable': 'Could not reach the microphone',
  'mic.recordFailed': 'Recording failed',
  'mic.blobFailed': 'Could not build the audio',
  'mic.empty': 'No audio was recorded',
  'mic.readFailed': 'Could not read the audio',
  'mic.audioEmpty': 'The audio is empty',
  'mic.connection': 'Connection failed',
  'mic.transcribeFailed': 'Transcription failed',
  'mic.cancelled': 'Cancelled',
  'mic.error': 'Something went wrong',
  'speak.idle': 'Read aloud (Ctrl+N reads the last message)',
  'speak.playLast': 'Read the last message (Ctrl+N)',
  'speak.loading': 'Cancel reading',
  'speak.playing': 'Pause reading',
  'speak.paused': 'Resume reading',
  'speak.rate': 'Reading speed',
  'speak.progress': 'Reading progress',
  'speak.retryHint': 'Click to retry',
  'speak.stop': 'Stop reading',
  'speak.blockCode': 'Code block, {language}. {lines} lines.',
  'speak.blockCodePlain': 'Code block. {lines} lines.',
  'speak.blockTable': 'Table of {rows} by {cols}. Columns: {columns}.',
  'speak.blockTableOversized': 'There is a {rows} by {cols} table on screen; better to read it there.',
  'speak.blockList': 'List of {count}.',
  'speak.image': 'There is an image here.',
  'speak.imageAlt': 'Image: {alt}.',
  'speak.errorNoText': 'There is no text to read',
  'speak.errorSynthesis': 'Speech synthesis failed',
  'speak.errorPlayback': 'Could not play the audio',
} satisfies Record<VoiceDictationKey, string>
