/**
 * Localhost DSH instance monitor.
 *
 * Scans a configurable loopback port range on a timer, probes each open port,
 * and classifies it as `up` (serves a Harness UI), `degraded` (reachable but
 * not a usable Harness UI — stale frontend, 4xx/5xx, or a non-Harness server),
 * or `down` (unreachable). The snapshot is published through the `instanceMonitor`
 * Remote so a browser client surface can render it, and hosts the `stop` /
 * `restart` actions.
 * @module @deepseek-ai/dsh-host-instance-monitor
 */

import { spawn, spawnSync } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'
import type {
  InstanceActionResult,
  InstanceAction,
  InstanceMonitorSnapshot,
  InstanceRecord,
  InstanceStatus,
} from './types.ts'

export type * from './types.ts'

/** Harness client signature present in the served root document. */
const HARNESS_SIGNATURE = '__ModuleLoader__'

/** Plugin configuration. */
export interface Config {
  /** Master switch; false disables the scan loop and the service. Default true. */
  enabled?: boolean
  /** First port of the scanned loopback range. Default 3070. */
  portStart?: number
  /** Last port of the scanned loopback range (inclusive). Default 3110. */
  portEnd?: number
  /** Scan cadence in milliseconds. Default 10000. */
  pollIntervalMs?: number
  /** Per-probe HTTP timeout in milliseconds. Default 1200. */
  probeTimeoutMs?: number
  /** Port of the instance serving this monitor; it is never targeted by an action. */
  selfPort?: number
  /** Command + arguments to relaunch an instance on `restart` (optional; stop-only otherwise). */
  relaunchCommand?: string[]
  /** Working directory for the relaunch. */
  relaunchCwd?: string
}

/** Read the PID that owns a loopback `port`, or null when undeterminable. */
function listPortPid(port: number): number | null {
  try {
    const res = spawnSync('lsof', ['-tiTCP:' + String(port), '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 2500 })
    if (res.status !== 0 || res.stdout === '') return null
    const first = res.stdout.trim().split('\n')[0] ?? ''
    const pid = Number.parseInt(first, 10)
    return Number.isFinite(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

/** Detach and launch a configured relaunch command. */
function relaunch(config: Config): void {
  if (!config.relaunchCommand || config.relaunchCommand.length === 0) return
  const [cmd, ...args] = config.relaunchCommand
  if (cmd === undefined) return
  spawn(cmd, args, { cwd: config.relaunchCwd, detached: true, stdio: 'ignore' }).unref()
}

/** Probe one loopback port and classify it. */
async function probePort(
  port: number,
  timeoutMs: number,
  selfPort: number | undefined,
): Promise<InstanceRecord> {
  const base = { port, isCurrent: selfPort === port, lastCheckedAt: Date.now(), pid: listPortPid(port) }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch('http://127.0.0.1:' + String(port) + '/', {
      signal: controller.signal,
      redirect: 'manual',
    })
    clearTimeout(timer)
    let body = ''
    try {
      body = await response.text()
    } catch {
      /* body read is best-effort for signature detection */
    }
    const servesHarness = body.includes(HARNESS_SIGNATURE)
    const status: InstanceStatus = servesHarness ? 'up' : 'degraded'
    return { ...base, httpStatus: response.status, servesHarness, status, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const unknown = message.includes('abort') ? '' : message
    return { ...base, httpStatus: null, servesHarness: false, status: 'down', error: unknown || null }
  }
}

/** Build one full snapshot. */
async function scan(config: Config): Promise<InstanceMonitorSnapshot> {
  const a = config.portStart ?? 3070
  const b = config.portEnd ?? 3110
  const start = Math.min(a, b)
  const end = Math.max(a, b)
  const timeoutMs = config.probeTimeoutMs ?? 1200
  const records: InstanceRecord[] = []
  for (let port = start; port <= end; port++) {
    records.push(await probePort(port, timeoutMs, config.selfPort))
  }
  return { instances: records, checkedAt: Date.now() }
}

/** Remote-only gateway exposing the localhost instance monitor snapshot. */
export class InstanceMonitorGateway extends TypertRemoteService {
  static Config: z<Config> = z.object({
    enabled: z.boolean().default(true),
    portStart: z.number().default(3070),
    portEnd: z.number().default(3110),
    pollIntervalMs: z.number().default(10000),
    probeTimeoutMs: z.number().default(1200),
    selfPort: z.number(),
    relaunchCommand: z.array(z.string()),
    relaunchCwd: z.string(),
  })

  private snapshot: InstanceMonitorSnapshot = { instances: [], checkedAt: Date.now() }

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'instanceMonitor')
    if (this.config.enabled === false) return
    ctx.effect(() => {
      void this.refresh()
      const timer = setInterval(() => void this.refresh(), this.config.pollIntervalMs ?? 10000)
      return () => clearInterval(timer)
    })
  }

  /**
   * The latest snapshot, or an empty snapshot before the first scan completes.
   */
  @Remote('list')
  list(): InstanceMonitorSnapshot {
    return this.snapshot
  }

  /**
   * Run one action against a discovered instance. `stop` SIGTERMs the listening
   * process; `restart` stops it and, when a relaunch command is configured,
   * starts a fresh process. Both refuse to target this monitor's own instance.
   */
  @Remote('action')
  action(payload: InstanceAction): InstanceActionResult {
    const instance = this.snapshot.instances.find(candidate => candidate.port === payload.port)
    if (instance === undefined) {
      return { kind: payload.kind, port: payload.port, status: 'failed', detail: 'instance not in snapshot' }
    }
    if (instance.isCurrent) {
      return { kind: payload.kind, port: payload.port, status: 'refused', detail: 'refusing to act on this monitor\'s own instance' }
    }
    const pid = instance.pid ?? listPortPid(payload.port)
    if (pid === null) {
      return { kind: payload.kind, port: payload.port, status: 'refused', detail: 'no listening process found on the port' }
    }
    try {
      process.kill(pid, 'SIGTERM')
    } catch (error) {
      return {
        kind: payload.kind,
        port: payload.port,
        status: 'failed',
        detail: error instanceof Error ? error.message : String(error),
      }
    }
    const hasRelaunch = Boolean(this.config.relaunchCommand && this.config.relaunchCommand.length > 0)
    if (payload.kind === 'restart') {
      if (!hasRelaunch) {
        return { kind: payload.kind, port: payload.port, status: 'ok', detail: 'terminated; no relaunch configured' }
      }
      try {
        relaunch(this.config)
        return { kind: payload.kind, port: payload.port, status: 'ok', detail: 'terminated and relaunched' }
      } catch (error) {
        return {
          kind: payload.kind,
          port: payload.port,
          status: 'failed',
          detail: 'terminated but relaunch failed: ' + (error instanceof Error ? error.message : String(error)),
        }
      }
    }
    return { kind: payload.kind, port: payload.port, status: 'ok', detail: '' }
  }

  private async refresh(): Promise<void> {
    this.snapshot = await scan(this.config)
  }
}

export default InstanceMonitorGateway
