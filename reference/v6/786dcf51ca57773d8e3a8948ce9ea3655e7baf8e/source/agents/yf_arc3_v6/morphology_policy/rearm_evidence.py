"""Bind selective entry and neutral departure to one observed occurrence."""
from .geometry import footprint, identity, pair_key, pairs


def orientation(rows, key, peer):
    matches=[p for p in pairs(tuple(bytes(r) for r in rows))[0] if pair_key(p)==key]
    if len(matches)!=1:return None
    p=matches[0]
    sites=[tuple(x) for x in p["sites"]]
    if tuple(peer) not in sites or p["quarter_turns"] is None:return None
    index=sites.index(tuple(peer))
    return {"residual":p["quarter_turns"] if index==0 else -p["quarter_turns"]%4,
            "peer_pose":p["orientations"][index],"mobile_pose":p["orientations"][1-index],
            "peer_color":p["palette_values"][index],"mobile_color":p["palette_values"][1-index]}


def entry(plan, before, after, observed_ref, unchanged, known, before_ref=None):
    step=plan["steps"][-1]
    if (step["from"]==step["to"] or before.level!=after.level or before.levels_completed!=after.levels_completed
        or identity(footprint(before.frame_rows,step["from"],plan["size"]))!=plan["footprint_sha"]
        or identity(footprint(before.frame_rows,step["to"],plan["size"]))!=step["surface_sha"]
        or identity(footprint(after.frame_rows,step["to"],plan["size"]))!=plan["footprint_sha"]):
        return None
    key=pair_key(plan["pair"])
    peer=unchanged if unchanged is not None else (known or {}).get("peer")
    if peer is None:return None
    a=orientation(before.frame_rows,key,peer);b=orientation(after.frame_rows,key,peer)
    if not a or not b:return None
    return {"site":step["to"],"site_surface":step["surface_sha"],"footprint":plan["footprint_sha"],
            "size":plan["size"],"role_refs":plan["role_refs"],"from":step["from"],"command":step["action_ref"],
            "before":before_ref or ("frame:"+before.frame_hash),"after":observed_ref,"before_pose":a,"after_pose":b,
            "delta":(b["residual"]-a["residual"])%4,
            "peer_preserved":a["peer_pose"]==b["peer_pose"] and a["peer_color"]==b["peer_color"],
            "peer_scale":plan["pair"]["scales"][plan["pair"]["sites"].index(list(peer))],
            "observed_scales":sorted(plan["pair"]["scales"])}


def role_pos(observation, station):
    roles={r["signature"]:r["bbox"] for r in observation["entities"] if not r["identity_ambiguous"]}
    if not all(s in roles for s in station["role_refs"]):return None
    return tuple(min(roles[s][i] for s in station["role_refs"]) for i in (0,1))


def departure(known, before, after, first, second, command):
    if before["level_epoch"]!=after["level_epoch"] or before["levels_completed"]!=after["levels_completed"]:
        return []
    events=[]
    for (epoch,key),contact in known.items():
        if epoch!=before["level_epoch"] or "peer" not in contact:continue
        for skey,station in contact.get("stations",{}).items():
            site=tuple(station["site"]);size=station["size"]
            a=role_pos(before,station);b=role_pos(after,station)
            if a!=site or not b or a==b:continue
            if (identity(footprint(first,site,size))!=station["footprint"] or
                    identity(footprint(second,b,size))!=station["footprint"] or
                    identity(footprint(second,site,size))!=station["site_surface"]):continue
            old=orientation(first,key,contact["peer"]);new=orientation(second,key,contact["peer"])
            if not old or not new:continue
            events.append({"kind":"departure","epoch":epoch,"pair_key":key,"station_key":skey,
                "from":list(site),"to":list(b),"command":command["action_ref"],"before":before["observation_ref"],
                "after":after["observation_ref"],"preserved":old==new,"before_pose":old,"after_pose":new})
    return events


def prediction(station, current_pose):
    entries=station["entries"]
    deltas={r["delta"] for r in entries}
    if (len({r["after"] for r in entries})<2 or len(deltas)!=1 or 0 in deltas
            or not all(r["peer_preserved"] for r in entries) or not current_pose):
        return None
    delta=next(iter(deltas))
    return {"relation":"selective_entry_rotation_mod4","delta":delta,"before_residual":current_pose["residual"],
            "expected_residual":(current_pose["residual"]+delta)%4,"expected_peer_pose":current_pose["peer_pose"],
            "entry_refs":[r["after"] for r in entries],"falsifiers":["different_residual","peer_changes","site_identity_changes"]}
