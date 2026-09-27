/**
 * Wire vocabulary of the per-workspace folder tint: the closed color set and
 * the request/result payloads the `workspaceColor` Remote carries. Types only
 * (the runtime member list lives in `spec.ts`).
 * @module @deepseek-ai/dsh-host-workspace-color/src/types
 */

/**
 * Folder tint a workspace may carry. A closed set of Theme aliases, never a
 * free color value: the Client maps each member to its own
 * `--dsw-alias-workspace-tint-*` token. `default` keeps the Theme's own folder
 * color and is stored as the absence of a row.
 */
export type WorkspaceColor =
  | 'default'
  | 'red' | 'pink' | 'purple' | 'indigo'
  | 'blue' | 'cyan' | 'teal'
  | 'green' | 'lime'
  | 'yellow' | 'orange' | 'deeporange'
  | 'brown' | 'bluegrey'

/** Every stored tint, keyed by Workspace id. Workspaces without a row are `default`. */
export interface WorkspaceColorMap {
  readonly colors: Readonly<Record<string, WorkspaceColor>>
}

/** One tint assignment. */
export interface SetWorkspaceColorInput {
  /** The Workspace whose folder is tinted. */
  readonly workspaceId: string
  /** The tint to store; `default` removes the row. */
  readonly color: WorkspaceColor
}

/** Acknowledgement of an applied tint. */
export interface SetWorkspaceColorResult {
  readonly workspaceId: string
  readonly color: WorkspaceColor
}
