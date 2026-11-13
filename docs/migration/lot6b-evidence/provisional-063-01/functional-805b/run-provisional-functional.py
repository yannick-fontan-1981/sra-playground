#!/usr/bin/env python3
"""Bounded functional rehearsal only; no official cost declaration or window."""
from pathlib import Path
import datetime,hashlib,json,os,re,signal,subprocess,sys,time,traceback
ROOT=Path('/workspace/sites/sra-lot6b-20261111/.sites-checkout')
BASELINE=Path('/workspace/sites/sra-lot6b-baseline-063-20261111/.sites-checkout')
TOOLS=ROOT/'docs/migration/lot6b-evidence'
OUT=Path(__file__).resolve().parent
CANDIDATE=TOOLS/'provisional-063-01/frozen-candidate/source-manifest.json'
COORD=Path('/workspace/shared/sra-coordination')
PIN='805b30297dc1b715dbfd9f1197a9a8ba7b361b90'
NAMES=('lot10c-status.json','lot5c-status.json')
HELPERS=('record-owner-source-inventory.mjs','capture-cost-owner-graphs.mjs','qualify-cost-owner-graphs.mjs')
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def rel(path): return str(Path(path).resolve().relative_to(ROOT))
def sha(data): return hashlib.sha256(data).hexdigest()
def write(path,value):
 with Path(path).open('x') as stream: stream.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
def fingerprint(path):
 data=Path(path).read_bytes(); return {'path':rel(path),'bytes':len(data),'sha256':sha(data)}
def inventory(root):
 files=dict(sorted((p.relative_to(root).as_posix(),sha(p.read_bytes()))
  for folder in ('src/logos-engine','src/runtime') for p in (root/folder).rglob('*')
  if p.is_file() and p.suffix in ('.ts','.json','.drm')))
 return {'fileCount':len(files),'digest':sha(json.dumps(files,separators=(',',':')).encode()),'files':files}
def prepare():
 original=TOOLS.parent/'lot3h-evidence/performance/cases.json'
 raw=original.read_bytes(); cases=json.loads(raw)
 assert cases['rounds']==4 and [v['id'] for v in cases['cases']]==['STCK','SMLP']
 assert [v['actions'] for v in cases['cases']]==[10,15] and all(v['warmupActions']==3 for v in cases['cases'])
 with (OUT/'cases.json').open('xb') as stream: stream.write(raw)
 assert (OUT/'cases.json').read_bytes()==raw
 baseline=inventory(BASELINE); candidate=inventory(ROOT); frozen=json.loads(CANDIDATE.read_bytes())
 assert baseline['fileCount']==318 and baseline['digest'].startswith('a33'), baseline
 assert candidate==frozen and candidate['fileCount']==322 and candidate['digest'].startswith('fa23bb76')
 for source_root,version in ((BASELINE,'0.63.0'),(ROOT,'0.64.0')):
  text=(source_root/'src/logos-engine/v6-native-runtime.ts').read_text()
  assert re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]",text)==[version]
 baseline_path=OUT/'baseline-source-manifest.json'; write(baseline_path,baseline)
 assert json.loads(baseline_path.read_bytes())==baseline
 assert inventory(BASELINE)==baseline and inventory(ROOT)==candidate
 provenance={'schema':'logos-engine.lot6b-provisional-functional-preparation.v1','recordedAt':now(),
  'status':'provisional_sources_verified_no_published_baseline_claim',
  'baseline':{'checkout':str(BASELINE),'commitDeclaredByCoordinator':PIN,'gitExecuted':False,
   'publishedSiteVersion':None,'actualPublishedCommit':None,'nativeVersion':'0.63.0','nativeDigest':baseline['digest'],
   'nativeFiles':baseline['fileCount'],'manifest':fingerprint(baseline_path)},
  'candidate':{'checkout':str(ROOT),'nativeVersion':'0.64.0','nativeDigest':candidate['digest'],
   'nativeFiles':candidate['fileCount'],'frozenManifest':fingerprint(CANDIDATE)},
  'cases':{'source':fingerprint(original),'copy':fingerprint(OUT/'cases.json'),'byteIdentical':True},
  'helpers':[fingerprint(TOOLS/name) for name in HELPERS],
  'qualification':'Untimed functional rehearsal against the coordinator-identified provisional 805b source. Native bytes and 318/322 inventories verified; publication is not inferred. No protocol, contract, readiness or official cost window created.'}
 write(OUT/'provenance.json',provenance)
 with (OUT/'README.md').open('x') as stream:
  stream.write('# Préparation fonctionnelle provisoire 805b\n\nBaseline 805b/a33 provisoire ; candidat fa23/322. Aucun Site publié n’est déclaré. Les manifestes natifs et la copie exacte des cas sont vérifiés dans provenance.json.\n\nCette tentative conserve inventaire, captures et qualification éventuelle des deux gels locaux seulement. Elle ne constitue ni protocole final, ni readiness, ni contrat final, ni coût officiel. Toute erreur ou limite reste conservée.\n')
 print(json.dumps({'prepared':True,'baselineDigest':baseline['digest'],'baselineFiles':baseline['fileCount'],
  'candidateDigest':candidate['digest'],'candidateFiles':candidate['fileCount'],'casesByteIdentical':True}),flush=True)
def main():
 if sys.argv[1:]==['--prepare']: prepare(); return 0
 assert not sys.argv[1:]
 started=now(); clock=time.monotonic(); rows=[]; terminal='running'; quiet_stop=None
 commands=[
 ('prepare-inputs',[sys.executable,'-B',rel(Path(__file__)),'--prepare']),
 ('owner-inventory',['node',rel(TOOLS/'record-owner-source-inventory.mjs'),str(BASELINE),rel(OUT/'owner-source-inventory.json')]),
 ('capture-baseline',['node',rel(TOOLS/'capture-cost-owner-graphs.mjs'),'baseline',str(BASELINE),rel(OUT/'cases.json'),rel(OUT/'baseline-source-manifest.json'),rel(OUT/'owner-baseline.json.gz')]),
 ('capture-candidate',['node',rel(TOOLS/'capture-cost-owner-graphs.mjs'),'candidate',str(ROOT),rel(OUT/'cases.json'),rel(CANDIDATE),rel(OUT/'owner-candidate.json.gz')]),
 ('qualify-graphs',['node',rel(TOOLS/'qualify-cost-owner-graphs.mjs'),rel(OUT/'owner-baseline.json.gz'),rel(OUT/'owner-baseline.receipt.json'),rel(OUT/'owner-candidate.json.gz'),rel(OUT/'owner-candidate.receipt.json'),rel(OUT/'owner-graph-attribution.json'),rel(OUT/'owner-structural-fixture.json')])]
 with (OUT/'execution.jsonl').open('x') as journal:
  def emit(value): journal.write(json.dumps(value,ensure_ascii=False,allow_nan=False)+'\n'); journal.flush(); print(json.dumps(value,ensure_ascii=False,allow_nan=False),flush=True)
  emit({'event':'started','startedAt':started,'globalWallLimitSeconds':480,'perCommandLimitSeconds':180,
   'childTimeoutSeconds':175,'lock':'shared performance.lock held by invoking flock','commands':[{'label':k,'argv':v} for k,v in commands]})
  try:
   for index,(label,argv) in enumerate(commands,1):
    metadata={name:json.loads((COORD/name).read_text()) for name in NAMES}
    record=OUT/f'coordination-before-{index:02d}.json'; write(record,{'checkedAt':now(),'statuses':metadata})
    if any(value.get('quiet_requested') is True for value in metadata.values()):
     quiet_stop={'beforeCommand':label,'coordination':rel(record)}; terminal='stopped_for_quiet'; break
    remaining=480-(time.monotonic()-clock)
    if remaining<=5: terminal='global_bound_reached'; break
    limit=min(175,remaining-5); log=OUT/f'{index:02d}-{label}.log'
    row={'index':index,'label':label,'command':argv,'cwd':str(ROOT),'startedAt':now(),'timeoutSeconds':limit,
     'coordination':rel(record),'log':rel(log),'exitCode':None,'timedOut':False}
    emit({'event':'command_started',**row}); begin=time.monotonic()
    with log.open('xb') as stream:
     process=subprocess.Popen(argv,cwd=ROOT,stdin=subprocess.DEVNULL,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
     try: row['exitCode']=process.wait(timeout=limit)
     except subprocess.TimeoutExpired:
      row['timedOut']=True; os.killpg(process.pid,signal.SIGKILL); row['exitCode']=process.wait(timeout=3)
    row.update(finishedAt=now(),elapsedSeconds=time.monotonic()-begin); rows.append(row)
    emit({'event':'command_finished',**row})
    if row['exitCode']!=0:
     terminal='command_failed_retained'; break
   else: terminal='provisional_functional_qualification_passed'
  except BaseException as error:
   terminal='driver_exception_retained'; emit({'event':'driver_exception','error':str(error),'traceback':traceback.format_exc()})
  finally:
   summary={'schema':'logos-engine.lot6b-provisional-functional-execution.v1','startedAt':started,'finishedAt':now(),
    'elapsedSeconds':time.monotonic()-clock,'status':terminal,'commands':rows,'quietStop':quiet_stop,
    'perCommandLimitSeconds':180,'globalWallLimitSeconds':480,'officialMeasurementExecuted':False,
    'actualPublishedBaselineClaimed':False,'protocolFinalized':False,'readinessCreated':False,'contractFinalized':False,
    'helpersSourcesTestsMutated':False,'gitExecuted':False}
   write(OUT/'execution-summary.json',summary); emit({'event':'terminal',**summary})
 return 0 if terminal=='provisional_functional_qualification_passed' else 2
if __name__=='__main__': raise SystemExit(main())
