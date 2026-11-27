// Reuse the inventory's historical run() on a real source game and in-process V6 service.
// The original released-plan and observed-outcome callbacks still collect every row.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';

const [checkout, output, ...selection] = process.argv.slice(2);
const curious = selection[0] === '--curious';
if (curious) selection.shift();
const offerFilter = selection[0] === '--offer' ? selection.slice(1, 4) : null;
const codes = offerFilter ? selection.slice(4) : selection;
if (!checkout || !output || !codes.length || new Set(codes).size !== codes.length) {
  throw Error('Usage: node scripts/sic-recapture-strategy-inventory.mjs CHECKOUT NEW-REPORT.json [--curious] [--offer FAMILY STRATEGY PROPOSAL] GAME [GAME ...]');
}
const sha = execFileSync('git', ['rev-parse','HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src', 'public', 'reference', 'scripts'], { cwd: checkout });
const importAt = path => import(pathToFileURL(resolve(checkout, path)).href);
const { BrowserV6Agent } = await importAt('src/runtime/v6-agent.ts');
const { V6AgentService } = await importAt('src/runtime/v6-agent-service.ts');
const { createNativeV6Runtime } = await importAt('src/logos-engine/v6-native-runtime.ts');
const { defaultRecoveryPack } = await importAt('src/sic/active-recovery.ts');
const { readNativeResolution } = await importAt('src/sic/native-resolution.ts');
const { GAME_CATALOG } = await importAt('src/games/catalog.ts');
const pinned = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const read = path => JSON.parse(readFileSync(resolve(checkout, pinned, path)));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const repository = fileURLToPath(new URL('../', import.meta.url));
const historicalSource = '8ce7ee3563fa1d5eca1639c6ad03975cfc962460:tests/helpers/sic-qualification.ts';
const source = execFileSync('git', ['show', historicalSource], { cwd: repository, encoding: 'utf8' });
const inventory = execFileSync('git', ['rev-parse', historicalSource], { cwd: repository, encoding: 'utf8' }).trim();
function extract(name) {
  const start = source.indexOf('async function ' + name + '(');
  const end = source.indexOf('\n}\n', start);
  if (start < 0 || end < 0) throw Error('Missing historical function: ' + name);
  return source.slice(start, end + 2);
}
const historicalRun = extract('run');
const injection = 'new BrowserV6Agent({';
if (historicalRun.split(injection).length !== 2) throw Error('Unknown transport initialisation');
const body = extract('hash') + '\n' + historicalRun.replace(injection, injection + ' transport: makeTransport(),');
const js = stripTypeScriptTypes(body, { mode: 'transform' });
const makeTransport = () => {
  const service = new V6AgentService(recovery => createNativeV6Runtime(declarations, { recovery }));
  return { request: op => service.handle(op), reset() {}, dispose() {} };
};
const run = Function('BrowserV6Agent','readNativeResolution','makeTransport', js + '\nreturn run;')(
  BrowserV6Agent, readNativeResolution, makeTransport);
const session = 'f8f552d2-2a43-4897-9ef4-aba266fe9c10';
crypto.randomUUID = () => session;
for (const code of codes) {
  if (!GAME_CATALOG.some(g => g.code === code && g.availability === 'playable')) throw Error('Unknown playable game: ' + code);
}
const backend = await sourceBackend(checkout);
const runtime = {
  load: (code, level) => backend.dispatch({ type: 'load', code, level }),
  action: (actionId, data) => backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }),
};
const report = { sha, inventoryBlob: inventory, session, startLevel: 1, seed: 0, maxActions: 16, games: [] };
if (offerFilter) report.offerFilter = offerFilter;
if (curious) report.openingCuriosity = 'active';
const pack = curious ? { ...defaultRecoveryPack, openingCuriosity: 'active' } : defaultRecoveryPack;
for (const game of codes) {
  const returned = [];
  const result = await run(runtime, game, 'complete', pack, 16, row => returned.push({ ...row }));
  const keys = new Set(returned.map(row => JSON.stringify([row.family, row.strategy, row.entry, row.proposal])));
  const rows = returned.filter(row => {
    if (offerFilter) return [row.family, row.strategy, row.proposal].every((v, i) => offerFilter[i] === '*' || offerFilter[i] === v);
    if (row.family === 'information_goal') return row.strategy === 'coupled_displays' && row.proposal === 'experiment';
    return row.family === 'view' && row.proposal === 'public_view_frontier'
      && ['approach_view_edge', 'confirm_access_obstruction'].includes(row.strategy);
  })
    .map(row => ({ ...row, packet: result.trace[row.sequence - 1].packet,
      command: result.trace[row.sequence - 1].action, nextCommand: result.trace[row.sequence]?.action ?? null }));
  report.games.push({ game, count: result.actions, observed: returned.length, levels: result.levels, stop: result.stop,
    keys: [...keys].sort(), trace: result.trace, rows });
}
writeFileSync(output, JSON.stringify(report) + '\n', { flag: 'wx' });
console.log(sha.slice(0, 8), codes.length, report.games.reduce((n,g) => n + g.count,0),
  report.games.reduce((n,g) => n + g.rows.length,0), createHash('sha256').update(readFileSync(output)).digest('hex'));
