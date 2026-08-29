/** Health verdict for one discovered instance at a point in time. */
export type InstanceStatus = 'up' | 'degraded' | 'down'

/** Result of one attempted action against an instance. */
export type InstanceActionResultStatus = 'ok' | 'refused' | 'failed'

/** Base per-instance outcome of a scan probe. */
export interface InstanceRecord {
  /** The port the instance listens on. */
  readonly port: number
  /** Health verdict. `down` is unreachable; `degraded` is reachable but not a usable Harness UI; `up` serves it. */
  readonly status: InstanceStatus
  /** HTTP status code of the root probe, or null when the port refused a request. */
  readonly httpStatus: number | null
  /** Whether the served response carries the Harness client signature. */
  readonly servesHarness: boolean
  /** Whether this is the instance that serves the monitor (never actionable). */
  readonly isCurrent: boolean
  /** PID of the process listening on the port, when discoverable. */
  readonly pid: number | null
  /** Epoch milliseconds of the last probe. */
  readonly lastCheckedAt: number
  /** Last probe/signal error, or null when clean. */
  readonly error: string | null
}

/** Point-in-time snapshot returned by the instance monitor. */
export interface InstanceMonitorSnapshot {
  readonly instances: readonly InstanceRecord[]
  /** Epoch milliseconds of the scan that produced this snapshot. */
  readonly checkedAt: number
}

/** One human-requested action against an instance. */
export interface InstanceAction {
  /** The instance port to act on. */
  readonly port: number
  /** `stop` terminates the process; `restart` terminates and, when a relaunch is configured, starts a fresh one. */
  readonly kind: 'stop' | 'restart'
}

/** Result surfaced to the client for one action attempt. */
export interface InstanceActionResult {
  readonly kind: 'stop' | 'restart'
  readonly port: number
  readonly status: InstanceActionResultStatus
  /** Human-readable reason for `refused` / `failed`. */
  readonly detail: string
}
