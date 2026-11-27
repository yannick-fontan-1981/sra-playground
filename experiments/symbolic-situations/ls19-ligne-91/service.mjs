import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount,run } from '../ls19-ligne-90/montage.mjs';
export { run };
export function native(sha,repo) {
  const m=mount(sha,repo);
  try {copyFileSync(new URL('./worker.mjs',import.meta.url),join(m.program,'worker.mjs'));return m;}
  catch(error){m.close();throw error;}
}
