// Diagnostic preload for the two measured revisions. Each witness records
// the real caller arguments and accepted displacement after its own guard.
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

if (process.env.SIC_REPLAY_CHILD === '1' && process.env.SIC_DISPLACEMENT_WITNESS) {
  const paths = [
    { file: 'replay-access.ts', step: 'scene.body.quantum', command: 'command.action_ref',
      axial: '(!delta[0] || !delta[1])' },
    { file: 'reception-access.ts', step: 'local.scene.pitch', command: 'issued.action_ref',
      axial: '(delta[0] === 0 || delta[1] === 0)' },
  ];
  const loaded = {};
  const samples = [];
  globalThis[Symbol.for('sic.displacement.witness')] = (file, from, position, step, command, observation, value, accepted) => {
    samples.push({ file, from, position, step, command, observation, displacement: accepted ? value : null });
    return accepted;
  };
  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      const site = paths.find(({ file }) => url.endsWith('/src/sic/' + file));
      if (!site) return result;
      const { file, step, command, axial } = site;
      const source = Buffer.from(result.source).toString('utf8');
      const shared = `const delta = singleStepDisplacement(from, position, ${step});`;
      const inline = `if (Math.abs(delta[0]) + Math.abs(delta[1]) === ${step} && ${axial})`;
      const report = `globalThis[Symbol.for('sic.displacement.witness')]('${file}', from, position, ${step}, ${command}, after.observation_ref, delta, `;
      const isShared = source.includes(shared);
      const needle = isShared ? shared : inline;
      if (source.split(needle).length !== 2) throw Error('Unrecognised displacement call site in ' + url);
      loaded[file] = isShared ? 'singleStepDisplacement' : 'inline';
      const replacement = isShared ? shared + ' ' + report + 'delta !== null);'
        : 'if (' + report + inline.slice(4, -1) + '))';
      return { ...result, source: source.replace(needle, replacement) };
    },
  });
  process.once('exit', () => writeFileSync(process.env.SIC_DISPLACEMENT_WITNESS,
    JSON.stringify({ loaded, samples }) + '\n', { flag: 'wx' }));
}
