import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROTOCOL_VERSION,
  type AgentObservation,
} from '../src/runtime/contracts.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  publicSmlpAddressedJointContext,
  publicUniqueSmlpAddressedJointContext,
} from '../src/logos-engine/v6-public-addressed-joint-channels.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import {
  findUniqueStckStackCardTarget,
  preparePublicUniqueStckAction6Decision,
} from '../src/logos-engine/v6-public-unique-stck-action6-port.ts';

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
    sessionId: 'public-product-action6-session',
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
    findUniqueStckStackCardTarget(observation(pixels)),
    {
      kind: 'stck-stack-card',
      x: 4,
      y: 50,
      evidenceRef: 'public-stck-stack-card:10:49-52',
    },
  );
});

test('two visible STCK cards remain unresolved instead of selecting one', () => {
  const pixels = frame();
  fillRect(pixels, 1, 39, 8, 3, 9);
  fillRect(pixels, 1, 49, 8, 4, 10);
  assert.equal(findUniqueStckStackCardTarget(observation(pixels)), undefined);
});

test('terminal or unavailable ACTION6 observations produce no STCK target', () => {
  const pixels = frame();
  fillRect(pixels, 1, 49, 8, 4, 10);
  assert.equal(
    findUniqueStckStackCardTarget(observation(pixels, { state: 'WIN' })),
    undefined,
  );
  assert.equal(
    findUniqueStckStackCardTarget(observation(pixels, { availableActionIds: [5] })),
    undefined,
  );
});

test('the unique STCK card becomes an admitted OP28 bundle with complete ACTION6 coordinates', () => {
  const pixels = frame();
  fillRect(pixels, 1, 49, 8, 4, 10);
  const prepared = preparePublicUniqueStckAction6Decision(observation(pixels));
  assert.ok(prepared);
  assert.deepEqual(prepared.action, { id: 6, data: { x: 4, y: 50 } });
  assert.equal(prepared.bundle.operation_key, 'OP28');
  assert.deepEqual(prepared.bundle.actions, [{ id: 6, data: { x: 4, y: 50 } }]);

  const release = releaseBundle(
    prepared.bundle,
    prepared.state,
    prepared.identity,
  );
  assert.equal(release.releaseAllowed, true);
  assert.equal(release.result?.bundleAdmitted, true);
  assert.equal(release.result?.operationAdmission?.accepted, true);
  assert.equal(release.result?.operationAdmission?.reason, 'operation_selected_reference');
});

test('observation revision participates in the STCK ACTION6 bundle identity', () => {
  const pixels = frame();
  fillRect(pixels, 1, 49, 8, 4, 10);
  const first = preparePublicUniqueStckAction6Decision(observation(pixels, { sequence: 3 }))!;
  const second = preparePublicUniqueStckAction6Decision(observation(pixels, { sequence: 4 }))!;
  assert.notEqual(first.bundle.id, second.bundle.id);
  assert.equal(first.bundle.observation_revision, 3);
  assert.equal(second.bundle.observation_revision, 4);
});

test('one SMLP gate supplies both causal joint-channel contexts in the product', () => {
  const pixels = frame(2);
  closedVerticalGate(pixels, 32, 26);
  assert.deepEqual(Object.keys(publicUniqueSmlpAddressedJointContext(observation(pixels))).sort(), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
});

test('several SMLP gates preserve product ambiguity without rewriting the qualified 9C2 tie rule', () => {
  const pixels = frame(2);
  closedVerticalGate(pixels, 20, 20);
  closedVerticalGate(pixels, 40, 40);
  const current = observation(pixels);

  assert.deepEqual(publicUniqueSmlpAddressedJointContext(current), {});
  assert.deepEqual(Object.keys(publicSmlpAddressedJointContext(current)).sort(), [
    PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
    PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
  ]);
});
