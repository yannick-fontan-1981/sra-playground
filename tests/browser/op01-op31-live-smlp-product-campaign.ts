import type {
  ProductReadinessState,
  XYActionData,
} from '../../src/agent-product-dispatch.ts';
import {
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
} from '../../src/logos-engine/v6-public-addressed-joint-channels.ts';
import { JOINT_CHANNEL_OWNER_ID } from '../../src/logos-engine/v6-joint-channel-owner.ts';
import {
  BrowserGameRuntime,
  type GameObservation,
} from '../../src/runtime/browser-games.ts';
import { ObservedAddressedMaterialRuntime } from '../../src/runtime/observed-addressed-material-runtime.ts';
import {
  createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost,
} from '../../src/runtime/v6-browser-product-campaign-host.ts';

const ACTIONS_REQUESTED = 3;
const SESSION_ID = 'op01-op31-live-smlp-product-campaign';
const EXPECTED_ACTION = { id: 6, x: 32, y: 26 } as const;
const EXPECTED_CHANNELS = [
  PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID,
  PUBLIC_VISIBLE_TARGET_CHANNEL_ID,
].sort();

type ExtendedObservation = GameObservation & {
  gameId?: string;
  backend?: string;
};

type JointChannelResult = {
  acquired: true;
  channelId: string;
  contributionRef: string;
  needId: string;
  proposalRef: string;
  jointRef: string;
};

type JointAcquisitionResult = {
  acquired: true;
  needId: string;
  eventRef: string;
  proposalRef: string;
  jointRef: string;
  channels: Array<{
    channelId: string;
    contributionRef: string;
    result: JointChannelResult;
  }>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function changedPixels(before: number[][], after: number[][]): number {
  if (before.length !== 64 || after.length !== 64) {
    throw new RangeError('live SMLP frames must be 64x64');
  }
  let changed = 0;
  for (let y = 0; y < 64; y += 1) {
    const beforeRow = before[y];
    const afterRow = after[y];
    if (!beforeRow || !afterRow || beforeRow.length !== 64 || afterRow.length !== 64) {
      throw new RangeError('live SMLP frames must be 64x64');
    }
    for (let x = 0; x < 64; x += 1) {
      if (beforeRow[x] !== afterRow[x]) changed += 1;
    }
  }
  return changed;
}

async function frameHash(frame: number[][]): Promise<string> {
  if (frame.length !== 64 || frame.some(row => row.length !== 64)) {
    throw new RangeError('live SMLP frame must be 64x64');
  }
  const pixels = Uint8Array.from(frame.flat());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function publicState(observation: ExtendedObservation) {
  return {
    frameHash: await frameHash(observation.frame),
    availableActionIds: [...observation.availableActionIds],
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  };
}

function productState(
  observation: ExtendedObservation,
  busy: boolean,
): ProductReadinessState {
  return {
    observation,
    selectedGameCode: observation.gameCode,
    busy,
    loading: false,
    failed: false,
  };
}

class TrackingAddressedRuntime extends ObservedAddressedMaterialRuntime {
  #events: string[] | null = null;
  lastLearningStatus: string | null = null;

  beginCycle(events: string[]): void {
    this.#events = events;
    this.lastLearningStatus = null;
  }

  override observeAddressedReturn(
    ...args: Parameters<ObservedAddressedMaterialRuntime['observeAddressedReturn']>
  ): ReturnType<ObservedAddressedMaterialRuntime['observeAddressedReturn']> {
    this.#events?.push('passive-field-stock');
    const result = super.observeAddressedReturn(...args);
    this.lastLearningStatus = result.status;
    return result;
  }
}

async function postReport(payload: unknown): Promise<void> {
  const response = await fetch('/__op01-op31-live-smlp-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`report endpoint returned ${response.status}`);
}

async function main(): Promise<void> {
  const status = document.querySelector<HTMLPreElement>('#status');
  const runtime = new BrowserGameRuntime({ requestTimeoutMs: 300_000 });
  const fieldRuntime = new TrackingAddressedRuntime();
  const host = createFieldStockPublicAction6AndPublicSingleActionBrowserCampaignHost({
    fieldStockRuntime: fieldRuntime,
  });

  try {
    let current = await runtime.load('SMLP', 1) as ExtendedObservation;
    assert(current.gameCode === 'SMLP', `expected SMLP, received ${current.gameCode}`);
    const initial = await publicState(current);
    host.begin({ sessionId: SESSION_ID, observation: current });

    let busy = false;
    const generation = 1;
    const cycles = [];
    const needIds = new Set<string>();

    for (let index = 0; index < ACTIONS_REQUESTED; index += 1) {
      if (status) status.textContent = `running SMLP product cycle ${index + 1}/${ACTIONS_REQUESTED}`;
      const events: string[] = [];
      const busyTransitions: boolean[] = [];
      fieldRuntime.beginCycle(events);
      const before = current;
      let returned: ExtendedObservation | undefined;
      let callbackReceipt: {
        needId: string;
        ownerId: string;
        proposalRef: string;
        routed: boolean;
        duplicate: boolean;
      } | undefined;

      const result = await host.run(productState(current, busy), {
        action: async (action: number, data?: XYActionData) => {
          events.push(`action:${action}:${data?.x}:${data?.y}`);
          returned = await runtime.action(action, data) as ExtendedObservation;
          events.push('action-return');
          return returned;
        },
        present: async next => {
          events.push('present');
          current = next as ExtendedObservation;
        },
        now: () => performance.now(),
        generation: () => generation,
        setBusy: value => {
          busy = value;
          busyTransitions.push(value);
        },
        onCampaignAcquired: receipt => {
          callbackReceipt = {
            needId: receipt.needId,
            ownerId: receipt.ownerId,
            proposalRef: receipt.proposalRef,
            routed: receipt.routed,
            duplicate: receipt.duplicate,
          };
          events.push('acquired');
        },
      });

      assert(result.status === 'action', `cycle ${index + 1} did not release an action: ${result.status}`);
      assert(result.preparation?.status === 'action', `cycle ${index + 1} has no action preparation`);
      const preparation = result.preparation;
      assert(preparation.ownerId === JOINT_CHANNEL_OWNER_ID, `unexpected owner ${preparation.ownerId}`);
      assert(preparation.action.id === 6, `unexpected action ${preparation.action.id}`);
      assert(
        preparation.action.data.x === EXPECTED_ACTION.x
          && preparation.action.data.y === EXPECTED_ACTION.y,
        `unexpected SMLP coordinates ${stable(preparation.action.data)}`,
      );
      assert(result.dispatch?.accepted === true, `cycle ${index + 1} dispatch was not accepted`);
      assert(result.dispatch.stale === false, `cycle ${index + 1} dispatch became stale`);
      assert(result.acquisition, `cycle ${index + 1} has no acquisition receipt`);
      assert(result.returnedObservation, `cycle ${index + 1} has no returned AgentObservation`);
      assert(returned, `cycle ${index + 1} has no returned GameObservation`);
      assert(callbackReceipt, `cycle ${index + 1} did not publish acquisition callback`);

      const acquisition = result.acquisition;
      const joint = acquisition.result as JointAcquisitionResult | undefined;
      assert(joint?.acquired === true, `cycle ${index + 1} did not route a joint acquisition`);
      assert(acquisition.ownerId === JOINT_CHANNEL_OWNER_ID, `acquisition routed to ${acquisition.ownerId}`);
      assert(acquisition.needId === preparation.needId, 'campaign acquisition changed needId');
      assert(acquisition.proposalRef === preparation.proposalRef, 'campaign acquisition changed proposalRef');
      assert(callbackReceipt.needId === preparation.needId, 'callback changed needId');
      assert(callbackReceipt.ownerId === JOINT_CHANNEL_OWNER_ID, 'callback routed to another owner');
      assert(callbackReceipt.proposalRef === preparation.proposalRef, 'callback changed proposalRef');
      assert(callbackReceipt.routed === true && callbackReceipt.duplicate === false, 'callback did not route once');
      assert(joint.needId === preparation.needId, 'joint receipt changed needId');
      assert(joint.proposalRef === preparation.proposalRef, 'joint receipt changed proposalRef');

      const channelIds = joint.channels.map(item => item.channelId).sort();
      assert(stable(channelIds) === stable(EXPECTED_CHANNELS), `unexpected joint channels ${stable(channelIds)}`);
      for (const channel of joint.channels) {
        assert(channel.result.acquired === true, `${channel.channelId} did not acquire the selected return`);
        assert(channel.result.channelId === channel.channelId, `${channel.channelId} result identity changed`);
        assert(channel.result.contributionRef === channel.contributionRef, `${channel.channelId} contribution changed`);
        assert(channel.result.needId === preparation.needId, `${channel.channelId} changed needId`);
        assert(channel.result.proposalRef === preparation.proposalRef, `${channel.channelId} changed proposalRef`);
        assert(channel.result.jointRef === joint.jointRef, `${channel.channelId} changed jointRef`);
      }

      const expectedEvents = [
        `action:6:${EXPECTED_ACTION.x}:${EXPECTED_ACTION.y}`,
        'action-return',
        'passive-field-stock',
        'acquired',
        'present',
      ];
      assert(stable(events) === stable(expectedEvents), `unexpected cycle order ${stable(events)}`);
      assert(stable(busyTransitions) === stable([true, false]), `unexpected busy transitions ${stable(busyTransitions)}`);
      assert(fieldRuntime.status() === 'empty', `passive FieldStock unexpectedly became ${fieldRuntime.status()}`);
      assert(fieldRuntime.field.model === null, 'passive FieldStock created a model from the SMLP gate toggle');
      assert(fieldRuntime.field.prior === null, 'passive FieldStock created a prior from the SMLP gate toggle');
      assert(fieldRuntime.field.stock === null, 'passive FieldStock created a stock from the SMLP gate toggle');
      assert(!needIds.has(preparation.needId), 'a product cycle reused an already settled needId');
      needIds.add(preparation.needId);

      const changedPixelCount = changedPixels(before.frame, returned.frame);
      assert(changedPixelCount === 9, `SMLP cycle changed ${changedPixelCount} pixels instead of 9`);
      const state = await publicState(returned);
      cycles.push({
        index: index + 1,
        ownerId: preparation.ownerId,
        proposalRef: preparation.proposalRef,
        bundleId: preparation.bundleId,
        needId: preparation.needId,
        action: {
          id: preparation.action.id,
          x: preparation.action.data.x,
          y: preparation.action.data.y,
        },
        dispatch: result.dispatch,
        acquisition: {
          ownerId: acquisition.ownerId,
          eventRef: acquisition.eventRef,
          needId: acquisition.needId,
          proposalRef: acquisition.proposalRef,
          routed: acquisition.routed,
          duplicate: acquisition.duplicate,
          jointRef: joint.jointRef,
          channels: joint.channels.map(channel => ({
            channelId: channel.channelId,
            contributionRef: channel.contributionRef,
            acquired: channel.result.acquired,
            needId: channel.result.needId,
            proposalRef: channel.result.proposalRef,
            jointRef: channel.result.jointRef,
          })),
        },
        callbackReceipt,
        agentSequence: result.returnedObservation.sequence,
        changedPixelCount,
        fieldLearningStatus: fieldRuntime.lastLearningStatus,
        fieldKnowledgeStatus: fieldRuntime.status(),
        events,
        busyTransitions,
        ...state,
      });
    }

    const report = {
      version: 1,
      runtime: 'browser-product-host-game-worker-pyodide',
      transport: 'BrowserGameRuntime -> game-worker.ts -> Pyodide -> game_bridge.py -> custom-games.zip -> BrowserCommonCampaignHost -> JointChannelOwner -> OP28 -> product dispatch',
      userAgent: navigator.userAgent,
      game: 'SMLP',
      gameId: String(current.gameId ?? ''),
      backend: String(current.backend ?? ''),
      actionsRequested: ACTIONS_REQUESTED,
      initial,
      cycles,
      finalFieldStock: {
        status: fieldRuntime.status(),
        hasModel: fieldRuntime.field.model !== null,
        hasPrior: fieldRuntime.field.prior !== null,
        hasStock: fieldRuntime.field.stock !== null,
        samples: fieldRuntime.field.samples.length,
      },
    };

    document.body.dataset.status = 'success';
    if (status) status.textContent = 'success';
    await postReport({ status: 'success', report });
  } catch (error) {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : String(error);
    document.body.dataset.status = 'error';
    if (status) status.textContent = message;
    await postReport({ status: 'error', error: message });
  } finally {
    runtime.dispose();
  }
}

void main();
