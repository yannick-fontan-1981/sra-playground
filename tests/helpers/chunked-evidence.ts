/** Lossless transport only: large immutable fixtures may be stored in parts. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (value: Buffer): string => createHash('sha256').update(value).digest('hex');
export function readEvidenceSync(url: URL): Buffer {
  let manifest: { schema: string; original: { file: string; bytes: number; sha256: string };
    parts: { file: string; bytes: number; sha256: string }[] };
  try { manifest = JSON.parse(readFileSync(new URL(url.href + '.parts.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return readFileSync(url); throw error; }
  if (manifest.schema !== 'logos-engine.evidence-byte-parts.v1'
    || manifest.original.file !== url.pathname.split('/').at(-1) || !manifest.parts.length) throw new TypeError('Invalid evidence byte manifest');
  const buffers = manifest.parts.map(part => {
    if (!part.file || /[/\\]/.test(part.file) || part.file === '.' || part.file === '..') throw new TypeError('Invalid evidence part path');
    const bytes = readFileSync(new URL(part.file, url));
    if (bytes.length !== part.bytes || sha(bytes) !== part.sha256) throw new TypeError('Evidence part fingerprint differs');
    return bytes;
  });
  const restored = Buffer.concat(buffers);
  if (restored.length !== manifest.original.bytes || sha(restored) !== manifest.original.sha256) throw new TypeError('Evidence byte reconstruction differs');
  return restored;
}
