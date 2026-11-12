#!/usr/bin/env python3
"""Declare exact final-identity controls, without starting any functional command."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, shutil

ROOT=Path(__file__).resolve().parents[5]
STAGE='docs/migration/lot8b-evidence/final-version-067-01'
TOOLS='docs/migration/lot8b-evidence/tools/final-functional'
OLD='docs/migration/lot8b-evidence/delivery-qualification-01'
BASELINE='/workspace/sites/sra-lot8b-baseline066-20261112'
PLUGIN=Path('/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts')

def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()

def main():
 review=ROOT/STAGE/'functional-tools-independent-review.json'
 assert review.is_file(), 'Independent static review must exist before declaration'
 rd=json.loads(review.read_text());assert rd.get('blockingObjections')==[], 'Independent review has unresolved objections'
 names=set()
 for name in ['work-forms-execution-plan.json','branch-execution-plan-02.json']:
  p=ROOT/OLD/name;names.add(str(p))
  names.update(str((ROOT/r['path']).resolve()) for r in json.loads(p.read_text())['inputFiles'])
 common=json.loads((ROOT/'docs/migration/lot8b-evidence/common-integration-01/build-01/inputs-before.json').read_text())
 # Reuse aggregate original-input integrity without targeting the permanently closed case.
 names.update(str(ROOT/n) for n in common if 'lkey' not in n.lower())
 for folder in ['src','content','public/vendor/pyodide',TOOLS]:
  names.update(str(p) for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
 # Public build assets are packaged as opaque byte inputs; closed-case-specific paths are not read.
 names.update(str(p) for p in (ROOT/'public').rglob('*') if p.is_file() and 'lkey' not in p.as_posix().lower())
 for name in ['candidate-native.json','baseline-native.json','prior-candidate-native.json','source-reconciliation.json','historical-input-reconciliation.json','recovered-build-inputs.json','publication-observation.json','version-reservation.json','functional-tools-independent-review.json']:
  names.add(str(ROOT/STAGE/name))
 for name in ['work-baseline-01/baseline.json.gz','work-baseline-01/baseline.receipt.json']:
  names.add(str(ROOT/OLD/name))
 for name in ['build-site.mjs','package-manager.mjs','workflow-metrics.mjs']:
  names.add(str(PLUGIN/name))
 for command in ['node','python']:
  names.add(str(Path(shutil.which(command)).resolve()))
 for name in ['node_modules/typescript/package.json','node_modules/vite/package.json','package.json','package-lock.json','vite.config.ts','tsconfig.json','.openai/hosting.json','index.html','scripts/audit-v6-entry-points.ts','scripts/audit-v6-migration.py',str(Path(__file__).relative_to(ROOT))]:names.add(str(ROOT/name))
 rows=[]
 for name in sorted(names):
  p=Path(name);assert p.is_file(), 'Missing declared input: '+str(p)
  rows.append({'path':p.relative_to(ROOT).as_posix() if p.is_relative_to(ROOT) else str(p),'bytes':p.stat().st_size,'sha256':sha(p)})
 node_env={'NODE_OPTIONS':'--max-old-space-size=1536'}
 commands={
  'inventory':{'argv':['node',TOOLS+'/work-forms/record-owner-source-inventory.mjs','{baseline}','{root}','{attempt}/owner-source-inventory.json'],'timeoutSeconds':120,'environment':node_env},
  'candidate-capture':{'argv':['node',TOOLS+'/work-forms/capture-cost-owner-graphs.mjs','candidate','{root}','docs/migration/lot8b-evidence/tools/delivery/work-forms/cases.json',STAGE+'/candidate-native.json','{attempt}/candidate.json.gz'],'timeoutSeconds':300,'environment':node_env},
  'paired-qualify':{'argv':['node',TOOLS+'/work-forms/qualify-cost-owner-graphs.mjs',STAGE+'/work-inventory-01/owner-source-inventory.json',OLD+'/work-baseline-01/baseline.json.gz',OLD+'/work-baseline-01/baseline.receipt.json',STAGE+'/work-candidate-01/candidate.json.gz',STAGE+'/work-candidate-01/candidate.receipt.json','{attempt}/graph-review.json','{attempt}/work-forms.json'],'timeoutSeconds':300,'environment':node_env,'dependencies':[STAGE+'/work-inventory-01/owner-source-inventory.json',STAGE+'/work-candidate-01/candidate.json.gz',STAGE+'/work-candidate-01/candidate.receipt.json']},
  'branch-capture':{'argv':['node',TOOLS+'/branch-common-capture-v2.mjs','{root}',STAGE+'/candidate-native.json','{attempt}/capture.jsonl.gz'],'timeoutSeconds':300,'environment':node_env},
  'branch-qualify':{'argv':['node',TOOLS+'/branch-common-qualify-v2.mjs',STAGE+'/branch-capture-01/capture.jsonl.gz',STAGE+'/branch-capture-01/capture.receipt.json','{attempt}/graph-review.json','{attempt}/work-forms.json'],'timeoutSeconds':300,'environment':node_env,'dependencies':[STAGE+'/branch-capture-01/capture.jsonl.gz',STAGE+'/branch-capture-01/capture.receipt.json']},
  'entry-audit':{'argv':['node','scripts/audit-v6-entry-points.ts'],'timeoutSeconds':120},
  'migration-audit':{'argv':['python','-B','scripts/audit-v6-migration.py'],'timeoutSeconds':120},
  'build':{'argv':['node',str(PLUGIN/'build-site.mjs')],'timeoutSeconds':300}
 }
 plan={'schema':'logos-engine.lot8b.functional-execution-plan.v1','declaredAt':datetime.now(timezone.utc).isoformat(),'phase':'final_version067_identity_and_build_renewal','sourceFreezeCommit':'0f45ad517b9df98563bc03b79ee73dd3be10e362','baselineCheckout':BASELINE,'publishedBaselineCommit':'4ff7bf45286a8a19d34401988adca587253ae41e','nativeDigests':{'baseline':'ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316','candidate':'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a'},'independentReview':{'path':str(review.relative_to(ROOT)),'sha256':sha(review)},'inputFiles':rows,'commands':commands,'requiredSequence':['inventory','candidate-capture','paired-qualify','branch-capture','branch-qualify','entry-audit','migration-audit','build'],'resourcePolicy':{'maximumConcurrentProcessGroups':1,'automaticRetry':False,'functionalCommandMaximumSeconds':300,'v8OldSpaceMiB':1536,'memoryQualification':'V8 old-space setting is not a total RSS bound.','clockDurationsAreOfficialPerformance':False},'workFormBudgetChange':'Final identity renewals tighten the prior 600-second functional ceilings to300. Historical successful durations39.578/43.975seconds inform only supervisor preparation, not performance acceptance.','retainedBaselineCaptureReexecuted':False,'historicalTestModulesRerun':False,'recordedRegressionCasesRerun':False,'publicServicePositiveBranchRoutingQualified':False,'newGameExecuted':False,'originalOracleExecuted':False,'LKEYIncluded':False,'globalLockAcquired':False,'ordinaryWorkGlobalLockRequired':False,'officialPerformanceMeasurement':False,'publicationPerformed':False,'headPolicy':'Keep execution HEAD stable for every capture/reader. Ordinary documentation/tool preparation may be committed beforehand; frozen native bytes may not change.'}
 out=ROOT/STAGE/'functional-execution-plan.json'
 with out.open('x') as f:json.dump(plan,f,indent=2);f.write('\n')
 print(json.dumps({'status':'declared','commands':len(commands),'frozenInputFiles':len(rows),'path':str(out.relative_to(ROOT))}))

if __name__=='__main__':main()
