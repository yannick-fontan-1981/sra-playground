// Check the identities that permit reuse of the frozen receipts and the native inventory.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const [captures, typescriptPackage = 'typescript'] = process.argv.slice(2);
if (!captures) throw Error('Usage: node scripts/verify-sic-logi-line15.mjs CAPTURES [TYPESCRIPT-PACKAGE]');
const require = createRequire(import.meta.url);
const ts = require(typescriptPackage === 'typescript' ? typescriptPackage : resolve(typescriptPackage));
assert.equal(ts.version, '5.9.3');

const history = '8ce7ee3563fa1d5eca1639c6ad03975cfc962460';
const frozen = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
const proof = '7bf3c85a4183baf0dd535ca7c97d055bb6a0b958';
const candidate = '48472784f1ee59b1117dddb53ef5c9fced929ec8';
const sourceFile = 'src/logos-engine/v6-coupled-displays.ts';
const fixtureFile = 'tests/fixtures/sic-information-displays-public.json.gz';
const fixtureHash = '9f2a049421405a35829214a44950ceb9a30e08c126ae052e32e53de459949158';
const git = (...args) => execFileSync('git', args);
const id = rev => git('rev-parse', rev).toString().trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const enginePaths = ['src', 'scripts', 'reference', 'public', 'package.json', 'package-lock.json', 'tsconfig.json'];
assert.equal(id(candidate + '^'), proof);
assert.equal(id(proof + '^^'), frozen);
assert.equal(id(frozen + ':src'), id(proof + ':src'));
git('diff', '--exit-code', frozen, proof, '--', ...enginePaths);
assert.equal(git('diff', '--name-only', proof, candidate, '--', ...enginePaths).toString().trim(), sourceFile);
for (const rev of [proof, candidate]) assert.equal(hash(git('show', rev + ':' + fixtureFile)), fixtureHash);

const emissions = {};
for (const rev of [frozen, proof, candidate]) {
  const source = git('show', rev + ':' + sourceFile).toString();
  const result = ts.transpileModule(source, { fileName: sourceFile, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } });
  assert.equal(result.diagnostics.length, 0);
  const bytes = Buffer.from(result.outputText);
  const sha256 = hash(bytes);
  assert.equal(sha256, '8178d156fa9d96a27f2d03384ad8585cb0cc01fef3758a69778d5200d445be48');
  emissions[rev] = { srcTree: id(rev + ':src'), moduleBlob: id(rev + ':' + sourceFile), bytes: bytes.length, sha256 };
}

const inventoryBlob = id(history + ':tests/helpers/sic-qualification.ts');
const sources = {};
const inventory = {};
let original;
for (const rev of [history, frozen, proof, candidate]) {
  const bytes = readFileSync(resolve(captures, 'inventaire-' + rev.slice(0, 8) + '.json'));
  const report = JSON.parse(bytes);
  assert.equal(report.sha, rev);
  assert.equal(report.inventoryBlob, inventoryBlob);
  assert.deepEqual([report.startLevel, report.seed, report.maxActions], [1, 0, 16]);
  assert.deepEqual(report.games.map(g => g.game), ['LOGI', 'REWI']);
  sources[rev] = hash(bytes);
  if (original) {
    assert.equal(report.session, original.session);
    for (const [i, game] of report.games.entries()) {
      assert.deepEqual(Object.keys(game).sort(), Object.keys(original.games[i]).sort());
      for (const key of Object.keys(game)) {
        assert.equal(hash(JSON.stringify(game[key])), hash(JSON.stringify(original.games[i][key])), rev + ' ' + game.game + ' ' + key);
      }
    }
  } else {
    original = report;
    for (const game of report.games) {
      const line = game.rows.filter(r => r.family === 'information_goal' && r.strategy === 'coupled_displays' && r.proposal === 'experiment');
      assert.equal(game.observed, game.count);
      const expected = game.game === 'LOGI' ? 16 : 6;
      assert.deepEqual(line.map(r => r.sequence), Array.from({ length: expected }, (_, i) => i + 1));
      inventory[game.game] = { commands: game.count, stop: game.stop, line15: line.length, levelsCompleted: game.levels,
        firstTwo: line.slice(0, 2).map(r => r.command), trajectorySHA256: hash(JSON.stringify(game.trace)) };
    }
  }
}
console.log(JSON.stringify({ compiler: ts.version, emissions, fixtureHash, inventoryBlob, sources, inventory }, null, 2));
