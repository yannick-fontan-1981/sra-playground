/** Passive observation of the one SelectedRigid owner; no input or clock injection. */
type R = Record<string, any>;

export interface SelectedRigidCaptureOwner {
  sourceState(): unknown;
  attachClockObserver(listener: (valueMs: number) => void): () => void;
  /** This getter reads only values already consumed by the owner. It must not call now(). */
  captureContext(): {
    configuration: unknown;
    requestedStopReason: string | null;
    levelDeadlineMs: number | null;
    remainingLevelActions: number | null;
    observedNowMs: number | null;
  };
}

const observedOwners = new WeakSet<object>();
const METHODS = ['setCurrentBudget', 'propose', 'bind', 'before', 'after', 'record',
  'restoreNative', 'restoreSourceState'] as const;

/** Preserve capability identity: capture only the primitive values, never invoke now/yield. */
function executionDescriptor(value: any): R | null {
  if (value == null) return null;
  return {
    deadlineMs: value.deadlineMs ?? null,
    remainingLevelActions: value.remainingLevelActions ?? null,
    hasNow: typeof value.now === 'function',
    hasYieldControl: typeof value.yieldControl === 'function',
    hasSignal: value.signal != null,
    aborted: value.signal == null ? null : value.signal.aborted,
  };
}

export function captureSelectedRigid(owner: SelectedRigidCaptureOwner, events: R[]): R {
  const target = owner as unknown as R;
  if (observedOwners.has(owner)) throw new TypeError('SelectedRigid owner already has a passive recorder');
  if (!Array.isArray(events) || events.length !== 0) throw new TypeError('SelectedRigid requires a new ordered evidence journal');
  for (const method of ['sourceState', 'captureContext', 'attachClockObserver', ...METHODS]) {
    if (typeof target[method] !== 'function') throw new TypeError(`Missing SelectedRigid evidence surface: ${method}`);
  }
  observedOwners.add(owner);
  let depth = 0;
  const active: R[] = [];
  const observation: R = { schema: 'logos-engine.selected-rigid-passive-capture.v1',
    methods: [...METHODS], clockObserverAttached: false, unscopedClockReads: [] };
  // Emit only clock values the component has already consumed; never call now here.
  owner.attachClockObserver(value => {
    if (!active.length) observation.unscopedClockReads.push(value);
    else for (const event of active) event.clockReads.push(value);
  });
  observation.clockObserverAttached = true;
  for (const method of METHODS) {
    const original = target[method];
    target[method] = function (...args: unknown[]) {
      const event: R = {
        sequence: events.length,
        kind: method.startsWith('restore') ? 'restore' : method === 'setCurrentBudget' ? 'budget' : 'call',
        method, depthBefore: depth, arguments: null, execution: null,
        domainSupplied: method === 'bind' ? args.length >= 2 : null,
        sourceBefore: null, sourceAfter: null, contextBefore: null, contextAfter: null,
        completion: 'pending', returnedNormally: false, returnMode: null, resultKind: null, clockReads: [],
        observationErrors: [],
      };
      // Reserve order before inspecting or invoking: nested real calls get later sequence numbers.
      events.push(event);
      const observe = (field: string, get: () => unknown): void => {
        try { event[field] = structuredClone(get()); }
        catch (error) {
          event.observationErrors.push({ field,
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
        }
      };
      observe('arguments', () => method === 'setCurrentBudget'
        ? [executionDescriptor(args[0]), args[1] ?? null]
        : method === 'propose' || method === 'before' ? args.slice(0, 4)
        : method === 'bind' ? args.slice(0, 1)
        : method === 'after' ? args.slice(0, 6)
        : method === 'record' ? args.slice(0, 8) : args);
      // bind's opaque native domain is passed through unchanged. The source bind never reads it.
      // It is not misrepresented as a JSON reconstruction of the native authority object.
      if (method === 'propose') observe('execution', () => executionDescriptor(args[4]));
      observe('sourceBefore', () => this.sourceState());
      observe('contextBefore', () => this.captureContext());
      active.push(event);
      depth++;
      const complete = (completion: string, result: unknown, error?: unknown): void => {
        event.completion = completion;
        event.returnedNormally = completion === 'returned' || completion === 'resolved';
        if (event.returnedNormally) {
          event.resultKind = result === null ? 'null' : result === undefined ? 'undefined' : 'value';
          observe('result', () => result ?? null);
        } else event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        observe('sourceAfter', () => this.sourceState());
        observe('contextAfter', () => this.captureContext());
        const activeIndex = active.lastIndexOf(event);
        if (activeIndex < 0 || activeIndex !== active.length - 1) {
          event.observationErrors.push({ field: 'invocationOrder', error: 'Source invocations completed outside the observed nesting order' });
        }
        if (activeIndex >= 0) active.splice(activeIndex, 1);
        depth--; event.depthAfter = depth;
      };
      let result: any;
      try { result = original.apply(this, args); }
      catch (error) { event.returnMode = 'sync'; complete('threw', undefined, error); throw error; }
      if (result && typeof result.then === 'function') {
        event.returnMode = 'async';
        // Observe settlement without replacing the promise, arguments, result or rejection reason.
        void result.then((value: unknown) => complete('resolved', value),
          (error: unknown) => complete('rejected', undefined, error));
      } else { event.returnMode = 'sync'; complete('returned', result); }
      return result;
    };
  }
  return observation;
}
