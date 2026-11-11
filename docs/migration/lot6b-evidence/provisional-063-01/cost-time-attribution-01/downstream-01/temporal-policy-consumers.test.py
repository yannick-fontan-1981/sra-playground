#!/usr/bin/env python3
"""Prepared synthetic policy tests; no capture, native runtime or cost executes."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE.parents[2]
CORPUS = json.loads((HERE / 'synthetic-policy-cases.json').read_text())
CONSUMERS = ('finalize-owner-cost-contract.py', 'check-cost-static-inputs.py', 'review-owner-costs.py')


def modified(case):
    data = copy.deepcopy(CORPUS['base'])
    for edit in case['edits']:
        target = data
        path = edit['path']
        for key in (path if edit['op'] == 'append' else path[:-1]):
            target = target[key]
        if edit['op'] == 'set':
            target[path[-1]] = copy.deepcopy(edit['value'])
        elif edit['op'] == 'remove':
            del target[path[-1]]
        elif edit['op'] == 'append':
            target.append(copy.deepcopy(edit['value']))
        else:
            raise ValueError('Unknown test edit')
    return data


class LocalTemporalPolicyTests(unittest.TestCase):
    pass


for ordinal, filename in enumerate(CONSUMERS):
    spec = importlib.util.spec_from_file_location('lot6b_downstream_' + str(ordinal), EVIDENCE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    validator = module.validate_common_value_attribution
    for case in CORPUS['cases']:
        def make_test(validate, scenario):
            def run(self):
                data = modified(scenario)
                retained = copy.deepcopy(data)
                if scenario['accept']:
                    self.assertIs(validate(data['attribution'], data['receipts'], data['fixture']), True)
                else:
                    with self.assertRaises(Exception):
                        validate(data['attribution'], data['receipts'], data['fixture'])
                self.assertEqual(data, retained, 'Validator must not normalize or change its evidence')
            return run
        setattr(LocalTemporalPolicyTests, 'test_' + str(ordinal) + '_' + case['name'], make_test(validator, case))


if __name__ == '__main__':
    unittest.main()
