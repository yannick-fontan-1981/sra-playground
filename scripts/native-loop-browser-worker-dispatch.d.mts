export interface BrowserWorkerBenchmarkRuntime {
  load(game: string, level?: number): Promise<unknown>;
  action(actionId: number, data?: { x: number; y: number }): Promise<unknown>;
}

export interface BrowserWorkerBenchmarkRequest {
  type: 'load' | 'action';
  code?: string;
  level?: number;
  actionId?: number;
  data?: { x: number; y: number };
}

export function createBrowserWorkerGameBridgeDispatch(options: {
  runtime: BrowserWorkerBenchmarkRuntime;
  game: 'STCK' | 'SMLP';
}): (request: BrowserWorkerBenchmarkRequest) => Promise<Record<string, unknown>>;
