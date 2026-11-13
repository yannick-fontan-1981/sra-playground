# V6 delivery roadmap — canonical reconstruction

> Reconstructed on 2026-11-12 from durable GitHub evidence.
>
> This document is **not** the lost historical roadmap and does not certify that
> the current GitHub tree is identical to Site 109 / native 0.68.

## 1. Canonical source and publication rule

Canonical code source:

`yannick-fontan-1981/sra-playground`

Canonical reconstruction branch:

`recovery/site109-reconstruction-20261112`

Mandatory publication chain:

`work → tests → commit → push GitHub → integrate canonical reconstruction → Site publish → verify GitHub SHA ↔ Site SHA`

No Site publication is authorized from an unpushed or temporary-only checkout.

## 2. Historical reference, evidence only

The historical target being reconstructed is recorded as:

- Site 109;
- historical native version 0.68;
- historical registry count 70/76;
- historical Site/source SHA `d90ce5b64fffa53cca201e2a6a49450fd123f299`.

That SHA is not resolvable in the accessible GitHub repository.

Therefore the current reconstruction must not be described as an exact Site 109
copy until parity is re-established.

Historical Lot 9 evidence also records a former 0.69 candidate at 71/76 and
28/33 material, but its source checkpoint is unresolved and that count is not
promoted to the current reconstruction.

## 3. Current reconstructed V6 foundation

The canonical branch currently contains and has targeted functional evidence for:

- V6 operations;
- composition engine;
- native authority;
- target binding;
- operation cache;
- operation cycle;
- operation trace.

Targeted V6-core qualification recorded by Lot 9 restart:

**27/27 tests passed.**

The OP01–OP31 recovery lane has additionally reconstructed operation contracts,
tracing and core calculation coverage. Its own audit documents remain the
authority for operation-by-operation dispositions.

## 4. Lot 9 reconstruction

### 4.1 9A — `chart_navigation`

Historical behavior and qualification are documented in prior evidence, but the
historical ChartNavigation source has not been recovered into the canonical
GitHub reconstruction.

Current status:

**historical evidence preserved; current implementation not reconstructed.**

Do not count historical ChartNavigation as present in the current registry.

### 4.2 9B — `region_intervention`

The historical 0.69 implementation could not be recovered exactly. A new,
evidence-bounded implementation is being reconstructed explicitly as a new
implementation.

Durably integrated components:

- `src/logos-engine/v6-region-intervention.ts`
- `src/logos-engine/v6-region-intervention-owner.ts`
- `src/logos-engine/v6-neutral-common-caller.ts`
- `src/logos-engine/v6-region-caller-adapter.ts`
- `src/runtime/v6-agent-worker-core.ts`
- `src/runtime/v6-agent-worker.ts`
- `src/logos-engine/v6-public-observation-delta.ts`
- `src/logos-engine/v6-region-public-evidence.ts`
- `tests/helpers/v6-live-game-campaign.ts`
- `scripts/measure-native-loop-costs.mjs`

Current targeted evidence:

| Area | Tests | Status |
| --- | ---: | --- |
| reconstructed V6 core | 27/27 | passed |
| Region core + owner | 19/19 | passed |
| neutral caller + Region integration | 12/12 | passed |
| worker core + public shell | 14/14 | passed |
| public observation delta + Region evidence | 12/12 | passed |
| generic bounded live-campaign helper | 7/7 | passed |
| ABBA cost protocol/orchestrator | 8/8 | passed |
| **Total targeted evidence** | **99/99** | **passed** |

Important semantic limits:

- no historical owner priority is invented;
- multiple owner proposals remain `ambiguous`;
- public pixel deltas do not infer a `methodRef`;
- Region method reuse requires an explicit justified `methodRef`;
- the default public worker decision port is
  `reconstruction-pending-perception` and does not invent an action;
- the generic campaign helper is not claimed to reproduce the historical
  STCK/SMLP campaign corpus;
- the cost harness reconstructs the ABBA protocol and arithmetic, not the lost
  historical CLI/checkouts/native runner.

Current Lot 9B status:

**functionally qualified for the reconstructed component boundaries above;
native STCK/SMLP runner and official performance remain to be confirmed.**

### 4.3 9C — `joint_channels`

Not yet reconstructed on the canonical GitHub baseline.

Start only after the shared caller/perception contracts used by 9B are stable
enough to avoid duplicating incompatible infrastructure.

## 5. Performance contract

Recovered official protocol:

- order: A1 → B1 → B2 → A2;
- each series runs STCK then SMLP;
- one warmup per game/series;
- warmup: 3 actions;
- four measured sessions per game/series;
- STCK measured session: 10 actions;
- SMLP measured session: 15 actions;
- total warmups: 8 sessions / 24 actions;
- total measured: 32 sessions / 400 actions;
- no measured-sample removal;
- no hidden retry;
- STCK and SMLP evaluated separately.

Acceptance:

- STCK complete-session global median increase **strictly < +10%**;
- SMLP complete-session global median increase **strictly < +10%**;
- exactly +10% fails;
- no cross-game compensation;
- an internal phase may exceed +10% when the global of the same game remains
  strictly below +10%;
- phase overruns remain visible in the evidence.

Current performance status:

**performance official to be confirmed.**

No current reconstruction benchmark result is claimed.

Historical 0.68-vs-0.67 cost numbers remain historical evidence only and must
not be reused as qualification of the reconstructed baseline.

## 6. Missing prerequisites before official Lot 9B cost

Still required:

1. durable, justified producer/binder for Region `methodRef`;
2. decision port connecting public observation/perception to owner contexts;
3. native STCK/SMLP `runSession` implementation and durable corpus/fixtures;
4. official measurement execution under the recovered ABBA protocol;
5. independent result review and preservation of all measured samples;
6. explicit reconstruction registry / entry-point progress before making any
   current 70/76 or 71/76 claim.

The files below are no longer missing, but their reconstructed scope must remain
explicit:

- `src/runtime/v6-agent-worker.ts`;
- `tests/helpers/v6-live-game-campaign.ts`;
- `scripts/measure-native-loop-costs.mjs`.

## 7. Other recovery lanes

### Lot 5

Recovery branch:

`recovery/lot5-canonical-buffer`

Its historical candidate must not be treated as restored until its exact source
or a newly requalified reconstruction is present on the canonical branch.

### Lot 6

Recovery branch:

`recovery/lot6c-product-dispatch`

Canonical reconstruction contains durable Lot 6 recovery/runtime documents and
product-dispatch work. Lot 6 documents are authoritative for its detailed
qualification and remaining gaps.

### Lot 8

No complete source branch was recovered.

Any reconstruction must begin from the canonical reconstruction and use only
durable evidence, without inventing the lost implementation.

### Lot 10

Recovery branch:

`lot10d-temporal-selection-github-20261112`

Its work remains separate until explicitly compared, tested and integrated into
the canonical reconstruction.

### OP01–OP31

Recovery/audit branch:

`op01-op31-c0-c7-audit`

Core operation reconstruction has been integrated progressively. The
OP01–OP31 audit documents remain the source for detailed need → call → result →
consumer → decision-effect dispositions.

## 8. Reconstruction-level gates

The reconstruction is not ready to claim Site109 parity until all of the
following are satisfied:

1. public/browser/worker runtime complete enough for actual agent execution;
2. historical published capabilities either reconstructed or explicitly
   reevaluated;
3. current entry-point registry rebuilt with evidence-backed counts;
4. restoration/checkpoint contracts qualified across reconstructed owners;
5. campaigns reproducible from durable GitHub fixtures;
6. official STCK/SMLP cost protocol executable with a real native runner;
7. both global performance budgets accepted independently;
8. any Site publication linked back to a durable canonical GitHub SHA.

## 9. Immediate Lot 9 roadmap

| Step | Status | Next proof |
| --- | --- | --- |
| historical Lot 9 recovery audit | complete | preserve unresolved identities |
| V6 core | targeted functional qualification complete | preserve regression coverage |
| Region core | reconstructed and qualified | preserve explicit evidence contract |
| Region owner | reconstructed and qualified | preserve selected/passive dedupe |
| neutral common caller | reconstructed and qualified | no implicit priority |
| worker transport boundary | reconstructed and qualified | connect justified decision port |
| public pixel delta | reconstructed and qualified | preserve no-method-inference rule |
| generic live campaign helper | reconstructed and qualified | obtain durable STCK/SMLP ports/fixtures |
| ABBA cost orchestrator | reconstructed and qualified | provide real native `runSession` |
| **native STCK/SMLP runner** | **open** | **next priority** |
| official Lot 9B cost | open | execute after runner restoration |
| current reconstruction registry | open | rebuild before count claims |
| 9C `joint_channels` | open | after shared infrastructure stabilizes |
| Site publication | blocked | only after GitHub-qualified integrated state |

## 10. Next step

**Recover or reconstruct the native STCK/SMLP session runner from durable
evidence.**

If the original corpus or runner identity cannot be established, create a new
runner only when its inputs, session semantics and measured scope can be stated
explicitly and requalified. Do not substitute unrelated games for STCK/SMLP and
do not manufacture benchmark numbers.
