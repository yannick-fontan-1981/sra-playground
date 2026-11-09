# Baseline parent-retention ablations

Both receipts run the full common runtime from the clean published V59 checkout
at `f7b9a56af5488c8d4cebd5d912262a541f4fe403`. The 236-file native inventory is
checked before and after each run and remains
`f2ec2ff8658290c510a58642612b4f9d4b07a04d8fa6434c91aadda997e6c23e`.

Each independent cold session acquires 37 actual recorded public returns,
checking every command only after normal native WHY/ACT authorization. At the
first selected pose-control experiment with an unknown rule, the harness
supplies one controlled raster return: the measured child's marks have rotated
by either 270 or 180 degrees. It then acquires that return through `advance` and
asks the common runtime to `resume`. No game implementation, hidden state,
prepared learned state or decision override is used. These counterfactual
returns are contract evidence; they are not live game results or timing trials.

| Receipt | Acquired rule | Next common result | Retained parent |
| --- | --- | --- | --- |
| `baseline-270.json` | Three quarter turns per observed control | The same current target, with two more control actions proposed and the first authorized | Absent before acquisition, after acquisition and after resume |
| `baseline-180.json` | Two quarter turns per observed control | `stopped`, reason `frontier_unknown`, with no next proposal or command | Absent before acquisition, after acquisition and after resume |

The 270-degree case already makes the pertinent action choice in V59. It proves
the absence of explicit retained parent lineage, not a behavioral failure or a
different target choice. The 180-degree case establishes a generic stop with no
parent-specific suspended demand in V59. Its `currentTargetChanged` Boolean is
true because the next proposal has no target; it does **not** mean another
target was silently selected. A claim about the changed implementation must
cite its own corresponding contract evidence as well.

Both receipts include the full before/after proposals, normal authorizations,
all commands actually returned to the host, the controlled public packet, the
newly acquired material event, source and helper fingerprints. Both have 38
acquired transitions for 38 supplied returns. The next command in the
270-degree receipt is authorized but is not executed by this bounded probe.

## Reproduce

Use the same helper and public-input files and an unused output path:

```bash
node scripts/prove-native-parent-ablation.mjs \
  /path/to/clean-v59-checkout \
  docs/migration/lot1-evidence/ablation/new-baseline-270.json 3

node scripts/prove-native-parent-ablation.mjs \
  /path/to/clean-v59-checkout \
  docs/migration/lot1-evidence/ablation/new-baseline-180.json 2
```

The runner refuses to overwrite evidence and verifies that the baseline source,
public inputs and helper files remain unchanged for the whole run.
