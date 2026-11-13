import { performance } from 'node:perf_hooks';
import { runNativeLoopCostProtocol } from './measure-native-loop-costs.mjs';
import { runSyntheticOperationSession } from '../tests/helpers/op01-op31-synthetic-session.ts';

export async function runProtocolShapedOpDiagnostic() {
  const result = await runNativeLoopCostProtocol(async descriptor => {
    const trace = descriptor.variant === 'B' ? 'counters' : false;
    const started = performance.now();
    const session = runSyntheticOperationSession({
      cycles: descriptor.actions,
      trace,
      cache: false,
    });
    const durationMs = performance.now() - started;

    if (session.released !== descriptor.actions) {
      throw new Error(`synthetic OP session released ${session.released}/${descriptor.actions} cycles`);
    }

    return {
      durationMs,
      phases: { logos_cycle: durationMs },
      metadata: {
        diagnosticOnly: true,
        gameLabel: descriptor.game,
        variant: descriptor.variant,
        traceMode: trace || 'off',
        syntheticCycles: descriptor.actions,
        released: session.released,
        op29: session.op29,
        op30: session.op30,
        op31: session.op31,
      },
    };
  });

  return {
    status: 'protocol_shaped_diagnostic_only',
    officialPerformanceQualification: false,
    note: 'Uses the restored ABBA cost protocol but synthetic Logos cycles, not real STCK/SMLP sessions.',
    diagnosticAccepted: result.accepted,
    result,
  };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  console.log(JSON.stringify(await runProtocolShapedOpDiagnostic(), null, 2));
}
