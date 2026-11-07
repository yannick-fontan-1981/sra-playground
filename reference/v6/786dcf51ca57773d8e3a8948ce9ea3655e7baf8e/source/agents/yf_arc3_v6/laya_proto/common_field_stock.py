"""Typed stock and observed rewrites under a recalled addressed-field hypothesis."""
from collections import Counter, defaultdict
from itertools import combinations
import copy
import json

from geometric_observer import components
from common_containment import filled
from common_multiscale_constraints import digest
from common_visible_identity import contains
from observed_input_domain import ObservedInputDomain
from typed_material_observations import child_present


def feature(body):
    return body['palette'], tuple(body['bbox'])


def pixels(body):
    left, top = body['bbox'][:2]
    return {(left + x, top + y) for x, y in body['mask']}


def distance(point, body):
    return min((point[0] - x) ** 2 + (point[1] - y) ** 2 for x, y in pixels(body))


def anchor(body):
    offset = body.get('offset')
    if offset is None:
        return None
    return body['bbox'][0] + offset[0], body['bbox'][1] + offset[1]


class FieldStock:
    @classmethod
    def create(cls, prior, observation, rows):
        if not prior.get('goal_region') or prior.get('upper_squared') is None:
            return None
        row = prior['request_row']
        squares = [entity for entity in observation['entities'] if entity['rectangular']
                   and entity['bbox'][2] - entity['bbox'][0] == entity['bbox'][3] - entity['bbox'][1]]
        groups = defaultdict(list)
        for entity in squares:
            left, top, right, bottom = entity['bbox']
            if right > left:
                groups[top, right - left + 1].append(entity)
        ladders = []
        for (top, side), entries in groups.items():
            entries.sort(key=lambda entity: entity['bbox'][0])
            pitches = {b['bbox'][0] - a['bbox'][0] for a, b in zip(entries, entries[1:])}
            if len(entries) >= 2 and len({entity['palette_value'] for entity in entries}) == len(entries) and len(pitches) == 1:
                ladders.append((abs(top - row), entries))
        if not ladders:
            return None
        ladder = min(ladders, key=lambda item: (-len(item[1]), item[0]))[1]
        order = [entity['palette_value'] for entity in ladder]
        ladder_boxes = {tuple(entity['bbox']) for entity in ladder}
        requests = [entity for entity in squares if entity['bbox'][1] <= row <= entity['bbox'][3]
                    and tuple(entity['bbox']) not in ladder_boxes and entity['palette_value'] in order]
        envelope = set(map(tuple, prior['goal_region']['envelope']))
        size = tuple(prior['goal_region']['size'])
        zones = []
        for entity in observation['entities']:
            left, top, right, bottom = entity['bbox']
            if (right - left + 1, bottom - top + 1) != size:
                continue
            if filled(set(map(tuple, entity['mask'])), *size) == envelope:
                zones.append({'bbox': entity['bbox'], 'point': [(left + right) // 2, (top + bottom) // 2],
                              'source_ref': observation['observation_ref']})
        if not requests or not zones:
            return None
        instance = cls()
        instance.prior = copy.deepcopy(prior)
        instance.epoch = observation['level_epoch']
        instance.order = order
        instance.requests = requests
        instance.demands = Counter(entity['palette_value'] for entity in requests)
        instance.zones = zones
        instance.interface_boxes = [entity['bbox'] for entity in ladder + requests]
        instance.interface_boxes += [entity['bbox'] for entity in observation['entities']
                                    if entity['bbox'][0] == 0 and entity['bbox'][2] == len(rows[0]) - 1 and entity['bbox'][1] == entity['bbox'][3]]
        instance.lower = prior['lower_squared']
        instance.upper = prior['upper_squared']
        instance.action_ref = prior['action_ref']
        instance.templates = copy.deepcopy(prior.get('class_templates', {}))
        instance.rules = {int(symbol): {**rule, 'confirmations': 0, 'prior_evidence': rule['evidence'], 'evidence': []}
                          for symbol, rule in prior.get('observed_rules', {}).items()
                          if int(symbol) in order and rule['product'] in order and prior.get('type_order') == order}
        instance.lineages = {}
        instance.motion_types = {int(symbol) for symbol, template in instance.templates.items() if template.get('alignment_supported')}
        instance.minimums = Counter()
        instance.failures = set()
        instance.events = []
        instance.invalid = None
        instance.scene_ref = observation['observation_ref']
        return instance

    def bodies(self, rows):
        result = []
        for entity in components(rows):
            left, top, right, bottom = entity['bbox']
            if entity['color'] not in self.order or not entity['rectangular'] or right - left != bottom - top:
                continue
            if any(contains(box, entity['bbox']) for box in self.interface_boxes):
                continue
            side = right - left + 1
            template = self.templates.get(str(entity['color']))
            offset = template['offset'] if template and template['size'] == [side, side] else [0, 0] if side == 1 else None
            result.append({'palette': entity['color'], 'bbox': list(entity['bbox']), 'mask': sorted(map(list, entity['mask'])),
                           'offset': offset, 'origins': self.lineages.get((entity['color'], tuple(entity['bbox'])), [])})
        return sorted(result, key=feature)

    def allocations(self, bodies):
        remaining = self.demands.copy()
        free = list(range(len(self.zones)))
        assigned = []
        for index, body in enumerate(bodies):
            position = anchor(body)
            matches = [zone for zone in free if position == tuple(self.zones[zone]['point'])]
            if remaining[body['palette']] and matches:
                zone = matches[0]
                remaining[body['palette']] -= 1
                free.remove(zone)
                assigned.append((index, zone))
        reserved = {index for index, _ in assigned}
        ready = []
        for symbol, count in remaining.items():
            options = [index for index, body in enumerate(bodies) if body['palette'] == symbol and index not in reserved]
            options.sort(key=lambda index: min((sum((anchor(bodies[index])[axis] - self.zones[zone]['point'][axis]) ** 2 for axis in (0, 1))
                                                for zone in free), default=0) if anchor(bodies[index]) else float('inf'))
            for index in options[:count]:
                ready.append(index)
                reserved.add(index)
        return remaining, free, reserved, ready

    def loci(self, rows, bodies, selected):
        result = []
        for y in range(len(rows)):
            for x in range(len(rows[0])):
                point = (x, y)
                if all(distance(point, bodies[index]) <= self.lower for index in selected) and all(
                        distance(point, body) >= self.upper for index, body in enumerate(bodies) if index not in selected):
                    result.append(point)
        return result

    @staticmethod
    def toward(point, target):
        return sum((point[axis] - target[axis]) ** 2 for axis in (0, 1))

    def movement(self, rows, bodies, index, target, purpose):
        body = bodies[index]
        position = anchor(body)
        if position is None:
            return None
        points = [point for point in self.loci(rows, bodies, {index}) if point != position]
        useful = [point for point in points if self.toward(point, target) < self.toward(position, target)]
        if useful:
            point = min(useful, key=lambda value: (self.toward(value, target), value))
        else:
            others = [other for j, other in enumerate(bodies) if j != index]
            separation = min((distance(position, other) for other in others), default=0)
            useful = [point for point in points if min((distance(point, other) for other in others), default=0) > separation]
            if not useful:
                return None
            point = min(useful, key=lambda value: (-min(distance(value, other) for other in others), self.toward(value, target), value))
            purpose = 'Separate one retained material occurrence to make a later access possible.'
        return {'kind': 'move', 'selected': [index], 'point': point, 'purpose': purpose,
                'known': body['palette'] in self.motion_types, 'product': body['palette']}

    def offer(self, rows, bodies):
        remaining, free, reserved, ready = self.allocations(bodies)
        if ready and free:
            choices = []
            for index in ready:
                for zone in free:
                    move = self.movement(rows, bodies, index, self.zones[zone]['point'], 'Deliver an observed requested type while preserving the other stock.')
                    if move:
                        choices.append((self.toward(move['point'], self.zones[zone]['point']), move))
            if choices:
                return min(choices, key=lambda item: item[0])[1]
        missing = [symbol for symbol, count in remaining.items() if count and not any(index in ready and bodies[index]['palette'] == symbol for index in ready)]
        if not missing:
            return None
        target_rank = max(self.order.index(symbol) for symbol in missing)
        options = []
        for left, right in combinations(range(len(bodies)), 2):
            first, second = bodies[left], bodies[right]
            symbol = first['palette']
            if left in reserved or right in reserved or symbol != second['palette'] or self.order.index(symbol) >= target_rank:
                continue
            rank = self.order.index(symbol)
            product = self.rules.get(symbol, {}).get('product', self.order[rank + 1])
            target = min((zone['point'] for zone in self.zones), key=lambda point: sum(self.toward(point, anchor(body) or body['bbox'][:2]) for body in (first, second)))
            points = self.loci(rows, bodies, {left, right})
            points = [point for point in points if (feature(first), feature(second), point) not in self.failures]
            if points:
                point = min(points, key=lambda value: (self.toward(value, target), value))
                options.append(((-rank, 0, self.toward(point, target)),
                    {'kind': 'fuse', 'selected': [left, right], 'point': point, 'product': product,
                     'known': self.rules.get(symbol, {}).get('confirmations', 0) >= 2,
                     'purpose': 'Test the production of a missing requested type through two observed intrants; a higher rewrite remains a hypothesis.'}))
            else:
                for moving, other in ((left, right), (right, left)):
                    move = self.movement(rows, bodies, moving, anchor(bodies[other]) or bodies[other]['bbox'][:2],
                                         'Bring one producer intrant into a common field domain without consuming the other stock.')
                    if move:
                        options.append(((-rank, 1, self.toward(move['point'], target)), move))
        return min(options, key=lambda item: item[0])[1] if options else None

    def simulate(self, bodies, offer):
        point = offer['point']
        selected = offer['selected']
        old = bodies[selected[0]]
        template = self.templates.get(str(offer['product']))
        if offer['kind'] == 'move':
            template = {'offset': old['offset'], 'mask': old['mask'], 'size': [old['bbox'][2] - old['bbox'][0] + 1, old['bbox'][3] - old['bbox'][1] + 1]}
        if not template or template['offset'] is None:
            return None
        left, top = point[0] - template['offset'][0], point[1] - template['offset'][1]
        width, height = template['size']
        product = {'palette': offer['product'], 'bbox': [left, top, left + width - 1, top + height - 1],
                   'mask': template['mask'], 'offset': template['offset'],
                   'origins': sorted({origin for index in selected for origin in bodies[index]['origins']})}
        return sorted([body for index, body in enumerate(bodies) if index not in selected] + [product], key=feature)

    def preservation_obligations(self, observation, rows):
        counts = Counter(body['palette'] for body in self.bodies(rows))
        for symbol, required in self.demands.items():
            self.minimums[symbol] = max(self.minimums[symbol], min(required, counts[symbol]))
        return [{'id': 'C_material_' + digest([self.epoch, symbol])[:16],
                 'meaning': 'Retain the observed type count needed by the current request.',
                 'entity_predicate': {'palette_value': symbol, 'minimum_count': count, 'exclude_boxes': self.interface_boxes},
                 'evidence': [self.scene_ref, observation['observation_ref']], 'revision_inputs': [self.action_ref]}
                for symbol, count in self.minimums.items() if count]

    def propose(self, observation, rows, remaining):
        if self.invalid:
            return {'status': 'typed_field_applicability_refuted', 'actions': [], 'question': self.invalid}
        if self.action_ref not in observation['available_action_refs']:
            return None
        bodies = self.bodies(rows)
        steps = []
        state = bodies
        changed = set()
        for _ in range(min(16, remaining)):
            offer = self.offer(rows, state)
            if offer is None or offer['point'] in changed:
                break
            expected = self.simulate(state, offer) if offer['known'] else None
            action = {'action_ref': self.action_ref, 'data': {'x': offer['point'][0], 'y': offer['point'][1]}}
            witness = ObservedInputDomain.make_locus_witness(observation, rows, offer['point'], reason=offer['purpose'], evidence=[self.scene_ref, observation['observation_ref']])
            steps.append({'action': action, 'before_bodies': state, 'offer': offer, 'locus_witness': witness,
                          'expected_before': {'level_epoch': self.epoch, 'frame_hash': observation['frame_hash'] if not steps else None},
                          'expected_after': expected})
            if expected is None:
                break
            changed.update(point for index in offer['selected'] for point in pixels(state[index]))
            changed.update(point for body in expected if feature(body) not in {feature(old) for old in state} for point in pixels(body))
            state = expected
        if not steps:
            return {'status': 'typed_material_access_or_rewrite_unresolved', 'actions': []}
        actions = [step['action'] for step in steps]
        why = steps[0]['offer']['purpose']
        reference = 'C_field_stock_' + digest([observation['observation_ref'], actions])[:16]
        facts = {'typed_stock_observed': True, 'request_recalled_from_scored_context': True, 'unknown_rewrite_closes_prefix': True}
        obligations = self.preservation_obligations(observation, rows)
        changes = {item['id']: {'observation_ref': observation['observation_ref'], 'action_ref': self.action_ref, 'actions': actions,
                                'why': 'The bound field question retains the requested material count.', 'revise_condition': False,
                                'expected_reestablishment': {'minimum_count': item['entity_predicate']['minimum_count'],
                                                             'palette_value': item['entity_predicate']['palette_value']}}
                   for item in obligations}
        plan = {'stock': True, 'steps': steps, 'order': self.order, 'demands': dict(self.demands),
                'counts_before': dict(Counter(body['palette'] for body in bodies)),
                'acquired_minimums': dict(self.minimums), 'rules': json.loads(json.dumps(self.rules)),
                'scope': 'Joint parentage is inferred from stable consumption and production; conserved pixel identity is not asserted.'}
        evidence = [self.scene_ref, observation['observation_ref']]
        return {'status': 'proposed', 'kind': 'typed_field_stock', 'field_plan': plan, 'steps': steps, 'actions': actions,
                'facts': facts, 'preservation_changes': changes,
                'compositions': [{'id': reference, 'role': 'information_question', 'observed': False, 'open_question': why,
                                  'properties': {'demand_counts': dict(self.demands), 'available_counts': plan['counts_before']},
                                  'relations': ['contributes_to:G_official_completion']}],
                'question': {'reason': why, 'hypothesis_refs': evidence}, 'route_refs': evidence,
                'binding': {'observation_ref': observation['observation_ref'], 'level_epoch': self.epoch, 'levels_completed': observation['levels_completed']},
                'bundle_template': {'operation_key': 'OP18', 'composition_ref': reference, 'objective_ref': 'G_official_completion',
                    'preserve_refs': [], 'purpose': why, 'preconditions': facts, 'evidence': evidence, 'actions': actions,
                    'frozen_field_plan': json.loads(json.dumps(plan)), 'outcome_guard': {'path': ['value'], 'contains': reference}}}

    def before(self, proposal, index, public, observation):
        expected = proposal['steps'][index]['before_bodies']
        actual = self.bodies(public.frame_rows)
        ok = (public.level == proposal['binding']['level_epoch'] and public.levels_completed == proposal['binding']['levels_completed']
              and (index > 0 or observation['observation_ref'] == proposal['binding']['observation_ref'])
              and sorted(map(feature, actual)) == sorted(map(feature, expected)))
        for body in expected:
            child = {'center': body['bbox'][:2], 'marks': [(body['palette'], x, y) for x, y in body['mask']]}
            ok = ok and child_present(child, public.frame_rows)
        return {'admitted': bool(ok), 'reason': 'typed_stock_and_address_bound' if ok else 'typed_stock_changed'}

    def after(self, proposal, index, before, after, first, second):
        if before['level_epoch'] != after['level_epoch'] or before['levels_completed'] != after['levels_completed'] or before['state'] != after['state']:
            return {'matched': None, 'seal_prefix': True, 'reason': 'official_boundary'}
        expected = proposal['steps'][index]['expected_after']
        matched = sorted(map(feature, self.bodies(second))) == sorted(map(feature, expected)) if expected is not None else None
        if expected is None:
            step = proposal['steps'][index]
            for i, body in enumerate(step['before_bodies']):
                if i not in step['offer']['selected']:
                    child = {'center': body['bbox'][:2], 'marks': [(body['palette'], x, y) for x, y in body['mask']]}
                    if not child_present(child, second):
                        matched = False
        return {'matched': matched, 'seal_prefix': matched is not True or index + 1 == len(proposal['steps']),
                'reason': 'compare_stable_material_stock'}

    def record(self, before, after, command, first, second, proposal=None, index=None):
        old, new = self.bodies(first), self.bodies(second)
        left = [body for body in old if feature(body) not in set(map(feature, new))]
        right = [body for body in new if feature(body) not in set(map(feature, old))]
        self.events = []
        if command['action_ref'] != self.action_ref or set(command.get('data', {})) != {'x', 'y'}:
            return {'status': 'material_transition_unaddressed', 'events': []}
        point = command['data']['x'], command['data']['y']
        if proposal and proposal.get('field_plan', {}).get('stock'):
            step = proposal['steps'][index]
            for i, body in enumerate(step['before_bodies']):
                if i not in step['offer']['selected'] and feature(body) not in set(map(feature, new)):
                    self.invalid = {'reason': 'unselected_material_changed_or_occluded', 'before': before['observation_ref'], 'after': after['observation_ref']}
                    return {'status': 'field_preservation_prediction_refuted', 'events': [self.invalid]}
        if len(right) == 1 and ((len(left) == 1 and left[0]['palette'] == right[0]['palette'])
                                or (len(left) == 2 and left[0]['palette'] == left[1]['palette'] and right[0]['palette'] != left[0]['palette'])):
            child = right[0]
            offset = [point[0] - child['bbox'][0], point[1] - child['bbox'][1]]
            size = [child['bbox'][2] - child['bbox'][0] + 1, child['bbox'][3] - child['bbox'][1] + 1]
            if not all(0 <= offset[axis] < size[axis] for axis in (0, 1)):
                return {'status': 'material_anchor_unresolved', 'events': []}
            former = self.templates.get(str(child['palette']), {})
            retained_alignment = (former.get('alignment_supported') and former.get('offset') == offset and former.get('size') == size)
            self.templates[str(child['palette'])] = {'offset': offset, 'mask': child['mask'], 'size': size,
                                                    'alignment_supported': len(left) == 1 or bool(retained_alignment)}
            if not self.templates[str(child['palette'])]['alignment_supported']:
                self.motion_types.discard(child['palette'])
            origins = sorted({origin for body in left for origin in (body['origins'] or [digest([before['observation_ref'], feature(body)])])})
            for body in left:
                self.lineages.pop(feature(body), None)
            self.lineages[feature(child)] = origins
            if len(left) == 1:
                self.motion_types.add(child['palette'])
                kind = 'typed_material_relocated_to_address'
            else:
                symbol = left[0]['palette']
                previous = self.rules.get(symbol)
                if previous and previous['product'] != child['palette']:
                    if previous['confirmations']:
                        self.invalid = {'reason': 'observed_rewrite_context_changed', 'before': before['observation_ref'], 'after': after['observation_ref']}
                        return {'status': 'material_rewrite_refuted', 'events': [self.invalid]}
                    self.events.append({'kind': 'recalled_rewrite_refuted', 'before': before['observation_ref'], 'after': after['observation_ref']})
                    previous = None
                confirmations = previous['confirmations'] + 1 if previous else 1
                self.rules[symbol] = {'consumed_count': 2, 'product': child['palette'], 'produced_count': 1, 'confirmations': confirmations,
                                      'prior_evidence': previous.get('prior_evidence', []) if previous else [],
                                      'evidence': (previous['evidence'] if previous else []) + [after['observation_ref']]}
                kind = 'observed_joint_material_rewrite'
            self.events.append({'kind': kind, 'before': before['observation_ref'], 'after': after['observation_ref'],
                                'parents': [{'palette': body['palette'], 'bbox': body['bbox']} for body in left],
                                'product': {'palette': child['palette'], 'bbox': child['bbox']},
                                'joint_origins': origins, 'conserved_pixel_identity_claimed': False})
        elif proposal and proposal.get('field_plan', {}).get('stock'):
            offer = proposal['steps'][index]['offer']
            if offer['kind'] == 'fuse' and not left and not right:
                first_body, second_body = [old[i] for i in offer['selected']]
                self.failures.add((feature(first_body), feature(second_body), tuple(offer['point'])))
            self.events.append({'kind': 'material_response_unresolved', 'removed': len(left), 'added': len(right),
                                'before': before['observation_ref'], 'after': after['observation_ref']})
        return {'status': 'material_observation_recorded', 'events': self.events}

    def retained(self, boundary):
        return {**self.prior, 'class_templates': self.templates, 'observed_rules': self.rules, 'type_order': self.order,
                'boundary': boundary, 'qualification': 'structural field/material hypotheses; next epoch requires fresh bindings and rewrite witnesses'}
