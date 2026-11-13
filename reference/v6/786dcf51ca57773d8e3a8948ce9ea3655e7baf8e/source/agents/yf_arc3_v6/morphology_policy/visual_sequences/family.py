"""Source-sequenced public visual question experiments, with explicit ambiguity."""
from pathlib import Path
from copy import deepcopy
from terminal_composition import identity
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from .measure import layout,interior
from .programs import explain
HERE=Path(__file__).resolve().parent

class VisualSequences:
    def __init__(self):
        doc=load_drm_document(HERE/'visual_sequences.drm');decl,=doc.document.declarations;self.config=dict(decl.configuration)
        self.failed=set();self.events=[];self.last=None
        self.src=SrcProgram(HERE/'visual_sequences.src','v6.visual_sequences.choose',{'sequence.measure':self.measure,'sequence.infer':self.infer,'sequence.bind':self.select})
    def measure(self,request):
        obs,rows,inputs,remaining=self.context
        self.layout=layout(obs,rows)
        return {'qualified':bool(self.layout),'remaining':remaining}
    def infer(self,measured):
        if not measured['qualified'] or measured['remaining']<1:return {'status':'no_bound_question'}
        lay=self.layout;q=lay['active'];cards=list(q['rasters']);cards[q['missing']]=None;options=[]
        for i,option in enumerate(lay['options']):
            why=explain(cards,q['missing'],option['raster'],lay['background'],self.config)
            if why:options.append({'index':i,'why':why,'raster_sha':identity(option['raster'])})
        self.last={'status':'unique' if len(options)==1 else 'ambiguous' if options else 'no_supported_declared_model',
                   'question_ref':lay['question_ref'],'missing_rank':q['missing'],'compatible_options':options,
                   'grammar_scope':'declared bounded feature laws; neither arbitrary law induction nor uniqueness of generating mechanism'}
        return self.last
    def select(self,inferred):
        if inferred['status']!='unique':return {'selected':False,'reason':inferred['status']}
        obs,rows,inputs,remaining=self.context;lay=self.layout;q=lay['active'];choice=inferred['compatible_options'][0];option=lay['options'][choice['index']]
        key=identity([obs['level_epoch'],lay['question_ref'],lay['grid_digest'],choice['raster_sha']])
        if key in self.failed:return {'selected':False,'reason':'same_answer_acceptance_unconfirmed'}
        l,t,r,b=option['box'];points=[a for a in inputs if a.get('data') and l<a['data']['x']<r and t<a['data']['y']<b]
        if not points:return {'selected':False,'reason':'no_current_option_locus'}
        action=min(points,key=lambda a:((2*a['data']['x']-l-r)**2+(2*a['data']['y']-t-b)**2,a['data']['y'],a['data']['x']))
        self.selected={'action':action,'key':key,'option':option,'inference':inferred}
        return {'selected':True,'reason':'unique_option_on_all_supported_feature_relations'}
    def propose(self,obs,rows,inputs,remaining):
        self.context=(obs,rows,inputs,remaining);answer,receipt=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
        if not answer['selected']:return None
        picked=self.selected;lay=self.layout;q=lay['active'];action=picked['action'];focus='composition:visual_answer:'+identity([obs['observation_ref'],picked['key']])[:20]
        facts={'indexed_question_current':True,'unique_supported_option':True};evidence=[obs['observation_ref']]
        return {'status':'proposed','kind':'public_visual_sequence','actions':[action],
          'steps':[{'action':action,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash']},'expected_after':None}],
          'facts':facts,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash']},
          'sequence_plan':{'trial':picked['key'],'question_ref':lay['question_ref'],'grid':lay['grid'],'row':q['row'],'missing_rank':q['missing'],
              'target_box':q['boxes'][q['missing']],'option_box':picked['option']['box'],'expected_raster':picked['option']['raster'],
              'inference':picked['inference'],'workflow':receipt,'control_status':'pointed_option_submission_unconfirmed_until_observed'},
          'compositions':[{'id':focus,'role':'information_question','observed':False,'things':['indexed_cards','missing_rank','visible_option'],
              'properties':{'feature_constraints':picked['inference'],'preserve':'other_card_contents'},'relations':['contributes_to:G_official_completion'],'open_question':self.config['question']}],
          'question':{'reason':self.config['question'],'hypothesis_refs':evidence},'route_refs':evidence,
          'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
               'purpose':self.config['question'],'preconditions':facts,'evidence':evidence,'actions':[action],'outcome_guard':{'path':['value'],'contains':focus}}}
    def propose_continuation(self,obs,rows,inputs,remaining,minimum_rows):
        rows_seen=[e for e in self.events if e['status']=='observed_row_completion' and e.get('other_cards_preserved') and e.get('expected_card_filled')]
        boundaries=[e for e in self.events if e['status']=='official_boundary']
        if len({e['question'] for e in rows_seen})<minimum_rows or not boundaries:return None
        proposal=self.propose(obs,rows,inputs,remaining)
        if proposal is None:return None
        witnesses=[e['evidence'] for e in rows_seen[-minimum_rows:]]+[boundaries[-1]['evidence']]
        proposal['facts']['visual_answer_method_recalled']=True
        proposal['bundle_template']['preconditions']['visual_answer_method_recalled']=True
        proposal['bundle_template']['evidence']+=witnesses
        proposal['sequence_plan']['continuation_witnesses']=witnesses
        return proposal
    def bind(self,proposal,domain):domain.bind_proposal(proposal)
    def before(self,proposal,index,public,obs):
        p=proposal['binding'];step=proposal['steps'][index];action=proposal['actions'][index];plan=proposal['sequence_plan'];point=action.get('data',{});l,t,r,b=plan['option_box']
        ok=(public.level==p['level_epoch'] and public.levels_completed==p['levels_completed'] and public.frame_hash==p['frame_hash'] and obs['observation_ref']==p['observation_ref'] and
            action==step['action'] and action['action_ref'] in public.available_action_refs and l<point.get('x',-1)<r and t<point.get('y',-1)<b and interior(public.frame_rows,plan['option_box'])==tuple(map(tuple,plan['expected_raster'])))
        return {'admitted':ok,'reason':'current_question_and_option_bound' if ok else 'sequence_or_option_scope_changed'}
    def after(self,proposal,index,before,after,first,second):
        return {'matched':None,'seal_prefix':True,'reason':'observe_answer_acceptance_or_boundary'}
    def record(self,before,after,command,first,second,proposal,index):
        if command!=proposal['actions'][index] or before['observation_ref']!=proposal['binding']['observation_ref']:raise ValueError('Unbound visual answer response')
        p=proposal['sequence_plan']
        if after['levels_completed']>before['levels_completed']:
            event={'status':'official_boundary','evidence':after['observation_ref'],'question':p['question_ref'],'scope':'transition corroborates the attempted final answer; necessity not inferred'}
        else:
            preserved=all(interior(first,box)==interior(second,box) for row in p['grid'] for box in row if box!=p['target_box'])
            filled=interior(second,p['target_box'])==tuple(map(tuple,p['expected_raster']))
            event={'status':'observed_row_completion' if filled and preserved else 'answer_acceptance_unconfirmed','evidence':after['observation_ref'],'question':p['question_ref'],'other_cards_preserved':preserved,'expected_card_filled':filled}
            if not (filled and preserved):self.failed.add(p['trial'])
        event['tested_relations']=p['inference'];self.events.append(event);return event
    def state(self):return {'failed':sorted(self.failed),'events':deepcopy(self.events)}
    def restore(self,state):self.failed=set(state['failed']);self.events=deepcopy(state['events'])
