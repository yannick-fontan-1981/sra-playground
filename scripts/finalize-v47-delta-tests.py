#!/usr/bin/env python3
"""Finalize unchanged tests plus one explicitly scoped provenance recheck.

The initial 664 functional checks passed. One test file received an additional
archive-provenance assertion during that run, so its input-freeze gate correctly
failed. Preserve that evidence and rerun only the changed file; never relabel
the initial run as frozen or pretend all tests ran together afterwards.
"""
from __future__ import annotations
import datetime
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v47/validation'
TEST = 'tests/v6-linked-packet-reference.test.ts'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def evidence(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def inputs():
    return {p.relative_to(ROOT).as_posix():sha(p) for folder in ['tests','src']
            for p in sorted((ROOT/folder).rglob('*')) if p.is_file()}
def names(text): return re.findall(r'^# Subtest: (.+)$', text, re.M)
def counts(text): return {key:int(re.search(r'^# '+key+r' (\d+)\s*$',text,re.M).group(1))
                         for key in ['tests','pass','fail','cancelled','skipped','todo']}
def main():
    destination=OUT/'delta-tests-final.json'; log=OUT/'linked-reference-final-recheck.log.gz'
    if destination.exists() or log.exists(): raise FileExistsError('Final delta receipt already exists')
    original_path=OUT/'delta-tests-run.json'; original=json.loads(original_path.read_text())
    assert original['exitCode']==0 and original['counts']['tests']==original['counts']['pass']==664
    assert original['nativeSourceUnchanged'] and original['status']=='failed'
    assert original['sourceAndTestInputsUnchanged'] is False
    before=inputs(); prior=original['sourceAndTestInputs']
    assert set(before)==set(prior)
    changed=[path for path in before if before[path]!=prior[path]]
    assert changed==[TEST], changed
    spec=importlib.util.spec_from_file_location('campaign_proof47', ROOT/'scripts/run-v47-campaign-proof.py')
    proof=importlib.util.module_from_spec(spec);spec.loader.exec_module(proof)
    source=proof.native_source(); assert source==original['nativeSource']==json.loads((OUT.parent/'source-manifest.json').read_text())
    initial_log=ROOT/original['output']['path'];assert evidence(initial_log)==original['output']
    initial_names=names(gzip.decompress(initial_log.read_bytes()).decode())
    assert len(initial_names)==664 and len(set(initial_names))==664
    command=['node','--test','--test-concurrency=1','--test-reporter=tap',TEST]
    start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic()
    run=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    log.write_bytes(gzip.compress(run.stdout,mtime=0));text=run.stdout.decode();rerun_counts=counts(text);rerun_names=names(text)
    after=inputs();source_after=proof.native_source()
    assert run.returncode==0 and rerun_counts['tests']==rerun_counts['pass']==55
    assert not any(rerun_counts[k] for k in ['fail','cancelled','skipped','todo'])
    assert len(rerun_names)==55 and len(set(rerun_names))==55
    assert set(rerun_names)<=set(initial_names)
    assert before==after and source==source_after
    unchanged_names=[name for name in initial_names if name not in set(rerun_names)]
    assert len(unchanged_names)==609
    result={'schema':'logos-engine.v47.actual-delta-composite.v1','status':'passed',
        'validationMode':'unchanged-tests-plus-scoped-recheck','nativeSourceManifestDigest':source['digest'],
        'nativeSource':source,'nativeSourceAfter':source_after,'nativeSourceUnchanged':True,
        'initialExecution':evidence(original_path),'initialFreezeGatePassed':False,
        'initialFunctionalCounts':original['counts'],'testFiles':original['testFiles'],'testFileCount':17,
        'unchangedTestFiles':[path for path in original['testFiles'] if path!=TEST],
        'recheckedTestFiles':[TEST],'changedInputs':[{'path':TEST,'initialSha256':prior[TEST],'finalSha256':before[TEST]}],
        'initialUnchangedTestNames':unchanged_names,'recheckedTestNames':rerun_names,
        'counts':{'tests':664,'pass':664,'fail':0,'cancelled':0,'skipped':0,'todo':0},
        'actualExecutedTestCount':719,'sourceAndTestInputs':before,'sourceAndTestInputsAfter':after,
        'recheckSourceAndTestInputsUnchanged':True,
        'recheck':{'command':command,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'elapsedSeconds':time.monotonic()-clock,'exitCode':run.returncode,'counts':rerun_counts,'output':evidence(log)},
        'generator':evidence(Path(__file__)),
        'qualification':'664 distinct final checks are covered by 609 checks whose test/source/fixture bytes did not change plus 55 checks rerun from the sole changed reference test file. The initial 664/664 functional run and its failed test-input freeze gate remain intact. This is not one post-edit execution of all 664 tests and does not count repeated checks as new coverage.'}
    destination.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'status':'passed','finalDistinctChecks':664,'rechecked':55,'unchanged':609,'actualExecutedChecks':719,'initialFreezeGatePreserved':False}))
if __name__=='__main__':main()
