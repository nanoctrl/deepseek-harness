/** `workspaceColor` namespace dictionaries: the folder-tint menu copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'menu.legend': '文件夹颜色',
  'color.default': '默认',
  'color.blue': '蓝色',
  'color.sky': '天蓝',
  'color.navy': '藏青',
  'color.green': '绿色',
  'color.lime': '青柠',
  'color.amber': '琥珀色',
  'color.orange': '橙色',
  'color.red': '红色',
  'color.coral': '珊瑚色',
  'color.fuchsia': '洋红色',
  'color.deepseek': '深蓝',
  'color.lavender': '薰衣草',
} satisfies Record<string, string>

/** The workspace-color namespace key union. */
export type WorkspaceColorKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'menu.legend': 'Folder color',
  'color.default': 'Default',
  'color.blue': 'Blue',
  'color.sky': 'Sky',
  'color.navy': 'Navy',
  'color.green': 'Green',
  'color.lime': 'Lime',
  'color.amber': 'Amber',
  'color.orange': 'Orange',
  'color.red': 'Red',
  'color.coral': 'Coral',
  'color.fuchsia': 'Fuchsia',
  'color.deepseek': 'DeepSeek',
  'color.lavender': 'Lavender',
} satisfies Record<WorkspaceColorKey, string>
