/** Reuse the production shadow comparator on any archived public trace. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { compareDirectionTargets, observeDirectionalReturn, summarizeDirections } from '../src/sic/directional-return.ts';

const write = process.argv.includes('--write');
const inputs = process.argv.slice(2).filter(arg => arg !== '--write');
if (!inputs.length) inputs.push(
  'docs/migration/lot2c-cost-evidence/final/ls20-regression/ls20-public-trace.json.gz',
  'docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz',
);
for (const path of inputs) {
  const { game, packets } = JSON.parse(gunzipSync(readFileSync(path)));
  const returns = [];
  for (let sequence = 1; sequence < packets.length; sequence++) {
    const { packet: before } = packets[sequence - 1];
    const { command, packet: after } = packets[sequence];
    const action = Number(command.action_ref.slice(6));
    if (action < 1 || action > 4) continue;
    returns.push(observeDirectionalReturn({ sessionId: game, sequence, command: action,
      fromLevel: before.level, toLevel: after.level }, before.frame_rows, after.frame_rows,
    before.level !== after.level || before.state !== after.state, returns.at(-1)));
  }
  const commands = summarizeDirections(returns);
  const examples = compareDirectionTargets(returns);
  const targets = examples.map(({ colors, moved, stationary, movedExample, stationaryExample }) =>
    ({ colors, moved, stationary, movedAction: movedExample?.sequence, stationaryAction: stationaryExample?.sequence }));
  if (game === 'LS20') {
    const a = returns.find(item => item.sequence === 18);
    const b = returns.find(item => item.sequence === 19);
    if (!a?.translation || !b?.stationary?.ahead) throw new Error('Paired example no longer matches');
    const artifact = new URL('../src/sic/ls20-direction-review.json', import.meta.url);
    const review = JSON.stringify({
      commands, targets, count: returns.length, example: {
        level: a.fromLevel, command: a.command, movedAction: a.sequence, blockedAction: b.sequence,
        movedTarget: a.translation.targetBefore, blockedTarget: b.stationary.ahead, sprite: a.translation.sprite,
      },
    }) + '\n';
    if (write) writeFileSync(artifact, review);
    else if (readFileSync(artifact, 'utf8') !== review) throw new Error('Directional review differs from the archive');
  }
  console.log(JSON.stringify({ game, count: returns.length, commands, targets }));
}
