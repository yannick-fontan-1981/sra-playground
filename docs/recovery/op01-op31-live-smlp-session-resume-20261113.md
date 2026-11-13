# OP01–OP31 live SMLP browser session resume qualification - 2026-11-13

## Status

**Qualified for functional in-memory continuity in a real headless Chrome browser using the real module Worker, Pyodide and Python SMLP engine.**

This proof closes the real-browser sub-boundary of C1. It does not claim durable persistence through a page reload, a browser-process restart, another machine or an external store.

## Qualified execution

- Repository: `yannick-fontan-1981/sra-playground`
- Canonical integration commit for the reusable fixture: `e465e78aa48b69e81e8b5afadbc094428387cfe9`
- Qualified source commit: `abda7e50be688b62de7ed6b36fdf405d6f7ee8ac`
- GitHub Actions run: `43439234643`
- Job: `131932196246`
- Browser: `HeadlessChrome/157.0.0.0`
- Game: `SMLP`, level 1
- Runtime backend: `python-wasm`
- Physical action: `ACTION6` at `(32, 26)`
- Original artifact id: `14044696579`
- Original artifact digest: `sha256:40460ca2a5c1026a672895df18b15fb08981a04aa42a92e307a9f58e7be7699b`

## Runtime chain exercised

```text
BrowserAgentController / BrowserCommonCampaignHost
→ BrowserGameRuntime
→ real module Worker
→ Pyodide
→ game_bridge.py
→ custom-games.zip
→ Python SMLP engine
→ returned public observation
→ campaign acquisition
→ next controller state
```

No synthetic Worker and no mocked Python response are used for the physical game transition.

## Scenario A - Manual stop and Agent reactivation

The controller starts from the real SMLP observation, sends one ACTION6 through Worker/Pyodide, receives `deactivate("manual")` while the action is pending, settles the return exactly once, retains its checkpoint and then activates again from a fresh host.

| Assertion | Result |
|---|---:|
| Real Worker instances | 1 |
| Worker action requests | 1 |
| Physical action calls | 1 |
| Presentations | 1 |
| Routed acquisitions | 1 |
| Hosts created | 2 |
| First stop reason | `manual` |
| Second stop reason | `action-limit` |
| Same session id preserved | yes |
| Same dispatched-action count preserved | yes, `1` |
| New Worker request after reactivation | 0 |
| Physical replay | 0 |
| Duplicate presentation | 0 |
| Duplicate acquisition | 0 |
| Changed public pixels | 9 |

The final public-frame hash differs from the initial hash.

## Scenario B - return already dispatched before restoration

A checkpoint is captured with `pendingReturn.stage = "dispatched"`. The physical return then settles. A fresh host restores that checkpoint against the already-live returned observation and acquires it with status `resumed`.

| Assertion | Result |
|---|---:|
| Real Worker instances | 1 |
| Worker action requests | 1 |
| Physical action calls | 1 |
| Original presentations | 1 |
| Original acquisitions | 1 |
| Captured pending stage | `dispatched` |
| Restored status | `resumed` |
| Returned sequence | `1` |
| Same `needId` preserved | yes |
| Physical replay | 0 |
| Duplicate presentation | 0 |
| Restored acquisition duplicate flag | `false` |
| Changed public pixels | 9 |

## Consolidated result

| Measure | Result |
|---|---:|
| Real Workers qualified | 2 |
| Physical actions qualified | 2 |
| Controller reactivations qualified | 1 |
| Dispatched returns resumed | 1 |
| Replayed actions | 0 |
| Duplicate presentations | 0 |

The generated structured proof is stored in:

`docs/recovery/op01-op31-live-smlp-session-resume-qualified.json`

## Regression validation

The qualifying run passed:

- production build;
- complete TypeScript regression suite, **396/396**;
- report-contract suite, **5/5**;
- real Chrome, Worker, Pyodide and SMLP qualification.

## Performance disposition

This is a functional qualification only.

- Snapshot and restore duration were not used as acceptance criteria.
- The official C7 Region performance scope remains unchanged.
- No capability is promoted to `official-qualified` performance status by this proof.
- Snapshot creation, restoration and resumed acquisition must be measured separately before any complete-loop performance claim.

## Exact remaining boundary

Still open:

- durable, versioned checkpoint storage;
- restoration after page reload or browser-process restart;
- restoration on another machine;
- the literal public DOM interaction sequence selecting Manual and then Agent;
- official performance of checkpoint and restore;
- recovery of any identity in the historical 76-slot registry;
- Site publication and GitHub ↔ Site parity.

## Next step

```text
serialize the retained browser checkpoint
→ store it durably with an explicit schema version and expiry policy
→ reload the page or start a new browser process
→ restore the game observation and campaign checkpoint together
→ acquire an already-sent return without replay
→ measure snapshot and restore costs independently
```
