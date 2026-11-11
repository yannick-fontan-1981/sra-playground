#!/usr/bin/env python3
"""Focused v3 transport checks using the unchanged v2 TEMP exercise bodies."""
import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from datetime import datetime, timezone

HERE=Path(__file__).resolve().parent
WRAPPER=HERE/'run-bounded-command.py'
V2=HERE.parent/'coordination-tools-v2'
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec);sys.modules[name]=value;spec.loader.exec_module(value);return value

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',type=Path,required=True);args=parser.parse_args()
    if args.report.exists():raise SystemExit('Refusing to overwrite test evidence.')
    harness=load('retained_v2_transport_harness',V2/'test_bounded_locked_command.py')
    api=load('bounded_v3_transport_api',WRAPPER)
    harness.WRAPPER=WRAPPER
    runner=harness.RUNNER
    old="cwd=pathlib.Path(config['cwd']), lock_path=pathlib.Path(config['lock']),"
    assert old in runner;runner=runner.replace(old,"cwd=pathlib.Path(config['cwd']),")
    old=",\n    _after_lock=change if config.get('after_lock') else None"
    assert old in runner;runner=runner.replace(old,'')
    injection="""
for status_path in statuses:
    state=json.loads(status_path.read_text())
    state.update(quiet_requested=True,performance_started=False,heavy_execution_active=True,
                 publication_started=True,publication_pending=True,
                 official_performance_active=config['mode']=='official_active')
    status_path.write_text(json.dumps(state))
import os as guarded_os
original_open=guarded_os.open
def deny_mutex_open(path,*args,**kwargs):
    if str(path)==config['lock'] or str(path).endswith('/performance.lock'):
        raise AssertionError('PERFORMANCE_MUTEX_MUST_NOT_BE_OPENED')
    return original_open(path,*args,**kwargs)
guarded_os.open=deny_mutex_open
"""
    needle='settings = module.Settings('
    assert needle in runner;runner=runner.replace(needle,injection+'\n'+needle)
    ast.parse(runner)
    report={'schema':'logos-engine.lot5c.bounded-command-v3-focused-tests.v1','status':'running',
            'startedAt':datetime.now(timezone.utc).isoformat(),'wrapper':harness.fingerprint(WRAPPER),
            'retainedExerciseSource':harness.fingerprint(V2/'test_bounded_locked_command.py'),
            'fullEighteenCaseSuiteReexecuted':False,'actualNodeOrGitHelpersExecuted':False,
            'productionPerformanceMutexOpenedOrAcquired':False,'publicationExecuted':False,
            'cases':[],'predicateChecks':[]}
    old_subreaper=api.set_subreaper(True)
    try:
        cases=[
            {'name':'ordinary_success_with_temp_ex_and_prospective_publication', 'held_ex':True, 'exit':0, 'status':'passed', 'locked':False},
            {'name':'nonzero_cleanup_with_temp_ex', 'mode':'nonzero','held_ex':True,'exit':1,'reason':'child_exit_nonzero','locked':False},
            {'name':'timeout_descendant_cleanup_with_temp_ex', 'mode':'tree','held_ex':True,'work_timeout':True,'exit':124,'reason':'work_timeout','locked':False},
            {'name':'actual_official_performance_blocks_before_input', 'mode':'official_active','initial_quiet':True,'exit':75,'reason':'official_performance_window_active','locked':False,'child':False},
        ]
        with tempfile.TemporaryDirectory(prefix='lot5-command-v3-focused-') as temporary:
            folder=Path(temporary);run_path=folder/'runner.py';run_path.write_text(runner)
            fake=folder/'fake_helper.py';fake.write_text(harness.FAKE)
            for case in cases:
                api.coordination_clear(tuple(api.COORDINATION/(lane+'-status.json') for lane in api.LANES))
                result=harness.exercise(folder,case,run_path,fake)
                result['checks'].append({'name':'performance_mutex_not_accessed','passed':result['receipt'].get('performanceMutexAccessed') is False})
                result['checks'].append({'name':'publication_mutex_not_imposed_on_ordinary_transport','passed':result['receipt'].get('publicationMutexManagedHere') is False})
                result['passed']=all(row['passed'] for row in result['checks'])
                report['cases'].append(result)
                print(json.dumps({'case':case['name'],'passed':result['passed']}),flush=True)
                if not result['passed']:raise RuntimeError('focused_case_failed')
        table=[
            ('omitted_fields_are_not_active',{},False),
            ('prospective_quiet_heavy_tests_and_publication_are_not_active',{'quiet_requested':True,'heavy_execution_active':True,'publication_started':True,'publication_pending':True},False),
            ('explicit_active_wins_over_old_release',{'official_performance_active':True,'quiet_released':True},True),
            ('explicit_inactive_wins_over_historical_start',{'official_performance_active':False,'performance_started':True,'quiet_released':False},False),
            ('legacy_started_without_release_is_active',{'performance_started':True},True),
            ('legacy_started_with_explicit_release_is_inactive',{'performance_started':True,'quiet_released':True},False),
            ('null_primary_uses_legacy_fallback',{'official_performance_active':None,'performance_started':True},True),
        ]
        for name,value,expected in table:
            report['predicateChecks'].append({'name':name,'passed':api.official_performance_active(value) is expected})
        rejected=False
        try:api.official_performance_active({'official_performance_active':'true'})
        except api.Stopped:rejected=True
        report['predicateChecks'].append({'name':'malformed_authoritative_active_flag_refuses','passed':rejected})
        text=WRAPPER.read_text();tree=ast.parse(text)
        report['predicateChecks'].append({'name':'no_performance_mutex_literal_or_flock_call','passed':'performance.lock' not in text and not any(isinstance(n,ast.Attribute) and n.attr=='flock' for n in ast.walk(tree))})
        v2raw=(V2/'run-bounded-locked-command.py').read_bytes()
        report['predicateChecks'].append({'name':'v2_source_unchanged','passed':hashlib.sha256(v2raw).hexdigest()=='1cf15ba630657b8fe83bd81c98071b0b67965a93a5caa211a568655df338e3a6'})
        report['status']='passed' if all(x['passed'] for x in report['predicateChecks']) and len(report['cases'])==4 else 'failed'
    except BaseException as error:
        report['status']='failed';report['failureClass']=type(error).__name__
        report['failureCode']='focused_case_failed' if str(error)=='focused_case_failed' else 'focused_harness_error'
    finally:
        api.set_subreaper(old_subreaper)
        report['finishedAt']=datetime.now(timezone.utc).isoformat()
        report['totalChecks']=sum(len(row['checks']) for row in report['cases'])+len(report['predicateChecks'])
        report['passedChecks']=sum(check['passed'] for row in report['cases'] for check in row['checks'])+sum(check['passed'] for check in report['predicateChecks'])
        raw=json.dumps(report,indent=2)+'\n';assert harness.DUMMY not in raw
        with args.report.open('x') as stream:stream.write(raw)
    print(json.dumps({'status':report['status'],'cases':len(report['cases']),'passedChecks':report['passedChecks'],'totalChecks':report['totalChecks']}),flush=True)
    return 0 if report['status']=='passed' else 1

if __name__=='__main__':raise SystemExit(main())
