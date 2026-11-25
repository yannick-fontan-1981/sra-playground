import { fork } from 'node:child_process';

const startupTimeMs = 120_000;
const maximumSettlementTimeMs = 5_000;

/** The parent's timer runs even when a synchronous native search blocks the child. */
export function superviseSicReplay(script, args, code) {
  return new Promise(resolve => {
    const child = fork(script, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, SIC_REPLAY_CHILD: '1' } });
    const levelStats = [];
    const recentCommands = [];
    let current, target, timer, result, actions = 0, authority = 0;
    let levelsCompleted = 0;
    const arm = (duration, onTimeout) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        result = onTimeout();
        child.kill();
      }, duration);
    };
    const idle = () => arm(startupTimeMs, () => ({
      code, target, status: 'harness_error', reason: 'replay_process_unresponsive', levels: levelsCompleted, actions, authority, levelStats,
    }));
    const scoreTiming = () => current?.scoredAt === undefined ? {} : {
      scoredMs: Math.round(current.scoredAt - current.startedAt),
      settlementMs: Math.round(performance.now() - current.scoredAt),
    };
    const levelTimeout = () => {
      const won = levelsCompleted >= current.level;
      const reason = levelsCompleted >= target ? 'target_levels_completed'
        : won ? 'level_transition_wall_time_budget' : 'level_wall_time_budget';
      const level = { level: current.level, won, actions: (current.scoredActions ?? actions) - current.initialActions,
        ms: Math.round(performance.now() - current.startedAt), budget: current.budget, ...scoreTiming() };
      return { code, target, status: 'stopped', reason, levels: levelsCompleted,
        actions, authority, levelStats: [...levelStats, level], ...(recentCommands.length ? { recentCommands } : {}) };
    };
    idle();
    child.on('message', message => {
      if (result) return;
      switch (message.kind) {
        case 'level-started': {
          target = message.target;
          current = { level: message.level, budget: message.budget, startedAt: performance.now(), initialActions: actions };
          recentCommands.length = 0;
          arm(current.budget.activeTimeMs, levelTimeout);
          break;
        }
        case 'command-applied': {
          actions++;
          authority += Number(message.sicAuthorized);
          if (!current || current.scoredAt !== undefined) {
            const previous = current ? levelTimeout() : { code, target, levels: levelsCompleted, actions, authority, levelStats };
            result = { ...previous, status: 'harness_error', reason: 'command_outside_active_level' };
            child.kill();
            break;
          }
          if (Number.isSafeInteger(message.levelsCompleted))
            levelsCompleted = Math.max(levelsCompleted, message.levelsCompleted);
          if (message.command) {
            recentCommands.push({ ...message.command, index: actions, elapsedMs: Math.round(performance.now() - current.startedAt) });
            if (recentCommands.length > 8) recentCommands.shift();
          }
          if (current && levelsCompleted >= current.level) {
            current.scoredAt = performance.now();
            current.scoredActions = actions;
            // The dispatch already scored. Reconciliation can finish before
            // the next level starts, within its own bounded allocation.
            const budget = current.budget.activeTimeMs;
            const settlement = Math.min(maximumSettlementTimeMs, Math.max(250, Math.ceil(budget / 4)));
            arm(Math.max(budget - (current.scoredAt - current.startedAt), settlement), levelTimeout);
          }
          break;
        }
        case 'level-finished':
          levelStats.push({ ...message.level, ...scoreTiming() });
          current = undefined;
          if (message.level.won) levelsCompleted = Math.max(levelsCompleted, message.level.level);
          idle();
          break;
        case 'result':
          result = { ...message.result, ...(levelStats.length ? { levelStats } : {}) };
          arm(maximumSettlementTimeMs, () => result);
          break;
      }
    });
    child.on('error', error => {
      result ??= { code, target, status: 'harness_error', message: error.message, levels: levelsCompleted, actions, authority, levelStats };
      clearTimeout(timer);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve(result ?? { code, target, status: 'harness_error', message: `Replay process exited: ${signal ?? exitCode}`,
        levels: levelsCompleted, actions, authority, levelStats });
    });
  });
}
