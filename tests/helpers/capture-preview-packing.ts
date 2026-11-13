/** Passive evidence for real Preview calls; no command, result or state injection. */
import type { NativePreviewPacking } from '../../src/logos-engine/v6-preview-packing.ts';

type R = Record<string, any>;

export function capturePreviewPacking(owner: NativePreviewPacking, events: R[]): void {
  const target = owner as unknown as R;
  let depth = 0;
  for (const method of ['propose', 'before', 'after', 'record', 'restoreNative', 'restoreSourceState']) {
    const original = target[method];
    if (typeof original !== 'function') throw new TypeError(`Missing Preview evidence surface: ${method}`);
    target[method] = function (...args: unknown[]) {
      const restore = method.startsWith('restore');
      const event: R = { sequence: events.length, kind: restore ? 'restore' : 'call', method,
        depthBefore: depth, arguments: null, sourceBefore: null, sourceAfter: null,
        completion: 'pending', returnedNormally: false, returnMode: null, observationErrors: [] };
      events.push(event);
      const observe = (field: string, get: () => unknown): void => {
        try { event[field] = structuredClone(get()); }
        catch (error) { event.observationErrors.push({ field, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }); }
      };
      observe('arguments', () => method === 'propose' || method === 'before' ? args.slice(0, 4)
        : method === 'after' ? args.slice(0, 6) : method === 'record' ? args.slice(0, 8) : args);
      observe('sourceBefore', () => this.sourceState());
      depth++;
      const complete = (completion: string, result: unknown, error?: unknown): void => {
        event.completion = completion; event.returnedNormally = completion === 'returned' || completion === 'resolved';
        if (event.returnedNormally) observe('result', () => result ?? null);
        else event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        observe('sourceAfter', () => this.sourceState());
        depth--; event.depthAfter = depth;
      };
      let result: any;
      try { result = original.apply(this, args); }
      catch (error) { event.returnMode = 'sync'; complete('threw', undefined, error); throw error; }
      if (result && typeof result.then === 'function') {
        event.returnMode = 'async';
        // Retain the original promise and original argument references.
        void result.then((value: unknown) => complete('resolved', value), (error: unknown) => complete('rejected', undefined, error));
      } else { event.returnMode = 'sync'; complete('returned', result); }
      return result;
    };
  }
}
