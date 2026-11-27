import { createHash } from 'node:crypto';
import { closeSync, openSync, writeFileSync } from 'node:fs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// The kernel chains the entire previous digest into each new digest. Rehash
// every ordered delta, removing only the storage clock on reasoning journal
// entries. A changed fact, evidence reference, node, cause or order still
// changes the comparable chain. The source graph is deeply immutable.
function comparableGraph(file) {
  const hashes = new Map();
  const recorded = new Set();
  const hash = createHash('sha256');
  const fd = openSync(file + '.chains.jsonl', 'wx');
  let prior = null;
  function ingest(memory) {
    for (let i = hashes.size; i < memory.deltas.length; i++) {
      const { digest: raw, previous, ...delta } = memory.deltas[i];
      if (previous !== prior || delta.sequence !== i + 1) throw Error('Discontinuous kernel graph');
      const { node } = delta;
      if (/^reasoning:trace:\d+$/.test(node.id) && node.kind === 'component_state') {
        const { root } = node.value;
        const stamp = root.members?.created;
        if (!Number.isSafeInteger(stamp) && stamp?.kind !== 'float64') {
          throw Error('Unknown journal clock encoding at ' + node.id + ' (' + root.kind + ', ' + typeof stamp + ')');
        }
        delta.node = { ...node, value: { ...node.value, root: { ...root,
          members: { ...root.members, created: 0 } } } };
      }
      hash.update(JSON.stringify(delta) + '\n');
      hashes.set(raw, hash.copy().digest('hex'));
      prior = raw;
    }
    if (prior !== memory.chain) throw Error('Kernel graph head mismatch');
  }
  function chain(raw) {
    if (raw == null) return raw;
    const semantic = hashes.get(raw);
    if (!semantic) throw Error('Unresolved kernel graph reference ' + raw);
    if (!recorded.has(raw)) {
      writeFileSync(fd, JSON.stringify({ raw, semantic }) + '\n');
      recorded.add(raw);
    }
    return semantic;
  }
  return { ingest, chain, close: () => closeSync(fd) };
}

// Observe the validation harness at its two public boundaries. Never call a solver
// operation or a game action from the recorder.
export function createDecisionTrace(file, game) {
  const fd = openSync(file, 'wx');
  const graph = comparableGraph(file);
  let next = { level: 1, turn: 1 }, last, tail;
  function write(position, kind, value) {
    writeFileSync(fd, JSON.stringify({ game, ...position, kind, value }) + '\n');
  }
  function observe(request, board) {
    const position = next;
    if (request.type !== 'load') {
      last = position;
      write(position, 'dispatch', request);
      next = { level: board.level, turn: board.level === position.level ? position.turn + 1 : 1 };
    }
    write(position, 'observation', { level: board.level, levelsCompleted: board.levelsCompleted,
      state: board.state, availableActionIds: board.availableActionIds, palette: board.palette,
      frame: digest(board.frame), frames: digest(board.frames), frameCount: board.frames.length });
  }
  function reply(operation, result, memory) {
    graph.ingest(memory);
    const { snapshot, kind, phase, ticket, command, reason } = result;
    const trace = snapshot.trace;
    // The service reuses its detached immutable entries. Fail if a response
    // overran the rolling window instead of silently dropping the oldest notes.
    const from = tail === undefined ? 0 : trace.lastIndexOf(tail) + 1;
    if (tail === undefined ? trace.length >= 128 : from === 0) throw Error('Native trace overlap lost');
    const returned = ['advance', 'reset_level', 'undo_action'].includes(operation.type);
    const position = returned ? last : next;
    for (const note of trace.slice(from)) {
      // advance can authorise the next step in a prefix while settling the last.
      const preparing = ['before_guard', 'why_act_release', 'sic_native_plan'].includes(note.kind);
      const entry = { ...note };
      for (const key of ['graph_chain', 'previous_graph_chain']) {
        if (Object.hasOwn(entry, key)) entry[key] = graph.chain(entry[key]);
      }
      write(preparing ? next : position, 'native', entry);
    }
    tail = trace.at(-1);
    if (kind === 'action') {
      write(next, 'decision', { agenda: snapshot.sicFamilySelection, proposal: snapshot.proposal,
        ticket: { ...ticket, graphChain: graph.chain(ticket.graphChain) }, command, phase, reason });
    } else {
      write(position, 'boundary', { operation: operation.type, kind, phase, reason,
        agenda: snapshot.sicFamilySelection, lastDecision: snapshot.lastDecision, graphChain: graph.chain(snapshot.graphChain) });
    }
  }
  return { observe, reply, close() { graph.close(); closeSync(fd); } };
}
