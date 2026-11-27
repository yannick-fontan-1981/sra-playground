// Replay public SK48 starts and verify their native receipts against the operator's parent seals.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [checkout, output, group, build, option] = process.argv.slice(2);
const colorsByGroup = { historique: [], developpement: [9, 14], reserve: [8, 14], independant: [8, 13] };
assert.ok(checkout && output && Object.hasOwn(colorsByGroup, group) && ['parent', 'enfant'].includes(build),
  'CHECKOUT OUTPUT historique|developpement|reserve|independant parent|enfant [--verify]');
assert.ok(option === undefined || option === '--verify');
const verify = option === '--verify';
const deployed = resolve(checkout);
const parent = '08fa10a6b9986e7028551fbfc9d9e16eb83726b7';
const child = '4946cf0297734b9464fc52256af6fb27846f3bad';
const source = build === 'parent' ? parent : child;
const git = (...args) => execFileSync('git', ['-C', deployed, ...args]);
assert.equal(git('rev-parse', 'HEAD').toString().trim(), child);
git('diff', '--exit-code', 'HEAD', '--', 'src', 'experiments', 'public', 'reference');
git('diff', '--exit-code', parent, child, '--', 'experiments/sic-agenda-offres/revision-96');
const colors = colorsByGroup[group];
const expected = {
  historique: 'd0352dc8f9d6bcf341288cc60677463d7f72fe97a5dc43c76d2c5592c8601fd0',
  developpement: '9a4fbfea86741fb4d16041a6f8d5718538a290de38af42d63dd6cf1f4ee9287d',
  reserve: 'f10926709aa9b59fd421b5b741e9402d7b85b5d69b5f0a4543b8694ab0bfa875',
}[group];
const folder = resolve(output, group + '-' + build);
if (!verify) {
  mkdirSync(resolve(output), { recursive: true });
  mkdirSync(folder);
}
let engine = deployed;
if (build === 'parent' && !verify) {
  engine = join(folder, 'moteur');
  mkdirSync(engine);
  const ref = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  const tar = join(folder, 'engine.tar');
  git('archive', '--format=tar', '--output=' + tar, source, 'src', 'package.json', 'public/python',
    ref + 'laya_proto', ref + 'morphology_policy');
  execFileSync('tar', ['-xf', tar, '-C', engine]);
}
const results = [];
const hasNegative = ['developpement', 'reserve'].includes(group);
const mapped = n => colors.includes(n) ? colors[1 - colors.indexOf(n)] : n;
const read = file => JSON.parse(readFileSync(file));
for (const negative of hasNegative ? [false, true] : [false]) {
  for (const alternate of [false, true]) {
    const pack = alternate ? { strategyOrder: ['reposition_root_before_contact', 'revise_rooted_contact'] } : {};
    const card = { version: 'sic.contact/1', couleurs: colors, pack, gestes: hasNegative ? 13 : 24 };
    if (negative) card.retourModifie = { geste: 12, zone: [42, 30, 45, 40], couleurs: [mapped(9), mapped(14)] };
    const stem = (negative ? 'contraire' : 'direct') + (alternate ? '-reposition' : '');
    const input = join(folder, stem + '.fiche.json');
    const out = join(folder, stem + '.json');
    if (verify) {
      assert.deepEqual(read(input), card);
    } else {
      writeFileSync(input, JSON.stringify(card));
      execFileSync(process.execPath, [join(deployed, 'experiments/sic-agenda-offres/revision-96/operateur.mjs'),
        '--source', pathToFileURL(engine + sep).href, '--fiche', input, '--pyodide', join(deployed, 'public/vendor/pyodide'),
        '--recu', out], { cwd: deployed, windowsHide: true });
    }
    const result = read(out);
    assert.deepEqual(result.steps.slice(0, 4).map(step => step.ticket.command), ['ACTION1', 'ACTION4', 'ACTION3', 'ACTION2']);
    if (group === 'developpement' && build === 'parent') {
      assert.equal(result.steps.length, 4);
      assert.equal(result.stop.reason, 'frontier_unknown');
    } else {
      assert.equal(result.steps[4].ticket.command, 'ACTION1');
      assert.equal(result.steps[11].returned.matched, false);
      if (negative) {
        assert.equal(result.steps.length, 12);
        assert.equal(result.stop.reason, 'frontier_unknown');
      } else {
        const recovery = result.steps[12];
        assert.equal(recovery.ticket.command, alternate ? 'ACTION1' : 'ACTION3');
        assert.equal(recovery.returned.matched, true);
        assert.deepEqual(recovery.pre.expected, recovery.returned.physical);
        assert.equal(result.steps.length, hasNegative ? 13 : (alternate ? 21 : 19));
        assert.equal(result.steps.at(-1).returned.completed, hasNegative ? 0 : 1);
      }
    }
    results.push({ alternate, negative, card, result });
  }
}
const hash = createHash('sha256').update(JSON.stringify(results)).digest('hex');
if (expected && build === 'parent') assert.equal(hash, expected);
const rows = results.map(({ negative, alternate, card, result }) => ({
  negative, alternate, card, steps: result.steps.length, first: result.steps[0].ticket.command,
  afterCalibration: result.steps[4]?.ticket.command, contradicted: result.steps[11]?.returned.matched,
  recovery: result.steps[12]?.ticket.command, recoveryMatched: result.steps[12]?.returned.matched,
  recoveryExpected: result.steps[12]?.pre.expected, recoveryObserved: result.steps[12]?.returned.physical,
  completed: result.steps.at(-1).returned.completed, stop: result.stop,
}));
const summary = { group, source, parentExpectedSHA256: expected, groupSHA256: hash, rows };
const receipt = join(folder, 'bilan.json');
if (verify && existsSync(receipt)) assert.deepEqual(read(receipt), JSON.parse(JSON.stringify(summary)));
else writeFileSync(receipt, JSON.stringify(summary) + '\n');
console.log(group, build, hash, rows.map(r => [r.steps, r.afterCalibration, r.recovery, r.completed, r.stop.reason]));
