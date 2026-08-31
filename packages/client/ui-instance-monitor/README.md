# @deepseek-ai/dsh-client-ui-instance-monitor

Web sidebar panel that monitors localhost DeepSeek Harness instances. It registers into the `sidebar.monitor` hole declared by [ui-sidebar](../ui-sidebar/README.md) and polls the host `instanceMonitor` Remote contributed by [dsh-host-instance-monitor](../../host/instance-monitor/README.md).

## Behavior

- The sidebar renders a single collapsed `ds-monitor` trigger button (in the foot stack above Settings); the rail renders nothing.
- Clicking the trigger opens a modal (portal to `document.body`) that polls `ctx.remote.instanceMonitor.list()` every 15 seconds while open.
- The modal renders one row per discovered instance: a status dot (`up` / `degraded` / `down`), the port, the `current` badge for the serving instance, the HTTP status of the root probe, and guarded `Stop` / `Restart` actions.
- Actions call `ctx.remote.instanceMonitor.action({ port, kind })` after a `window.confirm` step; rows for the current instance and for `down` instances disable their action buttons.
- The modal closes on the Close button, a backdrop click, or Escape.
- A load/action failure renders the error line; a successful empty scan renders the empty state.

The host owns all monitoring state; this package holds none beyond the rendered snapshot and the per-row action in-flight set.

## Slot contract

- **Declared by**: ui-sidebar (`sidebar.monitor`, `single`, root scope).
- **Owner share**: `SidebarSectionOwnerProps` (`wide`, `expandSidebar`) via `PropsRuntime<'sidebar.monitor'>`.
- **Injected share**: `InstanceMonitorInjected` (`load`, `act`), built in `apply` from `ctx.remote.instanceMonitor`.
- **Locale namespace**: `instanceMonitor`.

## Model Experience

None, as the panel renders host-computed instance health for a human and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends a provider request.

## Known Limitations and Deferred Work

- **Localhost only** — the panel reflects the host monitor's loopback scan; instances on other machines are never listed.
- **Polling, not push** — the panel refreshes on a fixed interval; a push channel for snapshot changes is a future host-side addition.
- **`restart` needs a configured relaunch** — the host only relaunches instances when `relaunchCommand` is configured; otherwise `restart` terminates without relaunching.
