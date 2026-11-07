import type { V7Bundle } from './bundle.ts';
import type { KnowledgeNode, KnowledgeDelta } from './kernel.ts';
import type { TraceEvent } from './ir.ts';
import type { CycleReceipt } from './v7-runtime.ts';

export type LabRequest =
  | { id: number; type: 'initialize'; bundle: V7Bundle }
  | { id: number; type: 'advance'; event: unknown }
  | { id: number; type: 'cancel' };

export interface LabSnapshot {
  sequence: number;
  memory: { nodes: readonly KnowledgeNode[]; deltas: readonly KnowledgeDelta[]; chain: string | null };
  trace: readonly TraceEvent[];
  receipt: CycleReceipt | null;
}

export type LabResponse =
  | { id: number; type: 'result'; snapshot: LabSnapshot }
  | { id: number; type: 'error'; message: string; cancelled: boolean };
