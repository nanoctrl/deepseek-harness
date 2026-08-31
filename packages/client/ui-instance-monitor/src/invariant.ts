/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-instance-monitor`.
 * @module @deepseek-ai/dsh-client-ui-instance-monitor/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-instance-monitor'

/** Cordis companion plugin name. */
export const name = 'client-ui-instance-monitor-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure-consumer plugin polling the host
 * `instanceMonitor` Remote and rendering the snapshot in-component. It emits
 * no cordis events, owns no cross-plugin mutable state, and its presentation
 * behavior is asserted by component specs, not by an owned event relationship.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
