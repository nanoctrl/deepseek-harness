---
description: "Per-workspace folder tint: a durable one-row-per-workspace color registry served over its own workspaceColor Remote."
kind: "package-reference"
---

# @deepseek-ai/dsh-host-workspace-color

## Summary

`dsh-host-workspace-color` stores the folder tint a user picks for each Workspace and serves it over the `workspaceColor` Remote. It keeps its own storage domain, so a chosen color survives a GUI reload without adding a field to the Workspace record that another package owns. An absent row means the default tint, so the table holds only the workspaces a user actually tinted.

## Table of Contents

- [Use this package](#use-this-package)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the package in a Host composition to expose the `workspaceColor` Remote. The server reads every stored tint with `all()` and writes one with `set({ workspaceId, color })`; `default` clears the row rather than storing it. The accepted colors are the members of `WORKSPACE_COLORS`, validated before the write.

## Known Limitations and Deferred Work

No runtime invariant companion is published: the package owns one key-value table whose single write path validates the closed color set before storing, so no independent observation can diverge from it.
