import { fork } from 'node:child_process';

const startupTimeMs = 120_000;

/** The parent's timer runs even when a synchronous native search blocks the child. */
export function superviseSicReplay(script, args, code) {
  return new Promise(resolve => {
    const child = fork(script, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, SIC_REPLAY_CHILD: '1' } });
    const levelStats = [];
    let current, target, timer, result, actions = 0, authority = 0;
    const arm = (duration, onTimeout) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        result = onTimeout();
        child.kill();
      }, duration);
    };
    const idle = () => arm(startupTimeMs, () => ({
      code, target, status: 'harness_error', reason: 'replay_process_unresponsive', actions, authority, levelStats,
    }));
    idle();
    child.on('message', message => {
      if (result) return;
      switch (message.kind) {
        case 'level-started': {
          target = message.target;
          current = { level: message.level, budget: message.budget, startedAt: performance.now(), initialActions: actions };
          arm(current.budget.activeTimeMs, () => {
            const level = { level: current.level, won: false, actions: actions - current.initialActions,
              ms: Math.round(performance.now() - current.startedAt), budget: current.budget };
            return { code, target, status: 'stopped', reason: 'level_wall_time_budget',
              levels: levelStats.filter(row => row.won).length, actions, authority, levelStats: [...levelStats, level] };
          });
          break;
        }
        case 'command-applied':
          actions++;
          authority += Number(message.sicAuthorized);
          break;
        case 'level-finished':
          levelStats.push(message.level);
          idle();
          break;
        case 'result':
          result = message.result;
          arm(5_000, () => result);
          break;
      }
    });
    child.on('error', error => {
      result ??= { code, target, status: 'harness_error', message: error.message, actions, authority, levelStats };
      clearTimeout(timer);
    });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve(result ?? { code, target, status: 'harness_error', message: `Replay process exited: ${signal ?? exitCode}`,
        actions, authority, levelStats });
    });
  });
}
