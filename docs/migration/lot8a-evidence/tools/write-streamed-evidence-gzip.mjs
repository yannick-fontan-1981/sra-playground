/** Lossless JSON/gzip report output with a final pathname only after completion.
 * Reuses the existing lot10B serializer. No native runtime or campaign is imported.
 * The value remains in memory; this only avoids a whole-document string/Buffer.
 * An interrupted process can leave its uniquely named temporary directory. It
 * cannot expose an incomplete file at the requested final report pathname.
 */
import { createWriteStream } from 'node:fs';
import { link, lstat, mkdtemp, open, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { evidenceJsonChunks } from '../../lot10b-evidence/stream-evidence-json.mjs';

export const MAX_JSON_CHUNK_BYTES = 49_152;

async function absent(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const error = new Error(`Evidence already exists: ${path}`);
  error.code = 'EEXIST';
  throw error;
}

export async function writeStreamedEvidenceGzip(path, value, { signal } = {}) {
  const output = resolve(path);
  await absent(output);
  signal?.throwIfAborted();
  const temporaryDirectory = await mkdtemp(`${output}.inprogress-`);
  const temporary = `${temporaryDirectory}/report.gz`;
  let rawBytes = 0, chunks = 0, maximumChunkBytes = 0;
  const digest = createHash('sha256');
  const observer = new Transform({
    transform(chunk, _encoding, done) {
      if (!Buffer.isBuffer(chunk) || chunk.length === 0 || chunk.length > MAX_JSON_CHUNK_BYTES) {
        done(new Error('The evidence serializer emitted an invalid chunk'));
        return;
      }
      rawBytes += chunk.length;
      chunks++;
      maximumChunkBytes = Math.max(maximumChunkBytes, chunk.length);
      digest.update(chunk);
      done(null, chunk);
    },
  });
  try {
    const streams = [
      Readable.from(evidenceJsonChunks(value, { trailingNewline: true }), { objectMode: false }),
      observer,
      createGzip(),
      createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
    ];
    if (signal) await pipeline(...streams, { signal });
    else await pipeline(...streams);
    if (rawBytes === 0) throw new TypeError('The report must have a JSON serialization');
    const completed = await open(temporary, 'r');
    try { await completed.sync(); } finally { await completed.close(); }
    signal?.throwIfAborted();
    // A same-filesystem hard link installs complete bytes atomically and fails
    // if another writer already installed the target. It never replaces it.
    await link(temporary, output);
  } finally {
    // Only our unique temporary directory is removed. Existing output files
    // and other writers' in-progress directories are never touched.
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  const directory = await open(dirname(output), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
  return {
    rawBytes, rawSha256: digest.digest('hex'), chunks, maximumChunkBytes,
    gzipBytes: (await stat(output)).size,
    completeBeforeFinalPath: true,
    replacesExistingEvidence: false,
  };
}
