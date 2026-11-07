"""Acquire an addressed local field from stable public occurrence responses."""
from collections import defaultdict
import json
from pathlib import Path

from common_containment import filled
from common_multiscale_constraints import digest
from common_visible_identity import residual_correspondences, contains, unchanged
from observed_input_domain import ObservedInputDomain


def center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def support(entity):
    x, y = entity['position']
    return {(x + dx, y + dy) for dx, dy in entity['mask']}


def distance_squared(point, pixels):
    return min((point[0] - x) ** 2 + (point[1] - y) ** 2 for x, y in pixels)


def target_candidates(observation, mobile, rows):
    result = []
    pattern = set(map(tuple, mobile['mask']))
    for shadow in observation['entities']:
        if shadow['palette_value'] == mobile['palette_value'] or set(map(tuple, shadow['mask'])) != pattern:
            continue
        for enclosure in observation['entities']:
            left, top, right, bottom = enclosure['bbox']
            if left == 0 or top == 0 or right == len(rows[0]) - 1 or bottom == len(rows) - 1:
                continue
            if not contains(enclosure['bbox'], shadow['bbox']) or center(enclosure['bbox']) != center(shadow['bbox']):
                continue
            if enclosure['bbox'] == shadow['bbox']:
                continue
            wall = set(map(tuple, enclosure['mask']))
            inside = filled(wall, right - left + 1, bottom - top + 1) - wall
            if {(x - left, y - top) for x, y in support(shadow)} <= inside:
                result.append({'shadow': shadow, 'enclosure': enclosure})
    return result


def transient_contour(first, frames, point):
    """Measure a contracting indicator without treating it as a physical law."""
    if not frames:
        return None
    changes = defaultdict(list)
    for y, row in enumerate(frames[0]):
        for x, value in enumerate(row):
            if value != first[y][x]:
                changes[value].append((x, y))
    candidates = []
    for value, pixels in changes.items():
        left = min(x for x, y in pixels)
        right = max(x for x, y in pixels)
        top = min(y for x, y in pixels)
        bottom = max(y for x, y in pixels)
        if right - left != bottom - top or (left + right, top + bottom) != (2 * point[0], 2 * point[1]):
            continue
        if right - left < 2 or any(frames[-1][y][x] == value for x, y in pixels):
            continue
        candidates.append({'palette': value, 'axis_extent': (right - left) // 2,
                           'first_box': [left, top, right, bottom], 'transient_pixels': len(pixels),
                           'qualification': 'transient graphic only; physical influence remains a separate hypothesis'})
    return max(candidates, key=lambda item: item['transient_pixels']) if candidates else None


class AddressedField:
    def __init__(self):
        self.policy = json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['addressed_field']
        self.epoch = None
        self.model = None
        self.samples = []
        self.indicator = None
        self.lower_squared = 0
        self.upper_squared = None
        self.calibration = 'different_offset'
        self.events = []
        self.passed = []
        self.prior = None
        self.stock = None

    def ensure_stock(self, observation, rows):
        if self.model is None and self.prior and self.stock is None:
            from common_field_stock import FieldStock
            self.stock = FieldStock.create(self.prior, observation, rows)
        return self.stock

    def preservation_obligations(self, observation, rows):
        stock = self.ensure_stock(observation, rows)
        return stock.preservation_obligations(observation, rows) if stock else []

    def body(self, observation):
        if not self.model:
            return None
        pose = tuple(self.model['position'])
        candidates = [entity for entity in observation['entities'] if entity['signature'] == self.model['signature']
                      and tuple(entity['position']) == pose]
        return candidates[0] if len(candidates) == 1 else None

    def fit(self, before, after, command, first, second, frames):
        point = command.get('data', {})
        if set(point) != {'x', 'y'}:
            return
        comparison = residual_correspondences(before, after, first, second)
        options = []
        for candidate in comparison['candidates']:
            old, new = candidate['before'], candidate['after']
            if not old['rectangular'] or not candidate['stationary_same_signature']:
                continue
            goals = target_candidates(before, old, first)
            if len(goals) != 1:
                continue
            offset = point['x'] - new['position'][0], point['y'] - new['position'][1]
            width = new['bbox'][2] - new['bbox'][0] + 1
            height = new['bbox'][3] - new['bbox'][1] + 1
            if not (0 <= offset[0] < width and 0 <= offset[1] < height):
                continue
            options.append((candidate, goals[0], offset, (width, height)))
        if len(options) != 1:
            return
        candidate, goal, offset, size = options[0]
        old, new = candidate['before'], candidate['after']
        self.model = {'signature': new['signature'], 'palette': new['palette_value'], 'mask': new['mask'],
                      'size': size, 'offset': offset, 'position': new['position'],
                      'exemplar': candidate['stationary_same_signature'][0], 'goal': goal,
                      'action_ref': command['action_ref'], 'source_ref': before['observation_ref']}
        self.indicator = transient_contour(first, frames, (point['x'], point['y']))
        self.events.append({'kind': 'addressed_field_candidate', 'before': before['observation_ref'], 'after': after['observation_ref'],
                            'mobile_before': old['bbox'], 'mobile_after': new['bbox'],
                            'stationary_exemplar': self.model['exemplar']['bbox'], 'goal_shadow': goal['shadow']['bbox'],
                            'identity': candidate['identity_status'], 'unresolved_residual_count': len(comparison['unresolved']),
                            'indicator': self.indicator, 'goal_status': 'centered_homologue_hypothesis'})

    def record(self, before, after, command, first, second, proposal=None, index=None, *, frames=None):
        self.events = []
        if self.epoch != before['level_epoch']:
            self.model = None
            self.samples = []
            self.indicator = None
            self.lower_squared = 0
            self.upper_squared = None
            self.calibration = 'different_offset'
            self.epoch = before['level_epoch']
        if before['level_epoch'] != after['level_epoch'] or before['levels_completed'] != after['levels_completed']:
            if after['levels_completed'] > before['levels_completed']:
                if self.stock:
                    self.prior = self.stock.retained(after['observation_ref'])
                    self.passed.append({'score': after['levels_completed'], 'evidence': after['observation_ref']})
                elif self.model:
                    self.passed.append({'score': after['levels_completed'], 'evidence': after['observation_ref']})
                    enclosure = self.model['goal']['enclosure']
                    left, top, right, bottom = enclosure['bbox']
                    size = [right - left + 1, bottom - top + 1]
                    self.prior = {'action_ref': self.model['action_ref'], 'lower_squared': self.lower_squared,
                                  'upper_squared': self.upper_squared, 'boundary': after['observation_ref'],
                                  'request_row': int(center(self.model['exemplar']['bbox'])[1]),
                                  'goal_region': {'size': size, 'envelope': sorted(map(list, filled(set(map(tuple, enclosure['mask'])), *size)))},
                                  'class_templates': {str(self.model['palette']): {'size': list(self.model['size']),
                                                                               'offset': list(self.model['offset']), 'mask': self.model['mask'],
                                                                               'alignment_supported': len([sample for sample in self.samples if sample['moved_to_anchor']]) >= 2}},
                                  'qualification': 'retained local hypothesis; new occurrence and field require revalidation'}
            self.model = None
            self.stock = None
            self.epoch = after['level_epoch']
            self.samples = []
            self.indicator = None
            self.lower_squared = 0
            self.upper_squared = None
            self.calibration = 'different_offset'
            return {'status': 'field_official_boundary', 'events': self.events, 'official_boundary': after['levels_completed']}
        stock = self.ensure_stock(before, first)
        if stock:
            result = stock.record(before, after, command, first, second, proposal, index)
            self.events = result['events']
            return result
        if not self.model:
            self.fit(before, after, command, first, second, frames)
        if not self.model or command['action_ref'] != self.model['action_ref'] or set(command.get('data', {})) != {'x', 'y'}:
            return {'status': 'field_unresolved', 'events': self.events}
        # Match the prior pose from the latest candidate or its retained origin.
        prior_candidates = [entity for entity in before['entities'] if entity['signature'] == self.model['signature']
                            and not unchanged(entity, after)]
        old = prior_candidates[0] if len(prior_candidates) == 1 else self.body(before)
        if old is None:
            return {'events': self.events, 'status': 'occurrence_unresolved'}
        same = [entity for entity in after['entities'] if entity['signature'] == old['signature'] and entity['bbox'] == old['bbox']]
        if same:
            new = same[0]
        else:
            comparison = residual_correspondences(before, after, first, second)
            matches = [item['after'] for item in comparison['candidates'] if item['before']['bbox'] == old['bbox']]
            if len(matches) != 1:
                return {'events': self.events, 'status': 'occurrence_unresolved'}
            new = matches[0]
        point = command['data']['x'], command['data']['y']
        anchor = new['position'][0] + self.model['offset'][0], new['position'][1] + self.model['offset'][1]
        moved = new['position'] != old['position']
        distance = distance_squared(point, support(old))
        aligned = anchor == point and moved
        if aligned:
            self.lower_squared = max(self.lower_squared, distance)
        elif not moved and distance > self.lower_squared:
            self.upper_squared = distance if self.upper_squared is None else min(self.upper_squared, distance)
        else:
            self.events.append({'kind': 'addressed_field_counterexample', 'before': before['observation_ref'], 'after': after['observation_ref'],
                                'point': point, 'actual_anchor': anchor, 'scope': 'alignment_hypothesis_refuted'})
            self.model = None
            return {'status': 'field_refuted', 'events': self.events}
        sample = {'before': before['observation_ref'], 'after': after['observation_ref'], 'point': point,
                  'old_position': old['position'], 'new_position': new['position'], 'distance_squared': distance,
                  'moved_to_anchor': aligned, 'stationary': not moved}
        self.samples.append(sample)
        self.events.append({'kind': 'addressed_field_response', **sample})
        if proposal and proposal.get('field_plan', {}).get('rival_predictions'):
            rivals = proposal['field_plan']['rival_predictions']
            self.events.append({'kind': 'field_rival_comparison', 'observation': after['observation_ref'], 'actual_anchor': anchor,
                                'compatible': [name for name, predicted in rivals.items() if tuple(predicted) == anchor],
                                'refuted_here': [name for name, predicted in rivals.items() if tuple(predicted) != anchor]})
        self.model['position'] = new['position']
        if proposal and proposal.get('field_plan'):
            experiment = proposal['field_plan']['experiment']
            if experiment == 'different_offset':
                self.calibration = 'outside_indicator' if aligned and self.indicator else 'navigation'
            elif experiment == 'outside_indicator':
                self.calibration = 'indicator_edge' if not moved else 'navigation'
            elif experiment == 'indicator_edge':
                self.calibration = 'navigation'
        return {'status': 'field_response_recorded', 'events': self.events}

    def point_options(self, rows, pose, lower, *, equal=False):
        width, height = self.model['size']
        ox, oy = self.model['offset']
        pixels = {(pose[0] + x, pose[1] + y) for x, y in self.model['mask']}
        options = []
        for y in range(oy, len(rows) - height + oy + 1):
            for x in range(ox, len(rows[0]) - width + ox + 1):
                distance = distance_squared((x, y), pixels)
                if (distance == lower if equal else 0 < distance <= lower):
                    options.append((x, y))
        return options

    def propose(self, observation, rows, inputs, remaining):
        if not self.policy['enabled'] or remaining <= 0:
            return None
        stock = self.ensure_stock(observation, rows)
        if stock:
            return stock.propose(observation, rows, remaining)
        if not self.policy['enabled'] or not self.model or remaining <= 0:
            return None
        body = self.body(observation)
        if body is None or self.model['action_ref'] not in observation['available_action_refs']:
            return None
        offset = self.model['offset']
        pose = tuple(body['position'])
        anchor = pose[0] + offset[0], pose[1] + offset[1]
        shadow = self.model['goal']['shadow']
        target = shadow['position'][0] + offset[0], shadow['position'][1] + offset[1]
        experiment = self.calibration
        alternatives = []
        if experiment == 'different_offset':
            first = self.samples[0]
            original = (first['new_position'][0] - first['old_position'][0], first['new_position'][1] - first['old_position'][1])
            points = self.point_options(rows, pose, first['distance_squared'], equal=True)
            points = [point for point in points if max(abs(point[0] - anchor[0]), abs(point[1] - anchor[1])) > max(map(abs, original))
                      and sum((point[i] - target[i]) ** 2 for i in (0, 1)) < sum((anchor[i] - target[i]) ** 2 for i in (0, 1))]
            if not points:
                return None
            best = min(sum((point[i] - target[i]) ** 2 for i in (0, 1)) for point in points)
            alternatives = sorted(point for point in points if sum((point[i] - target[i]) ** 2 for i in (0, 1)) == best)
            points = [alternatives[0]]
            why = 'Contrast click alignment with the former displacement and an axis-limited approach at another bound locus.'
        elif experiment in ('outside_indicator', 'indicator_edge'):
            radius = self.indicator['axis_extent']
            axis = max((0, 1), key=lambda i: abs(target[i] - anchor[i]))
            direction = 1 if target[axis] >= anchor[axis] else -1
            reach = (self.model['size'][axis] - 1 - offset[axis]) if direction > 0 else offset[axis]
            delta = radius + reach + int(experiment == 'outside_indicator')
            point = list(anchor)
            point[axis] += direction * delta
            if not (radius <= point[0] < len(rows[0]) - radius and radius <= point[1] < len(rows) - radius):
                return None
            points = [tuple(point)]
            why = 'Test the transient graphic boundary against a stable receiver response; the graphic alone does not establish range.'
        else:
            points = []
            projected = pose
            for _ in range(min(16, remaining)):
                current = projected[0] + offset[0], projected[1] + offset[1]
                if current == target:
                    break
                options = self.point_options(rows, projected, self.lower_squared)
                options = [point for point in options if sum((point[i] - target[i]) ** 2 for i in (0, 1)) < sum((current[i] - target[i]) ** 2 for i in (0, 1))]
                if not options:
                    break
                point = min(options, key=lambda item: (sum((item[i] - target[i]) ** 2 for i in (0, 1)), item))
                points.append(point)
                projected = point[0] - offset[0], point[1] - offset[1]
            why = 'Compose conditional locally supported field accesses toward the centered homologous enclosure.'
        if not points:
            return None
        steps = []
        projected = pose
        evidence = [observation['observation_ref']] + [sample['after'] for sample in self.samples[-3:]]
        for index, point in enumerate(points):
            action = {'action_ref': self.model['action_ref'], 'data': {'x': point[0], 'y': point[1]}}
            destination = (point[0] - offset[0], point[1] - offset[1]) if experiment == 'navigation' else None
            witness = ObservedInputDomain.make_locus_witness(observation, rows, point, reason=why, evidence=evidence)
            steps.append({'action': action, 'from': projected, 'to': destination, 'locus_witness': witness,
                          'expected_before': {'level_epoch': observation['level_epoch'], 'frame_hash': observation['frame_hash'] if index == 0 else None},
                          'expected_after': {'position': destination, 'question': experiment}})
            if destination is not None:
                projected = destination
        actions = [step['action'] for step in steps]
        reference = 'C_field_' + digest([observation['observation_ref'], actions])[:16]
        facts = {'visible_residual_occurrence_bound': True, 'stationary_same_shape_reference': True,
                 'field_law_is_conditional': True, 'goal_role_is_hypothesis': True}
        frozen_model = json.loads(json.dumps(self.model))
        frozen_model['goal']['enclosure'] = {key: value for key, value in frozen_model['goal']['enclosure'].items()
                                             if key in ('id', 'signature', 'bbox', 'palette_value')}
        rivals = {}
        if experiment != 'navigation':
            first = self.samples[0]
            old_delta = [first['new_position'][i] - first['old_position'][i] for i in (0, 1)]
            point = points[0]
            limit = [abs(value) for value in old_delta]
            rivals = {'click_alignment': point, 'fixed_displacement': tuple(anchor[i] + old_delta[i] for i in (0, 1)),
                      'former_axis_limited_approach': tuple(anchor[i] + max(-limit[i], min(limit[i], point[i] - anchor[i])) for i in (0, 1)),
                      'no_effect': anchor}
            if self.indicator:
                within = distance_squared(point, support(body)) <= self.indicator['axis_extent'] ** 2
                rivals['graphic_extent_as_range'] = point if within else anchor
            steps[0]['expected_after']['rival_anchors'] = rivals
        plan = {'experiment': experiment, 'steps': steps, 'model': frozen_model, 'alternatives': alternatives,
                'rival_predictions': rivals,
                'accepted_distance_squared': self.lower_squared, 'rejected_distance_squared': self.upper_squared,
                'falsifiers': ['mobile does not reach predicted anchor', 'reference changes', 'unpredicted type or multiplicity change'],
                'rivals': ['local alignment', 'fixed displacement', 'bounded approach', 'no effect outside an unknown domain']}
        return {'status': 'proposed', 'kind': 'addressed_local_field', 'field_plan': plan, 'actions': actions, 'steps': steps,
                'facts': facts, 'compositions': [{'id': reference, 'role': 'information_question', 'observed': False,
                    'open_question': why, 'properties': {'terminal_relevance': 'hypothesized_homologue'}, 'relations': ['contributes_to:G_official_completion']}],
                'question': {'reason': why, 'hypothesis_refs': evidence}, 'route_refs': evidence,
                'binding': {'observation_ref': observation['observation_ref'], 'level_epoch': observation['level_epoch'], 'levels_completed': observation['levels_completed']},
                'bundle_template': {'operation_key': 'OP18', 'composition_ref': reference, 'objective_ref': 'G_official_completion',
                    'preserve_refs': [], 'purpose': why, 'preconditions': facts, 'evidence': evidence, 'actions': actions,
                    'frozen_field_plan': json.loads(json.dumps(plan)), 'outcome_guard': {'path': ['value'], 'contains': reference}}}

    def bind(self, proposal, domain):
        for step in proposal['steps']:
            step['point_binding'] = step['locus_witness']

    @staticmethod
    def footprint_matches(rows, model, position):
        x, y = position
        return all(0 <= y + dy < len(rows) and 0 <= x + dx < len(rows[0]) and rows[y + dy][x + dx] == model['palette']
                   for dx, dy in model['mask'])

    def before(self, proposal, index, public, observation):
        if proposal['field_plan'].get('stock'):
            return self.stock.before(proposal, index, public, observation)
        plan = proposal['field_plan']
        model = plan['model']
        step = proposal['steps'][index]
        bound = proposal['binding']
        exemplar = model['exemplar']
        shadow = model['goal']['shadow']
        known = [(x, y, entity['palette_value']) for entity in (exemplar, shadow) for x, y in support(entity)]
        ok = (public.level == bound['level_epoch'] and public.levels_completed == bound['levels_completed']
              and (index > 0 or observation['observation_ref'] == bound['observation_ref'])
              and step['action']['action_ref'] in public.available_action_refs
              and self.footprint_matches(public.frame_rows, model, step['from'])
              and all(public.frame_rows[y][x] == value for x, y, value in known))
        return {'admitted': bool(ok), 'reason': 'measured_receiver_reference_and_address_bound' if ok else 'field_receiver_or_reference_changed'}

    def after(self, proposal, index, before, after, first, second):
        if proposal['field_plan'].get('stock'):
            return self.stock.after(proposal, index, before, after, first, second)
        if before['level_epoch'] != after['level_epoch'] or before['levels_completed'] != after['levels_completed'] or before['state'] != after['state']:
            return {'matched': None, 'seal_prefix': True, 'reason': 'official_boundary'}
        target = proposal['steps'][index]['to']
        matched = self.footprint_matches(second, proposal['field_plan']['model'], target) if target is not None else None
        return {'matched': matched, 'seal_prefix': matched is not True or index + 1 == len(proposal['steps']),
                'reason': 'compare_stable_receiver_with_frozen_field_prediction'}
