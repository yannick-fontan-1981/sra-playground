import { spawn } from 'node:child_process';
import { once } from 'node:events';
import readline from 'node:readline';

import { selectRegionPublicAction6Probe } from './native-loop-region-public-action6-probe.mjs';

const child = spawn('python3', ['scripts/native-python-archive-session.py'], {
  stdio: ['pipe', 'pipe', 'inherit'],
});
const lines = readline.createInterface({ input: child.stdout });
const waiting = [];
lines.on('line', line => {
  const pending = waiting.shift();
  const payload = JSON.parse(line);
  if (!payload.ok) pending.reject(new Error(payload.error));
  else pending.resolve(payload.result);
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

const results = [];
try {
  for (let launches = 0; launches <= 16; launches += 1) {
    let observation = await request({ type: 'load', code: 'STCK' });
    let valid = true;
    for (let i = 0; i < launches; i += 1) {
      if (!observation.availableActionIds.includes(5) || observation.state !== 'NOT_FINISHED') {
        valid = false;
        break;
      }
      observation = await request({ type: 'action', actionId: 5 });
    }
    if (!valid) {
      results.push({ launches, status: 'terminal-before-probe' });
      continue;
    }
    const action = selectRegionPublicAction6Probe('STCK', observation);
    if (!action) {
      results.push({ launches, status: 'no-public-probe-target' });
      continue;
    }
    const after = await request({ type: 'action', actionId: 6, data: { x: action.x, y: action.y } });
    const delta = changedPixels(observation.frame, after.frame);
    results.push({
      launches,
      status: delta > 0 ? 'useful' : 'no-change',
      action,
      changedPixelCount: delta,
      level: observation.level,
      state: observation.state,
    });
  }
  console.log(JSON.stringify({ game: 'STCK', diagnostic: 'ACTION5-prelude-then-public-ACTION6-probe', results }, null, 2));
} finally {
  child.stdin.end();
  await once(child, 'close');
}
