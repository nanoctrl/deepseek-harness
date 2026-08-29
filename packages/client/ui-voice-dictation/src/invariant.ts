/** Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-voice-dictation`.
 * @module @deepseek-ai/dsh-client-ui-voice-dictation/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-voice-dictation'

/** Cordis companion plugin name. */
export const name = 'client-ui-voice-dictation-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a pure-consumer plugin driving the host `voiceTranscribe`
 * Remote and rendering the recording overlay. It emits no cordis events and owns
 * no cross-plugin mutable state; the presentation behavior is asserted by its
 * component specs, not an owned event relationship.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
