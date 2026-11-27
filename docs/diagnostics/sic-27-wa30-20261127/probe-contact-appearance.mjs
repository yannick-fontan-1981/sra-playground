// Inspect actual public returns. This restores one family, not a full SIC session.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createSicVerifyOrientedDelivery } from '../../../src/sic/oriented-delivery.ts';

const rows = gunzipSync(await readFile(new URL('./wa30-last-part-public.jsonl.gz', import.meta.url)))
  .toString().trim().split('\n').map(JSON.parse);
const family = createSicVerifyOrientedDelivery();
let proposal, before;
const changed = [], acquisition = [];
for (const row of rows) {
  if (row.kind === 'plan') {
    proposal = structuredClone(row.proposal);
    before = row.observation;
    const state = family.state().state;
    if (state) {
      proposal.local.contactAppearance = state.contactAppearance;
      proposal.local.releasedContact = state.releasedContact;
    }
    family.restore({ state: proposal.local });
    continue;
  }
  if (row.kind !== 'return') continue;
  const outcome = await family.after(proposal, row.index, before, row.observation, row.first, row.second);
  await family.record(before, row.observation, row.command, row.first, row.second, proposal, row.index, []);
  const state = family.state().state;
  if ([98, 99].includes(row.commands)) acquisition.push({ command: row.commands, matched: outcome.matched,
    pending: state.releasedContact ?? null, learned: state.contactAppearance ?? null });
  if (outcome.matched !== row.outcome.matched) changed.push({ command: row.commands,
    previous: row.outcome.matched, current: outcome.matched, before: before.observation_ref, after: row.observation.observation_ref });
  before = row.observation;
}
assert.deepEqual(changed.map(row => row.command), [107, 108]);
assert.ok(changed.every(row => row.previous === false && row.current === true));
assert.equal(acquisition[0].learned, null);
assert.equal(acquisition[1].learned.sources.length, 3);
assert.equal(acquisition[1].matched, false, 'The first unexplained withdrawal remains a real boundary before its acquisition');
console.log(JSON.stringify({ scope: 'public returns of owner-only diagnostic; not a full campaign', acquisition, changed }, null, 2));
