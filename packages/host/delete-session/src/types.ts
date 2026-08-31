/** Input for a permanent session deletion request. */
export interface DeleteSessionInput {
  /** The session to delete permanently. */
  readonly sessionId: string
}

/** Result surfaced to the client for one deletion attempt. */
export interface DeleteSessionResult {
  readonly deleted: boolean
  /** Human-readable reason when `deleted` is false (refused or failed). */
  readonly detail: string
}
