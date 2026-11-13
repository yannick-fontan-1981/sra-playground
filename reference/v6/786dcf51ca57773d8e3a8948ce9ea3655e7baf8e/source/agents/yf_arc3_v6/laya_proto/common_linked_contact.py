"""Measured access to a linked occurrence before its effect is understood.

The declarative policy supplies the contact and containment hypotheses. This
module binds their occurrences, searches visible access and compares effects.
Input references, palette, lattice, support and destination come from pixels.
"""
from collections import Counter, deque
import hashlib
import json
from pathlib import Path

import numpy as np


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def add(first, second):
    return first[0] + second[0], first[1] + second[1]


def rectangle(position, size):
    x, y = position
    w, h = size
    return {(x + dx, y + dy) for dy in range(h) for dx in range(w)}


def patch(rows, position, size):
    x, y = position
    w, h = size
    return rows[y:y + h, x:x + w]


def open_enclosures(observation, body, quantum):
    """A same-material open rim around an actor-sized lattice-aligned cavity."""
    w, h = body['size']
    sx, sy = body['start']
    result = []
    for entity in observation['entities']:
        if entity['palette_value'] != body['palette']:
            continue
        left, top, right, bottom = entity['bbox']
        if (right - left + 1, bottom - top + 1) != (w + 2, h + 2):
            continue
        support = set(map(tuple, entity['mask']))
        sides = [
            {(x, 0) for x in range(w + 2)},
            {(x, h + 1) for x in range(w + 2)},
            {(0, y) for y in range(h + 2)},
            {(w + 1, y) for y in range(h + 2)},
        ]
        if sum(side <= support for side in sides) != 3:
            continue
        cavity = left + 1, top + 1
        if (cavity[0] - sx) % quantum or (cavity[1] - sy) % quantum:
            continue
        if any((x, y) in support for y in range(1, h + 1) for x in range(1, w + 1)):
            continue
        result.append(cavity)
    return result


def linked_nodes(observation, body, quantum):
    """Dense local supports joined within one extended, partly thin component."""
    w, h = body['size']
    sx, sy = body['start']
    result = []
    for entity in observation['entities']:
        left, top, right, bottom = entity['bbox']
        if entity['palette_value'] in (body['palette'], body['floor']):
            continue
        if right - left <= 2 * w and bottom - top <= 2 * h:
            continue
        support = {(left + x, top + y) for x, y in entity['mask']}
        nodes = []
        for y in range(sy % quantum, bottom + 1, quantum):
            for x in range(sx % quantum, right + 1, quantum):
                inside = rectangle((x, y), body['size']) & support
                if not any({(a, b), (a + 1, b), (a, b + 1), (a + 1, b + 1)} <= inside for a, b in inside):
                    continue
                nodes.append({'position': (x, y), 'pixels': len(inside), 'support': sorted(inside)})
        if len(nodes) < 2:
            continue
        covered = set().union(*(set(map(tuple, node['support'])) for node in nodes))
        wire = support - covered
        if not wire or any({(a, b), (a + 1, b), (a, b + 1), (a + 1, b + 1)} <= wire for a, b in wire):
            continue
        largest = max(node['pixels'] for node in nodes)
        for node in nodes:
            if node['pixels'] >= largest:
                continue
            result.append({**node, 'component': entity['signature'], 'palette': entity['palette_value'],
                           'peer_support': sorted(covered - set(map(tuple, node['support']))),
                           'wire_pixels': len(wire), 'larger_peer_pixels': largest})
    return result


def phase_slots(observation, body, details=False):
    """Count aligned compact marker occurrences including one active rim."""
    groups = {}
    for entity in observation['entities']:
        left, top, right, bottom = entity['bbox']
        width, height = right - left + 1, bottom - top + 1
        if width != height or not 1 < width < min(body['size']):
            continue
        if entity['area'] < width * height - 1:
            continue
        groups.setdefault((top, width), []).append(entity)
    candidates = []
    for (top, width), entries in groups.items():
        entries.sort(key=lambda entity: entity['position'][0])
        pitches = {b['position'][0] - a['position'][0] for a, b in zip(entries, entries[1:])}
        active = [entity for entity in entries if entity['palette_value'] == body['palette'] and entity['area'] == width * width - 1]
        if len(entries) >= 2 and len(pitches) == 1 and next(iter(pitches)) > width and len(active) == 1:
            candidates.append([entity['bbox'] for entity in entries])
    if len(candidates) != 1:
        return None
    return candidates[0] if details else len(candidates[0])


class LinkedContact:
    def __init__(self):
        self.policy = json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['linked_contact']
        self.body = None
        self.nodes = []
        self.goal = None
        self.vectors = {}
        self.tested = set()
        self.selected = None
        self.contact = None
        self.departure = None
        self.reversal = None
        self.phase_trial = None
        self.phase_changed = False
        self.replay_cursor = 0
        self.secondary = None
        self.replay_refuted = False
        self.replay_motion_support = []
        self.replay_blocked_support = []
        self.slot_count = None
        self.slot_boxes = []
        self.phase_context = None
        self.phase_start = 0
        self.history_paths = []
        self.prepared = []
        self.persistent_sites = set()
        self.prepared_effects = []
        self.phase_action = None
        self.recording_next = False
        self.replay_ticks = 0
        self.waited = 0
        self.seen = 0
        self.events = []

    def fit(self, phase, observation):
        if not self.policy['enabled'] or self.body or len(phase.states) < 2:
            return
        initial = phase.states[0]
        entities = {entity['signature']: entity for entity in observation['entities']}
        options = []
        for signature, position in initial['poses'].items():
            current = phase.states[-1]['poses'].get(signature)
            if current is None or current == position or signature not in entities:
                continue
            size = phase.size[signature]
            dx, dy = current[0] - position[0], current[1] - position[1]
            if min(size) < 2 or bool(dx) == bool(dy):
                continue
            quantum = abs(dx or dy)
            if quantum <= max(size):
                continue
            uncovered = patch(phase.states[-1]['rows'], position, size)
            values = np.unique(uncovered)
            if len(values) != 1:
                continue
            body = {'signature': signature, 'size': size, 'start': position,
                    'palette': entities[signature]['palette_value'], 'floor': int(values[0]), 'quantum': quantum,
                    'mask': entities[signature]['mask']}
            goals = open_enclosures(observation, body, quantum)
            nodes = linked_nodes(observation, body, quantum)
            if len(goals) == 1 and nodes:
                options.append((body, goals[0], nodes))
        if len(options) == 1:
            self.body, self.goal, self.nodes = options[0]
            self.slot_count = phase_slots(observation, self.body)
            self.slot_boxes = phase_slots(observation, self.body, details=True) or []
            self.events.append({'kind': 'linked_occurrence_contact_question', 'observation': observation['observation_ref'],
                                'body': self.body, 'goal_candidate': self.goal, 'nodes': self.nodes, 'marker_slots': self.slot_count,
                                'qualification': 'Visual linkage and open-rim containment are hypotheses; official relevance is unknown.'})

    def observe(self, phase, observation):
        self.fit(phase, observation)
        if not self.body:
            return
        signature = self.body['signature']
        while self.seen < len(phase.commands):
            i = self.seen
            self.seen += 1
            first, second = phase.states[i:i + 2]
            action = phase.commands[i]
            start, end = first['poses'].get(signature), second['poses'].get(signature)
            if action is None or start is None or end is None:
                continue
            self.tested.add((start, action))
            vector = end[0] - start[0], end[1] - start[1]
            if sorted(map(abs, vector)) == [0, self.body['quantum']]:
                former = self.vectors.get(action)
                if former is None or former == vector:
                    self.vectors[action] = vector
            if self.phase_trial and first['ref'] == self.phase_trial['before_ref']:
                self.phase_changed = action == self.phase_trial['action'] and end == self.body['start'] and end != start
                self.phase_start = i + 1
                self.replay_ticks = 0
                self.replay_cursor = 0
                self.phase_context = {'ref': second['ref'], 'pixels': [
                    (x, y, int(second['rows'][y, x])) for left, top, right, bottom in self.slot_boxes
                    for y in range(top, bottom + 1) for x in range(left, right + 1)]}
                self.events.append({'kind': 'linked_contact_phase_response', 'before': first['ref'], 'after': second['ref'],
                                    'returned_to_start': self.phase_changed, 'replay_causality': 'unknown'})
                continue
            if self.phase_changed:
                path = self.phase_trial['source_path']
                advanced = start != end
                self.replay_ticks += int(advanced)
                self.replay_cursor = min(len(path) - 1, self.replay_ticks)
                actual = {tuple(occurrence['position']) for occurrence in second.get('occurrences', [])
                          if occurrence['signature'] != self.body['signature']
                          and occurrence['geometry'] == phase.geometry[self.body['signature']]}
                expected = {tuple(history[min(len(history) - 1, self.replay_ticks)]) for history in self.history_paths}
                if actual:
                    if not actual <= expected:
                        self.replay_refuted = True
                        self.events.append({'kind': 'replay_cursor_counterexample', 'observation': second['ref'],
                                            'expected': sorted(expected), 'observed': sorted(actual), 'cursor': self.replay_cursor,
                                            'alternatives': ['truncated history', 'overwritten history', 'other tick rule']})
                    else:
                        support = self.replay_motion_support if advanced else self.replay_blocked_support
                        support.append(second['ref'])
            if not self.selected:
                continue
            site = tuple(self.selected['position'])
            remote = set(map(tuple, self.selected['peer_support']))
            changed = [(x, y, int(first['rows'][y, x]), int(second['rows'][y, x]))
                       for x, y in sorted(remote) if first['rows'][y, x] != second['rows'][y, x]]
            if end == site and start != end and self.contact is None:
                self.contact = {'site': site, 'before_ref': first['ref'], 'after_ref': second['ref'],
                                'from': start, 'pixels': changed, 'action': action}
                self.events.append({'kind': 'linked_contact_effect', **self.contact,
                                    'exclusive_cause_established': False})
            elif self.contact and start == site and end != site and self.departure is None:
                pixels = self.contact['pixels']
                restored = bool(pixels) and all(int(second['rows'][y, x]) == old for x, y, old, new in pixels)
                persisted = bool(pixels) and all(int(second['rows'][y, x]) == new for x, y, old, new in pixels)
                self.departure = {'before_ref': first['ref'], 'after_ref': second['ref'], 'position': end,
                                  'remote_restored': restored, 'remote_persisted': persisted, 'effect_pixels': len(pixels)}
                self.events.append({'kind': 'linked_contact_departure_contrast', **self.departure})
            elif self.departure and end == site and start != end and self.reversal is None:
                pixels = self.contact['pixels']
                returned = bool(pixels) and all(int(second['rows'][y, x]) == new for x, y, old, new in pixels)
                self.reversal = {'after_ref': second['ref'], 'effect_returned': returned,
                                 'conditional_hold_supported': self.departure['remote_restored'] and returned}
                self.events.append({'kind': 'linked_contact_reentry_contrast', **self.reversal})

    def paths(self, rows, start, special=(), conditional_transit=()):
        q = self.body['quantum']
        w, h = self.body['size']
        height, width = rows.shape
        special = set(special)
        conditional_transit = set(conditional_transit)
        paths = {start: []}
        pending = deque([start])
        while pending:
            origin = pending.popleft()
            for vector in ((0, -q), (-q, 0), (q, 0), (0, q)):
                dest = add(origin, vector)
                x, y = dest
                if dest in paths or not (0 <= x <= width - w and 0 <= y <= height - h):
                    continue
                clear = bool(np.all(patch(rows, dest, self.body['size']) == self.body['floor']))
                if not clear and dest not in special and dest not in conditional_transit:
                    continue
                paths[dest] = paths[origin] + [(origin, dest, vector)]
                if clear or dest in conditional_transit:
                    pending.append(dest)
        return paths

    def propose(self, phase, observation, rows, inputs, remaining):
        self.observe(phase, observation)
        if not self.body or remaining <= 0:
            return None
        current = phase.states[-1]
        position = current['poses'].get(self.body['signature'])
        if position is None:
            return None
        available = [item['action_ref'] for item in inputs if not item.get('data')]
        rows = np.asarray(rows)
        by_vector = {vector: action for action, vector in self.vectors.items() if action in available}
        completed = self.phase_changed and all(self.replay_ticks >= len(path) - 1 for path in self.history_paths)
        held_sites = []
        if completed:
            held_sites = [tuple(effect['site']) for effect in self.prepared_effects
                          if effect['kind'] == 'reversible_occupancy'
                          and all(int(rows[y, x]) == new for x, y, old, new in effect['pixels'])]
        paths = self.paths(rows, position, [tuple(node['position']) for node in self.nodes] + [self.goal], held_sites)
        reason = None
        route = None
        if self.selected is None:
            options = [node for node in self.nodes if tuple(node['position']) in paths]
            if not options:
                return None
            options.sort(key=lambda node: (len(paths[tuple(node['position'])]), node['position']))
            self.selected = options[0]
        site = tuple(self.selected['position'])
        if self.contact is None:
            route = paths.get(site)
            reason = 'Test contact with the smaller dense occurrence linked to a distant larger support.'
        elif not self.contact['pixels']:
            return None
        elif self.departure is None:
            exits = []
            for dest, prefix in paths.items():
                if len(prefix) != 1 or dest == site:
                    continue
                if not np.all(patch(rows, dest, self.body['size']) == self.body['floor']):
                    continue
                questions = [tuple(node['position']) for node in self.nodes if tuple(node['position']) != site]
                onward = self.paths(rows, dest, questions + [self.goal])
                relevance = sum(question in onward for question in questions) + int(self.goal in onward)
                exits.append(((-relevance, dest != tuple(self.contact['from']), dest), prefix))
            route = min(exits, key=lambda item: item[0])[1] if exits else paths.get(tuple(self.contact['from']))
            reason = 'Leave the contacted occurrence and compare the frozen remote pixels.'
        elif self.departure['remote_persisted']:
            if site not in self.persistent_sites:
                self.persistent_sites.add(site)
                self.prepared_effects.append({'site': site, 'pixels': self.contact['pixels'],
                                             'kind': 'persistent_after_observed_departure',
                                             'evidence': [self.contact['after_ref'], self.departure['after_ref']]})
                self.events.append({'kind': 'retain_contextual_persistent_preparation', 'observation': current['ref'],
                                    'site': site, 'pixels': self.contact['pixels'],
                                    'departure_ref': self.departure['after_ref'],
                                    'unresolved': ['duration', 'reentry may invert', 'phase change may restore original world']})
            # Persistence after this departure supplies a preparation that can
            # be preserved while testing a different occurrence. Reentry is a
            # separate experiment, with a possible undo effect and no need here.
            options = [node for node in self.nodes if tuple(node['position']) not in self.persistent_sites
                       and tuple(node['position']) not in self.prepared and tuple(node['position']) in paths]
            if self.goal in paths:
                route = paths[self.goal]
                reason = 'Test destination access while preserving the locally persistent preparation.'
            elif options:
                options.sort(key=lambda node: (len(paths[tuple(node['position'])]), node['position']))
                self.selected = options[0]
                self.contact = None
                self.departure = None
                self.reversal = None
                return self.propose(phase, observation, rows, inputs, remaining)
            else:
                return None
        elif self.reversal is None:
            route = paths.get(site)
            reason = 'Reenter the same occurrence to distinguish reversible occupancy from a one-off change.'
        elif not self.reversal['conditional_hold_supported']:
            return None
        elif self.phase_trial is None or self.recording_next:
            unresolved = ([self.phase_action] if self.phase_action in available else
                          [action for action in available if action not in self.vectors and (position, action) not in self.tested])
            if len(unresolved) != 1:
                return None
            if self.slot_count is None or len(self.history_paths) >= self.slot_count - 1:
                return None
            self.phase_trial = {'before_ref': current['ref'], 'action': unresolved[0],
                                'recorded_steps': len(phase.commands), 'site': site,
                                'source_path': [self.body['start']]}
            for state in phase.states[self.phase_start + 1:]:
                pose = state['poses'].get(self.body['signature'])
                if pose is not None and pose != self.phase_trial['source_path'][-1]:
                    self.phase_trial['source_path'].append(pose)
            self.history_paths.append(self.phase_trial['source_path'])
            self.prepared.append(site)
            self.prepared_effects.append({'site': site, 'pixels': self.contact['pixels'],
                                         'kind': 'reversible_occupancy', 'evidence': [self.contact['after_ref'], self.reversal['after_ref']]})
            self.phase_action = unresolved[0]
            self.recording_next = False
            return self.bundle(observation, unresolved[0], position, None,
                               'Test the remaining input while a reversible remote condition is established.', 'phase')
        elif self.phase_changed:
            if self.replay_refuted:
                return None
            route = paths.get(self.goal)
            reason = 'Test the visible open-rim destination while the previously contacted occurrence may be replayed.'
            unfinished = any(self.replay_ticks < len(path) - 1 for path in self.history_paths)
            if route is None and not unfinished and len(self.history_paths) < self.slot_count - 1:
                options = [node for node in self.nodes if tuple(node['position']) not in self.prepared
                           and tuple(node['position']) not in self.persistent_sites and tuple(node['position']) in paths]
                if options:
                    options.sort(key=lambda node: (len(paths[tuple(node['position'])]), node['position']))
                    self.selected = options[0]
                    self.contact = None
                    self.departure = None
                    self.reversal = None
                    self.recording_next = True
                    self.events.append({'kind': 'compose_another_linked_contribution', 'observation': current['ref'],
                                        'prepared_sites': list(self.prepared), 'new_site': self.selected['position'],
                                        'remaining_marker_slots': self.slot_count - len(self.history_paths) - 1,
                                        'terminal_access_still_unavailable': True})
                    return self.propose(phase, observation, rows, inputs, remaining)
            if route is None or unfinished:
                remote = {(x, y) for effect in self.prepared_effects for x, y, old, new in effect['pixels']}
                current_remote = {(x, y) for x, y, old, new in self.contact['pixels']}
                candidates = []
                for origin, prefix in paths.items():
                    for vector, action in by_vector.items():
                        dest = add(origin, vector)
                        support = rectangle(dest, self.body['size'])
                        addressed = bool(support & current_remote)
                        if addressed or (dest not in paths and support & remote):
                            candidates.append(((not addressed, len(prefix)), prefix + [(origin, dest, vector)]))
                if candidates and not unfinished:
                    route = min(candidates, key=lambda item: item[0])[1]
                    reason = 'Approach the previously changed region and test whether its access becomes available.'
                elif unfinished:
                    approach = min(candidates, key=lambda item: item[0])[1][:-1] if candidates else []
                    if approach:
                        route = approach
                        reason = 'Approach the remote region while comparing the secondary path with the recorded displacements.'
                    else:
                        # Reusing a proven floor edge tests whether accepted
                        # motion advances the secondary after blocked inputs
                        # failed to do so. Both poses are frozen before release.
                        loops = []
                        for displacement, ref in by_vector.items():
                            reverse = (-displacement[0], -displacement[1])
                            dest = add(position, displacement)
                            if reverse not in by_vector or dest not in paths or len(paths[dest]) != 1:
                                continue
                            if rectangle(dest, self.body['size']) & remote:
                                continue
                            loops.append([(position, dest, displacement), (dest, position, reverse)])
                        if not loops:
                            return None
                        route = min(loops, key=lambda path: path[0][1])
                        reason = 'Contrast accepted motion with a blocked command by a reversible observed-floor excursion.'
                else:
                    return None
        if not route:
            return None
        origin, dest, vector = route[0]
        action = by_vector.get(vector)
        if action is None:
            unresolved = [ref for ref in available if ref not in self.vectors and (position, ref) not in self.tested]
            if not unresolved:
                return None
            return self.bundle(observation, unresolved[0], position, None,
                               'Measure an unresolved input needed by the visible access path.', 'binding')
        prefix = []
        for source, target, displacement in route[:min(16, remaining)]:
            ref = by_vector.get(displacement)
            if ref is None:
                break
            prefix.append({'action': {'action_ref': ref}, 'from': source, 'to': target,
                           'destination_before': ([[self.body['floor']] * self.body['size'][0] for _ in range(self.body['size'][1])]
                                                  if target == position else patch(rows, target, self.body['size']).tolist())})
            if not np.all(patch(rows, target, self.body['size']) == self.body['floor']):
                break
        return self.bundle(observation, action, origin, dest, reason, 'access', prefix)

    def bundle(self, observation, action, start, end, why, mode, prefix=None):
        command = {'action_ref': action}
        ref = 'C_linked_' + digest([observation['observation_ref'], command, why])[:16]
        evidence = [observation['observation_ref']]
        if self.contact:
            evidence.append(self.contact['after_ref'])
        facts = {'linked_occurrences_measured': True, 'receiver_bound': True,
                 'access_is_conditional': True, 'terminal_role_is_hypothesis': True}
        plan = {'bootstrap': True, 'primary': self.body['signature'], 'from': start, 'to': end,
                'why': why, 'mode': mode, 'site': self.selected['position'],
                'remote_pixels': self.contact['pixels'] if self.contact else [],
                'falsifiers': ['receiver displacement differs', 'linked remote region unchanged', 'condition persists on departure'],
                'alternatives': ['local decoration', 'persistent activation', 'autonomous change', 'reversible occupancy']}
        plan['retained_preparations'] = [{'site': effect['site'], 'kind': effect['kind'], 'evidence': effect['evidence']}
                                        for effect in self.prepared_effects]
        if self.contact and self.departure is None and mode == 'access':
            plan['departure_contrast'] = {'entry_ref': self.contact['after_ref'], 'peer_pixels': self.contact['pixels'],
                                         'exit_choice': 'maximal count of visible accessible unresolved occurrences without recrossing the contacted site',
                                         'return_obligation': False, 'persistence_is_unknown_until_response': True}
        steps = prefix or [{'action': command, 'from': start, 'to': end, 'destination_before': None}]
        commands = [step['action'] for step in steps]
        for index, step in enumerate(steps):
            step['expected_before'] = {'frame_hash': observation['frame_hash'] if index == 0 else None}
            step['expected_after'] = step['to']
        plan['steps'] = steps
        if self.phase_changed and not self.replay_refuted and mode != 'phase':
            ticks = self.replay_ticks
            path = self.phase_trial['source_path']
            for step in steps:
                step['secondary_before'] = path[min(len(path) - 1, ticks)]
                step['copies_before'] = [history[min(len(history) - 1, ticks)] for history in self.history_paths]
                ticks += int(step['to'] is not None and step['to'] != step['from'])
                step['secondary_after'] = path[min(len(path) - 1, ticks)]
                step['copies_after'] = [history[min(len(history) - 1, ticks)] for history in self.history_paths]
            plan['secondary'] = self.secondary
            plan['receiver_mask'] = self.body['mask']
            plan['replay_hypothesis'] = 'A successful receiver displacement advances one recorded displacement; a blocked command may leave the cursor unchanged.'
            plan['replay_support'] = {'motion': self.replay_motion_support[-2:], 'blocked': self.replay_blocked_support[-2:]}
        changes = {}
        if mode == 'phase':
            references = [self.context_id(observation)] + [self.effect_id(observation, effect) for effect in self.prepared_effects]
            changes = {reference: {'observation_ref': observation['observation_ref'], 'action_ref': action,
                                   'why': why, 'expected_reestablishment': {'conditional_histories': self.history_paths}}
                       for reference in references}
        return {'status': 'proposed', 'kind': 'linked_contact_experiment', 'phase_plan': plan,
                'preservation_changes': changes,
                'actions': commands, 'steps': steps, 'facts': facts,
                'compositions': [{'id': ref, 'role': 'information_question', 'observed': False,
                                  'open_question': why, 'properties': {'terminal_relevance': 'unknown'},
                                  'relations': ['contributes_to:G_official_completion']}],
                'question': {'reason': why, 'hypothesis_refs': evidence}, 'route_refs': evidence,
                'binding': {'observation_ref': observation['observation_ref'], 'level_epoch': observation['level_epoch'],
                            'levels_completed': observation['levels_completed']},
                'bundle_template': {'operation_key': 'OP18', 'composition_ref': ref, 'objective_ref': 'G_official_completion',
                                    'preserve_refs': [], 'purpose': why, 'evidence': evidence, 'actions': commands,
                                    'preconditions': facts, 'frozen_linked_contact': json.loads(json.dumps(plan)),
                                    'outcome_guard': {'path': ['value'], 'contains': ref}}}

    def before(self, proposal, index, public, observation):
        plan = proposal['phase_plan']
        step = proposal['steps'][index]
        entities = {entity['signature']: tuple(entity['position']) for entity in observation['entities'] if not entity['identity_ambiguous']}
        ok = ((index > 0 or observation['observation_ref'] == proposal['binding']['observation_ref'])
              and public.level == proposal['binding']['level_epoch']
              and public.levels_completed == proposal['binding']['levels_completed']
              and (index > 0 or public.frame_hash == step['expected_before']['frame_hash'])
              and step['action']['action_ref'] in public.available_action_refs
              and entities.get(plan['primary']) == tuple(step['from']))
        if step['destination_before'] is not None:
            ok = ok and patch(np.asarray(public.frame_rows), tuple(step['to']), self.body['size']).tolist() == step['destination_before']
        copies = self.secondary_poses(observation, plan)
        if copies and 'copies_before' in step:
            ok = ok and copies <= set(map(tuple, step['copies_before']))
        return {'admitted': bool(ok), 'reason': 'linked_contact_receiver_bound' if ok else 'linked_contact_binding_changed'}

    def after(self, proposal, index, before, after, first, second):
        if before['level_epoch'] != after['level_epoch'] or before['levels_completed'] != after['levels_completed'] or before['state'] != after['state']:
            return {'matched': None, 'seal_prefix': True, 'reason': 'official_boundary'}
        end = proposal['steps'][index]['to']
        entities = {entity['signature']: tuple(entity['position']) for entity in after['entities'] if not entity['identity_ambiguous']}
        matched = None if end is None else entities.get(proposal['phase_plan']['primary']) == tuple(end)
        copies = self.secondary_poses(after, proposal['phase_plan'])
        if copies and 'copies_after' in proposal['steps'][index]:
            matched = matched and copies <= set(map(tuple, proposal['steps'][index]['copies_after']))
        return {'matched': matched, 'seal_prefix': matched is not True or index + 1 == len(proposal['steps']),
                'reason': 'linked_contact_conditional_response'}

    @staticmethod
    def secondary_poses(observation, plan):
        if 'receiver_mask' not in plan:
            return set()
        candidates = [tuple(entity['position']) for entity in observation['entities']
                      if entity['signature'] != plan['primary']
                      and entity['mask'] == plan['receiver_mask']]
        return set(candidates)

    def context_id(self, observation):
        return 'C_prepared_context_' + digest([observation['level_epoch'], self.body['start']])[:16]

    @staticmethod
    def effect_id(observation, effect):
        return 'C_prepared_effect_' + digest([observation['level_epoch'], effect['site'], effect['evidence']])[:16]

    def preservation_obligations(self, observation, rows):
        if not self.body:
            return []
        result = []
        if self.phase_context and self.history_paths:
            result.append({'id': self.context_id(observation), 'meaning': 'Retain the current prepared temporal context.',
                           'pixels': self.phase_context['pixels'], 'evidence': [self.phase_context['ref']],
                           'revision_inputs': [self.phase_action]})
        completed = not self.history_paths or all(self.replay_ticks >= len(path) - 1 for path in self.history_paths)
        if completed:
            for effect in self.prepared_effects:
                points = [(x, y, new) for x, y, old, new in effect['pixels']]
                result.append({'id': self.effect_id(observation, effect), 'meaning': effect['kind'],
                               'pixels': points, 'evidence': effect['evidence'], 'occluder_mask': self.body['mask'],
                               'revision_inputs': [self.phase_action] if self.phase_action else []})
        return result
