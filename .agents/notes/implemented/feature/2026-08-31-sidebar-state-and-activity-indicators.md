# Agent Note: Sidebar state and activity indicators

Status: implemented

English | [中文](2026-08-31-sidebar-state-and-activity-indicators.zh.md)

## Problem

The sidebar communicated session state through a 10px `StateDot` whose running state was a dim blue pixel-chase (base opacity 0.15), nearly invisible at sidebar scale. An idle session rendered no dot at all, so the list gave no persistent per-row state signal, and a workspace gave no signal when a session inside it was running.

## Decision

Every sidebar session row shows a `StateDot` state indicator; only the provisional blank row omits it. The states are green `done` for idle or completed, amber `warning` for a pending interaction (approval, question, plan review), fuchsia `ongoing` while running (own or subagent descendant), and red `error` where a surface carries an error. The `ongoing` state was redesigned from a 3x3 pixel matrix into a ring of eight lights chasing clockwise around a soft glow core.

The activity color is fuchsia, added as `--dsw-static-fuchsia-500` and exposed through the new semantic alias `--dsw-alias-state-ongoing-primary` (light and dark). `StateDot` pins a component-local `--dsh-state-ongoing` to that alias. A workspace group with any visible running session (`GroupNode.hasActivity`, derived from a member's own `running` or its `runningSubagentCount`) renders its folder icon in the activity color with a `folder-activity` blink (opacity 1 -> 0.4 over 1.2s), disabled under `prefers-reduced-motion`.

## Consequences

The session rows now carry a persistent state signal instead of a dot only while active or finished-and-unviewed; the completion-reminder set in the earlier note is unchanged, and this note owns the row rendering that changed. The `ongoing` color changed from DeepSeek blue to fuchsia across every `StateDot` consumer (terminal cards, subagents, jobs, workflow runs) because the primitive is shared. No data, wire, or configuration format changes: `GroupNode.hasActivity` is a derived presentation fact, like `containsCurrent`.

## Alternatives considered

- **Keep the blue pixel-chase and only enlarge it.** Rejected: the requested activity color is an intense fuchsia and the requested shape is a circular light ring; blue stays the brand accent and the pixel matrix reads as a static square at small size.
- **Overlay an activity badge on the folder.** Rejected: the folder itself should signal activity, so it blinks instead of carrying a separate badge.

## Related

- [Session completion dot in the sidebar](2026-08-06-session-completed-done-dot.md) — the completion-reminder set this always-visible dot builds on.
