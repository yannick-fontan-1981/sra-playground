# Original common-caller acquisition oracle

This is development evidence for the native TypeScript transfer. The Python
reference is not imported by the website or packaged in its agent worker.
The fixtures below test `NativeCallerCoordinator` independently. The coordinator
is now also connected to the product runtime. A separate integration test starts
from the public HANO packet, without restoring oracle state, and matches all eight
caller component states after the first released prefix. Complete V6 provider
coverage remains pending.

## Recorded cases and result

| Fixture | Original host and choices | Physical actions | Sealed prefixes | Native comparisons |
| --- | --- | ---: | ---: | ---: |
| `tests/fixtures/v6-native-caller/hano-first-prefix.json` | Original HANO engine; ordered support transfer | 2 | 1 | 15 passed |
| `tests/fixtures/v6-native-caller/viewport-three-prefixes.json` | Synthetic public ACTION5 viewport; two observed-effect experiments, then `public_view_frontier / approach_view_edge` | 3 | 3 | 29 passed |

The 44 comparisons include acquisition returns, complete component states,
caller-owned facts, assessments, Frontier deltas, and six physical guards in
the viewport case. The Node test reports **47 passing tests** because it also
counts one provenance test and the two parent cases. The targeted run took
3.85 seconds in this workspace; runtime varies by machine.

Neither case completes a level. The viewport case is synthetic and carries no
ARC score claim. These results do not establish full strategy election, full
caller parity, or game-campaign parity. Earlier nine-level HANO/SYME/DNOI
results predate full WHY/ACT acquisition integration and are a separate baseline.

## Capture method

The pinned original caller is
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py`.
The exporter executes its unchanged `main`, with no strategy replacement or
interception of decisions. All 1,786 source-manifest files are byte-verified
before and after the run.

A separate outer host owns the game engine. Only public pixels, animation
frames, available actions, official state, level, score and step index cross
the pipe into the reference solver. The reference process receives no engine
instance, hidden puzzle state, expected action list or solution route.

Trace/profile observers copy actual locals and returned values at these phases:

1. Initial observation and retained Frontier delta.
2. Original WHY/ACT physical release, before any host action.
3. Each acquired transition, immediately before assessment.
4. Completed transition after assessment, Frontier deltas and empirical registry.
5. Sealed-prefix analysis after original OP29, OP30 and OP31 execution.

An external diagnostic exception stops after a completed prefix and its
analysis. It does not shorten the planner's input allowance: the original
arguments remain three target levels, 160 actions per level and 480 overall.
The diagnostic stop is neither a solved level nor a rejected decision.

`scripts/v6-caller-host-boundary.py` contains public transport validation,
active-clock accounting, manifest verification and a single-process lease.
It has no solver, source transformer, browser-agent service or generator
rendezvous. The unchanged custom transport imports a dependency stub that
rejects any attempt to construct an engine in the reference process.

The retained fixture bytes are the original historical captures. Their initial
development host rewrote only the unused game-construction import; it never
rewrote `main` or a reasoning function. The repository exporter removes even
that import rewrite. It has been run afresh for both cases, reproducing their
actions, capture counts and successful native differentials. Physical timestamps
and development-host paths naturally differ between fresh runs.

## Retained data and comparison scope

Each fixture contains content-addressed `objects`, caller `snapshots`, ordered
`events`, the original physical `execution` journal, public-protocol packets,
source verification and action budgets. Resolve `{ "$object": "…" }` through
the fixture's object table. Interning removes repeated JSON storage, without
dropping semantic values.

Dynamic facts and traces are complete. The immutable catalog is identified by
original hashes and row counts. Meter and collection state, original timestamps,
post-prefix analyses and original caller-owned events remain in the fixture.
Raw locals can retain an earlier loop's value; the event stream identifies newly
produced returns. The differential performs no field normalization.

The native comparator restores each original **released-prefix checkpoint**,
then acquires witnessed transitions in source order: Attention, View, selected
family callback, Goal, Point/curiosity/Control, assessment and Frontier. This
bounded comparison omits the selected-family callback and expects its nullable
return to be absent; that callback has its own ordered-support source oracle.
It does not replay complete strategy selection or post-prefix WHY/ACT execution.
Their original results remain available for later integration tests.

Source facts outside the current coordinator are reported explicitly:

- `addressed_material_event`
- `framed_transfer_event`
- `support_navigation_event`
- `ordered_support_state`
- `repeated_series_state`
- `temporal_selection_state`

Support navigation and ordered-support state are selected-family work.
The other acquisitions still need their corresponding coordinator integration.
No score boundary occurs in these cases, so Goal event replay and Frontier
boundary reconstruction are checked separately by the real-game campaign
runner, `tests/helpers/v6-live-game-campaign.ts`. No completion gate is relaxed
by these tests.

In the connected runtime, `ordered_support_state` is now acquired as a source
fact as well as a real family state node. The selected OrderedSupport event is
also retained; the complete SupportNavigation aggregate is still missing.
AddressedMaterial, FramedTransfer, RepeatedSeries and TemporalSelection remain
outside the connected acquisition coverage. The bounded fixture comparator
retains its original exclusion list so its historical scope remains explicit.

## Reproduction

The committed Node tests need no Python execution:

```bash
node --test tests/v6-native-caller.test.ts
```

To generate fresh reference captures, run the development exporter from the
repository root in a Python environment with the original reference dependencies.
Choose new output directories; the exporter rejects existing destinations.

```bash
python scripts/export-v6-caller-reference.py --case HANO --prefixes 1 --output /tmp/v6-caller-hano
python scripts/export-v6-caller-reference.py --case viewport --prefixes 3 --output /tmp/v6-caller-view
node scripts/compare-v6-caller-reference.ts /tmp/v6-caller-hano/oracle.json
node scripts/compare-v6-caller-reference.ts /tmp/v6-caller-view/oracle.json
```

An optional second argument to the comparison script saves the full differential
report. The exporter includes complete snapshots, public transport packets,
original output files and a summary in its output directory. Its default wall
diagnostic bound is 360 seconds; measured generation here was approximately
38 seconds for HANO and 53 seconds for the viewport case. Generation is a
development-only operation and is not part of the component test suite or build.
