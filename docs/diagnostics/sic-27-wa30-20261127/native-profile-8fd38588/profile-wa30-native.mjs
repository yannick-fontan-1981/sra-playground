import { Session } from 'node:inspector/promises';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.env.SIC_REPLAY_CHILD === '1') {
  const { NativeV6Runtime } = await import(pathToFileURL(resolve('src/logos-engine/v6-native-runtime.ts')));
  const originalAdvance = NativeV6Runtime.prototype.advance;
  let session, commands = 0, chunk = 0;
  NativeV6Runtime.prototype.advance = async function (outcome, execution) {
    if (!session && outcome.observation.level === 9) {
      session = new Session();
      session.connect();
      await session.post('Profiler.enable');
      await session.post('Profiler.start');
    }
    const returned = await originalAdvance.call(this, outcome, execution);
    if (session && outcome.observation.level === 9) {
      commands++;
      const complete = outcome.observation.levels_completed >= 9;
      if (commands % 8 === 0 || complete) {
        const { profile } = await session.post('Profiler.stop');
        writeFileSync(join(process.env.WA30_PROFILE_DIR, 'l9-' + String(++chunk).padStart(2, '0') + '.cpuprofile'), JSON.stringify(profile));
        if (!complete) await session.post('Profiler.start');
      }
    }
    return returned;
  };
}
