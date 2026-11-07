"""Public UI acquisition and conditional construction of ordered information probes."""
from pathlib import Path
from copy import deepcopy
from terminal_composition import identity
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from .visual import initial_layout,values,palette,feedback,border
from .finite import choose
from common_multiscale_constraints import projection,rows_digest
HERE=Path(__file__).resolve().parent

class FeedbackSequences:
    def __init__(self):
        doc=load_drm_document(HERE/'feedback_sequences.drm');declaration,=doc.document.declarations
        self.configuration=dict(declaration.configuration);self.order=self.configuration['stages'];self.layout=None
        self.active=None;self.repeatable=None;self.entry_evidence=[];self.history=[];self.submit=None;self.clear_evidence=[];self.last=None;self.blocked=None;self.palette_background=None;self.entry_method=None;self.transfer_refuted_epoch=None
        self.src=SrcProgram(HERE/'feedback_sequences.src','v6.feedback_sequences.choose',
            {'sequences.begin':self.begin,'sequences.offer':self.offer,'sequences.advance':self.advance,'sequences.finish':self.finish})
    def begin(self,request):return dict(pending=True,done=False,index=0,progress=0,visited=[])
    def offer(self,session):
        name=self.order[session['index']];p=self.providers[name]();self.offered[name]=p
        return dict(selected=p is not None,family=name)
    def advance(self,session):
        i=session['index']+1
        return dict(session,index=i,progress=i,pending=i<len(self.order),done=i==len(self.order),visited=[*session['visited'],self.order[session['index']]])
    def finish(self,session,trial):return dict(session,pending=False,done=True,progress=session['progress']+1,selected=trial['family'],visited=[*session['visited'],trial['family']])
    def reset_scope(self,obs):
        if self.layout and self.layout['epoch']!=obs['level_epoch']:
            if self.active and self.submit and len({e['value'] for e in self.entry_evidence})>=2:
                ordered=sorted(self.layout['slot_rows'],key=lambda row:row['y'])
                self.entry_method={'kind':'append_to_next_unfilled_rank','source_epoch':self.layout['epoch'],
                    'size':self.layout['size'],'pitch':self.layout['pitch'],'slot_row_count':len(ordered),
                    'active_order':next(i for i,row in enumerate(ordered) if row['y']==self.active['y']),
                    'append_evidence':[e['ref'] for e in self.entry_evidence],
                    'submit_evidence':self.submit['ref'],'submit_action':self.submit['action'] if not self.submit['action'].get('data') else None,
                    'palette_mode_at_source':self.repeatable,'status':'hypothesis_to_revalidate_at_next_epoch'}
            self.layout=None;self.active=None;self.repeatable=None;self.entry_evidence=[];self.history=[];self.submit=None;self.clear_evidence=[];self.last=None;self.blocked=None;self.palette_background=None
    def method_matches(self,obs):
        m=self.entry_method;lay=self.layout
        return bool(m and lay and m.get('kind')=='append_to_next_unfilled_rank' and
            m.get('source_epoch')!=obs['level_epoch'] and self.transfer_refuted_epoch!=obs['level_epoch'] and
            len(set(m.get('append_evidence',())))>=2 and m.get('submit_evidence') and
            m.get('size')==lay['size'] and m.get('pitch')==lay['pitch'] and
            m.get('slot_row_count')==len(lay['slot_rows']) and
            0<=m.get('active_order',-1)<len(lay['slot_rows']))
    def view(self,obs,rows):
        self.reset_scope(obs)
        if self.layout is None:self.layout=initial_layout(obs)
        if self.layout is None:return None
        pal=palette(obs,self.layout)
        if pal is None:return None
        prefix=[]
        if self.active:
            row=values(rows,self.layout,self.active['y'],self.layout['count'])
            if row is None:return None
            empty=self.active['empty'];filled=[v for v in row if v!=empty]
            if row!=filled+[empty]*(len(row)-len(filled)) or any(v not in self.layout['alphabet'] for v in filled):return None
            prefix=filled
        return {'prefix':prefix,'palette':pal}
    def compile(self,trial,obs,rows,inputs,remaining,question,selection):
        view=self.view(obs,rows)
        if view is None:return None
        prefix=list(view['prefix']);pal=list(view['palette']);steps=[];w,h=self.layout['size'];arr=[list(row) for row in rows]
        attested=len({e['value'] for e in self.entry_evidence})>=2 and self.repeatable is not None
        box=[self.layout['xs'][0],self.layout['palette_y'],self.layout['xs'][-1]+w-1,self.layout['palette_y']+h-1]
        gaps={rows[j][x+w] for x in self.layout['xs'][:-1] for j in range(box[1],box[3]+1)}
        background=self.palette_background
        if attested and self.repeatable is False and background is None:return None
        if trial[:len(prefix)]!=prefix:return None
        for value in trial[len(prefix):]:
            matching=[(i,x) for i,(x,v) in enumerate(pal) if v==value]
            if len(matching)!=1:return None
            i,x=matching[0];locus={'x':x+w//2,'y':self.layout['palette_y']+h//2}
            bound=[a for a in inputs if a.get('data')==locus]
            if len(bound)!=1:return None
            command=bound[0]
            next_prefix=prefix+[value];next_values=[v for _,v in pal]
            if self.repeatable is False:next_values.pop(i)
            expected={'prefix':next_prefix,'palette_values':next_values} if attested else None
            steps.append({'action':command,'kind':'ADD','value':value,'prefix_before':prefix,'palette_before':[list(a) for a in pal],'expected_after':expected,
                          'palette_projection_bbox':box,'palette_projection_sha':rows_digest(projection(arr,box))})
            prefix=next_prefix;pal=list(zip(self.layout['xs'],next_values))
            if attested:
                for rank,xx in enumerate(self.layout['xs']):
                    fill=next_values[rank] if rank<len(next_values) else background
                    for yy in range(box[1],box[3]+1):arr[yy][xx:xx+w]=[fill]*w
            if not attested or len(steps)>=min(remaining,self.configuration['maximum_bundle']):break
        if not steps:return None
        return self.proposal(obs,steps,question,selection)
    def proposal(self,obs,steps,question,selection):
        actions=[s['action'] for s in steps];focus='composition:ordered_trial:'+identity([obs['observation_ref'],actions])[:20]
        evidence=[obs['observation_ref'],self.layout['ref'],*[x['ref'] for x in self.entry_evidence],*[x['ref'] for x in self.history]]
        facts={'ordered_slots_current':True}
        recalled=selection.get('recalled_entry')
        if recalled:
            facts['entry_method_rebound']=self.method_matches(obs)
            evidence.extend([*recalled['append_evidence'],recalled['submit_evidence']])
        return {'status':'proposed','kind':'public_feedback_sequence','actions':actions,'steps':steps,
          'facts':facts,
          'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash']},
          'feedback_plan':{'layout':deepcopy(self.layout),'active':deepcopy(self.active),'repeatable':self.repeatable,'palette_background':self.palette_background,'selection':selection,'question':question,'evidence':evidence},
          'compositions':[{'id':focus,'role':'information_question','observed':False,'properties':{'ordered_proposal':selection.get('trial'),'preserve':'currently filled prefix and all sealed response rows'},'relations':['contributes_to:G_official_completion'],'open_question':question}],
          'question':{'reason':question,'hypothesis_refs':evidence},'route_refs':evidence,
          'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':question,'preconditions':facts,'evidence':evidence,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}
    def propose(self,obs,rows,inputs,remaining):
        self.offered={};view=self.view(obs,rows)
        if view is None or remaining<1 or self.blocked:return None
        n=self.layout['count'];prefix=view['prefix']
        def continue_trial():
            if not self.last or self.last.get('epoch')!=obs['level_epoch'] or self.last['trial'][:len(prefix)]!=prefix or len(prefix)>=n:return None
            return self.compile(self.last['trial'],obs,rows,inputs,remaining,'Continue the currently bound ordered information probe.',self.last['selection'])
        def submit():
            if not self.active or len(prefix)!=n:return None
            recalled=self.entry_method.get('submit_action') if self.method_matches(obs) else None
            commands=[self.submit['action']] if self.submit else [recalled] if recalled and recalled in inputs else [a for a in inputs if not a.get('data')]
            if len(commands)!=1 or commands[0] not in inputs:return None
            return self.proposal(obs,[{'action':commands[0],'kind':'SUBMIT' if self.submit else 'CONTROL_WHEN_FULL','prefix_before':prefix,'palette_before':[list(x) for x in view['palette']],'expected_after':None}],
               'Test the control with a complete proposal and measure any positional return; stop at that response.',{'trial':prefix,'control_evidence':self.submit,'information_cost':1})
        def discriminate():
            if not self.active or len(prefix)>=n:return None
            other=[s for s in self.layout['slot_rows'] if s['y']!=self.active['y']]
            if len(other)!=1:return None
            raw=values(rows,self.layout,other[0]['y'],n)
            if raw is None:return None
            revealed=[None if v==other[0]['empty'] else v for v in raw]
            if any(v is not None and v not in self.layout['alphabet'] for v in revealed):return None
            result=choose(self.layout['alphabet'],n,prefix,self.history,revealed,self.repeatable,obs,remaining,self.configuration)
            self.last_diagnostic=result
            if result['status']!='proposed':return None
            self.last={'epoch':obs['level_epoch'],'trial':result['trial'],'selection':result}
            return self.compile(result['trial'],obs,rows,inputs,remaining,self.configuration['question'],result)
        def acquire():
            if self.active or not view['palette']:return None
            w,h=self.layout['size'];styles=[border(rows,x,self.layout['palette_y'],w,h) for x,v in view['palette']]
            distinctive=[i for i,x in enumerate(styles) if styles.count(x)==1]
            recalled=self.method_matches(obs)
            if len(distinctive)!=1 and not recalled:return None
            # Before any current feedback all distinct palette members are
            # symmetric under relabeling; use the first measured occurrence.
            choice=distinctive[0] if len(distinctive)==1 else 0
            value=view['palette'][choice][1]
            return self.compile([value],obs,rows,inputs,remaining,'Test whether a distinguished selectable value is appended to an ordered row.',{'trial':[value],'role_status':'unconfirmed','information_cost':1,'recalled_entry':deepcopy(self.entry_method) if recalled else None,'current_role_revalidation_pending':recalled})
        self.providers=dict(continue_bound_trial=continue_trial,test_complete_proposal=submit,discriminate_codes=discriminate,acquire_append=acquire)
        result,receipt=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
        proposal=self.offered.get(result.get('selected'))
        if proposal:proposal['feedback_plan']['workflow']=receipt
        return proposal
    def bind(self,proposal,domain):
        bound=proposal['binding']
        for step in proposal['steps']:
            point=step['action'].get('data')
            if not point:continue
            original=domain.bindings[bound['level_epoch'],bound['frame_hash']][point['x'],point['y']]
            if step['kind']!='ADD':
                step['point_binding']=dict(original)
                continue
            step['point_binding']={**original,'palette_value':step['value'],'source_frame_hash':bound['frame_hash'],
                                  'projected_rows_digest':step['palette_projection_sha'],'projection_bbox':step['palette_projection_bbox'],
                                  'scope':'conditional occurrence from observed palette-compaction law and exact current palette raster'}
    def before(self,proposal,index,public,obs):
        plan=proposal['feedback_plan'];step=proposal['steps'][index];bound=proposal['binding'];lay=plan['layout']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and step['action']['action_ref'] in public.available_action_refs and proposal['actions'][index]==step['action'] and (index>0 or obs['observation_ref']==bound['observation_ref']))
        if plan['active']:
            expected=step['prefix_before']+[plan['active']['empty']]*(lay['count']-len(step['prefix_before']))
            ok=ok and values(public.frame_rows,lay,plan['active']['y'],lay['count'])==expected
        else:
            ok=ok and all(values(public.frame_rows,lay,q['y'],lay['count'])==[q['empty']]*lay['count'] for q in lay['slot_rows'])
        expected=step['palette_before'];w,h=lay['size']
        ok=ok and all(values(public.frame_rows,{**lay,'xs':[x]},lay['palette_y'],1)==[v] for x,v in expected)
        ok=ok and all(values(public.frame_rows,{**lay,'xs':[x]},lay['palette_y'],1) not in [[v] for v in lay['alphabet']] for x in lay['xs'][len(expected):])
        if step['kind']=='ADD':
            matching=[x for x,v in expected if v==step['value']];data=step['action'].get('data',{})
            ok=ok and len(matching)==1 and data=={'x':matching[0]+w//2,'y':lay['palette_y']+h//2}
        return {'admitted':bool(ok),'reason':'ordered_prefix_and_loci_bound' if ok else 'sequence_binding_changed'}
    def after(self,proposal,index,before,after,first,second):
        if after['level_epoch']!=before['level_epoch'] or after['levels_completed']!=before['levels_completed']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        step=proposal['steps'][index];expected=step['expected_after'];plan=proposal['feedback_plan']
        if expected is None:return {'matched':None,'seal_prefix':True,'reason':'unknown_entry_or_feedback'}
        active=plan['active'];lay=plan['layout'];current=values(second,lay,active['y'],lay['count'])
        match=current==expected['prefix']+[active['empty']]*(lay['count']-len(expected['prefix']))
        # Per-primitive transport supplies pixels and protocol fields, not a
        # newly perceived scene. Check the frozen palette loci directly.
        pal=values(second,lay,lay['palette_y'])
        predicted=expected['palette_values']
        expected_palette=predicted+[plan['palette_background']]*(len(lay['xs'])-len(predicted))
        match=match and pal is not None and pal==expected_palette
        return {'matched':match,'seal_prefix':not match or index+1==len(proposal['steps']),'reason':'measured_entry_transition'}
    def record(self,before,after,command,first,second,proposal=None,index=0):
        view=self.view(before,first)
        if view is None:return {'status':'unbound_interface'}
        if after['level_epoch']!=before['level_epoch'] or after['levels_completed']!=before['levels_completed']:
            self.reset_scope(after);return {'status':'official_boundary','evidence':after['observation_ref']}
        lay=self.layout;w,h=lay['size'];ref=after['observation_ref'];data=command.get('data',{})
        clicked=[v for x,v in view['palette'] if x<=data.get('x',-1)<x+w and lay['palette_y']<=data.get('y',-1)<lay['palette_y']+h]
        additions=[]
        if len(clicked)==1:
            value=clicked[0]
            for row in lay['slot_rows']:
                b=values(first,lay,row['y'],lay['count']);a=values(second,lay,row['y'],lay['count'])
                if b is None or a is None:continue
                prefix=[v for v in b if v!=row['empty']]
                if b==prefix+[row['empty']]*(lay['count']-len(prefix)) and len(prefix)<lay['count'] and a==prefix+[value]+[row['empty']]*(lay['count']-len(prefix)-1):additions.append(row)
            if len(additions)==1:
                self.active=additions[0];pal=palette(after,lay);old=[v for x,v in view['palette']];new=[v for x,v in pal] if pal is not None else None
                mode=True if new==old else False if new==[v for v in old if v!=value] else None
                if self.entry_evidence and self.repeatable is not None and mode!=self.repeatable:
                    self.blocked={'status':'entry_protocol_refuted','evidence':ref};return self.blocked
                self.repeatable=mode;event={'ref':ref,'before':before['observation_ref'],'value':value,'action':command,'repeatable':mode}
                if self.method_matches(before):
                    ordered=sorted(lay['slot_rows'],key=lambda row:row['y'])
                    expected=ordered[self.entry_method['active_order']]['y']
                    event['method_revalidation']='active_rank_row_confirmed' if self.active['y']==expected else 'active_rank_row_changed'
                    event['source_method_evidence']=self.entry_method['append_evidence']
                    if self.active['y']!=expected:self.transfer_refuted_epoch=before['level_epoch']
                if mode is False:
                    vacated=values(second,{**lay,'xs':[lay['xs'][len(new)]]},lay['palette_y'],1)
                    if vacated and vacated[0] not in lay['alphabet']:self.palette_background=vacated[0]
                self.entry_evidence.append(event);return {'status':'observed_append','event':event,'active_row':self.active}
        if self.active:
            row=values(second,lay,self.active['y'],lay['count']);prefix=view['prefix']
            if len(prefix)==lay['count'] and row==[self.active['empty']]*lay['count']:
                matches=feedback(second,after,lay,prefix)
                if len(matches)==1:
                    result={**matches[0],'ref':ref,'before':before['observation_ref']}
                    if not any(x['ref']==ref for x in self.history):self.history.append(result)
                    self.submit={'action':command,'ref':ref};self.last=None
                    return {'status':'observed_submission_feedback','event':result}
                return {'status':'feedback_ambiguous','matches':len(matches),'evidence':ref}
            if 'x' in data and self.active['y']<=data.get('y',-1)<self.active['y']+h:
                ranks=[i for i,x in enumerate(lay['xs'][:lay['count']]) if x<=data['x']<x+w]
                if len(ranks)==1 and ranks[0]<len(prefix) and row==prefix[:ranks[0]]+[self.active['empty']]*(lay['count']-ranks[0]):
                    event={'ref':ref,'rank':ranks[0],'prefix_preserved':prefix[:ranks[0]]};self.clear_evidence.append(event);self.last=None
                    return {'status':'observed_suffix_clear','event':event}
        if proposal and proposal.get('feedback_plan',{}).get('selection',{}).get('recalled_entry'):
            self.transfer_refuted_epoch=before['level_epoch']
            return {'status':'recalled_append_refuted_here','evidence':ref,'method_source':self.entry_method['source_epoch']}
        return {'status':'no_bound_sequence_effect','evidence':ref}
    def state(self):return deepcopy({k:getattr(self,k) for k in ('layout','active','repeatable','entry_evidence','history','submit','clear_evidence','last','blocked','palette_background','entry_method','transfer_refuted_epoch')})
    def restore(self,state):
        for key,value in state.items():
            if key not in ('layout','active','repeatable','entry_evidence','history','submit','clear_evidence','last','blocked','palette_background','entry_method','transfer_refuted_epoch'):raise ValueError('Unknown memory field')
            setattr(self,key,deepcopy(value))
