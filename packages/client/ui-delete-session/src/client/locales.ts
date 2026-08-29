/** `deleteSession` namespace dictionaries: the session-row delete action copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.label': '删除会话',
  'action.busy': '删除中…',
  'confirm.message': '永久删除会话“{title}”？\n\n完整历史将从磁盘移除。此操作无法撤销。',
  'error.live': '会话处于打开状态：请先归档并关闭，再删除。',
  'error.failed': '无法删除会话',
} satisfies Record<string, string>

/** The delete-session namespace key union. */
export type DeleteSessionKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.label': 'Delete session',
  'action.busy': 'Deleting…',
  'confirm.message': 'Permanently delete session "{title}"?\n\nThe full history will be removed from disk. This action cannot be undone.',
  'error.live': 'The session is open: archive and close it before deleting.',
  'error.failed': 'Could not delete the session',
} satisfies Record<DeleteSessionKey, string>
