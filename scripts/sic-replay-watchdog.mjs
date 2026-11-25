import { fork } from 'node:child_process';

const startupTimeMs = 120_000;

/** The parent's timer runs even when a synchronous native search blocks the child. */
export function superviseSicReplay(script, args, code) {
  return new Promise(resolve => {
    const child = fork(script, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, SIC_REPLAY_CHILD: '1' } });
    const levelStats = [];
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
    idle();
    child.on('message', message => {
      if (result) return;
      switch (message.kind) {
        case 'level-started': {
          target = message.target;
          current = { level: message.level, budget: message.budget, startedAt: performance.now(), initialActions: actions };
          arm(current.budget.activeTimeMs, () => {
            const won = levelsCompleted >= current.level;
            const reason = levelsCompleted >= target ? 'target_levels_completed'
              : won ? 'level_transition_wall_time_budget' : 'level_wall_time_budget';
            const level = { level: current.level, won, actions: actions - current.initialActions,
              ms: Math.round(performance.now() - current.startedAt), budget: current.budget };
            return { code, target, status: 'stopped', reason, levels: levelsCompleted,
              actions, authority, levelStats: [...levelStats, level] };
          });
          break;
        }
        case 'command-applied':
          actions++;
          authority += Number(message.sicAuthorized);
          if (Number.isSafeInteger(message.levelsCompleted))
            levelsCompleted = Math.max(levelsCompleted, message.levelsCompleted);
          break;
        case 'level-finished':
          levelStats.push(message.level);
          if (message.level.won) levelsCompleted = Math.max(levelsCompleted, message.level.level);
          idle();
          break;
        case 'result':
          result = message.result;
          arm(5_000, () => result);
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
