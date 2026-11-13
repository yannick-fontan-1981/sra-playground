#!/usr/bin/env python3
"""Development oracle for the native V6 field ports; never shipped as an agent.

Execute the pinned, unchanged Python family against original game observations.
Every emitted command/guard/outcome is a differential fixture, not a solution
lookup table or a hidden-state input to the TypeScript agent.
"""
from pathlib import Path
from types import SimpleNamespace
import hashlib, json, shutil, sys, tempfile, zipfile

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REFERENCE = ROOT / 'reference' / 'v6' / COMMIT / 'source'
LAYA = REFERENCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(LAYA), str(REFERENCE)]
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from common_multiscale_constraints import WindowConstraints, rows_digest, projection
from common_symmetric_field import SymmetricField
POLICY = json.loads((REFERENCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['regular_field_correspondence']

def public(value, step):
    rows = value['frame']
    return SimpleNamespace(frame_rows=rows, frame_packet=value['frames'], level=value['level'],
        levels_completed=value['levelsCompleted'], state=value['state'], step_index=step,
        available_action_refs=[f'ACTION{n}' for n in value['availableActionIds']],
        frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16])

def make_fixtures():
    with tempfile.TemporaryDirectory(prefix='v6-field-oracle-') as directory:
        temp=Path(directory); assets=ROOT/'public/python'
        for bundle in ('custom-games.zip','official-games.zip'):
            with zipfile.ZipFile(assets/bundle) as archive: archive.extractall(temp)
        for name in ('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(assets/name,temp/name)
        sys.path.insert(0,str(temp))
        import game_bridge
        def send(kind,**payload):
            result=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**payload})))
            if 'error' in result:raise RuntimeError(result['error'])
            return result
        cases=[]
        for code in ['SYME','DNOI','SEQN']:
            engine=send('load',code=code,level=1)
            families=[WindowConstraints(),SymmetricField(POLICY)]
            domain=ObservedInputDomain(256); transitions=[]; revision=0; current=public(engine,revision)
            obs,_=measure(current,revision,'native-field-oracle')
            initial={'public':vars(current),'observation':obs}
            while revision<160 and current.state not in ('WIN','GAME_OVER','GAMEOVER','LEVEL_COMPLETE'):
                inputs=domain.candidates(obs); choice=None
                for index,family in enumerate(families):
                    proposal=family.propose(obs,current.frame_rows,inputs,160-revision)
                    if proposal is not None:choice=index,family,proposal;break
                if choice is None:break
                family_index,family,proposal=choice
                event={'family':family_index,'inputs':inputs,'proposal':proposal,'steps':[]}
                for index,command in enumerate(proposal['actions']):
                    before_guard=family.before(proposal,index,current,obs)
                    if not before_guard['admitted']:
                        event['steps'].append({'beforeGuard':before_guard});break
                    engine=send('action',actionId=int(command['action_ref'][6:]),data=command.get('data'))
                    revision+=1; after_public=public(engine,revision); after_obs,_=measure(after_public,revision,'native-field-oracle')
                    after_guard=family.after(proposal,index,obs,after_obs,current.frame_rows,after_public.frame_rows)
                    recorded=family.record(obs,after_obs,command,current.frame_rows,after_public.frame_rows,proposal,index)
                    event['steps'].append({'beforeGuard':before_guard,'afterPublic':vars(after_public),'afterObservation':after_obs,'afterGuard':after_guard,'record':recorded})
                    current,obs=after_public,after_obs
                    if after_guard['seal_prefix']:break
                transitions.append(event)
                if not event['steps'] or 'afterPublic' not in event['steps'][-1]:break
            cases.append({'game':code,'initial':initial,'transitions':transitions,'actions':revision,'levelsCompleted':current.levels_completed,'state':current.state})
        sources={str(path.relative_to(REFERENCE)):{'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size}
                 for path in [LAYA/'common_multiscale_constraints.py',LAYA/'common_symmetric_field.py',LAYA/'periodic_correspondence.py',LAYA/'neutral_observer.py',LAYA/'geometric_observer.py',LAYA/'observed_input_domain.py',REFERENCE/'agents/yf_arc3_v6/morphology_policy/strategy.drm']}
        result={'provenance':{'commit':COMMIT,'sources':sources,'scope':'Individual original field-family differential; not complete V6 router parity','inputDomainLimit':256},'policy':POLICY,'cases':cases}
        dest=ROOT/'tests/fixtures/v6-field-reference.json';dest.write_text(json.dumps(result,separators=(',',':'))+'\n')
        print(json.dumps({'output':str(dest),'cases':[{'game':c['game'],'actions':c['actions'],'levelsCompleted':c['levelsCompleted'],'cycles':len(c['transitions'])}for c in cases]},indent=2))
if __name__=='__main__':make_fixtures()
