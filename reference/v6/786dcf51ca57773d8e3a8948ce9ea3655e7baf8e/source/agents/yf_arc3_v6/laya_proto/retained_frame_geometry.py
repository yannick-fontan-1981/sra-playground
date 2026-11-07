"""Exact revalidate_frame reuse from C morphology_policy/guarded_binding/geometry.py.
Donor SHA256: 3F9DC74697ACB360BF5CF8A757518AB988C3B4F164F5DBD21B0A27DC161914F7
No occlusion or permissive contour values are supplied by construction caller.
"""
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
