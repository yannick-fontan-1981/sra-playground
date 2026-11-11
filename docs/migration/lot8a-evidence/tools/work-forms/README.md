# Prepared 6B → 8A work forms and graph review

These tools prepare functional evidence only. They do not create an official cost declaration, readiness, measurement window, timing comparison or publication. No global mutex is opened. The historical 5C/6B tools and all native sources remain unchanged.

## Frozen inputs

| Role | Checkout | Source | Native identity |
| --- | --- | --- | --- |
| Prepared baseline | `/workspace/sites/sra-lot8a-prepared6b-20261111` | Exact `a01e6faf330d82fa220feac0c9ad4632bb75a9de`, unpublished 0.64.0 | 322 files, `fa23bb76ca4a01b5cfaa72ec6d1d4b4fc2e8969762e966ada8225265fc546886` |
| Candidate | `/workspace/sites/sra-lot8a-motif-20261111/.sites-checkout` | Current explicitly recorded checkpoint, unpublished 0.65.0 | 324 files, `936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43` |

The inventory and captures record HEAD separately from native-byte identity. Keep the same candidate checkpoint throughout this bounded preparation; do not commit between inventory and captures. The baseline is a separate sparse checkout; no baseline native files belong in the candidate.

The native manifest and owner inventory use the complete `src/logos-engine` and `src/runtime` trees. The sparse baseline also needs `package.json`, `scripts/measure-native-loop-costs.mjs` (fingerprinted, never executed here), both source declarations under `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/` (`laya_proto/common_frontier_policy.drm.json` and `morphology_policy/strategy.drm`), and the two exact archived public traces named by `cases.json`. No public game engine, browser, test suite, dist tree or historical proof archive is required.

## Tools

- `record-owner-source-inventory.mjs` derives from the retained 6B inventory. It reads the actual factories and family-installed programs without initializing a runtime session. Motif must be the only new owner; existing owner order and all existing programs remain exact.
- `capture-cost-owner-graphs.mjs` derives from the retained 6B capture, adding actual Binding source hooks from 5C and registered Motif wrapper hooks. It captures four cold work forms per role: STCK 3/10 actions and SMLP 3/15 actions. Only the complete forms have three terminal inspections. Commands must match before the archived public return is supplied. Every graph delta is retained.
- `qualify-cost-owner-graphs.mjs` derives from the retained 6B strict reader. It validates each graph with its own pinned store/Kernel and shared identical codecs, checks fragment hashes, hydrates every changed root, checks actual owner checkpoints and selected Motif facts, and compares work forms. Raw common values and delta order/cause/identity remain part of comparison.

Binding and SelectedRigid exist in both roles. Motif is observed through its one registered family, not through `acquisitionFamilies`; its real `state`, `restore`, `propose` and `record` are observed without replacement state. A negative Motif proposal can change epoch context. No empty-state or constant-growth assumption is imposed on it.

Each service.handle call is bracketed by real Date.now observations; the clock is not replaced. Only the precise `/value/root/members/created` scalar or its exact `kind`/`bits` float64 encoding of a verified `reasoning:trace:<id>` node can receive wall-clock attribution. Its hydrated timestamp must exactly round-trip from integer milliseconds and lie in the actual call interval, its id must match the source trace id, and the unchanged source default clock and construction without options are pinned. All raw Kernel hashes and fragments are still checked. Other differences remain explicit in the gzip JSON-lines output; no generic timestamp stripping, node.value omission or graph normalization is used.

## Prospective execution, not yet performed

The caller first declares a bounded functional activity and freezes these tool bytes. Finish the outstanding recorded regression work before starting. Run the four commands sequentially, inspect each terminal result, and retain every failed attempt in its own directory. A supervisor should bound each command and its process group; these tools themselves are ordinary scripts and do not provide external lifetime/resource supervision. A prospective `NODE_OPTIONS=--max-old-space-size=1536` and a 600-second maximum per capture are suitable starting declarations, subject to the owning execution plan. No execution or future success is implied by this README.

From the candidate checkout, prepare a new evidence directory and copy the original cases byte for byte:

```bash
mkdir docs/migration/lot8a-evidence/work-forms-prepared-01
cp docs/migration/lot6b-evidence/provisional-063-01/functional-805b/cases.json docs/migration/lot8a-evidence/work-forms-prepared-01/cases.json
```

Then run, under the owning bounded supervisor:

```bash
node docs/migration/lot8a-evidence/tools/work-forms/record-owner-source-inventory.mjs \
  /workspace/sites/sra-lot8a-prepared6b-20261111 \
  /workspace/sites/sra-lot8a-motif-20261111/.sites-checkout \
  docs/migration/lot8a-evidence/work-forms-prepared-01/owner-source-inventory.json

node docs/migration/lot8a-evidence/tools/work-forms/capture-cost-owner-graphs.mjs baseline \
  /workspace/sites/sra-lot8a-prepared6b-20261111 \
  docs/migration/lot8a-evidence/work-forms-prepared-01/cases.json \
  docs/migration/lot8a-evidence/integration-provisional-063-064-01/contract/prepared6b-source-manifest.json \
  docs/migration/lot8a-evidence/work-forms-prepared-01/baseline.json.gz

node docs/migration/lot8a-evidence/tools/work-forms/capture-cost-owner-graphs.mjs candidate \
  /workspace/sites/sra-lot8a-motif-20261111/.sites-checkout \
  docs/migration/lot8a-evidence/work-forms-prepared-01/cases.json \
  docs/migration/lot8a-evidence/integration-provisional-063-064-01/contract/source-manifest.json \
  docs/migration/lot8a-evidence/work-forms-prepared-01/candidate.json.gz

node docs/migration/lot8a-evidence/tools/work-forms/qualify-cost-owner-graphs.mjs \
  docs/migration/lot8a-evidence/work-forms-prepared-01/owner-source-inventory.json \
  docs/migration/lot8a-evidence/work-forms-prepared-01/baseline.json.gz \
  docs/migration/lot8a-evidence/work-forms-prepared-01/baseline.receipt.json \
  docs/migration/lot8a-evidence/work-forms-prepared-01/candidate.json.gz \
  docs/migration/lot8a-evidence/work-forms-prepared-01/candidate.receipt.json \
  docs/migration/lot8a-evidence/work-forms-prepared-01/graph-review.json \
  docs/migration/lot8a-evidence/work-forms-prepared-01/work-forms.json
```

All outputs are exclusive-create. A capture failure retains a failed receipt and log payload. The reader produces `graph-review.differences.jsonl.gz` containing every reported raw leaf/population difference, with references to complete nodes in the captures. A successful process can establish `qualified_prepared_work_forms_and_individual_graphs` while `privateComparison` still says `unattributed_differences_retained_strict_qualification_pending`. Read those fields, not only exit code.

Every output retains `officialPerformanceEligible: false`; the forms deliberately have a different schema from an official structural fixture. Even if all observed differences receive narrow attribution, this preparation does not self-authorize strict final qualification. The actual published 0.64, candidate reconciliation, final proof review and official performance procedure remain separate.

## Verification completed during tool preparation

Only static source review and `node --check` are permitted in this preparation. No helper, native factory, capture, session, replay, game or official measurement has been launched by the tool author. The accompanying `preparation-review.json` records the actual syntax commands and source derivation fingerprints after final review.
