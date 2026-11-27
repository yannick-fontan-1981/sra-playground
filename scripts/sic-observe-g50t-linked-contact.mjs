// Run before the native G50T test to retain its measured carrier and registered remote pixels.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const checkout = process.env.SIC_LINKED_GAME_ROOT;
const output = process.env.SIC_LINKED_RECEIPT;
if (!checkout || !output) throw Error('Set SIC_LINKED_GAME_ROOT and SIC_LINKED_RECEIPT');
const file = 'src/logos-engine/v6-linked-temporal-preparation.ts';
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'src', 'public', 'scripts', 'reference'], { cwd: checkout });
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
const { LinkedTemporalPreparation } = await import(pathToFileURL(resolve(checkout, file)).href);
const carrier = '9377082569ed42fe9b01ec63cc82ad5830e10c23e6a57819c134e54024168cb5';
const rows = [];
const record = LinkedTemporalPreparation.prototype.recordSource;
LinkedTemporalPreparation.prototype.recordSource = function (...args) {
  const events = record.apply(this, args);
  const [before, after] = args;
  const contact = this.phase.linked_contact;
  const pose = this.phase.states.at(-1)?.poses[carrier];
  rows.push(structuredClone({ before: before.observation_ref, after: after.observation_ref, turn: after.revision - 1,
    pose, vectors: Object.fromEntries(contact.vectors), contact: contact.contact, departure: contact.departure, reversal: contact.reversal }));
  return events;
};
process.on('exit', () => {
  assert.ok(rows.some(row => row.turn === 8 && row.contact), 'Missing observed contact');
  writeFileSync(output, JSON.stringify({ source, carrier, rows }) + '\n', { flag: 'wx' });
});
