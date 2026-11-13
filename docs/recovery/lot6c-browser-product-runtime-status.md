# Lot 6C browser product runtime qualification status

Date: 2026-11-12 (America/Recife)

Work branch: `recovery/lot6c-browser-product-runtime-20261112`

Canonical branch: `recovery/site109-reconstruction-20261112`

Reconciled candidate before this status commit: `612dc0a594498819aa90bc5b0245871d43a43dbe`

Qualification workflow run: `43355994545`

Status: **QUALIFIED — functional browser integration only**

## Scope qualified

This step qualifies the real Vite browser entry path:

`src/main.ts` → `BrowserGameRuntime` → protocol-compatible synthetic `Worker` → shared product dispatch → shared presentation → real DOM and canvas effects.

The harness dynamically imports the actual `src/main.ts`, replaces only the browser `Worker` boundary with a deterministic protocol-compatible implementation, then drives the rendered product interface in headless Chrome.

The qualification proves the product integration around the Worker boundary. It does not claim to qualify the internal Pyodide or native game implementation executed by the real game Worker.

No production source file, game rule or game-specific solution was changed by this step. The changes are limited to a browser fixture, qualification scripts, report-contract tests, CI workflow and this recovery status document.

## Reconciliation with the canonical branch

While this qualification was running, the canonical reconstruction branch advanced with the browser FieldStock OP18 transport. The current qualification branch was therefore reconciled with canonical commit `db2fb0f5051c6b7e1b4a599edee7c31158d62557` before the final evidence run.

The reconciled candidate is merge commit `612dc0a594498819aa90bc5b0245871d43a43dbe`. All evidence below was rerun on that combined candidate rather than on the earlier branch base.

## Evidence

GitHub Actions workflow run `43355994545` completed successfully on the reconciled candidate.

### Production build

`npm run build` passed, including:

- preparation of self-hosted browser Python assets;
- generation of content pages and the 100-game gallery;
- `tsc --noEmit`;
- Vite production build;
- 53 transformed modules.

### Complete regression suite

The complete TypeScript regression suite passed under Node.js 22.18.0 with TypeScript transformation enabled:

- tests: **330**;
- passed: **330**;
- failed: **0**;
- cancelled: **0**;
- skipped: **0**.

The explicit transformation flag is required because Node.js 22 strip-only TypeScript mode does not support constructor parameter properties already used by the repository. The initial strip-only run produced 274 passes and 8 loader failures; no product assertion failed. The CI command was corrected to use `--experimental-transform-types`, and the entire suite then passed.

### Browser report contract

The independent report-contract suite passed:

- tests: **5**;
- passed: **5**;
- failed: **0**.

The contract rejects missing busy acquisition, lost ACTION6 coordinates, canvas paint regressions and terminal-feedback drift.

### Real-browser functional qualification

Headless Google Chrome `156.0.8078.79` loaded the real Vite `src/main.ts` product path and qualified:

- exactly **1** product Worker instance;
- exactly **3** protocol requests: initial `load`, simple `ACTION1`, addressed `ACTION6`;
- preservation of the ACTION6 canvas coordinates;
- exactly **2** busy acquire/release transitions, one per dispatched action;
- exactly **3** observed canvas states: initial, simple-action and terminal-action frames;
- initial URL synchronization for game and level;
- runtime overlay removal after load;
- non-terminal feedback remaining empty;
- terminal `Level 1 complete.` feedback;
- visible terminal overlay titled `Level complete`.

The generated qualification report was uploaded as GitHub Actions artifact `14005878005` (1,020 bytes).

The first browser attempt exposed only a harness-oracle issue: browser `MouseEvent.clientX` and `clientY` are integer-valued, while the expected point had been calculated from pre-dispatch fractional values. The product correctly transmitted the browser event coordinates. The oracle was corrected to derive its expected point from the actual dispatched event; no production code changed.

## Interpretation

This closes the remaining controlled-DOM-to-real-`main.ts` browser integration frontier for Lot 6C. The already qualified product dispatch, Worker transport, presentation sequence, DOM effects and end-to-end bridge are now also exercised together through the real compiled browser entry point.

This is a functional integration qualification. It is deliberately not an official performance acceptance result.

## Performance disposition

No official timing result is claimed in this step.

The official C7 performance protocol remains blocked until the repository contains and validates the complete official harness inputs and the four-runner manifest required by the existing C7 readiness gate. The repository tests explicitly preserve the blocked state when harness files or runner declarations are missing.

When readiness becomes green, the next performance step remains:

1. hard reset and controlled warm-up;
2. ABBA A/B measurements for STCK and SMLP on all four required runners;
3. per-phase and global comparison with the established acceptance rule that global per-game regression remains below 10%, while a phase may exceed 10% only when the global result remains below 10%;
4. recording of medians, retained counters and exact commit identities.

## Publication disposition

No Site publication is included in this step. Publication remains downstream of canonical integration and the unresolved official performance gate. After publication, GitHub ↔ Site commit identity must be verified according to `docs/migration/git-site-sync-policy.md`.

## Next step

Restore or locate the complete official C7 performance harness and its four-runner manifest, make the readiness gate green without inventing substitutes, then execute the official ABBA measurements before any Site publication.
