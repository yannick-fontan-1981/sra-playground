import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const roadmapPath = resolve(root, 'docs/migration/v6-delivery-roadmap.md');
const checkOnly = process.argv.includes('--check');

function replaceOnce(source, before, after, label) {
  const afterFirst = source.indexOf(after);
  if (afterFirst !== -1) {
    assert.equal(
      source.indexOf(after, afterFirst + after.length),
      -1,
      `duplicate synchronized roadmap block: ${label}`,
    );
    return source;
  }

  const beforeFirst = source.indexOf(before);
  assert.notEqual(
    beforeFirst,
    -1,
    `missing roadmap anchor or synchronized block: ${label}`,
  );
  assert.equal(
    source.indexOf(before, beforeFirst + before.length),
    -1,
    `duplicate roadmap anchor: ${label}`,
  );
  return source.slice(0, beforeFirst) + after + source.slice(beforeFirst + before.length);
}

function synchronizedRoadmap(source) {
  let next = source;
  next = replaceOnce(
    next,
    '| **current reconstruction registry** | **open** | **map durable capabilities before any count claim** |',
    '| current reconstruction registry | **complete, verified** | preserve generated totals and historical non-comparability |',
    'immediate roadmap registry row',
  );

  next = replaceOnce(
    next,
    '## 7. Other recovery lanes',
    `## 6.1 Current reconstruction registry

The current reconstruction registry is now machine-readable, evidence-linked and
verified from the canonical repository tree.

Derived inventory:

- 44 tracked entries;
- 32 current capability boundaries;
- 24 product-active capability boundaries;
- 8 qualified library or non-product seams;
- 6 separately tracked qualification harnesses;
- 2 official performance qualifications;
- 1 historical-only entry;
- 5 open entries;
- 0 resolved historical identities.

The current capability count is deliberately **not** written as \`32/76\`.
The historical denominator, granularity and entry identities have not been
recovered, so the old \`70/76\` and \`71/76\` evidence remains incomparable.

Durable sources:

- \`docs/migration/v6-current-entry-registry.json\`;
- \`docs/migration/v6-current-entry-registry/*.json\`;
- \`docs/migration/v6-current-entry-registry.md\`;
- \`scripts/verify-v6-current-entry-registry.mjs\`;
- \`tests/v6-current-entry-registry.test.mjs\`;
- GitHub Actions run \`43429453769\`, job \`131898993265\`.

## 7. Other recovery lanes`,
    'registry qualification section',
  );

  next = replaceOnce(
    next,
    '2. the current entry-point registry is rebuilt from durable evidence;',
    '2. the current entry-point registry remains verified from durable evidence;',
    'reconstruction gate 2',
  );

  next = replaceOnce(
    next,
    `## 9. Next step

**Rebuild the current reconstruction registry.**

Inventory every durable capability integrated on the canonical branch, link it
to its functional and performance proofs, mark unresolved historical identity
separately, and only then compute a current count. Do not map the old \`70/76\` or
\`71/76\` claims automatically onto the reconstructed tree. Do not publish Site
before this registry work and a fresh canonical qualification are complete.
`,
    `## 9. Next step

**Qualify cross-owner continuity and the complete active-product composition.**

Priority order:

1. persist and restore the common campaign across Agent activations, including
   owner order, pending need, acquisition deduplication, FieldStock and joint
   channel state;
2. connect a physical goal owner that consumes OP31 information and changes
   goal selection;
3. measure the complete active four-peer browser product composition rather
   than only isolated Region or joint-channel candidate seams;
4. preserve the historical 70/76 mapping and exact Site 109 parity as separate
   unresolved recovery lanes;
5. publish Site only from an integrated and freshly qualified canonical GitHub
   SHA, then verify the deployed revision against that SHA.
`,
    'next step',
  );

  return next;
}

const current = readFileSync(roadmapPath, 'utf8');
const next = synchronizedRoadmap(current);

if (checkOnly) {
  assert.equal(current, next, 'v6-delivery-roadmap.md is not synchronized with the verified current registry');
} else if (current !== next) {
  writeFileSync(roadmapPath, next, 'utf8');
}
