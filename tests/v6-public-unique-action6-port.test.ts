import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import {
  findUniquePublicAction6Target,
  preparePublicUniqueAction6Decision,
} from '../src/logos-engine/v6-public-unique-action6-port.ts';

function frame(fill = 5): Uint8Array {
  return new Uint8Array(4096).fill(fill);
}

function setPixel(pixels: Uint8Array, x: number, y: number, value: number): void {
  pixels[y * 64 + x] = value;
}

function fillRect(
  pixels: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(pixels, column, row, value);
    }
  }
}

function observation(
  pixels: Uint8Array,
  overrides: Partial<AgentObservation> = {},
): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'public-action6-session',
    sequence: 3,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels,
    },
    availableActionIds: [6],
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
    ...overrides,
  };
}

function closedVerticalGate(pixels: Uint8Array, x: number, y: number): void {
  fillRect(pixels, x - 1, y - 1, 3, 3, 2);
  setPixel(pixels, x, y - 1, 5);
  setPixel(pixels, x, y, 5);
  setPixel(pixels, x, y + 1, 5);
}

test('one visible STCK card produces one public coordinate target', () => {
  const pixels = frame();
  fillRect(pixels, 1, 49, 8, 4, 10);
  assert.deepEqual(
    findUniquePublicAction6Target('STCK', observation(pixels)),
    {
      kind: 'stck-stack-card',
      x: 4,
      y: 50,
      evidenceRef: 'public-stck-stack-card:10:49-52',
    },
  );
});

test('two visible STCK cards remain ambiguous instead of selecting one', () => {
  const pixels = frame();
  fillRect(pixels, 1, 39, 8, 3, 9);
  fillRect(pixels, 1, 49, 8, 4, 10);
  assert.equal(findUniquePublicAction6Target('STCK', observation(pixels)), undefined);
});

test('one visible SMLP gate produces its exact public center', () => {
  const pixels = frame(2);
  closedVerticalGate(pixels, 32, 26);
  assert.deepEqual(
    findUniquePublicAction6Target('SMLP', observation(pixels)),
    {
      kind: 'smlp-gate',
      x: 32,
      y: 26,
      evidenceRef: 'public-smlp-gate:32:26',
    },
  );
});

test('several visible SMLP gates remain unresolved', () => {
  const pixels = frame(2);
  closedVerticalGate(pixels, 20, 20);
  closedVerticalGate(pixels, 40, 40);
  assert.equal(findUniquePublicAction6Target('SMLP', observation(pixels)), undefined);
});

test('unsupported, terminal or unavailable ACTION6 observations produce no target', () => {
  const pixels = frame();
  fillRect(pixels, 1, 49, 8, 4, 10);
  assert.equal(findUniquePublicAction6Target('TEST', observation(pixels)), undefined);
  assert.equal(
    findUniquePublicAction6Target('STCK', observation(pixels, { state: 'WIN' })),
    undefined,
  );
  assert.equal(
    findUniquePublicAction6Target('STCK', observation(pixels, { availableActionIds: [5] })),
    undefined,
  );
});

test('the unique target becomes an admitted OP28 bundle with a complete ACTION6', () => {
  const pixels = frame(2);
  closedVerticalGate(pixels, 32, 26);
  const prepared = preparePublicUniqueAction6Decision('SMLP', observation(pixels));
  assert.ok(prepared);
  assert.deepEqual(prepared.action, { id: 6, data: { x: 32, y: 26 } });
  assert.equal(prepared.bundle.operation_key, 'OP28');
  assert.equal(prepared.bundle.actions.length, 1);

  const release = releaseBundle(
    prepared.bundle,
    prepared.state,
    prepared.identity,
  );
  assert.equal(release.releaseAllowed, true);
  assert.deepEqual(release.actions, [{ id: 6, data: { x: 32, y: 26 } }]);
});

test('observation revision participates in the ACTION6 bundle identity', () => {
  const pixels = frame(2);
  closedVerticalGate(pixels, 32, 26);
  const first = preparePublicUniqueAction6Decision('SMLP', observation(pixels, { sequence: 3 }))!;
  const second = preparePublicUniqueAction6Decision('SMLP', observation(pixels, { sequence: 4 }))!;
  assert.notEqual(first.bundle.id, second.bundle.id);
  assert.equal(first.bundle.observation_revision, 3);
  assert.equal(second.bundle.observation_revision, 4);
});
