import { components, type FieldStockDependencies } from '../logos-engine/field-stock.ts';
import type { PublicObservationLike } from '../logos-engine/linked-preparation.ts';
import type { AgentObservation } from './contracts.ts';

export interface PublicCampaignObservation {
  agent: AgentObservation;
  observation: PublicObservationLike;
  rows: readonly (readonly number[])[];
}

export interface MeasuredPublicEntity {
  component_ref: string;
  palette_value: number;
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  rectangular: boolean;
}

function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function hashCodes(codes: Iterable<number>): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;
  for (const code of codes) {
    const value = code & 0xff;
    a = Math.imul(a ^ value, 0x01000193);
    b = Math.imul(b ^ (value + 0x51), 0x27d4eb2d);
    c = Math.imul(c ^ (value + 0x9d), 0x165667b1);
    d = Math.imul(d ^ (value + 0xe7), 0x85ebca77);
  }
  return `${hex(a)}${hex(b)}${hex(c)}${hex(d)}`;
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Uint8Array) return `u8:[${[...value].join(',')}]`;
  if (Array.isArray(value)) return `[${value.map(item => canonical(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return String(value);
}

export function digestPublicValue(value: unknown): string {
  return hashCodes([...canonical(value)].map(character => character.charCodeAt(0)));
}

export function publicRows(observation: AgentObservation): number[][] {
  const { width, height, pixels } = observation.image;
  if (width !== 64 || height !== 64 || pixels.length !== width * height) {
    throw new RangeError('agent public image must be exactly 64x64 palette indices');
  }
  const rows: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const value = pixels[y * width + x];
      if (value === undefined || value < 0 || value > 15) {
        throw new RangeError('agent public pixels must be palette indices in [0, 15]');
      }
      row.push(value);
    }
    rows.push(row);
  }
  return rows;
}

function cloneObservation(observation: AgentObservation): AgentObservation {
  return {
    ...observation,
    image: {
      ...observation.image,
      pixels: Uint8Array.from(observation.image.pixels),
    },
    availableActionIds: [...observation.availableActionIds],
  };
}

export function measurePublicEntities(
  observationRef: string,
  rows: readonly (readonly number[])[],
): MeasuredPublicEntity[] {
  return components(rows).map((component, index) => ({
    component_ref: `${observationRef}:component:${index}`,
    palette_value: component.color,
    bbox: component.bbox,
    mask: component.mask,
    rectangular: component.rectangular,
  }));
}

/**
 * Build the public symbolic observation used by the reconstructed campaign.
 *
 * Entity measurement is deliberately optional. The common OP28 path needs only
 * the public worker contract; connected components are materialized only when a
 * retained FieldStock prior must be revalidated in the current scene.
 */
export function measurePublicCampaignObservation(
  source: AgentObservation,
  includeEntities = false,
): PublicCampaignObservation {
  const agent = cloneObservation(source);
  const rows = publicRows(agent);
  const observationRef = `public-observation:${agent.sessionId}:${agent.sequence}`;
  const observation: PublicObservationLike = {
    observation_ref: observationRef,
    revision: agent.sequence,
    level_epoch: agent.level,
    levels_completed: agent.levelsCompleted,
    state: agent.state,
    frame_hash: `public-frame:${hashCodes(agent.image.pixels)}`,
    available_action_refs: agent.availableActionIds.map(id => `ACTION${id}`),
    ...(includeEntities ? { entities: measurePublicEntities(observationRef, rows) } : {}),
  };
  return { agent, observation, rows };
}

export function completePublicCampaignEntities(
  measured: PublicCampaignObservation,
): PublicCampaignObservation {
  if (measured.observation.entities !== undefined) return measured;
  return {
    ...measured,
    observation: {
      ...measured.observation,
      entities: measurePublicEntities(measured.observation.observation_ref, measured.rows),
    },
  };
}

export const PUBLIC_FIELD_STOCK_DEPENDENCIES: FieldStockDependencies = Object.freeze({
  digest: digestPublicValue,
  makeLocusWitness(observation, _rows, point, reason, evidence) {
    return {
      observation_ref: observation.observation_ref,
      point: [...point],
      reason,
      evidence: [...evidence],
    };
  },
});
