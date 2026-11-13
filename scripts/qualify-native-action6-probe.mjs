import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import readline from 'node:readline';

import { selectRegionPublicAction6Probe } from './native-loop-region-public-action6-probe.mjs';

const child = spawn('python3', ['scripts/native-python-archive-session.py'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = readline.createInterface({ input: child.stdout });
const waiting = [];
lines.on('line', line => {
  const pending = waiting.shift();
  if (!pending) throw new Error('unexpected native session response');
  try {
    const payload = JSON.parse(line);
    if (!payload.ok) pending.reject(new Error(payload.error));
    else pending.resolve(payload.result);
  } catch (error) {
    pending.reject(error);
  }
});

function request(payload) {
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    child.stdin.write(JSON.stringify(payload) + '\n');
  });
}

function changedPixels(a, b) {
  let count = 0;
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (a[y][x] !== b[y][x]) count += 1;
    }
  }
  return count;
}

async function qualify(game) {
  const before = await request({ type: 'load', code: game });
  if (before.state !== 'NOT_FINISHED') throw new Error(`${game} did not start non-terminal`);
  if (!before.availableActionIds.includes(6)) throw new Error(`${game} does not expose ACTION6`);
  const action = selectRegionPublicAction6Probe(game, before);
  if (!action) throw new Error(`${game} public probe found no ACTION6 target`);
  const after = await request({
    type: 'action',
    actionId: 6,
    data: { x: action.x, y: action.y },
  });
  return {
    game,
    gameId: before.gameId,
    initialAvailableActionIds: before.availableActionIds,
    action,
    changedPixelCount: changedPixels(before.frame, after.frame),
    levelBefore: before.level,
    levelAfter: after.level,
    stateAfter: after.state,
  };
}

const report = {
  archive: 'public/python/custom-games.zip',
  seed: 0,
  probe: 'region-public-action6-probe-v1',
  generatedAt: new Date().toISOString(),
  games: [],
};

try {
  report.games.push(await qualify('STCK'));
  report.games.push(await qualify('SMLP'));
  const smlp = report.games.find(item => item.game === 'SMLP');
  if (!smlp || smlp.changedPixelCount <= 0) {
    throw new Error('SMLP public ACTION6 probe produced no visible delta');
  }
  const target = process.env.LOT9B_NATIVE_PROBE_REPORT || 'lot9b-native-probe-report.json';
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  child.stdin.end();
  await once(child, 'close');
}
