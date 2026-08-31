# Agent Note: Stale Client Bundle Externals Drift

Status: implemented

English | [中文](2026-08-29-stale-client-bundle-externals-drift.zh.md)

## Problem

On 2026-08-29 the web-app harness failed to import the `@deepseek-ai/dsh-api-remotes` loader entry at boot: `client-modules: require("zod") missed the module table — not a platform seed word, not a materialized module, and no registered package factory`. The served `lib/client.js` carried one orphaned `let zod = require("zod");` ahead of a fully inlined copy of zod. The bundle came from an intermediate build state produced while three new packages were being wired into the client entry; a clean rebuild of the Client face emitted a bundle with zero `require()` calls.

The client loader resolves `require()` only against the platform seed, materialized modules, and registered bundle factories. The build preset (`packages/client/tsdown.client.ts`, `clientConfig`) inlines everything not explicitly requested from the module table — its comment names zod — so an unrequested specifier surviving as `require()` in a client bundle is always a build-time externals drift. No code change fixed the failure: the runtime error is the designed fail-loud detection, and rebuilding removed the orphaned require.

## Decision

Prevention is operational and recorded here as the diagnosis rule rather than a new gate:

- A healthy client bundle contains no `require()` other than platform seed words and the package's own `dsh.client.external` requests. For `dsh-api-remotes`, which requests none, the healthy count is zero: `grep -o 'require("[^"]*")' lib/client.js` must return nothing.
- After wiring a new package into a client entry (new imports in `src/client/index.ts`, new workspace dependencies, regenerated `/remote` contracts), rebuild the Client face before launching the harness.
- When a boot reports a missed specifier, inspect the served bundle for the orphaned `require()` first; the loader diagnostic already names the specifier and the likely cause.

The runtime keeps failing loud, the bundle purity gate keeps rejecting unrequested `@deepseek-ai/*` imports, and no artifact-scanning build gate is added: the drift exists only in never-committed build output, and the boot-time error names the exact specifier.

## Alternatives considered

**Add zod to the platform seed.** Rejected: the seed is reserved for platform-singleton modules every bundle shares (react, cordis, the UI slot and primitive packages). zod is an ordinary dependency each bundle must inline; a shared instance in the frozen module table buys nothing and erodes the "anything not requested must inline" rule.

**Add an artifact-scanning build gate over `lib/client.js` outputs.** Rejected: the failure mode is intermediate build state that never reaches a commit, the boot-time check already fails loud with the exact specifier, and a second pass over every emitted bundle would pay for a drift the runtime detects for free.

**Make the loader tolerate unknown requires (auto-fetch or a lazy stub).** Rejected: factory-form CJS `require()` is synchronous while bundle arrival is async, so tolerance would surface as undefined exports later in the plugin's lifetime — a deferred, contextless failure instead of the boot-time diagnostic.

## Consequences

- The failure mode and its diagnostic are documented: a missed-specifier boot error points at build drift before code.
- Prevention is a rebuild step, not a check — an intermediate build state stays invisible until the client boots.
- Cross-references: the [generated-contract build note](2026-08-08-api-remotes-generated-contract-build.md) owns the two-face build ordering behind the intermediate state; the [client plugin loading model](../architecture/2026-07-23-client-plugin-loading-model.md) owns the loader resolution branches behind the fail-loud behavior.
