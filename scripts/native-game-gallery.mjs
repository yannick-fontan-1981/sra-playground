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
import { WizardPuzzleSession } from '../experiments/sinking-star-ss04/src/core.ts';
import { SS04_LEVELS } from '../experiments/sinking-star-ss04/src/levels.ts';
import { BardPuzzleSession } from '../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../experiments/sinking-star-ss05/src/levels.ts';
import { DuoPuzzleSession } from '../experiments/sinking-star-ss06/src/core.ts';
import { SS06_LEVELS } from '../experiments/sinking-star-ss06/src/levels.ts';
import { DuoPuzzleSession as ThiefDuoSession } from '../experiments/sinking-star-ss07/src/core.ts';
import { SS07_LEVELS } from '../experiments/sinking-star-ss07/src/levels.ts';
import { DuoPuzzleSession as WizardDuoSession } from '../experiments/sinking-star-ss08/src/core.ts';
import { SS08_LEVELS } from '../experiments/sinking-star-ss08/src/levels.ts';
import { DuoPuzzleSession as ChorusDuoSession } from '../experiments/sinking-star-ss09/src/core.ts';
import { SS09_LEVELS } from '../experiments/sinking-star-ss09/src/levels.ts';
import { DuoPuzzleSession as WarehouseDuoSession } from '../experiments/sinking-star-ss10/src/core.ts';
import { SS10_LEVELS } from '../experiments/sinking-star-ss10/src/levels.ts';
import { DuoPuzzleSession as ForgeDuoSession } from '../experiments/sinking-star-ss11/src/core.ts';
import { SS11_LEVELS } from '../experiments/sinking-star-ss11/src/levels.ts';
import { DuoPuzzleSession as ColumnDuoSession } from '../experiments/sinking-star-ss12/src/core.ts';
import { SS12_LEVELS } from '../experiments/sinking-star-ss12/src/levels.ts';
import { DuoPuzzleSession as AnchorDuoSession } from '../experiments/sinking-star-ss13/src/core.ts';
import { SS13_LEVELS } from '../experiments/sinking-star-ss13/src/levels.ts';
import { DuoPuzzleSession as HarmonyDuoSession } from '../experiments/sinking-star-ss14/src/core.ts';
import { SS14_LEVELS } from '../experiments/sinking-star-ss14/src/levels.ts';
import { DuoPuzzleSession as AccordDuoSession } from '../experiments/sinking-star-ss15/src/core.ts';
import { SS15_LEVELS } from '../experiments/sinking-star-ss15/src/levels.ts';
import { TrioPuzzleSession } from '../experiments/sinking-star-ss16/src/core.ts';
import { SS16_LEVELS } from '../experiments/sinking-star-ss16/src/levels.ts';
import { TrioPuzzleSession as FortressTrioSession } from '../experiments/sinking-star-ss17/src/core.ts';
import { SS17_LEVELS } from '../experiments/sinking-star-ss17/src/levels.ts';
import { TrioPuzzleSession as GalleryTrioSession } from '../experiments/sinking-star-ss18/src/core.ts';
import { SS18_LEVELS } from '../experiments/sinking-star-ss18/src/levels.ts';
import { TrioPuzzleSession as GuardiansTrioSession } from '../experiments/sinking-star-ss19/src/core.ts';
import { SS19_LEVELS } from '../experiments/sinking-star-ss19/src/levels.ts';
import { TrioPuzzleSession as RelayTrioSession } from '../experiments/sinking-star-ss20/src/core.ts';
import { SS20_LEVELS } from '../experiments/sinking-star-ss20/src/levels.ts';
import { QuartetPuzzleSession } from '../experiments/sinking-star-ss21/src/core.ts';
import { SS21_LEVELS } from '../experiments/sinking-star-ss21/src/levels.ts';

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
  const sessions = [
    new SinkingStarSession(SS01_LEVELS), new PushPuzzleSession(SS02_LEVELS),
    new PullPuzzleSession(SS03_LEVELS), new WizardPuzzleSession(SS04_LEVELS),
    new BardPuzzleSession(SS05_LEVELS), new DuoPuzzleSession(SS06_LEVELS),
    new ThiefDuoSession(SS07_LEVELS), new WizardDuoSession(SS08_LEVELS), new ChorusDuoSession(SS09_LEVELS),
    new WarehouseDuoSession(SS10_LEVELS), new ForgeDuoSession(SS11_LEVELS),
    new ColumnDuoSession(SS12_LEVELS), new AnchorDuoSession(SS13_LEVELS), new HarmonyDuoSession(SS14_LEVELS),
    new AccordDuoSession(SS15_LEVELS), new TrioPuzzleSession(SS16_LEVELS), new FortressTrioSession(SS17_LEVELS), new GalleryTrioSession(SS18_LEVELS), new GuardiansTrioSession(SS19_LEVELS), new RelayTrioSession(SS20_LEVELS), new QuartetPuzzleSession(SS21_LEVELS),
  ];
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
