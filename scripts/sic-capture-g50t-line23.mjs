import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [checkout, revision, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node scripts/sic-capture-g50t-line23.mjs CANDIDATE-CHECKOUT REVISION NEW-RECEIPT.json');
const candidate = 'ba04161fbce03f9660e9e73c14ed2c14ef2538d7';
const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), candidate);
git('diff', '--exit-code', 'HEAD', '--', 'src', 'public', 'reference', 'experiments/sic-agenda-offres');
const root = pathToFileURL(resolve(checkout) + sep);
const harness = new URL('experiments/sic-agenda-offres/', root);
const { loadService } = await import(new URL('essai-local-23/service.mjs', harness));
const { withPinnedEngine, frozen, historical } = await import(new URL('essai-local-23/moteur.mjs', harness));
const { loadGame } = await import(new URL('frontiere-22-23/game.mjs', harness));
const source = git('rev-parse', revision + '^{commit}');
assert.ok([historical, frozen, candidate].includes(source));

function project(d) {
  return { family: d.family, strategy: d.strategy, kind: d.kind, question: d.question, need: d.need, plan: d.plan,
    preSha256: d.preSha256, ranking: d.ranking, expectedAfter: d.expectedAfter, predictedEffectUnknown: d.predictedEffectUnknown,
    guard: d.guard, release: d.release, ticket: d.ticket };
}

async function capture(engine) {
  const game = await loadGame('G50T', resolve(checkout, 'public/vendor/pyodide'), engine);
  const start = await loadService(engine);
  const session = await start(game.initial);
  const first = await session.decision();
  const { id, actionRef, data } = first.ticket;
  const after = game.step(Number(actionRef.slice(6)), data);
  const receipt = await session.advance(id, after);
  const next = await session.decision();
  return { first: project(first), receipt, next: project(next) };
}
const observed = source === candidate ? await capture(root.href) : await withPinnedEngine(source, capture);
writeFileSync(output, JSON.stringify({ game: 'G50T', start: 1, source, harness: candidate, ...observed }) + '\n', { flag: 'wx' });
