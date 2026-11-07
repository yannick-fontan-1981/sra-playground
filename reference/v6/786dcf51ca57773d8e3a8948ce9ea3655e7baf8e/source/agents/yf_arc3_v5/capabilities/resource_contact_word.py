"""Finite product-graph calculation on an externally declared contact model.

No role, objective or event law is inferred here. The caller supplies edges,
entry operators, consuming receipts and the terminal relation. A word is only
a counterfactual witness under those inputs, never action authorization.
"""
from collections import deque
from dataclasses import dataclass
from collections.abc import Mapping


def measure_oriented_contact_calibration_path(*, edges, start, accepting,
        entry_turns, required_phase, modulus, max_states, max_actions):
    """Geometry-only witness. It never certifies any resource feasibility."""
    if modulus <= 0 or max_states <= 0 or max_actions <= 0:
        return (), 0, False
    queue = deque([(start, 0, ())]); seen = {(start, 0)}; expanded = 0
    while queue and expanded < max_states:
        node, phase, actions = queue.popleft(); expanded += 1
        if actions and node in accepting and phase == required_phase % modulus:
            return actions, expanded, False
        if len(actions) >= max_actions:
            continue
        for action, successor in sorted(edges.get(node, ())):
            next_phase = (phase + int(entry_turns.get(successor, 0))) % modulus
            key = (successor, next_phase)
            if key in seen:
                continue
            seen.add(key)
            queue.append((successor, next_phase, (*actions, action)))
    return (), expanded, bool(queue and expanded >= max_states)


@dataclass(frozen=True)
class ContactWord:
    actions: tuple[str, ...]
    # action ordinal, node, supplied event kind, reserve before/after event
    events: tuple[tuple[int, tuple[int, int], str, int, int], ...]
    remaining: int | None
    used_receipts: frozenset[tuple[int, int]]


def measure_contact_words(*, edges: Mapping, start: tuple[int, int],
                          accepting: frozenset[tuple[int, int]],
                          entry_turns: Mapping, receipts: frozenset,
                          initial_phase: int, modulus: int, required_phase: int,
                          reserves: tuple[int, ...], receipt_floor: int,
                          cost: int, max_states: int, max_actions: int,
                          max_witnesses: int = 3) -> tuple[tuple[ContactWord, ...], int, bool]:
    """Breadth-first finite calculation, with exact consuming-set separation.

    Entry operators fire on a traversed edge, not initial presence. Every debit
    must leave strictly positive reserve *before* a receipt. Unknown depletion
    ordering can therefore never turn an exact-zero landing into a safe word.
    Only conservative lower bounds are used. Higher reserve dominates only at
    equal node, phase, consumed identities and depth. Up to three global words
    are reconstructed; no executable words are retained for rejected states.
    """
    if (not reserves or min(reserves) <= 0 or cost <= 0 or modulus <= 0
            or max_states <= 0 or max_actions <= 0):
        return (), 0, False
    maximum = min(3, max(1, max_witnesses))
    initial = (start, initial_phase % modulus, frozenset(), min(reserves), 0)
    queue = deque([0]); states = [initial]; parents = [None]
    dominance = {(start, initial[1], frozenset(), 0): initial[3]}
    terminal = []; expanded = 0
    while queue and expanded < max_states and len(terminal) < maximum:
        index = queue.popleft(); node, phase, used, reserve, depth = states[index]
        expanded += 1
        if depth and node in accepting and phase == required_phase % modulus:
            terminal.append(index)
            continue
        if depth >= max_actions:
            continue
        for action, successor in sorted(edges.get(node, ())):
            after_debit = reserve - cost
            if after_debit <= 0:
                continue
            next_phase = (phase + int(entry_turns.get(successor, 0))) % modulus
            next_used = used; after = after_debit; event = ""
            if successor in receipts and successor not in used:
                if receipt_floor <= 0:
                    continue
                next_used = used | {successor}; after = receipt_floor
                event = "receipt"
            if successor in entry_turns:
                event = "entry_operator" if not event else "receipt_and_entry_operator"
            key = (successor, next_phase, next_used, depth + 1)
            if dominance.get(key, -1) >= after:
                continue
            dominance[key] = after
            states.append((successor, next_phase, next_used, after, depth + 1))
            parents.append((index, action, event, after_debit, after))
            queue.append(len(states) - 1)
    words = []
    for terminal_index in terminal:
        chain = []; cursor = terminal_index
        while parents[cursor] is not None:
            parent, action, event, before, after = parents[cursor]
            chain.append((action, states[cursor][0], event, before, after))
            cursor = parent
        chain.reverse()
        words.append(ContactWord(
            actions=tuple(row[0] for row in chain),
            events=tuple((ordinal, row[1], row[2], row[3], row[4])
                         for ordinal, row in enumerate(chain, 1) if row[2]),
            remaining=states[terminal_index][3],
            used_receipts=states[terminal_index][2]))
    return tuple(words), expanded, bool(queue and expanded >= max_states)
