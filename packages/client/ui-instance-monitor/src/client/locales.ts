/** `instanceMonitor` namespace dictionaries: the sidebar instance-monitor panel copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger.label': 'dsh-instances',
  'modal.close': '关闭',
  'panel.title': 'DSH 实例',
  'status.up': '正常',
  'status.degraded': '异常',
  'status.down': '离线',
  'row.current': '当前',
  'row.http': 'HTTP',
  'action.stop': '停止',
  'action.restart': '重启',
  'confirm.stop': '确认停止该实例？',
  'confirm.restart': '确认重启该实例？',
  'panel.error': '监控不可用',
  'panel.empty': '未发现 DSH 实例',
  'panel.lastChecked': '更新于',
} satisfies Record<string, string>

/** The instance-monitor namespace key union. */
export type InstanceMonitorKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger.label': 'dsh-instances',
  'modal.close': 'Close',
  'panel.title': 'DSH Instances',
  'status.up': 'Up',
  'status.degraded': 'Degraded',
  'status.down': 'Down',
  'row.current': 'current',
  'row.http': 'HTTP',
  'action.stop': 'Stop',
  'action.restart': 'Restart',
  'confirm.stop': 'Stop this instance?',
  'confirm.restart': 'Restart this instance?',
  'panel.error': 'Monitor unavailable',
  'panel.empty': 'No DSH instances found',
  'panel.lastChecked': 'Checked',
} satisfies Record<InstanceMonitorKey, string>
