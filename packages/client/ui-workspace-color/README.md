---
description: "Workspace folder tint menu for the dsh web client: the tint rows a Workspace header menu shows, over the workspaceColor Remote."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-workspace-color

## Summary

`dsh-client-ui-workspace-color` adds the folder-tint rows to a Workspace header menu in the dsh web client. Selecting a row writes the tint through the `workspaceColor` Remote and republishes the map the sidebar reads to paint the folder glyph. The plugin registers into ui-workspace's `sidebar.workspaces.row.menu.item` slot, so its rows join the menu's keyboard walk as ordinary entries; without the plugin the slot stays empty and every folder keeps the theme color.

## Table of Contents

- [Use this package](#use-this-package)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Mount the package in a Web profile beside ui-workspace and the `workspaceColor` Remote. It publishes the current tints as the `workspaceColorTints` service, which ui-workspace reads to tint a row; the first reader triggers the request for the stored map.

## Known Limitations and Deferred Work

No runtime invariant companion is published: the plugin owns one snapshot map and its only writer is the Remote acknowledgement for the row the user picked.
