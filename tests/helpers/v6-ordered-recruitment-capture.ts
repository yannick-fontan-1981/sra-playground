/** Passive Recruitment evidence only. No proposal, state, command or return is
 * supplied to the owner. Original return/Promise/exception identities survive.
 * Native scheduling objects are excluded from the original 4/4/8 arguments.
 */
type R = Record<string, any>;
const OWNER = 'family_state:public_ordered_recruitment';
const FORMAT = 'native.public_ordered_recruitment.v1';
const installed = new WeakSet<object>();
const copy = <T>(value: T): T => structuredClone(value);

export interface RecruitmentCheckpointCaptureInput {
  read: (id: string) => any;
  facts: readonly R[];
  transitions: readonly R[];
  proposal: R;
  selectedFamily: string | null;
}
export interface OrderedRecruitmentCapture {
  prefixSnapshot(input: RecruitmentCheckpointCaptureInput): R | null;
  dispose(): void;
}

function describe(error: unknown): R {
  try {
    return error instanceof Error ? { name: error.name, message: error.message,
      ...('cause' in error ? { cause: copy(error.cause) } : {}),
      ...('frontier' in error ? { frontier: copy((error as unknown as R).frontier) } : {}) }
      : { name: typeof error, message: String(error) };
  } catch { return { name: 'uninspectable_exception', message: 'The passive observer could not serialize the exception.' }; }
}

export function installOrderedRecruitmentCapture(owner: R, report: R): OrderedRecruitmentCapture {
  if (installed.has(owner)) throw new TypeError('Recruitment capture is already installed on this owner');
  for (const method of ['propose', 'before', 'recordSource', 'restoreNative', 'state']) {
    if (typeof owner[method] !== 'function') throw new TypeError(`Missing Recruitment capture surface: ${method}`);
  }
  for (const key of ['recruitmentSourceCalls', 'recruitmentRestoreCalls', 'recruitmentCaptureErrors']) {
    report[key] ??= [];
    if (!Array.isArray(report[key])) throw new TypeError(`Invalid Recruitment evidence list: ${key}`);
  }
  installed.add(owner);
  const sourceCalls = report.recruitmentSourceCalls as R[], restoreCalls = report.recruitmentRestoreCalls as R[];
  const errors = report.recruitmentCaptureErrors as R[];
  const patched: { name: string; descriptor: PropertyDescriptor | undefined }[] = [];
  let sourceDepth = 0;
  const observe = (event: R, phase: string, operation: () => void): void => {
    try { operation(); }
    catch (error) {
      const failure = { stream: event.stream, index: event.index, phase, ...describe(error) };
      event.observationErrors.push(failure); errors.push(failure);
    }
  };
  const install = (name: string, replacement: (...args: any[]) => any): void => {
    patched.push({ name, descriptor: Object.getOwnPropertyDescriptor(owner, name) });
    Object.defineProperty(owner, name, { value: replacement, configurable: true, writable: true });
  };
  for (const method of ['propose', 'before', 'recordSource']) {
    const original = owner[method];
    install(method, function (this: R, ...args: any[]): any {
      const event: R = { stream: 'source', index: sourceCalls.length, method, arguments: null,
        sourceBefore: null, sourceAfter: null, result: null, nativeAdaptation: null,
        sourceDepthBefore: sourceDepth, sourceDepthAfter: null,
        returnMode: null, completion: 'pending', observationErrors: [] };
      sourceCalls.push(event);
      observe(event, 'arguments', () => {
        event.arguments = copy(method === 'recordSource'
          ? [...args.slice(0, 5), args[5] === undefined ? null : args[5],
            args[6] === undefined ? 0 : args[6], args[7] === undefined ? null : args[7]]
          : args.slice(0, 4));
      });
      observe(event, 'sourceBefore', () => { event.sourceBefore = copy(this.state()); });
      sourceDepth++;
      let finished = false;
      const complete = (result: any, failed = false, error?: unknown): void => {
        if (finished) return;
        finished = true;
        if (failed) { event.error = describe(error); event.completion = 'failed'; }
        else {
          event.completion = 'returned';
          observe(event, 'result', () => { event.result = copy(result === undefined ? null : result); });
        }
        observe(event, 'sourceAfter', () => { event.sourceAfter = copy(this.state()); });
        if (method !== 'recordSource' && typeof this.currentProposalRefusal === 'function') {
          observe(event, 'nativeAdaptation', () => {
            event.nativeAdaptation = copy(this.currentProposalRefusal(method === 'propose' ? args[0] : args[3]) ?? null);
          });
        }
        sourceDepth--; event.sourceDepthAfter = sourceDepth;
      };
      let result: any;
      try { result = original.apply(this, args); }
      catch (error) { event.returnMode = 'sync'; complete(undefined, true, error); throw error; }
      observe(event, 'completionObserver', () => {
        if (result && typeof result.then === 'function') {
          event.returnMode = 'async';
          void result.then((value: any) => complete(value), (error: unknown) => complete(undefined, true, error));
        } else { event.returnMode = 'sync'; complete(result); }
      });
      return result;
    });
  }
  const restore = owner.restoreNative;
  install('restoreNative', function (this: R, ...args: any[]): any {
    const event: R = { stream: 'restore', index: restoreCalls.length, method: 'restoreNative',
      sourceCallsBefore: sourceCalls.length, sourceCallsAfter: null,
      sourceDepthBefore: sourceDepth, sourceDepthAfter: null, sourceBefore: null, sourceAfter: null,
      nativeInput: null, completion: 'pending', returnMode: null, observationErrors: [] };
    restoreCalls.push(event);
    observe(event, 'nativeInput', () => { event.nativeInput = copy(args[0]); });
    observe(event, 'sourceBefore', () => { event.sourceBefore = copy(this.state()); });
    let finished = false;
    const complete = (failed = false, error?: unknown): void => {
      if (finished) return;
      finished = true;
      event.completion = failed ? 'failed' : 'returned';
      if (failed) event.error = describe(error);
      event.sourceCallsAfter = sourceCalls.length; event.sourceDepthAfter = sourceDepth;
      observe(event, 'sourceAfter', () => { event.sourceAfter = copy(this.state()); });
    };
    let result: any;
    try { result = restore.apply(this, args); }
    catch (error) { event.returnMode = 'sync'; complete(true, error); throw error; }
    observe(event, 'completionObserver', () => {
      if (result && typeof result.then === 'function') {
        event.returnMode = 'async'; void result.then(() => complete(), (error: unknown) => complete(true, error));
      } else { event.returnMode = 'sync'; complete(); }
    });
    return result;
  });
  return {
    prefixSnapshot({ read, facts, transitions, proposal, selectedFamily }): R | null {
      const context: R = { stream: 'prefix', index: report.prefixes?.length ?? null, observationErrors: [] };
      let result: R | null = null;
      observe(context, 'checkpoint', () => {
        // Read the already persisted Kernel node. Calling nativeState(), its
        // revision getter or restore here would change the evidence producer.
        const checkpoint = copy(read(OWNER));
        if (checkpoint?.format !== FORMAT) throw new TypeError('Missing complete persisted Recruitment checkpoint');
        const revisions = new Set(transitions.map(transition => {
          const match = /:revision:(\d+):frame:/.exec(transition.before);
          if (!match) throw new TypeError('Recruitment prefix transition lacks its public revision');
          return Number(match[1]);
        }));
        const acquired = facts.filter(fact => {
          const match = /^recruitment_event:(\d+)$/.exec(fact.key)
            ?? (selectedFamily === 'public_ordered_recruitment' ? /^window_constraint:(\d+)$/.exec(fact.key) : null);
          return match && revisions.has(Number(match[1]));
        }).map(fact => ({ episode: fact.episode, key: fact.key, value: copy(fact.value), evidence: fact.evidence, revision: fact.revision }));
        result = { stateNode: OWNER, checkpointFormat: checkpoint.format,
          sourceState: copy(checkpoint.source_state), nativeCheckpoint: checkpoint,
          instanceSourceState: copy(owner.state()), sourceCallsThrough: sourceCalls.length,
          restoreCallsThrough: restoreCalls.length, sourceDepthAtSnapshot: sourceDepth,
          nativeRestoration: copy(restoreCalls.at(-1) ?? null), transitions: copy(transitions), acquired,
          retainedSourceFact: copy(facts.find(fact => fact.key === 'recruitment_state') ?? null),
          selectionReceipt: copy(proposal.strategy_receipt ?? null),
          ...(selectedFamily === 'public_ordered_recruitment' ? { selectedProposal: copy(proposal) } : {}),
          qualification: 'Passive capture of the persisted seven-field Recruitment owner, actual source/native restore cursors, '
            + 'current instance state, sealed transitions and source facts. No state, command, return or expected decision is supplied; '
            + 'the snapshot does not call nativeState, nativeRevision or restore.' };
      });
      return result;
    },
    dispose(): void {
      for (const item of patched.reverse()) {
        if (item.descriptor) Object.defineProperty(owner, item.name, item.descriptor);
        else delete owner[item.name];
      }
      installed.delete(owner);
    },
  };
}
