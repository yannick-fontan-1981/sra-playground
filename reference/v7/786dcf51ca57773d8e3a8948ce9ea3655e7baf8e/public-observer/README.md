# Public observation projection reference

These three files are exact copies from
`yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan` at commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`:

| Copy | Original repository path |
| --- | --- |
| `public_observer.py` | `agents/yf_arc3_v7/public_observer.py` |
| `geometric_observer.py` | `agents/yf_arc3_v6/laya_proto/geometric_observer.py` |
| `kernel.py` | `agents/yf_arc3_v7/kernel.py` |

`scripts/export-public-observer-reference.py` verifies their original Git blob
identities, then selects the complete function definitions by Python AST. It
executes the original `components`, `perceive`, canonical hashing and grounding
functions with standard-library dependencies. No function body or algorithm is
rewritten for the oracle. It does not import a game engine, solve a game, or test
the original archive adapter and full application startup.

The generated fixture compares the eight public V7 facts: full image hash,
width, height, monochrome component count, palette count, rectangular component
count, public state and completed level count. Components use four-neighbour
connectivity and include all palette values, including background. No object
role, hidden state, causal model or action policy is inferred by this observer.

```sh
python scripts/export-public-observer-reference.py --check
node --test tests/public-observer.test.ts
```

The TypeScript host supplies session/sequence observation identities explicitly.
For exact comparisons, fixture identities are copied from the original Python
perception result. Runtime callers may use their own immutable identity scheme;
they must change scope at a game/session discontinuity and accurately attribute
the action that produced an observation.
