import { performance } from 'node:perf_hooks';
import { PROTOCOL_VERSION } from '../src/runtime/contracts.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import { preparePublicSingleActionDecision } from '../src/logos-engine/v6-public-single-action-port.ts';
import { CommonCampaignOwner } from '../src/logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../src/logos-engine/v6-public-single-action-caller-adapter.ts';

const pixels = new Uint8Array(64 * 64);

function observation(sessionId, actions) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    sequence: 0,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels,
    },
    availableActionIds: actions,
    state: 'NOT_FINISHED',
    level: 1,
    levelsCompleted: 0,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sample(operation, samples) {
  const elapsed = [];
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    const started = performance.now();
    operation(sampleIndex);
    elapsed.push(performance.now() - started);
  }
  return elapsed;
}

function summarize(values, cycles) {
  const medianMs = median(values);
  return {
    samples: values.length,
    cycles,
    median_ms: medianMs,
    median_us_per_cycle: medianMs * 1000 / cycles,
    min_ms: Math.min(...values),
    max_ms: Math.max(...values),
  };
}

function directNoProposal(cycles, sampleIndex) {
  for (let index = 0; index < cycles; index += 1) {
    const current = observation(`direct-none:${sampleIndex}:${index}`, [1, 2]);
    if (preparePublicSingleActionDecision(current) !== undefined) {
      throw new Error('direct no-proposal diagnostic unexpectedly produced a decision');
    }
  }
}

function commonNoProposal(cycles, sampleIndex) {
  const campaign = new CommonCampaignOwner([new PublicSingleActionCallerOwnerAdapter()]);
  for (let index = 0; index < cycles; index += 1) {
    const current = observation(`common-none:${sampleIndex}:${index}`, [1, 2]);
    const result = campaign.prepare(current, {
      [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
    });
    if (result.status !== 'none') {
      throw new Error('common no-proposal diagnostic unexpectedly produced a decision');
    }
  }
}

function directReleasedAction(cycles, sampleIndex) {
  for (let index = 0; index < cycles; index += 1) {
    const current = observation(`direct-action:${sampleIndex}:${index}`, [1]);
    const prepared = preparePublicSingleActionDecision(current);
    if (!prepared) throw new Error('direct action diagnostic did not prepare a decision');
    const released = releaseBundle(
      prepared.bundle,
      prepared.state,
      prepared.identity,
    );
    if (!released.releaseAllowed) {
      throw new Error('direct action diagnostic did not release its action');
    }
  }
}

function commonReleasedAction(cycles, sampleIndex) {
  const campaign = new CommonCampaignOwner([new PublicSingleActionCallerOwnerAdapter()]);
  for (let index = 0; index < cycles; index += 1) {
    const current = observation(`common-action:${sampleIndex}:${index}`, [1]);
    const prepared = campaign.prepare(current, {
      [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: { observation: current },
    });
    if (prepared.status !== 'action') {
      throw new Error('common action diagnostic did not release its action');
    }
    const receipt = campaign.acquire({
      sessionId: current.sessionId,
      needId: prepared.needId,
      eventRef: `return:${sampleIndex}:${index}`,
      payload: { sequence: 1 },
    });
    if (!receipt.routed) {
      throw new Error('common action diagnostic did not route its return');
    }
  }
}

const cycles = Number(process.env.COMMON_CAMPAIGN_CYCLES ?? 2000);
const samples = Number(process.env.COMMON_CAMPAIGN_SAMPLES ?? 21);
if (!Number.isInteger(cycles) || cycles < 1) throw new RangeError('COMMON_CAMPAIGN_CYCLES must be positive');
if (!Number.isInteger(samples) || samples < 3) throw new RangeError('COMMON_CAMPAIGN_SAMPLES must be at least 3');

const directNone = summarize(sample(index => directNoProposal(cycles, index), samples), cycles);
const commonNone = summarize(sample(index => commonNoProposal(cycles, index), samples), cycles);
const directAction = summarize(sample(index => directReleasedAction(cycles, index), samples), cycles);
const commonAction = summarize(sample(index => commonReleasedAction(cycles, index), samples), cycles);

commonNone.delta_vs_direct_pct = ((commonNone.median_ms - directNone.median_ms) / directNone.median_ms) * 100;
commonNone.absolute_overhead_us_per_cycle = commonNone.median_us_per_cycle - directNone.median_us_per_cycle;
commonAction.delta_vs_direct_pct = ((commonAction.median_ms - directAction.median_ms) / directAction.median_ms) * 100;
commonAction.absolute_overhead_us_per_cycle = commonAction.median_us_per_cycle - directAction.median_us_per_cycle;

console.log(JSON.stringify({
  status: 'diagnostic_only',
  official_performance_qualification: false,
  note: 'Public OP28 micro-path only; not a native STCK or SMLP session.',
  results: {
    direct_no_proposal: directNone,
    common_no_proposal: commonNone,
    direct_released_action: directAction,
    common_released_action_and_return: commonAction,
  },
}, null, 2));
