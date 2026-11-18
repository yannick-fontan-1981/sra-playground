/** Generate native games' real level previews without Python or third-party image libraries. */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SinkingStarSession } from '../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../src/games/sinking-star/levels.ts';
import { PushPuzzleSession } from '../experiments/sinking-star-ss02/src/core.ts';
import { SS02_LEVELS } from '../experiments/sinking-star-ss02/src/levels.ts';
import { PullPuzzleSession } from '../experiments/sinking-star-ss03/src/core.ts';
import { SS03_LEVELS } from '../experiments/sinking-star-ss03/src/levels.ts';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
export async function makeNativeGalleryGroup(root) {
  const sessions = [new SinkingStarSession(SS01_LEVELS), new PushPuzzleSession(SS02_LEVELS), new PullPuzzleSession(SS03_LEVELS)];
  const games = sessions.map((session, row) => {
    const { gameCode: code, levelCount } = session.observe();
    const frames = Array.from({ length: levelCount }, (_, column) => session.selectLevel(column + 1));
    return { code, row, levelCount, frames };
  });
  const columns = Math.max(...games.map(game => game.levelCount));
  const rows = games.length, width = columns * 64, height = rows * 64;
  const stride = width * 3 + 1, pixels = Buffer.alloc(stride * height);
  for (const { row, frames } of games) frames.forEach(({ frame, palette }, column) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const rgb = Number.parseInt(palette[frame[y][x]].slice(1), 16);
      const at = (row * 64 + y) * stride + 1 + (column * 64 + x) * 3;
      pixels[at] = rgb >>> 16; pixels[at + 1] = (rgb >>> 8) & 255; pixels[at + 2] = rgb & 255;
    }
  });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
  const image = '/gallery/custom_4.png';
  await mkdir(resolve(root, 'public/gallery'), {recursive:true});
  await writeFile(resolve(root, `public${image}`), png);
  return { id: 'custom_4', image, width, height, rows, columns, sha256: createHash('sha256').update(png).digest('hex'),
    games: games.map(({ frames, ...game }) => ({ ...game, levels: frames.map(({ frame }, column) => ({
      level: column + 1, column, frameSha256: createHash('sha256').update(Buffer.from(frame.flat())).digest('hex'),
    })) })),
  };
}
