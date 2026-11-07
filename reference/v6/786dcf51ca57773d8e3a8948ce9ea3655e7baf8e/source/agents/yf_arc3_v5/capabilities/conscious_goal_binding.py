"""Measure current goal-owned relation declarations without borrowing a means' goal."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_goal_relation_evidence(snapshot, goal_ref, configuration, *, execution_scope=None):
    rows, bindings, participants = [], set(), set()
    for query in configuration.get('goal_relation_queries', ()):
        for claim in snapshot.claims_for_predicate(query['predicate_ref']):
            index = query['goal_argument_index']
            if (len(claim.arguments) <= index or claim.arguments[index] != goal_ref
                    or claim.disposition.value != 'active'):
                continue
            binding = tuple(claim.attributes.get(query[field]) for field in
                ('subject_attribute', 'target_attribute', 'axis_attribute'))
            complete = (all(isinstance(ref, str) and ref for ref in binding[:2])
                and (binding[2] is None or isinstance(binding[2], str) and bool(binding[2])))
            scoped = all((execution_scope or {}).get(key) == value
                for key, value in sorted(claim.scope.items()))
            epoch_bindings = []
            for attribute, declaration in sorted(query.get('scope_attribute_bindings', {}).items()):
                value = claim.attributes.get(attribute)
                expected = declaration['value_prefix'] + str(value) if type(value) in (str, int) else None
                actual = (execution_scope or {}).get(declaration['scope_field'])
                epoch_bindings.append(FrozenMap({'attribute': attribute, 'value': value,
                    'expected_scope_ref': expected, 'current_scope_ref': actual,
                    'matches': expected is not None and expected == actual}))
            scoped = scoped and all(row['matches'] for row in epoch_bindings)
            current = (claim.polarity.value == 'positive'
                and claim.epistemic_status.value in query['epistemic_status_refs']
                and not claim.active_contradictions and not claim.defeated_by
                and (claim.valid_through_state_revision is None
                     or claim.valid_through_state_revision >= snapshot.revision))
            condition_rows = []
            for ref in claim.conditions:
                condition = snapshot.claim(ref)
                condition_current = bool(condition is not None
                    and condition.polarity.value == 'positive' and condition.disposition.value == 'active'
                    and condition.epistemic_status.value in query['condition_epistemic_status_refs']
                    and not condition.active_contradictions and not condition.defeated_by
                    and (condition.valid_through_state_revision is None
                         or condition.valid_through_state_revision >= snapshot.revision)
                    and all((execution_scope or {}).get(key) == value for key, value in sorted(condition.scope.items())))
                condition_rows.append(FrozenMap({'ref': ref, 'digest': stable_digest(condition),
                    'current': condition_current}))
            qualified = (complete and current and scoped and binding[0] != binding[1]
                and all(row['current'] for row in condition_rows))
            if qualified:
                bindings.add(binding)
            participants.update(ref for ref in binding[:2] if isinstance(ref, str) and ref)
            rows.append(FrozenMap({'claim_ref': claim.id, 'claim_digest': stable_digest(claim),
                'query_digest': stable_digest(query), 'binding': binding,
                'qualified': qualified, 'current': current, 'complete': complete,
                'scope_matches': scoped, 'epoch_bindings': tuple(epoch_bindings),
                'condition_rows': tuple(condition_rows)}))
    return FrozenMap({'goal_ref': goal_ref,
        'evidence_rows': tuple(sorted(rows, key=lambda row: (row['claim_ref'], row['query_digest']))),
        'bindings': tuple(sorted(bindings, key=stable_digest)), 'participant_refs': tuple(sorted(participants)),
        'all_evidence_qualified': bool(rows) and all(row['qualified'] for row in rows)})
