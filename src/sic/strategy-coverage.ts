import { matchesStrategyRule, strategyFacts, type StrategyFact, type StrategyRule } from './strategy-timeline.ts';

export interface FactGroup {
  readonly facts: ReadonlySet<StrategyFact>;
  readonly count: number;
}

export interface StrategySample {
  readonly groups: readonly FactGroup[];
  readonly actions: number | null;
  readonly actionsByFacts: readonly FactGroup[] | null;
  readonly shownActions: number | null;
  readonly shownActionsByFacts: readonly FactGroup[] | null;
}

const factKeys = Object.keys(strategyFacts) as StrategyFact[];
const storageKey = 'sra-playground.sic.strategy-coverage.v1';
type Counts = Record<string, number>;
type SavedGame = { episodes: Counts; actions: number; actionsByFacts: Counts; shownActions: number; shownActionsByFacts: Counts };
type StoredGame = SavedGame | Counts;
type SavedCoverage = Record<string, StoredGame>;

/** One compact sample per game, with identical episode facts counted together. */
export function countStrategyFacts<T extends { readonly facts: ReadonlySet<StrategyFact> }>(
  episodes: readonly T[], weight: (episode: T) => number = () => 1,
): FactGroup[] {
  const counts = new Map<string, number>();
  for (const episode of episodes) {
    const key = factKeys.filter(fact => episode.facts.has(fact)).join(',');
    counts.set(key, (counts.get(key) ?? 0) + weight(episode));
  }
  return decodeGroups(Object.fromEntries(counts));
}

export function measureStrategyCoverage(samples: readonly StrategySample[], rules: readonly StrategyRule[]) {
  let actions = 0, configurable = 0, shown = 0, shownConfigurable = 0, active = 0, shownActive = 0, measured = 0;
  const classified = (groups: readonly FactGroup[]) => groups.reduce((total, group) =>
    total + (rules.some(rule => matchesStrategyRule(group.facts, rule)) ? group.count : 0), 0);
  const guided = (groups: readonly FactGroup[]) => groups.reduce((total, group) =>
    total + (group.facts.has('activeRecovery') ? group.count : 0), 0);
  for (const sample of samples) {
    if (sample.actions === null || sample.shownActions === null || !sample.actionsByFacts || !sample.shownActionsByFacts) continue;
    measured++;
    actions += sample.actions;
    configurable += classified(sample.actionsByFacts);
    shown += sample.shownActions;
    shownConfigurable += classified(sample.shownActionsByFacts);
    active += guided(sample.actionsByFacts);
    shownActive += guided(sample.shownActionsByFacts);
  }
  return { actions, configurable, shown, shownConfigurable, active, shownActive, measured };
}

export function auditStrategyPriority(groups: readonly FactGroup[], rules: readonly StrategyRule[]) {
  const results = rules.map(rule => ({ rule, matches: 0, first: 0, winners: new Map<StrategyRule, number>() }));
  for (const { facts, count } of groups) {
    const matching = results.filter(({ rule }) => matchesStrategyRule(facts, rule));
    const winner = matching[0];
    if (!winner) continue;
    winner.first += count;
    for (const result of matching) {
      result.matches += count;
      if (result !== winner) result.winners.set(winner.rule, (result.winners.get(winner.rule) ?? 0) + count);
    }
  }
  return results;
}

function decodeGroups(saved: Counts): FactGroup[] {
  return Object.entries(saved).flatMap(([key, count]) => {
    const facts = key === '' ? [] : key.split(',');
    if (!Number.isSafeInteger(count) || count < 1 || count > 96
        || facts.some(fact => !Object.hasOwn(strategyFacts, fact))) return [];
    return [{ facts: new Set(facts as StrategyFact[]), count }];
  });
}

function isCounts(value: unknown): value is Counts {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function decodeSample(saved: StoredGame): StrategySample {
  if (isCounts(saved.episodes) && isCounts(saved.actionsByFacts) && isCounts(saved.shownActionsByFacts)
      && Number.isSafeInteger(saved.actions) && Number.isSafeInteger(saved.shownActions)) {
    const value = saved as SavedGame;
    const groups = decodeGroups(value.episodes), actionsByFacts = decodeGroups(value.actionsByFacts);
    const shownActionsByFacts = decodeGroups(value.shownActionsByFacts);
    const sum = (counts: FactGroup[]) => counts.reduce((total, group) => total + group.count, 0);
    if (value.actions >= sum(actionsByFacts) && value.actions <= 96 && value.shownActions === sum(shownActionsByFacts)
        && value.shownActions <= sum(actionsByFacts)) {
      return { groups, actions: value.actions, actionsByFacts, shownActions: value.shownActions, shownActionsByFacts };
    }
  }
  return { groups: decodeGroups(saved as Counts), actions: null, actionsByFacts: null, shownActions: null, shownActionsByFacts: null };
}

function readSavedCoverage(): SavedCoverage {
  const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([game, value]) =>
    /^[A-Z0-9]{4}$/.test(game) && value && typeof value === 'object' && !Array.isArray(value)));
}

export class StrategyCoverage {
  private readonly games = new Map<string, StrategySample>();
  private readonly lastRecorded = new Map<string, string>();

  constructor() { this.refresh(); }

  get samples(): ReadonlyMap<string, StrategySample> { return this.games; }

  record(game: string, current: StrategySample): void {
    if (!current.actions || !current.actionsByFacts || current.shownActions === null || !current.shownActionsByFacts
        || !/^[A-Z0-9]{4}$/.test(game)) return;
    const encode = (groups: readonly FactGroup[]) => Object.fromEntries(groups.map(({ facts, count }) => [[...facts].join(','), count]));
    const sample: SavedGame = {
      episodes: encode(current.groups), actions: current.actions, actionsByFacts: encode(current.actionsByFacts),
      shownActions: current.shownActions, shownActionsByFacts: encode(current.shownActionsByFacts),
    };
    const encoded = JSON.stringify(sample);
    if (this.lastRecorded.get(game) === encoded) return;
    this.refresh();
    this.games.set(game, current);
    this.lastRecorded.set(game, encoded);
    try {
      const saved = readSavedCoverage();
      if (JSON.stringify(saved[game]) === encoded) return;
      saved[game] = sample;
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // The current page can still compare the samples collected in memory.
    }
  }

  refresh(): void {
    try {
      for (const [game, sample] of Object.entries(readSavedCoverage())) {
        const restored = decodeSample(sample);
        if (restored.groups.length || restored.actions !== null) this.games.set(game, restored);
      }
    } catch {
      // Storage is optional for the read-only audit.
    }
  }
}
