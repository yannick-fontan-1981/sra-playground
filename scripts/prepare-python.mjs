/** Prepare self-hosted WebAssembly assets from a pinned, integrity-checked manifest. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('./python-runtime-assets.json', import.meta.url), 'utf8'));
const destination = path.join(root, 'public/vendor/pyodide');
await mkdir(destination, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

for (const item of manifest.files) {
  const filename = path.join(destination, item.file);
  if (path.basename(item.file) !== item.file) throw new Error('Invalid runtime asset filename.');
  let current;
  try { current = await readFile(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current && hash(current) === item.sha256) continue;
  const response = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Cannot download ${item.file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error(`Integrity check failed for ${item.file}`);
  const temporary = `${filename}.download`;
  await writeFile(temporary, bytes);
  await rename(temporary, filename);
  console.log(`Prepared ${item.file}`);
}
console.log(`Browser Python ${manifest.python}: self-hosted assets ready.`);
