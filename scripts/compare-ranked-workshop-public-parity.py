#!/usr/bin/env python3
"""Replay captured public workshop calls through one cold original Python owner.

The main trajectory never restores captured native state.  Independent causal
ablations start from the original replay's own states and cannot change the
trajectory.  The final-frame question is an offline diagnostic, not an action.
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.dont_write_bytecode = True
BYTECODE = tempfile.TemporaryDirectory(prefix='workshop-public-parity-')
sys.pycache_prefix = BYTECODE.name


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value


def canonical(value):
    return json.dumps(plain(value), sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def differences(expected, actual, path='$', limit=30):
    expected, actual = plain(expected), plain(actual)
    if canonical(expected) == canonical(actual): return []
    if isinstance(expected, dict) and isinstance(actual, dict):
        out=[]
        for key in sorted(expected.keys() | actual.keys()):
            if key not in expected or key not in actual:
                out.append({'path':path+'.'+key,'expected':expected.get(key,'<absent>'),'actual':actual.get(key,'<absent>')})
            else: out += differences(expected[key],actual[key],path+'.'+key,limit-len(out))
            if len(out)>=limit:break
        return out
    if isinstance(expected,list) and isinstance(actual,list):
        out=[]
        if len(expected)!=len(actual):out.append({'path':path+'.length','expected':len(expected),'actual':len(actual)})
        for index,(a,b) in enumerate(zip(expected,actual)):
            out += differences(a,b,path+'['+str(index)+']',limit-len(out))
            if len(out)>=limit:break
        return out
    return [{'path':path,'expected':expected,'actual':actual}]


def decision(value):
    if value is None:return None
    plan=value.get('workshop_plan',{});extension=plan.get('extension') or {}
    return {'kind':value.get('kind'),'actions':value.get('actions'),'rule':plan.get('rule_ref'),'stage':plan.get('stage'),
        'extensionKind':extension.get('kind'),'methodRef':extension.get('method_ref'),
        'supportRef':extension.get('support',{}).get('ref'),'objectiveKey':extension.get('objective_key')}


def write(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    data=(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':') if path.suffix=='.gz' else None,
                     indent=None if path.suffix=='.gz' else 2,allow_nan=False)+'\n').encode()
    path.write_bytes(gzip.compress(data,mtime=0) if path.suffix=='.gz' else data)
    return {'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--report',default='docs/migration/lot7a-evidence/attempt1/lkey-campaign.json.gz')
    parser.add_argument('--out-dir',default='docs/migration/lot7a-evidence/diagnostic')
    parser.add_argument('--label',default='attempt1')
    args=parser.parse_args();started=time.monotonic()
    report_path=ROOT/args.report;out_dir=ROOT/args.out_dir
    report=json.load(gzip.open(report_path,'rt')) if report_path.suffix=='.gz' else json.loads(report_path.read_text())
    manifest=json.loads((SOURCE.parent/'manifest.json').read_text())['files']
    def verify():
        for name,record in manifest.items():
            assert hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()==record['sha256'],name
    verify()
    sys.path[:0]=[str(SOURCE),str(SOURCE/'agents/yf_arc3_v6/laya_proto')]
    from agents.yf_arc3_v6.morphology_policy.ranked_workshop.family import RankedWorkshop
    from agents.yf_arc3_v6.morphology_policy.ranked_workshop import geometry,methods
    owner=RankedWorkshop()
    assert owner.state()['epoch'] is None and not any(v for k,v in owner.state().items() if k!='epoch')
    selected_revisions={p['decisionRevision'] for p in report['prefixes'] if p['family']=='public_ranked_workshop'}
    calls=report['workshopSourceCalls'];rows=[];ablations=[];selected=[];record_counts=Counter();transition_counts=Counter();first_passive_activation=None
    field_layers=['mode_evidence','mode_methods','input_effects','operator_observations','method_refutations','rejected','events']
    for index,call in enumerate(calls):
        assert call['index']==index
        before=plain(owner.state());arguments=copy.deepcopy(call['arguments'])
        source_method={'proposeSource':'propose','recordSource':'record'}[call['method']]
        value=plain(getattr(owner,source_method)(*arguments));after=plain(owner.state())
        checks={'beforeState':canonical(before)==canonical(call['sourceBefore']),
            'returnValue':canonical(value)==canonical(call['result']),
            'afterState':canonical(after)==canonical(call['sourceAfter'])}
        result={'index':index,'method':call['method'],'checks':checks,'matched':all(checks.values()),
            'beforeSha256':digest(before),'resultSha256':digest(value),'afterSha256':digest(after),
            'observationRevision':arguments[0]['revision'],'epoch':arguments[0]['level_epoch'],
            'decision':decision(value) if call['method']=='proposeSource' else None,
            'differences':{key:differences(expected,actual) for key,expected,actual in [
                ('beforeState',call['sourceBefore'],before),('returnValue',call['result'],value),('afterState',call['sourceAfter'],after)] if canonical(expected)!=canonical(actual)}}
        rows.append(result)
        if call['method']=='recordSource':
            active=len(arguments)>5 and arguments[5] is not None and 'workshop_plan' in arguments[5]
            record_counts['active' if active else 'passive']+=1
            transition_counts[(arguments[0]['observation_ref'],arguments[1]['observation_ref'])]+=1
            if not active and not before['mode_evidence'] and after['mode_evidence'] and first_passive_activation is None:
                first_passive_activation={'callIndex':index,'beforeRevision':arguments[0]['revision'],'afterRevision':arguments[1]['revision'],
                    'command':arguments[2],'event':value,'sourceMethod':after['mode_methods'][-1] if after['mode_methods'] else None}
            continue
        if value is None or arguments[0]['revision'] not in selected_revisions:continue
        item={'callIndex':index,'revision':arguments[0]['revision'],'epoch':arguments[0]['level_epoch'],
            'decision':decision(value),'knowledgeBefore':{k:len(before[k]) for k in field_layers},
            'proposalSha256':digest(value),'sourceStateSha256':digest(before)}
        selected.append(item)
        for layer in [*field_layers,'all_learned_layers']:
            counterfactual=RankedWorkshop();state=copy.deepcopy(before)
            for key in field_layers if layer=='all_learned_layers' else [layer]:state[key]=[]
            counterfactual.restore(state)
            try:
                alternative=plain(counterfactual.propose(*copy.deepcopy(arguments)))
                if alternative==value:classification='unchanged'
                elif alternative is None:classification='proposal_removed'
                elif decision(alternative)!=decision(value):classification='decision_changed'
                else:classification='same_decision_different_evidence'
                ablations.append({**item,'removedLayer':layer,'classification':classification,
                    'result':alternative,'resultSha256':digest(alternative),'alternativeDecision':decision(alternative)})
            except Exception as error:
                ablations.append({**item,'removedLayer':layer,'classification':'source_refusal',
                    'error':{'name':type(error).__name__,'message':str(error)}})
    # The last actual returned packet is carried by the last recorded source
    # transition; never synthesize another frame or dispatch a diagnostic input.
    last_record=next(c for c in reversed(calls) if c['method']=='recordSource')
    final_obs=copy.deepcopy(last_record['arguments'][1]);final_rows=copy.deepcopy(last_record['arguments'][4])
    final_state=plain(owner.state());final_scene,final_context=geometry.project(final_obs,final_rows,owner.config)
    latest_inputs=next(c['arguments'][2] for c in reversed(calls) if c['method']=='proposeSource')
    inputs=[copy.deepcopy(x) for x in latest_inputs if x['action_ref'] in final_obs['available_action_refs']]
    for action in final_obs['available_action_refs']:
        if action!='ACTION6' and not any(x['action_ref']==action for x in inputs):inputs.append({'action_ref':action})
    # Use the remaining native action bound from the last captured call. This
    # is a hypothetical source question, not a claim that the caller reached it.
    remaining=next(c['arguments'][3] for c in reversed(calls) if c['method']=='proposeSource')
    diagnostic=RankedWorkshop();diagnostic.restore(copy.deepcopy(final_state))
    final_offer=plain(diagnostic.propose(copy.deepcopy(final_obs),copy.deepcopy(final_rows),inputs,remaining))
    extensions=plain(methods.extension_options(owner,final_obs,final_rows,final_scene,final_context,inputs,remaining)) if final_context else []
    final_diagnostic={'observation':final_obs,'sourceState':final_state,'frameRows':final_rows,'projectedContext':plain(final_context),
        'comparisonDomain':plain(final_scene.get('comparison_domain')),'extensions':extensions,'inputs':inputs,'remaining':remaining,
        'hypotheticalProposal':final_offer,'hypotheticalDecision':decision(final_offer),
        'capturedProposeCallsAtFinalEpoch':sum(c['method']=='proposeSource' and c['arguments'][0]['level_epoch']==final_obs['level_epoch'] for c in calls),
        'qualification':'Offline original-owner question on the last real returned public packet and independently replayed memory. No new game observation or physical action; no native state injected.'}
    verify()
    source_hashes={name:record['sha256'] for name,record in manifest.items() if
        '/ranked_workshop/' in name or name.endswith('/station_profile_scene.py') or name.endswith('/stem_reliefs.py') or name.endswith('/station_profile_workbench.py')}
    report_proof={'path':report_path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(report_path.read_bytes()).hexdigest(),
        'sourceDigest':report['source']['digest'],'sourceUnchangedDuringRun':report['sourceUnchangedDuringRun'],
        'game':report['game'],'actions':len(report['actions']),'levelsCompleted':report['final']['levelsCompleted'],
        'status':report['status'],'reason':report['final']['reason'],'elapsedSeconds':report['elapsedSeconds']}
    contribution={'schema':'logos-engine.v6.ranked-workshop-public-contribution.v1','referenceCommit':COMMIT,'campaign':report_proof,
        'trajectoryStateOrigin':'One cold original Python owner; native sourceBefore/sourceAfter are comparison targets only.',
        'firstPassiveActivation':first_passive_activation,'records':dict(record_counts),
        'feedbackUniqueness':{'physicalActions':len(report['actions']),'recordCalls':sum(record_counts.values()),
            'distinctObservedTransitions':len(transition_counts),'duplicates':[{'before':a,'after':b,'count':n} for (a,b),n in transition_counts.items() if n!=1]},
        'selectedWorkshopProposals':selected,
        'selectedWorkshopCount':len(selected),'ablationScope':'Independent component counterfactuals from original replay state, holding the observed public situation fixed. No altered game replay or solved-level causal claim.',
        'ablationCounts':{layer:dict(Counter(r['classification'] for r in ablations if r['removedLayer']==layer)) for layer in [*field_layers,'all_learned_layers']},
        'ablations':ablations,'finalPublicPacketDiagnostic':final_diagnostic}
    contribution_receipt=write(out_dir/'contribution.json.gz',contribution)
    parity={'schema':'logos-engine.v6.ranked-workshop-public-parity.v1','referenceCommit':COMMIT,'campaign':report_proof,
        'sourceFilesVerifiedBeforeAndAfter':len(manifest),'sourceModified':False,'sourceHashes':source_hashes,
        'nativeSourceStatesInjected':0,'initialOwner':'fresh RankedWorkshop()','callCount':len(rows),
        'matchedCalls':sum(r['matched'] for r in rows),'failedCalls':sum(not r['matched'] for r in rows),
        'exactChecks':sum(sum(r['checks'].values()) for r in rows),'totalChecks':len(rows)*3,
        'calls':rows,'contributionReceipt':contribution_receipt,'selectedWorkshopCount':len(selected),
        'finalDiagnosticSummary':{'epoch':final_obs['level_epoch'],'revision':final_obs['revision'],
            'capturedProposeCallsAtFinalEpoch':final_diagnostic['capturedProposeCallsAtFinalEpoch'],
            'hypotheticalDecision':decision(final_offer),'activationModeEvidenceCount':len(final_state['mode_evidence']),
            'portableMethodCount':len(final_state['mode_methods']),'projectionAdmissible':bool(final_context),
            'extensionKinds':[e['kind'] for e in extensions]},
        'elapsedSeconds':time.monotonic()-started}
    parity_receipt=write(out_dir/(args.label+'-public-parity.json'),parity)
    print(json.dumps({'parity':parity_receipt,'contribution':contribution_receipt,'calls':len(rows),
        'matched':parity['matchedCalls'],'failed':parity['failedCalls'],'selected':len(selected),
        'records':dict(record_counts),'ablations':contribution['ablationCounts'],
        'finalDiagnostic':parity['finalDiagnosticSummary'],'elapsedSeconds':parity['elapsedSeconds']}))


if __name__=='__main__':main()
