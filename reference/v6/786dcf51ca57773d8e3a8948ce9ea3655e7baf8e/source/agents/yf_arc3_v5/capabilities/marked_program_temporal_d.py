"""Exact finite matching of a measured collection word to retained body poses.

It returns matches, never execution order, role meanings
or a permit. The caller supplies the collection/body binding and glyph vectors.
"""
from collections import Counter
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput
from agents.yf_arc3_v5.capabilities.components import detect_components

def fit_retained_word(value,current_scene,scene_measure,maximum_frames=64):
 frames=value.latest_ordered_action_frames
 if not frames or len(frames)>maximum_frames:return None
 present=value.current_observed_frame or value.frame
 old=None;frame_ordinal=None
 for n,f in enumerate(frames):
  if f==present:break
  sample=value.model_copy(update={'frame':f,'current_observed_frame':f,'components':detect_components(ComponentExtractionInput(frame=f,connectivity=4))})
  s=scene_measure(sample,bootstrap_empty=False)
  if s is None or not s['collection_word']:continue
  same=True
  for c in current_scene['carriers']:
   t,l,b,r=c['bounds']
   if any(f.rows[y][x]!=present.rows[y][x]for y in range(t,b+1)for x in range(l,r+1)):same=False;break
  if same:old=s;frame_ordinal=n;break
 if old is None:return None
 alphabet={c['paint']for c in old['carriers']};ring=old['collection_body_ring'];snapshots=[]
 for n,f in enumerate(frames):
  if f==present:break
  bodies=[]
  for cell in old['cells']:
   y,x=cell['center'];tip=f.rows[y+1][x]
   if tip in alphabet or tip==old['background_paint']or f.rows[y][x-1]!=tip or f.rows[y][x+1]!=tip:continue
   if f.rows[y][x]in alphabet:
    cards=[];off=0
    while y-off>=0 and f.rows[y-off][x]in alphabet:cards.append(f.rows[y-off][x]);off+=1
    if len(cards)>=3 and cards[-1]==cards[-2]:bodies.append({'cell':cell['cell'],'cards':tuple(cards[:-2]),'ring':tip})
  linked=tuple(b for b in bodies if b['ring']==ring)
  if len(linked)!=1:return None
  other=tuple(b for b in bodies if b['ring']!=ring)
  if len(other)>1:return None
  snap={'frame_ordinal':n,'linked_cell':linked[0]['cell'],'linked_word':linked[0]['cards'],'other_cells':tuple(b['cell']for b in other),'other_words':tuple(b['cards']for b in other)}
  if not snapshots or any(snap[k]!=snapshots[-1][k]for k in snap if k!='frame_ordinal'):snapshots.append(snap)
 if not snapshots or snapshots[0]['linked_word']!=old['collection_word']:return None
 if any(row['linked_word']!=old['collection_word']for row in snapshots):return None
 movement=tuple((b['linked_cell'][0]-a['linked_cell'][0],b['linked_cell'][1]-a['linked_cell'][1])for a,b in zip(snapshots,snapshots[1:])if a['linked_cell']!=b['linked_cell'])
 h,w=old['half_extent'];vectors={c['paint']:((c['vector'][0]//h-c['vector'][1]//w)//2,(c['vector'][0]//h+c['vector'][1]//w)//2)for c in old['carriers']if c['singleton']}
 word=old['collection_word'];forward=tuple(vectors[p]for p in word if p in vectors);backward=tuple(vectors[p]for p in reversed(word)if p in vectors)
 terminal_drop=bool(snapshots[0]['other_words']and not snapshots[-1]['other_words'])
 uniform=tuple(c['paint']for c in old['carriers']if not c['singleton'])
 return {'word_observed':word,'measured_directional_vectors':tuple({'paint':p,'delta':v}for p,v in sorted(vectors.items())),'movement_sequence':movement,'forward_matches':movement==forward,'reverse_matches':movement==backward,'uniform_marker_paints':uniform,'other_stack_disappeared':terminal_drop,'linked_word_preserved':True,'old_geometry_first_measured_at_frame':frame_ordinal,'ordered_frame_count':len(frames),'base_snapshots':tuple(snapshots),'calibration_intent_ref':value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),'old_local_lease_reused':False}
