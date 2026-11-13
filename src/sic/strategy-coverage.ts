import { matchesStrategyRule, strategyFacts, type StrategyFact, type StrategyRule } from './strategy-timeline.ts';

export interface FactGroup {
  readonly facts: ReadonlySet<StrategyFact>;
  readonly count: number;
}

const factKeys = Object.keys(strategyFacts) as StrategyFact[];
const storageKey = 'sra-playground.sic.strategy-coverage.v1';
type SavedGame = Record<string, number>;
type SavedCoverage = Record<string, SavedGame>;

/** One compact sample per game, with identical episode facts counted together. */
export function countStrategyFacts(episodes: readonly { readonly facts: ReadonlySet<StrategyFact> }[]): FactGroup[] {
  const counts = new Map<string, number>();
  for (const { facts } of episodes) {
    const key = factKeys.filter(fact => facts.has(fact)).join(',');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return decodeGroups(Object.fromEntries(counts));
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

function decodeGroups(saved: SavedGame): FactGroup[] {
  return Object.entries(saved).flatMap(([key, count]) => {
    const facts = key === '' ? [] : key.split(',');
    if (!Number.isSafeInteger(count) || count < 1 || count > 96
        || facts.some(fact => !Object.hasOwn(strategyFacts, fact))) return [];
    return [{ facts: new Set(facts as StrategyFact[]), count }];
  });
}

function readSavedCoverage(): SavedCoverage {
  const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([game, value]) =>
    /^[A-Z0-9]{4}$/.test(game) && value && typeof value === 'object' && !Array.isArray(value)));
}

export class StrategyCoverage {
  private readonly games = new Map<string, readonly FactGroup[]>();
  private readonly lastRecorded = new Map<string, string>();

  constructor() { this.refresh(); }

  get samples(): ReadonlyMap<string, readonly FactGroup[]> { return this.games; }

  record(game: string, groups: readonly FactGroup[]): void {
    if (!groups.length || !/^[A-Z0-9]{4}$/.test(game)) return;
    const sample = Object.fromEntries(groups.map(({ facts, count }) => [[...facts].join(','), count]));
    const encoded = JSON.stringify(sample);
    if (this.lastRecorded.get(game) === encoded) return;
    this.refresh();
    this.games.set(game, groups);
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
        const groups = decodeGroups(sample);
        if (groups.length) this.games.set(game, groups);
      }
    } catch {
      // Storage is optional for the read-only audit.
    }
  }
}
