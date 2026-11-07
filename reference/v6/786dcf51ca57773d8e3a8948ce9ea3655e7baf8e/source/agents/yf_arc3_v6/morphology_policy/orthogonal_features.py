"""Measure correspondence without equating pigment, form and relative pose."""
from itertools import combinations
from geometric_observer import rotate
from terminal_composition import identity


def matched_pairs(patterns):
    out=[]
    for a,b in combinations(patterns,2):
        if a["bbox"]==b["bbox"]:continue
        transforms=[k for k in range(4) if rotate(a["mask"],k)==b["mask"]]
        if not transforms:continue
        invariant=min(tuple(sorted(rotate(a["mask"],k))) for k in range(4))
        out.append({"sites":[list(a["bbox"]),list(b["bbox"])],"scales":[a["scale"],b["scale"]],
            "orientations":[identity(sorted(a["mask"])),identity(sorted(b["mask"]))],
            "palette_values":[a["color"],b["color"]],"permitted_turns":transforms,
            "quarter_turns":transforms[0] if len(transforms)==1 else None,
            "shape_class":identity(invariant),"signature":identity(sorted(a["mask"]))})
    return out


def residuals(pair,method):
    values=pair["palette_values"]
    choices=[] if not method else [i for i,s in enumerate(pair["scales"]) if s==method.get("peer_scale")]
    recalled=(len(choices)==1 and sorted(pair["scales"])==sorted(method.get("observed_scales",[]))
              and bool(method.get("after")))
    q=pair["quarter_turns"]
    return {"shape":"homologous_under_rotation","shape_class":pair["shape_class"],
        "orientation":"ambiguous" if q is None else "aligned" if q==0 else "different",
        "orientation_alternatives":list(pair["permitted_turns"]),
        "color":"equal" if values[0]==values[1] else "different","observed_colors":list(values),
        "sites":[list(box) for box in pair["sites"]],"palette_values":list(values),
        "possible_peer":pair["sites"][choices[0]] if recalled else None,
        "prior_method_ref":method["after"] if recalled else None,
        "prior_surface":method.get("site_surface") if recalled else None,
        "scope":"appearance and currently rebound reference-scale hypothesis; scoring role remains conditional"}


def compare_features(first_pair,second_pair):
    if not first_pair or not second_pair:return {"status":"unmeasured","reason":"unique_frame_pair_unavailable"}
    def scene(p):
        return {tuple(box):dict(shape=p["shape_class"],orientation=o,color=v)
                for box,o,v in zip(p["sites"],p["orientations"],p["palette_values"],strict=True)}
    before,after=scene(first_pair),scene(second_pair)
    if set(before)!=set(after) or len(before)!=2:return {"status":"unmeasured","reason":"frame_sites_changed"}
    sites=[{"bbox":list(box),"before":before[box],"after":after[box],
            "changed":[k for k in ("shape","orientation","color") if before[box][k]!=after[box][k]]}
           for box in sorted(before)]
    changed=[r for r in sites if r["changed"]]
    only_color=len(changed)==1 and changed[0]["changed"]==["color"]
    return {"status":"measured","sites":sites,"color_only_at_one_site":only_color,
        "orientation_preserved":all("orientation" not in r["changed"] for r in sites),
        "shape_preserved":all("shape" not in r["changed"] for r in sites),
        "peer_unchanged":len(changed)==1,"score_meaning":"unconfirmed"}
