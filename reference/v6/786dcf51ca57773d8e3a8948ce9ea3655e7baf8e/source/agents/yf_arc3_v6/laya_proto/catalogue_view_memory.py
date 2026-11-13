"""A catalogue ambiguity can request an observed field-changing input.

The previous effect is evidence for an experiment, never a predicted translation.
All coordinates and finite candidate sets are measured again in the current view.
"""
from occluded_catalogue_access import OccludedCatalogueAccess
from occluded_catalogue_observation import measure, fit
from common_view_frontier import ViewFrontier
from terminal_composition import identity


def structure(scene):
    return [scene['field'], [(p['mask'], p['extent']) for p in scene['cards']],
            scene['palette'], scene['controls']]


def field_pixels(rows, scene):
    x, y, r, b = scene['field']
    return [row[x:r + 1] for row in rows[y:b + 1]]


class CatalogueViewMemory(OccludedCatalogueAccess):
    def __init__(self):
        super().__init__()
        self.catalogue_view_events = []

    def retained_digest(self):
        return identity([super().retained_digest(), self.catalogue_view_events])

    def apply_event(self, event):
        if event.get('kind') == 'catalogue_field_input_observed':
            self.catalogue_view_events.append(event)
        else:
            super().apply_event(event)

    def propose(self, episode, obs, rows, inputs, max_prefix, config):
        p = super().propose(episode, obs, rows, inputs, max_prefix, config)
        if p and 'occluded_catalogue_plan' in p:
            return p
        scene = measure(rows)
        if not scene or not max_prefix or not config.get('occluded_catalogue_question'):
            return p
        field, key = self.keys(obs, scene)
        if scene['palette'] in self.catalogue_answered.get(field, []):
            return p
        bg = self.catalogue_backgrounds.get(field, [])
        prior = self.catalogue_candidates.get(key)
        fits = fit(rows, scene, bg) if bg else []
        ids = sorted({f['candidate'] for f in fits if prior is None or f['candidate'] in prior})
        if bg and len(ids) < 2:
            return p  # Contradiction or a uniquely measurable answer is not this question.
        events = [e for e in self.catalogue_view_events if e['field_key'] == field]
        available = {identity({'action_ref': a['action_ref']}): {'action_ref': a['action_ref']} for a in inputs if not a.get('data')}
        options = []
        for key_action in sorted({identity(e['command']) for e in events if e['field_changed'] and e['structure_preserved']}):
            if key_action not in available:
                continue
            command = available[key_action]
            # A measured unchanged/contradictory response at these exact premises
            # is not retried. The catalogue may change without changing the field.
            current = identity([field_pixels(rows, scene), structure(scene)])
            if any(e['command'] == command and e['before_context'] == current for e in events):
                continue
            witnesses = [e for e in events if e['command'] == command and e['field_changed'] and e['structure_preserved']]
            attempts = sum(e['command'] == command and e['catalogue_key'] == key for e in events)
            options.append((attempts, key_action, command, witnesses))
        if not options:
            return p
        _, _, command, witnesses = min(options)
        reason = 'obtain_a_discriminating_view_for_current_ambiguous_catalogue'
        details = {'candidate_ids': ids, 'catalogue_key': key, 'field_key': field,
                   'evidence_refs': sorted({r for e in witnesses for r in e['evidence']}),
                   'expected_effect': 'Previously field-changing input; current effect and discrimination remain hypotheses.',
                   'falsifier': 'No field change, changed catalogue geometry, contradiction, or no candidate reduction.',
                   'terminal_role': 'unknown'}
        step = {'action': command, 'expected_before': {k: obs[k] for k in ('level_epoch', 'frame_hash', 'state', 'levels_completed')}, 'expected_after': None}
        form = ViewFrontier()._form(obs, 'catalogue_view_experiment', [command], [step], details, reason)
        form.pop('view_plan')
        form['kind'] = 'catalogue_view_experiment'
        form['occluded_catalogue_plan'] = {'mode': 'view', 'epoch': obs['level_epoch'], 'score': obs['levels_completed'],
            'observation_ref': obs['observation_ref'], 'frame_digest': identity(rows), 'command': dict(command),
            'scene': scene, 'details': details}
        return form

    def before(self, p, index, rows, **meta):
        plan = p.get('occluded_catalogue_plan', {})
        if plan.get('mode') != 'view':
            return super().before(p, index, rows, **meta)
        command = plan['command']
        ok = index == 0 and (meta['epoch'], meta['score'], meta['observation_ref']) == (plan['epoch'], plan['score'], plan['observation_ref'])
        ok = ok and identity(rows) == plan['frame_digest'] and command['action_ref'] in meta['available']
        ok = ok and p['actions'] == [command] and p['bundle_template']['actions'] == [command]
        return {'admitted': bool(ok), 'reason': 'current_catalogue_view_experiment' if ok else 'catalogue_view_binding_changed'}

    def after(self, p, index, rows, later, **meta):
        plan = p.get('occluded_catalogue_plan', {})
        if plan.get('mode') != 'view':
            return super().after(p, index, rows, later, **meta)
        scene = measure(later) if meta['epoch'] == plan['epoch'] else None
        changed = bool(scene and field_pixels(rows, plan['scene']) != field_pixels(later, scene))
        return {'matched': None, 'seal_prefix': True, 'reason': 'field_changed_requires_catalogue_recomparison' if changed else 'field_change_unconfirmed', 'official_progress': meta['score'] > plan['score']}

    def record(self, before, command, after, rows, later, proposal, index):
        parent_proposal = proposal
        if proposal.get('occluded_catalogue_plan', {}).get('mode') == 'view':
            parent_proposal = {k: v for k, v in proposal.items() if k != 'occluded_catalogue_plan'}
        events = super().record(before, command, after, rows, later, parent_proposal, index)
        scene = measure(rows)
        current = measure(later) if before['level_epoch'] == after['level_epoch'] else None
        if scene and current and scene['field'] == current['field'] and not command.get('data'):
            field, key = self.keys(before, scene)
            event = {'kind': 'catalogue_field_input_observed', 'field_key': field, 'catalogue_key': key,
                     'epoch': before['level_epoch'], 'command': command,
                     'before_context': identity([field_pixels(rows, scene), structure(scene)]),
                     'field_changed': field_pixels(rows, scene) != field_pixels(later, current),
                     'structure_preserved': structure(scene) == structure(current),
                     'evidence': [before['observation_ref'], after['observation_ref']],
                     'scope': 'Observed input and field delta, not a universal movement law or a promised informative outcome.'}
            self.apply_event(event)
            events.append(event)
        return events
