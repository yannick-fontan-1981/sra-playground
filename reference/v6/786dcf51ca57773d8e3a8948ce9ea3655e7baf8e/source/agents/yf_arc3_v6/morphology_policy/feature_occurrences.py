"""Rebind actually observed, scope-specific selective palette effects to the screen."""
from terminal_composition import identity


def known_feature_sites(current,pair,history,feature_trials,origin,size):
    sites=pair.get("sites",[]);epoch=current.epoch
    pair_ref=identity([epoch,identity(sorted(sites))])
    # An older durable observation may lack an explicit epoch or surface
    # digest. Its exact before/after references in the public prefix recover
    # both; guessing from an opaque reference or from coordinates is forbidden.
    history_by_edge={(a.ref,b.ref):(a,b) for a,_,b in history if a.epoch==b.epoch==epoch}
    def patch(scene,p):
        x,y=p;w,h=size
        if x<0 or y<0 or x+w>len(scene.rows[0]) or y+h>len(scene.rows):return None
        return tuple(v for row in scene.rows[y:y+h] for v in row[x:x+w])
    result={}
    for t in (feature_trials or {}).values():
        if not t.get("arrived") or not t.get("before_ref") or not t.get("after_ref"):continue
        if t.get("epoch",epoch)!=epoch or t.get("pair_ref",pair_ref)!=pair_ref:continue
        frames=history_by_edge.get((t["before_ref"],t["after_ref"]))
        if frames is None and (t.get("epoch")!=epoch or t.get("pair_ref")!=pair_ref):continue
        d=t.get("outcome") or {}
        rows=d.get("sites",[])
        if len(rows)!=2 or identity(sorted(r["bbox"] for r in rows))!=identity(sorted(sites)):continue
        p=tuple(t["site"])
        saved=t.get("site_surface")
        if frames:
            before=identity(patch(frames[0],p))
            if saved and saved!=before:continue
            saved=before
        if not saved or (p!=tuple(origin) and identity(patch(current,p))!=saved):continue
        record=result.setdefault(p,{"id":"feature:"+identity([epoch,p,saved]),"sites":[list(p)],"site_surface":saved,
                                     "evidence":[],"effects":[],"uncertain_sources":[]})
        changed=[r for r in rows if r["changed"]]
        if len(changed)!=1 or not d.get("color_only_at_one_site") or not d.get("orientation_preserved") or not d.get("shape_preserved"):
            record["uncertain_sources"].extend(r["before"]["color"] for r in rows)
            continue
        row=changed[0]
        if row["changed"]!=["color"]:continue
        record["evidence"].append(t["after_ref"])
        record["effects"].append({"from_color":row["before"]["color"],"to_color":row["after"]["color"],
            "mobile_site":row["bbox"],"before":t["before_ref"],"after":t["after_ref"]})
    return result
