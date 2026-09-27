/** `workspaceColor` namespace dictionaries: the folder-tint menu copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'menu.legend': '文件夹颜色',
  'color.default': '默认',
  'color.blue': '蓝色',
  'color.green': '绿色',
  'color.amber': '琥珀色',
  'color.red': '红色',
  'color.fuchsia': '洋红色',
  'color.deepseek': '深蓝',
} satisfies Record<string, string>

/** The workspace-color namespace key union. */
export type WorkspaceColorKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'menu.legend': 'Folder color',
  'color.default': 'Default',
  'color.blue': 'Blue',
  'color.green': 'Green',
  'color.amber': 'Amber',
  'color.red': 'Red',
  'color.fuchsia': 'Fuchsia',
  'color.deepseek': 'DeepSeek',
} satisfies Record<WorkspaceColorKey, string>
