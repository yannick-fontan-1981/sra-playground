"""Palette-neutral, bounded image measurements. No game roles are assigned here."""
import hashlib
import math
from collections import deque


def components(rows):
    h, w = len(rows), len(rows[0])
    if h*w > 65536:
        raise ValueError("Frame exceeds admitted measurement domain")
    seen, found = set(), []
    for y in range(h):
        for x in range(w):
            if (x,y) in seen:
                continue
            color, todo, pts = rows[y][x], [(x,y)], []
            seen.add((x,y))
            while todo:
                px,py = todo.pop()
                pts.append((px,py))
                for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                    if 0 <= nx < w and 0 <= ny < h and (nx,ny) not in seen and rows[ny][nx] == color:
                        seen.add((nx,ny)); todo.append((nx,ny))
            left,top = min(p[0] for p in pts), min(p[1] for p in pts)
            right,bottom = max(p[0] for p in pts), max(p[1] for p in pts)
            mask = frozenset((px-left,py-top) for px,py in pts)
            widths = []
            for py in range(bottom-top+1):
                xs = sorted(px for px,yy in mask if yy == py)
                if xs:
                    count = 1
                    for a,b in zip(xs,xs[1:]):
                        if b == a+1: count += 1
                        else: widths.append(count); count = 1
                    widths.append(count)
            for px in range(right-left+1):
                ys = sorted(py for xx,py in mask if xx == px)
                if ys:
                    count = 1
                    for a,b in zip(ys,ys[1:]):
                        if b == a+1: count += 1
                        else: widths.append(count); count = 1
                    widths.append(count)
            scale = math.gcd(*widths) if widths else 1
            normalized = frozenset((px//scale,py//scale) for px,py in mask)
            found.append({"id": f"component-{len(found)}", "color": color, "bbox": [left,top,right,bottom],
                          "area": len(pts), "scale": scale, "mask": mask, "normalized": normalized,
                          "rectangular": len(pts) == (right-left+1)*(bottom-top+1)})
    return found


def rotate(mask, turns=1):
    out = mask
    for _ in range(turns % 4):
        height = max(y for x,y in out)+1
        out = frozenset((height-1-y,x) for x,y in out)
    return out


def correspondences(parts):
    result = []
    for i,a in enumerate(parts):
        if a["rectangular"]: continue
        for b in parts[i+1:]:
            turns = [r for r in range(4) if rotate(a["normalized"],r) == b["normalized"]]
            if turns:
                result.append({"first":a["id"], "second":b["id"], "quarter_turns":turns,
                               "same_color":a["color"] == b["color"], "scale_ratio":[a["scale"],b["scale"]],
                               "orientation_already_equal":0 in turns})
    return result


def transitions(before, after):
    changes = []
    for a in before:
        matches = []
        for b in after:
            if a["color"] != b["color"]: continue
            turns = [r for r in range(4) if rotate(a["normalized"],r) == b["normalized"]]
            if turns and a["area"] == b["area"]:
                matches.append({"after":b["id"], "translation":[b["bbox"][0]-a["bbox"][0],b["bbox"][1]-a["bbox"][1]],
                                "quarter_turns":turns, "scale_preserved":a["scale"] == b["scale"]})
        if len(matches) == 1:
            m = matches[0]
            if m["translation"] != [0,0] or 0 not in m["quarter_turns"]:
                changes.append({"before":a["id"], **m, "attribution":"observed_difference_not_causal_proof"})
    return changes


def compact(parts):
    return [{k:v for k,v in p.items() if k not in {"mask","normalized"}} for p in parts]


def framed_patterns(rows, parts, occlusion_bbox=None):
    """Gather ALL foreground islands inside a two-valued rectangular carrier."""
    patterns = []
    for p in parts:
        l,t,r,b = p["bbox"]
        if p["rectangular"] or max(r-l+1,b-t+1) > 32 or min(r-l+1,b-t+1) < 5:
            continue
        def visible(x,y):
            return occlusion_bbox is None or not (occlusion_bbox[0]<=x<=occlusion_bbox[2] and occlusion_bbox[1]<=y<=occlusion_bbox[3])
        colors = {rows[y][x] for y in range(t,b+1) for x in range(l,r+1) if visible(x,y)}
        if len(colors) != 2: continue
        other = next(c for c in colors if c != p["color"])
        points = [(x,y) for y in range(t,b+1) for x in range(l,r+1) if visible(x,y) and rows[y][x] == other]
        if not points: continue
        x0,y0 = min(x for x,y in points),min(y for x,y in points)
        x1,y1 = max(x for x,y in points),max(y for x,y in points)
        # Exact uniform block compression, preserving holes and orientation.
        scale = 1
        for k in range(2,min(x1-x0+1,y1-y0+1)+1):
            if (x1-x0+1)%k or (y1-y0+1)%k: continue
            blocks = {}
            for y in range(y0,y1+1):
                for x in range(x0,x1+1):
                    blocks.setdefault(((x-x0)//k,(y-y0)//k),set()).add(rows[y][x] == other)
            if all(len(v)==1 for v in blocks.values()): scale = k
        mask = frozenset(((x-x0)//scale,(y-y0)//scale) for x,y in points)
        patterns.append({"id":p["id"], "bbox":p["bbox"], "color":other,"scale":scale,"mask":mask,
                         "center": [(l+r)//2,(t+b)//2], "foreground_area":len(points)})
    return patterns


def matching_rules(rules, facts):
    return [r for r in rules if all(facts.get(k) == v for k,v in r["when"].items())]


def alignment_scene(rows, policy, occlusion_bbox=None):
    parts = components(rows)
    patterns = framed_patterns(rows, parts, occlusion_bbox)
    pairs = []
    for a in patterns:
        for b in patterns:
            if a["scale"] <= b["scale"]: continue
            turns = [r for r in range(4) if rotate(a["mask"],r) == b["mask"]]
            if turns: pairs.append((a,b,turns))
    if len(pairs) != 1:
        raise ValueError("Unresolved framed-pattern pair domain: " + str(len(pairs)))
    display,target,turns = pairs[0]
    h,w = len(rows),len(rows[0])
    interior = [p for p in parts if p["bbox"][0]>0 and p["bbox"][1]>0 and p["bbox"][2]<w-1 and p["bbox"][3]<h-1]
    maximum = max(p["area"] for p in interior)
    substrates = [p for p in interior if matching_rules(policy["role_rules"],
                  {"largest_interior_component":p["area"] == maximum,"rectangular":p["rectangular"]})]
    if len(substrates) != 1: raise ValueError("Unresolved substrate domain")
    roles = []
    for p,facts in [(display,{"paired_shape":True,"larger_scale":True}),
                    (target,{"paired_shape":True,"smaller_scale":True}),
                    (substrates[0],{"largest_interior_component":True,"rectangular":False})]:
        for rule in matching_rules(policy["role_rules"],facts):
            roles.append({"entity":p["id"],"role":rule["id"],"status":rule["status"],"evidence":facts,"falsifier":rule["falsifier"]})
    return {"parts":parts,"display":display,"target":target,"substrate":substrates[0],"roles":roles,
            "residual":{"shape_equal_under_rotation":True,"orientation_turns":turns,"color_equal":display["color"] == target["color"]},
            "aligned":0 in turns and display["color"] == target["color"]}


def moved_body(before, after, previous_bbox=None):
    if previous_bbox is not None:
        l,t,r,b = previous_bbox
        before = [p for p in before if l<=p['bbox'][0]<=p['bbox'][2]<=r and t<=p['bbox'][1]<=p['bbox'][3]<=b]
    changes = transitions(before,after)
    changes = [c for c in changes if c["translation"] != [0,0] and 0 in c["quarter_turns"]]
    vectors = {tuple(c["translation"]) for c in changes}
    if len(vectors) != 1: raise ValueError("Ambiguous controlled translation")
    selected = [p for p in after if p["id"] in {c["after"] for c in changes}]
    bounds = [min(p["bbox"][0] for p in selected),min(p["bbox"][1] for p in selected),
              max(p["bbox"][2] for p in selected),max(p["bbox"][3] for p in selected)]
    return {"bbox":bounds,"center":[(bounds[0]+bounds[2])//2,(bounds[1]+bounds[3])//2],
            "translation":list(next(iter(vectors))),"parts":[p["id"] for p in selected]}


def grid_paths(rows, scene, body, step):
    """Pure graph enumeration on the observed substrate and measured lattice."""
    start = tuple(body["center"])
    l,t,r,b = scene["substrate"]["bbox"]
    value = scene["substrate"]["color"]
    half = step//2
    cells = {}
    for y in range(start[1]%step,len(rows),step):
        for x in range(start[0]%step,len(rows[0]),step):
            if not (l<=x<=r and t<=y<=b): continue
            values = [rows[yy][xx] for yy in range(max(0,y-half),min(len(rows),y+half+1)) for xx in range(max(0,x-half),min(len(rows[0]),x+half+1))]
            if sum(v == value for v in values) > len(values)//2:
                cells[(x,y)] = values
    cells[start] = []
    destination = tuple(scene["target"]["center"])
    cells[destination] = []  # Explicit candidate target-entry test, not a known free cell.
    paths = {start:[]}
    queue = deque([start])
    for_current = [("ACTION1",0,-step),("ACTION2",0,step),("ACTION3",-step,0),("ACTION4",step,0)]
    while queue:
        x,y = queue.popleft()
        for action,dx,dy in for_current:
            nxt = x+dx,y+dy
            if nxt in cells and nxt not in paths:
                paths[nxt] = paths[(x,y)]+[action];queue.append(nxt)
    return cells,paths
