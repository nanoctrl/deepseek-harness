# @deepseek-ai/dsh-host-instance-monitor

Localhost DeepSeek Harness instance monitor. It scans a configurable loopback port range on a timer, probes each port, and classifies every reachable address as `up`, `degraded`, or `down`. The resulting snapshot is published as the `instanceMonitor` host service and read by the [instance-monitor Remote] wiring and the web-sidebar client surface.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Master switch; `false` disables the scan loop and the service. |
| `portStart` | `3070` | First port of the scanned loopback range. |
| `portEnd` | `3110` | Last port of the scanned loopback range (inclusive). |
| `pollIntervalMs` | `10000` | Scan cadence in milliseconds. |
| `probeTimeoutMs` | `1200` | Per-probe HTTP timeout in milliseconds. |
| `selfPort` | — | Port of the instance serving this monitor; never targeted by an action. |
| `relaunchCommand` | — | Command + arguments to relaunch an instance on `restart` (stop-only otherwise). |
| `relaunchCwd` | — | Working directory for the relaunch. |

## Health classification

| Status | Meaning |
|---|---|
| `up` | The port serves a response carrying the Harness client signature. |
| `degraded` | Reachable but not a usable Harness UI — stale frontend, 4xx/5xx, or a non-Harness server. |
| `down` | Unreachable (connection refused, timeout, or no listener). |

## Service contract

`ctx.instanceMonitor` provides:

- `list(): InstanceMonitorSnapshot` — the latest snapshot (empty until the first scan completes).
- `action(payload: InstanceAction): InstanceActionResult` — `stop` or `restart` an instance. `stop` sends `SIGTERM` to the listening process; `restart` stops it and, when a relaunch command is configured, starts a fresh process. Both refuse to target the monitor's own instance (`selfPort`).

## Model Experience

None, as the package probes localhost and publishes a host-service snapshot; nothing reaches a model request.

#### KV Cache effect

None; the package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Localhost only** — no registry of instances exists, so discovery is a loopback port scan. Instances on other machines are invisible.
- **`lsof` dependency** — PID resolution and therefore `stop`/`restart` depend on `lsof` being on `PATH`; without it the actions report the instance as not actionable.
- **`restart` cannot reliably relaunch an arbitrary instance** — a discovered instance does not record how it was launched, so `restart` needs an explicit `relaunchCommand` (plus `relaunchCwd`); otherwise it only stops.
- **The remote/client wiring is out of this package** — this package owns discovery, health, and the host service. The browser Remote gateway and the sidebar widget live in the instance-monitor client integration.
