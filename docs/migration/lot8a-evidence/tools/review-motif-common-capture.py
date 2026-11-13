#!/usr/bin/env python3
"""Review the actual four-return Motif diagnostic; never execute a runtime/oracle."""
import argparse,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
def fp(p):
 data=p.read_bytes();return {'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
 source=(ROOT/args.input).resolve();output=(ROOT/args.output).resolve()
 assert source.is_relative_to(ROOT/'docs/migration/lot8a-evidence/qualification-provisional-01') and output.is_relative_to(ROOT/'docs/migration/lot8a-evidence/qualification-provisional-01') and not output.exists()
 initial=fp(source);report=json.loads(source.read_text());checks=[]
 def check(name,fn):
  try:passed=bool(fn());detail=None
  except (KeyError,IndexError,TypeError,ValueError) as error:passed=False;detail=type(error).__name__
  checks.append({'name':name,'passed':passed,**({'error':detail} if detail else {})})
 check('declared_diagnostic_schema',lambda:report['schema']=='sra.lot8a.synthetic-caller-diagnostic.v1')
 check('all_declared_steps_completed',lambda:report['status']=='completed_declared_synthetic_steps')
 trace=report.get('trace',[]);records=report.get('records',[]);offers=[x for x in trace if x.get('phase')=='offer'];returns=[x for x in trace if x.get('phase')=='return']
 check('four_actual_offers_and_four_returns',lambda:len(trace)==8 and len(offers)==len(returns)==4)
 check('declared_public_frames_in_order',lambda:[x['forFrame'] for x in offers]==[x['fromFrame'] for x in returns]==['moved','toggled','open','walked'])
 check('four_selected_acquisitions_without_duplicates',lambda:len(records)==4 and len({x['revision'] for x in records})==4)
 check('actual_selected_modes',lambda:[x['mode'] for x in records]==['calibrate','toggle','invoke','walk'])
 check('every_offer_is_authorized_motif_action',lambda:len(offers)==4 and all(x['kind']=='action' and x['family']=='motif_access' and x['whyActStatus']=='action_set_released' and bool(x['authorization']) for x in offers))
 check('recorded_commands_are_the_actual_offers',lambda:len(records)==len(offers)==4 and all(a['command']==b['command'] for a,b in zip(records,offers)))
 check('each_return_seals_and_runs_common_reconciliation',lambda:len(returns)==4 and all(x['kind']=='boundary' and x['analysis']==['OP29','OP30','OP31'] for x in returns))
 check('complete_record_count_at_every_return',lambda:[x['actions'] for x in returns]==[1,2,3,4])
 check('no_official_level_in_synthetic_capture',lambda:len(trace)==8 and all(x['levelsCompleted']==0 for x in trace) and report['finalOffer']['levelsCompleted']==0)
 for key in ['learned','motion','events','passed']:
  check('common_restore_preserves_'+key,lambda key=key:report['restoredBeforeNextAction'][key]==report['acquiredBeforeRestore'][key])
 check('restoration_is_exercised_after_actual_acquisition',lambda:len(report['acquiredBeforeRestore']['events'])==3 and report['ownerWasCleared']!=report['acquiredBeforeRestore'] and len(report['ownerWasCleared']['events'])==0)
 check('four_final_source_events',lambda:len(report['finalOwner']['events'])==4)
 check('four_common_store_keys_match_actual_record_revisions',lambda:len(report['motifEpisodeKeys'])==4 and [x['revision'] for x in report['motifEpisodeKeys']]==[x['revision'] for x in records])
 check('common_store_values_match_retained_owner_events',lambda:len(report['motifEpisodeKeys'])==4 and [x['value'] for x in report['motifEpisodeKeys']]==report['finalOwner']['events'])
 check('input_unchanged',lambda:fp(source)==initial)
 result={'schema':'logos-engine.lot8a.motif-common-capture-review.v1','status':'passed' if all(x['passed'] for x in checks) else 'failed','input':initial,'reviewer':fp(Path(__file__)),'checks':{'total':len(checks),'passed':sum(x['passed'] for x in checks),'failures':[x for x in checks if not x['passed']],'items':checks},'qualification':'Review of the actual synthetic four-return positive diagnostic, including deliberately clearing native owner state and restoring acquired knowledge from common memory. Existing contrary-return, acquisition-ablation and local symmetry-boundary proofs remain separately bound by the passing145-file suite. No full original caller, same-episode three-owner activation, live-game, cost or publication claim.'}
 with output.open('x') as stream:json.dump(result,stream,ensure_ascii=False,indent=2);stream.write('\n')
 print(json.dumps({'status':result['status'],'checks':result['checks']['total'],'passed':result['checks']['passed'],'failures':result['checks']['failures']}))
 return 0 if result['status']=='passed' else 1
if __name__=='__main__':raise SystemExit(main())
