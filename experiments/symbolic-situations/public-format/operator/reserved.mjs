import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { campaign } from '../../generate.mjs';
import { publicCard } from '../../cards.mjs';
import { suite } from '../../ressource/generate.mjs';
import { card } from '../../ressource/cards.mjs';
import { development, formatDir, makeCase } from './schedule.mjs';

export const commitment = '86886e265599c0fdf1eda6483e31550b4a5cc96bd156c1ccfdb89eb8170ef597';

export function derive(key) {
  if (key.length !== 32) throw new Error('Clé de 32 octets attendue');
  const hash = label => createHash('sha256').update(key).update('\0' + label).digest();
  let dialSeed = 0;
  for (let i = 0; dialSeed <= 107; i++) dialSeed = hash('dial/' + i).readUInt32BE(0);
  return { dialSeed, resourceSeed: 'public1-' + hash('resource/0').toString('hex').slice(0, 32) };
}

export function reserved() {
  const key = readFileSync(join(formatDir, 'operator/private/holdout.key'));
  const check = createHash('sha256').update('sra.public/1.partition.v1\n').update(key).digest('hex');
  if (check !== commitment) throw new Error('Engagement de la partition non vérifié');
  const { dialSeed, resourceSeed } = derive(key);
  const rows = [];
  for (const [family, cases, render] of [
    ['dial', campaign(dialSeed).cases, publicCard],
    ['resource', suite(resourceSeed).cases, card],
  ]) {
    for (const c of cases.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
      rows.push(makeCase(family, c.id, render(c.model)));
    }
  }
  const known = new Set(development().map(c => JSON.stringify(c.message)));
  if (rows.length !== 12 || rows.reduce((n, c) => n + c.worlds.length, 0) !== 18 ||
      rows.some(c => known.has(JSON.stringify(c.message)))) throw new Error('Partition imprévue ou recouvrement avec le développement');
  return rows;
}
