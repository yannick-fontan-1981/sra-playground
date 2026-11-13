"""Creator-side causal controls on synthetic measurements; never issues game actions."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from statistics import median
import sys
from tempfile import TemporaryDirectory
from time import perf_counter

from .policy import HERE, MorphologyPolicy


def main(output):
    output = Path(output)
    policy = MorphologyPolicy()
    start = [2, 3]
    def route(end):
        return dict(level_epoch="epoch:1", observation_ref="obs:7", start_xy=start, end_xy=end,
                    actions=[{"ref":"ACTION4"},{"ref":"ACTION1"}])
    facts = dict(level_epoch="epoch:1", observation_ref="obs:7", framed_pair=True, homologous=True,
        asymmetric=True, orientation_relation="different", control_attested=True, single_pattern_contact_change=False,
        alignment_refuted=False, controlled_xy=start, modifier_xy=[8,3], peer_xy=[12,9],
        routes={"modifier":route([8,3]), "peer":route([12,9])})
    rows = []
    def check(label, measured, phase, access, runtime=policy):
        began = perf_counter()
        receipt = runtime.evaluate(measured)
        elapsed = (perf_counter()-began)*1000
        if (receipt["status"], receipt["route_key"]) != (phase, access):
            raise ValueError(f"{label}: unexpected {receipt['status']} {receipt['route_key']}")
        if receipt["operation"] != ("OP18" if access else None) or receipt["release_authority"]:
            raise ValueError(f"{label}: invalid proposed operation or physical authority")
        rows.append({"case":label,"status":phase,"target":access,"operation":receipt["operation"],
                     "composition":receipt["composition"],"reason":receipt["reason"],"elapsed_ms":elapsed,
                     "route_bindings":receipt["route_bindings"],"projection_refs":receipt["projection_refs"],
                     "principle_refs":receipt["principle_refs"],"src_hash":receipt["src_hash"],
                     "drm_hash":receipt["drm_hash"],"src_status":receipt["src_status"]})
    check("different_pose", facts, "proposed","modifier")
    aligned=dict(facts,orientation_relation="aligned",single_pattern_contact_change=True)
    check("aligned_after_selective_contact",aligned,"proposed","peer")
    check("aligned_without_contact_evidence",dict(aligned,single_pattern_contact_change=False),"retained",None)
    check("pose_ambiguous",dict(facts,orientation_relation="ambiguous"),"retained",None)
    check("control_unbound",dict(facts,control_attested=False),"retained",None)
    check("access_missing",dict(facts,routes={}),"retained",None)
    check("pattern_pair_unmeasured",dict(facts,homologous=False),"deferred",None)
    check("explicit_counterexample",dict(facts,alignment_refuted=True),"refuted",None)
    for field, bad in [("level_epoch","stale"),("observation_ref","obs:6"),("start_xy",[0,0]),
                       ("end_xy",[13,9]),("actions",[]),("actions",["ACTION1"]*17)]:
        changed=deepcopy(aligned)
        changed["routes"]["peer"][field]=bad
        check("invalid_"+field+("_over_cap" if field=="actions" and bad else ""),changed,"retained",None)
    with TemporaryDirectory() as tmp:
        doc=json.loads((HERE/"morphology_policy.drm").read_bytes())
        rules=doc["declarations"][-1]["fact_projections"]
        rules[:]=[r for r in rules if r["id"]!="projection.morph.probe_modifier"]
        path=Path(tmp)/"removed.drm"
        path.write_text(json.dumps(doc),encoding="utf8")
        missing=MorphologyPolicy(drm_path=path)
        check("ablated_modifier_projection",facts,"retained",None,missing)
        check("ablation_preserves_peer",aligned,"proposed","peer",missing)
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open("x",encoding="utf8") as f:
        json.dump(dict(scope="synthetic public measurements; no simulator and no physical release",
                  verified=True,cases=rows,median_warm_ms=median(r["elapsed_ms"] for r in rows[1:]),
                  source_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest()
                                 for p in (HERE/"morphology_policy.drm",HERE/"morphology.src",HERE/"policy.py",
                                           HERE/"src_runtime.py",HERE/"qualify.py")}),f,indent=2)
    print(json.dumps(dict(cases=len(rows),median_warm_ms=median(r["elapsed_ms"] for r in rows[1:]),
                          source_hash=rows[0]["src_hash"], drm_hash=rows[0]["drm_hash"])))


if __name__ == "__main__":
    main(sys.argv[1])
