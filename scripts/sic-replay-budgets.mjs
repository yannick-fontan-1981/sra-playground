const defaultBudget = Object.freeze({ actions: 80, activeTimeMs: 90_000, source: 'no_level_reference' });

export function replayLevelBudget(reference) {
  if (reference == null) return { ...defaultBudget };
  const { actions, timeMs, source } = reference;
  if (!Number.isSafeInteger(actions) || actions < 1 || typeof source !== 'string' || !source
    || (timeMs !== undefined && (!Number.isSafeInteger(timeMs) || timeMs < 1))) {
    throw new TypeError('A budget reference requires witnessed actions, a source and an optional measured time.');
  }
  const actionMargin = Math.min(30, Math.max(5, Math.ceil(actions * 0.2)));
  const timeBasis = timeMs ?? Math.max(20_000, Math.min(360_000, actions * 1_500));
  const timeMargin = Math.max(5_000, Math.ceil(timeBasis * 0.35));
  return { actions: actions + actionMargin, activeTimeMs: Math.ceil((timeBasis + timeMargin) / 1000) * 1000,
    source, timeBasis: timeMs === undefined ? 'estimated_from_actions' : 'measured' };
}

export function historicalReplayReferences(campaign) {
  const references = new Map();
  for (const game of [...campaign.cases, campaign.control]) {
    const levels = [];
    for (const row of game.levels) {
      if (!row.won) continue;
      levels[row.level - 1] = { actions: row.actions,
        ...(Number.isFinite(row.ms) && row.ms > 0 ? { timeMs: Math.ceil(row.ms) } : {}),
        source: 'qualification_' + campaign.source };
    }
    references.set(game.game, levels);
  }
  return references;
}

export function replayCampaignBudgets(code, target, historical, additional) {
  const documented = historical.get(code) ?? [];
  const supplied = additional?.[code] ?? [];
  return Array.from({ length: target }, (_, i) => replayLevelBudget(supplied[i] ?? documented[i]));
}
