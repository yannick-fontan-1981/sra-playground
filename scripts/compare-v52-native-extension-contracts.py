#!/usr/bin/env python3
"""Record separate, frozen phased/direct-composition component comparisons.

Expected outputs are generated with unchanged Python primitives and explicit
native specifications before a pure native helper is run. No host or physical
command is run. --verify recomputes only Python expectations against the retained
native output and executes no native helper, agent, tests or game.
"""
from __future__ import annotations
import argparse
import copy
import gzip
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v52_extension_comparison', ROOT/'scripts/compare-v52-final-framed-public-evidence.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
HISTORICAL = ROOT/'docs/migration/native-campaigns-v52/attempt8'
RUNNER = ROOT/'scripts/measure-v52-native-extension-contracts.mjs'
SPECIFICATIONS = [Path(__file__), RUNNER, ROOT/'scripts/compare-v52-final-framed-public-evidence.py',
    ROOT/'scripts/measure-v52-native-receptions.py', ROOT/'scripts/measure-v52-native-phased-receptions.py',
    ROOT/'scripts/measure-v52-native-uniform-questions.py', ROOT/'scripts/measure-v52-native-directed-composition.py']

def json_bytes(value): return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()
def read_inputs():
    report_path, trace_path = HISTORICAL/'gare-three-levels.json', HISTORICAL/'gare-public-trace.json.gz'
    report, trace = m.load(report_path), m.load(trace_path)
    assert report['status'] == 'failed' and report['final']['actions'] == 86 and report['final']['levelsCompleted'] == 2
    first = next(prefix['framedTransfer'] for prefix in report['prefixes'] if prefix.get('framedTransfer'))
    scope = m.OBSERVATION_REF.fullmatch(first['proposal']['binding']['observation_ref']).group(1)
    observations = {index: m.observe(m.SimpleNamespace(**trace['packets'][index]['packet']), index+1, scope)[0] for index in [9,16,17,49,51]}
    return report, trace, observations, {'report': m.proof(report_path), 'trace': m.proof(trace_path),
        'sourceArchive': m.proof(ROOT/'docs/migration/native-campaigns-v52/history/0fb602-source-test-code.json')}

def packet_measurements(policy, trace, observations):
    first, final = trace['packets'][16]['packet'], trace['packets'][17]['packet']
    arguments = {'first': first['frame_rows'], 'final': final['frame_rows'], 'before': observations[16], 'after': observations[17],
        'command': trace['packets'][17]['command'], 'frames': final['frame_packet']}
    stationary = m.reception_spec.measure_current_public_packet_receptions(**arguments, policy=policy)
    phased = m.phased_spec.measure_current_phased_public_packet_receptions(**arguments, policy=policy)
    assert stationary['complete'] and phased['complete']
    records, annex = [], []
    for domain, measurement in [('stationary', stationary), ('phased_directed_only', phased)]:
        for row in measurement['rows']:
            result, workflow = policy.record('policy.record_observed_framed_replacement', row['facts'])
            assert result['status'] == 'derived'
            records.append(m.plain({'domain': domain, 'result': result, 'workflow': workflow}))
            record = m.plain({**result['record'], 'evidence': [observations[16]['observation_ref'], observations[17]['observation_ref']],
                'derivation': {'policy': result['policy_ref'], 'rule': result['rule_ref'], 'event': result['event_ref'], 'workflow': workflow},
                'native_packet_witness': row['packet_witness']})
            if row['packet_witness'].get('native_directed_composition_only') is True: record['native_directed_composition_only'] = True
            annex.append(record)
    return arguments, {'stationary': stationary, 'phased_directed_only': phased, 'projectedRecords': records}, annex

def build_reference(kind):
    report, trace, observations, inputs = read_inputs()
    family, projected = m.FramedTransfer(), m.FramedTransfer()
    arguments, packets, annex_records = packet_measurements(family.policy, trace, observations)
    old_annex = m.source_projection(report['prefixes'][16]['framedAcquisition']['nativeCheckpoint']['public_packet_receptions']['receipts'], 'historical.packet17.annex')
    m.check([record for record in annex_records if not m.directed_only(record)], old_annex, 'historical.stationary.recomputed')
    common = {'schema': 'logos-engine.v52.native-extension-contract-reference.v1', 'kind': kind, 'referenceCommit': m.helper.COMMIT,
        'actualInputEvidence': inputs, 'newHostRuns': 0, 'newActionsDispatched': 0, 'newCompletedLevels': 0,
        'expectedOutputsDerivedFromNativeResults': False, 'originalSourceModified': False}
    if kind == 'phased':
        return {**common, 'arguments': arguments, 'expected': packets,
            'qualification': 'The two expected measurement domains and four original SRC record projections are independently computed from one earlier actual public return. Contextual appearance is not global component identity, and the phased receipt is directed-only.'}
    cases, expected_cases = [], []
    for index in [9,17,49,51]:
        state = m.source_projection(report['prefixes'][index-1]['framedAcquisition']['sourceState'], f'controlled.{index}.sourceState')
        obs, packet = observations[index], trace['packets'][index]['packet']; family.restore(state)
        annex = {**m.empty_packet_state(obs['level_epoch']), 'receipts': copy.deepcopy(annex_records) if index >= 17 else []}
        checkpoint = {'format': 'native.public_framed_transfer.v2', 'source_state': state, 'public_packet_receptions': annex}
        projected_state = copy.deepcopy(state)
        projected_state['receipts'] += [record for record in annex['receipts'] if not m.directed_only(record)]
        projected.restore(projected_state)
        source_offers = m.g.candidates(packet['frame_rows'], obs, family.policy, family.spans, projected.receipts, family.attempts)
        proposal, _, measurements = m.native_expected_proposal(projected, annex, obs, packet['frame_rows'], 600, 'propose')
        assert proposal
        source_guard = m.plain(family.before(proposal, 0, m.SimpleNamespace(**packet), obs))
        plan = proposal['framed_transfer_plan']
        if plan.get('native_directed_receiver_composition'):
            receipt = m.directed_binding_receipt(projected, annex, proposal, packet, obs, source_guard, 0)
            native_guard = {'admitted': True, 'reason': 'native_current_directed_receiver_composition_bound', 'native_binding_receipt': receipt}
        elif plan.get('native_uniform_reception_question'):
            receipt = m.uniform_binding_receipt(projected, annex, proposal, packet, obs, source_guard, 0)
            native_guard = {'admitted': True, 'reason': 'native_current_uniform_reception_question_bound', 'native_binding_receipt': receipt}
        elif plan.get('native_public_packet_reception'):
            receipt = m.packet_binding_receipt(projected, annex, proposal, packet, obs, source_guard)
            native_guard = {'admitted': True, 'reason': 'native_current_packet_reception_question_bound', 'native_binding_receipt': receipt}
        elif not source_guard['admitted']:
            receipt = m.current_binding_receipt(family, proposal, packet, obs, source_guard)
            native_guard = {'admitted': True, 'reason': 'native_current_framed_point_witness_bound', 'native_binding_receipt': receipt}
        else: native_guard = source_guard
        cases.append({'afterActualAction': index, 'observation': obs, 'publicPacket': packet, 'checkpoint': checkpoint})
        expected_cases.append(m.plain({'afterActualAction': index, 'sourceOffers': source_offers,
            'uniform': measurements['uniform'], 'directed': measurements['directed'], 'proposal': proposal,
            'sourceGuard': source_guard, 'nativeGuard': native_guard, 'sourceStateAfter': state, 'nativeCheckpointAfter': checkpoint}))
    return {**common, 'cases': cases, 'expected': {'cases': expected_cases},
        'qualification': 'Controlled queries of retained six-field checkpoints, with prior packet17 observations recomputed independently. The checkpoints are inputs to the current-question contract; this is not an independent replay of their preceding campaign. No restored memory is supplied to a cold game. Every native proposal field, strict source guard, native guard and unchanged query state is compared.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kind', choices=['phased', 'directed'], required=True)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args(); directory = ROOT/args.directory
    source_path = directory/'source-manifest.json'; source = m.load(source_path)
    m.check(m.native_inventory(), source['files'], 'native.frozen.before')
    assert source['fileCount'] == len(source['files']) and source['digest'] == m.digest(source['files'])
    before = m.helper.verify_source_manifest(); code_before = {path.relative_to(ROOT).as_posix(): m.sha(path) for path in SPECIFICATIONS}
    stem = 'phased-reception-contract' if args.kind == 'phased' else 'directed-composition-contract'
    reference_path, native_path, report_path = [directory/(stem+suffix) for suffix in ['-reference.json.gz', '-native.json.gz', '-comparison.json']]
    if not args.verify:
        assert not any(path.exists() for path in [reference_path, native_path, report_path]), 'A retained comparison cannot be overwritten'
    reference = build_reference(args.kind)
    command = ['node', str(RUNNER), args.kind, str(reference_path)]
    if args.verify:
        retained = m.load(report_path); assert retained['status'] == 'passed'
        m.check(m.load(reference_path), reference, 'independent.reference.recomputed')
        actual = m.load(native_path)
    else:
        reference_path.write_bytes(gzip.compress(json_bytes(reference), mtime=0))
        process = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if process.returncode:
            raise RuntimeError('Pure native measurement failed: '+process.stderr.decode()[-6000:])
        actual = json.loads(process.stdout); native_path.write_bytes(gzip.compress(json_bytes(actual), mtime=0))
    m.ANNOTATIONS.clear()
    expected_hash = m.own_check(actual, reference['expected'], args.kind+'.native')
    assert before == m.helper.verify_source_manifest()
    m.check(m.native_inventory(), source['files'], 'native.frozen.after')
    assert code_before == {path.relative_to(ROOT).as_posix(): m.sha(path) for path in SPECIFICATIONS}
    if args.kind == 'phased':
        summary = {'stationaryReceipts': len(actual['stationary']['rows']), 'phasedDirectedOnlyReceipts': len(actual['phased_directed_only']['rows']),
            'stationaryWork': actual['stationary']['work_count'], 'phasedWork': actual['phased_directed_only']['work_count'],
            'originalSrcRecordProjections': len(actual['projectedRecords'])}
    else:
        summary = {'controlledQueries': len(actual['cases']), 'queries': [{'afterActualAction': item['afterActualAction'],
            'directedOffers': len(item['directed']['offers']) if item['directed'] is not None else 0,
            'command': item['proposal']['actions'][0], 'strictSourceGuard': item['sourceGuard'], 'nativeGuardReason': item['nativeGuard']['reason']} for item in actual['cases']]}
    result = {'schema': 'logos-engine.v52.native-extension-contract-comparison.v1', 'status': 'passed', 'kind': args.kind,
        'referenceCommit': m.helper.COMMIT, 'nativeSourceDigest': source['digest'], 'nativeSourceFiles': source['fileCount'],
        'sourceManifest': m.proof(source_path), 'sourceUnchangedBeforeAfter': True, 'pinnedSourceFilesVerifiedBeforeAfter': len(before),
        'effectiveSourceImports': m.helper.source_hashes(), 'specificationAndRunnerHashes': code_before,
        'generator': m.proof(Path(__file__)), 'nativeRunner': m.proof(RUNNER), 'command': command,
        'reference': m.proof(reference_path), 'retainedNativeOutput': m.proof(native_path), 'summary': summary,
        'nativeSourceProjectionSha256': expected_hash, 'srcReceiptAnnotations': m.ANNOTATIONS,
        'qualification': {'nativeExpectedResultsUsed': False, 'unchangedOriginalAgentCapabilityClaimed': False,
            'gameHostRun': False, 'newPhysicalActions': 0, 'newCompletedLevels': 0, 'controlledRestoredMemoryNotColdCampaignInput': True,
            'verifyExecutesNativeCode': False, 'onlyExplicitSrcWorkflowAnnotationsExcluded': sorted(m.NATIVE_RECEIPT_KEYS),
            'scope': reference['qualification']}}
    if args.verify: m.check(retained, result, 'comparison.recomputed')
    else: report_path.write_text(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False)+'\n')
    print(json.dumps({'status': 'passed', 'kind': args.kind, 'mode': 'verify' if args.verify else 'create', **summary}))

if __name__ == '__main__': main()
