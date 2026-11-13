"""Visible occurrence comparison reused from the common C identity helper.

The stationary predicate and bounded visible comparison retain their donor
behavior. Callers must keep cross-source ambiguity and explicit occlusion.
"""
def contains(outer,inner):return outer[0]<=inner[0] and outer[1]<=inner[1] and outer[2]>=inner[2] and outer[3]>=inner[3]

def enclosing_contours(observation,body):
 values=[]
 for entity in observation['entities']:
  l,t,r,b=entity['bbox'];width=r-l+1;height=b-t+1
  if contains(entity['bbox'],body['bbox']) and width>2*(body['bbox'][2]-body['bbox'][0]+1) and height>2*(body['bbox'][3]-body['bbox'][1]+1) and entity['area']<width*height/4:values.append(entity['palette_value'])
 return values

def unchanged(entity,observation):
 return any(e['signature']==entity['signature'] and e['bbox']==entity['bbox'] for e in observation['entities'])

def compatible(source,candidate,first,second,before,after,body_before=None,body_after=None):
 value=source['palette_value'];old=source['bbox'];new=candidate['bbox'];occlusions=[body_before['bbox'] if body_before else None,body_after['bbox'] if body_after else None];contours=[enclosing_contours(before,body_before) if body_before else [],enclosing_contours(after,body_after) if body_after else []]
 shifts={(new[0]-old[0],new[1]-old[1]),(new[2]-old[2],new[1]-old[1]),(new[0]-old[0],new[3]-old[3]),(new[2]-old[2],new[3]-old[3])};accepted=[]
 def visible(rows,x,y,box,values):
  return 0<=x<len(rows[0]) and 0<=y<len(rows) and (box is None or not (box[0]<=x<=box[2] and box[1]<=y<=box[3])) and rows[y][x] not in values
 for dx,dy in sorted(shifts):
  l=min(old[0],new[0]-dx);t=min(old[1],new[1]-dy);r=max(old[2],new[2]-dx);b=max(old[3],new[3]-dy);same=[];background=0;hidden=0;contradicted=False
  for y in range(t,b+1):
   for x in range(l,r+1):
    xx,yy=x+dx,y+dy
    if not visible(first,x,y,occlusions[0],contours[0]) or not visible(second,xx,yy,occlusions[1],contours[1]):hidden+=1;continue
    a=first[y][x]==value;c=second[yy][xx]==value
    if a!=c:contradicted=True;break
    if a:same.append([x,y])
    else:background+=1
   if contradicted:break
  if not contradicted and len({x for x,y in same})>1 and len({y for x,y in same})>1:
   accepted.append({'translation':[dx,dy],'matching_visible_foreground':same,'matching_visible_background_count':background,'unobservable_points':hidden})
 return {'status':'visible_shape_compatible_under_bounded_translation','alternatives':accepted,'scope':'visible_part_only_occluded_part_unknown'} if accepted else None


def residual_correspondences(before, after, first, second):
    """Retain stationary witnesses, then compare the remaining visible shapes.

    A unique residual supplies a testable correspondence. Multiple residuals
    and insufficient visible shape stay unresolved. Hidden identity exchange
    remains possible even when the visible registration is unique.
    """
    from collections import defaultdict
    groups = defaultdict(lambda: [[], []])
    stationary = []
    for entity in before['entities']:
        if unchanged(entity, after):
            stationary.append(entity)
        else:
            groups[entity['signature']][0].append(entity)
    for entity in after['entities']:
        if not unchanged(entity, before):
            groups[entity['signature']][1].append(entity)
    candidates = []
    unresolved = []
    for signature, (left, right) in groups.items():
        if len(left) != 1 or len(right) != 1:
            unresolved.append({'signature': signature, 'before_count': len(left), 'after_count': len(right),
                               'reason': 'multiple_or_missing_residuals'})
            continue
        proof = compatible(left[0], right[0], first, second, before, after)
        if proof is None:
            unresolved.append({'signature': signature, 'before_count': 1, 'after_count': 1,
                               'reason': 'insufficient_visible_shape; reveal_cover_or_relocation_remain_open'})
            continue
        candidates.append({'before': left[0], 'after': right[0], 'visible_comparison': proof,
                           'stationary_same_signature': [entity for entity in stationary if entity['signature'] == signature],
                           'identity_status': 'conditional_visible_correspondence; hidden_exchange_unknown'})
    return {'stationary': stationary, 'candidates': candidates, 'unresolved': unresolved}

