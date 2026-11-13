"""Public measurements: compact controlled core, empty frame and loose silhouette."""
from collections import Counter,defaultdict
import hashlib,json

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:24]
def center(box):return ((box[0]+box[2])/2,(box[1]+box[3])/2)
def unique(observation):
 count=Counter(e['signature'] for e in observation['entities'])
 return {e['signature']:e for e in observation['entities'] if count[e['signature']]==1}
def contains(outer,inner):return outer[0]<=inner[0] and outer[1]<=inner[1] and outer[2]>=inner[2] and outer[3]>=inner[3]
def intersects(a,b):return a[0]<=b[2] and b[0]<=a[2] and a[1]<=b[3] and b[1]<=a[3]
def near(a,b):return max(0,b[0]-a[2],a[0]-b[2])==0 and max(0,b[1]-a[3],a[1]-b[3])==0

def empty_frames(observation,rows):
 horizontal=defaultdict(list);vertical=defaultdict(list)
 for entity in observation['entities']:
  l,t,r,b=entity['bbox'];value=entity['palette_value']
  if t==b and r-l>=2:horizontal[value].append((l,t,r,b))
  if l==r and b-t>=2:vertical[value].append((l,t,r,b))
 frames=[]
 for value,lines in horizontal.items():
  upright=set(vertical[value])
  for left,top,right,_ in lines:
   for l,bottom,rr,_ in lines:
    if l!=left or rr!=right or bottom-top<4:continue
    if (left-1,top+1,left-1,bottom-1) not in upright or (right+1,top+1,right+1,bottom-1) not in upright:continue
    corners=[rows[y][x] for x,y in [(left-1,top),(right+1,top),(left-1,bottom),(right+1,bottom)]]
    if len(set(corners))!=1:continue
    interior={rows[y][x] for y in range(top+1,bottom) for x in range(left,right+1)}
    if len(interior)!=1 or value in interior:continue
    frames.append({'ref':'empty_frame:'+digest([value,left,top,right,bottom]),'palette_value':value,'bbox':[left-1,top,right+1,bottom],'interior_bbox':[left,top+1,right,bottom-1],'center':center([left-1,top,right+1,bottom]),'corner_value':corners[0],'interior_value':next(iter(interior)),'evidence':observation['observation_ref']})
 return frames

def correspondence(observation,rows,controlled=None,known_frames=()):
 frames=empty_frames(observation,rows);result=[]
 body=find_body(observation,controlled) if controlled else None
 if body:
  current={f['ref'] for f in frames}
  for previous in known_frames:
   if previous['ref'] in current:continue
   rebound=revalidate_frame(previous,rows,[body['bbox']],enclosing_contours(observation,body))
   if rebound:frames.append(rebound);current.add(rebound['ref'])
 for frame in frames:
  box=frame['interior_bbox'];width=box[2]-box[0]+1;height=box[3]-box[1]+1
  for entity in observation['entities']:
   l,t,r,b=entity['bbox']
   if entity['signature']==controlled or entity['palette_value']!=frame['palette_value'] or entity.get('identity_ambiguous') or entity['area']<4:continue
   if min(r-l,b-t)<1 or r-l+1>width or b-t+1>height or any(intersects(entity['bbox'],f['bbox']) for f in frames):continue
   result.append({'ref':'correspondence:'+digest([entity['signature'],frame['ref']]),'object':{'signature':entity['signature'],'bbox':entity['bbox'],'center':center(entity['bbox']),'area':entity['area'],'palette_value':entity['palette_value']},'frame':frame,'status':'appearance_and_fit_suggest_reception_not_prove_goal','evidence':[observation['observation_ref']]})
 return result

def moved_core(before,after,*,minimum_area=4,preferred_minimum_area=None):
 a,b=unique(before),unique(after);moving=[]
 for signature in a.keys()&b.keys():
  first,second=a[signature],b[signature];x,y=center(first['bbox']);xx,yy=center(second['bbox']);delta=(xx-x,yy-y)
  if delta==(0,0) or first['area']<minimum_area:continue
  moving.append({'signature':signature,'before_bbox':first['bbox'],'bbox':second['bbox'],'delta':list(delta),'area':first['area'],'palette_value':first['palette_value']})
 # Preserve the established larger-core interpretation; small bodies fill only
 # formerly unbound measurements, never resolve competing larger bodies.
 if preferred_minimum_area is not None:
  preferred=[item for item in moving if item['area']>=preferred_minimum_area]
  if preferred:moving=preferred
 # An enclosing co-moving contour does not define the compact body's collision mask.
 cores=[item for item in moving if not any(other is not item and contains(item['bbox'],other['bbox']) and item['bbox']!=other['bbox'] and item['delta']==other['delta'] for other in moving)]
 return cores[0] if len(cores)==1 else None

def find_body(observation,signature):return unique(observation).get(signature)

def revalidate_frame(frame,rows,occluders=(),contour_values=()):
 l,t,r,b=frame['bbox'];measured=[];corners=0
 if l<0 or t<0 or b>=len(rows) or r>=len(rows[0]):return None
 for y in range(t,b+1):
  for x in range(l,r+1):
   if x not in (l,r) and y not in (t,b):continue
   if any(a<=x<=c and d<=y<=e for a,d,c,e in occluders):continue
   if rows[y][x] in contour_values:continue
   corner=x in (l,r) and y in (t,b);expected=frame['corner_value'] if corner else frame['palette_value']
   if rows[y][x]!=expected:return None
   measured.append([x,y]);corners+=int(corner)
 if corners<2 or len(measured)<(r-l+b-t):return None
 return {**frame,'current_unoccluded_perimeter':measured,'status':'partially_occluded_frame_revalidated' if occluders else 'frame_revalidated'}

def enclosing_contours(observation,body):
 values=[]
 for entity in observation['entities']:
  l,t,r,b=entity['bbox'];width=r-l+1;height=b-t+1
  if contains(entity['bbox'],body['bbox']) and width>2*(body['bbox'][2]-body['bbox'][0]+1) and height>2*(body['bbox'][3]-body['bbox'][1]+1) and entity['area']<width*height/4:values.append(entity['palette_value'])
 return values
