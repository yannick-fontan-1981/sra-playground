export const REGION_PUBLIC_ACTION6_PROBE_V1 = Object.freeze({
  id: 'region-public-action6-probe-v1',
  games: Object.freeze(['STCK', 'SMLP']),
  actionId: 6,
  source: 'public 64x64 frame only',
  rule: 'SMLP: first visible closed-gate 3x3 glyph center; STCK: first visible bottom shop-button run center',
});

function validateFrame(observation) {
  if (!observation || typeof observation !== 'object') {
    throw new TypeError('public probe observation must be an object');
  }
  if (!Array.isArray(observation.availableActionIds) || !observation.availableActionIds.includes(6)) {
    throw new Error('public probe requires ACTION6 to be available');
  }
  const frame = observation.frame;
  if (!Array.isArray(frame) || frame.length !== 64 || frame.some(row => !Array.isArray(row) || row.length !== 64)) {
    throw new RangeError('public probe requires a 64x64 frame');
  }
  return frame;
}

function same(values) {
  return values.length > 0 && values.every(value => value === values[0]);
}

export function findSmlpVisibleGateCenter(observation) {
  const frame = validateFrame(observation);
  for (let y = 8; y <= 58; y += 1) {
    for (let x = 1; x <= 62; x += 1) {
      const patch = [
        [frame[y - 1][x - 1], frame[y - 1][x], frame[y - 1][x + 1]],
        [frame[y][x - 1], frame[y][x], frame[y][x + 1]],
        [frame[y + 1][x - 1], frame[y + 1][x], frame[y + 1][x + 1]],
      ];

      const verticalLine = patch[0][1] === 5 && patch[1][1] === 5 && patch[2][1] === 5;
      if (verticalLine) {
        const surround = [patch[0][0], patch[0][2], patch[1][0], patch[1][2], patch[2][0], patch[2][2]];
        if (same(surround) && surround[0] !== 5) return { id: 6, x, y };
      }

      const horizontalLine = patch[1][0] === 5 && patch[1][1] === 5 && patch[1][2] === 5;
      if (horizontalLine) {
        const surround = [patch[0][0], patch[0][1], patch[0][2], patch[2][0], patch[2][1], patch[2][2]];
        if (same(surround) && surround[0] !== 5) return { id: 6, x, y };
      }
    }
  }
  return undefined;
}

export function findStckVisibleShopButtonCenter(observation) {
  const frame = validateFrame(observation);
  const y0 = 54;
  const y1 = 58;
  const active = [];
  for (let x = 0; x < 64; x += 1) {
    let nonBlack = 0;
    for (let y = y0; y <= y1; y += 1) {
      if (frame[y][x] !== 5) nonBlack += 1;
    }
    active.push(nonBlack >= 2);
  }

  let start = -1;
  for (let x = 0; x <= 64; x += 1) {
    const on = x < 64 ? active[x] : false;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      const end = x - 1;
      if (end - start + 1 >= 5) {
        return { id: 6, x: Math.floor((start + end) / 2), y: 56 };
      }
      start = -1;
    }
  }
  return undefined;
}

export function selectRegionPublicAction6Probe(game, observation) {
  if (game === 'SMLP') return findSmlpVisibleGateCenter(observation);
  if (game === 'STCK') return findStckVisibleShopButtonCenter(observation);
  throw new RangeError(`unsupported Region public probe game ${String(game)}`);
}
