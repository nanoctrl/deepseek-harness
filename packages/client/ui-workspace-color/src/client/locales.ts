/** `workspaceColor` namespace dictionaries: the folder-tint menu copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'menu.legend': '文件夹颜色',
  'color.default': '默认',
  'color.red': '红色',
  'color.pink': '粉色',
  'color.purple': '紫色',
  'color.indigo': '靛蓝',
  'color.blue': '蓝色',
  'color.cyan': '青色',
  'color.teal': '水鸭色',
  'color.green': '绿色',
  'color.lime': '青柠',
  'color.yellow': '黄色',
  'color.orange': '橙色',
  'color.deeporange': '深橙',
  'color.brown': '棕色',
  'color.bluegrey': '灰蓝',
  'error.failed': '无法保存文件夹颜色',
} satisfies Record<string, string>

/** The workspace-color namespace key union. */
export type WorkspaceColorKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'menu.legend': 'Folder color',
  'color.default': 'Default',
  'color.red': 'Red',
  'color.pink': 'Pink',
  'color.purple': 'Purple',
  'color.indigo': 'Indigo',
  'color.blue': 'Blue',
  'color.cyan': 'Cyan',
  'color.teal': 'Teal',
  'color.green': 'Green',
  'color.lime': 'Lime',
  'color.yellow': 'Yellow',
  'color.orange': 'Orange',
  'color.deeporange': 'Deep Orange',
  'color.brown': 'Brown',
  'color.bluegrey': 'Blue Grey',
  'error.failed': 'Could not save the folder color',
} satisfies Record<WorkspaceColorKey, string>
