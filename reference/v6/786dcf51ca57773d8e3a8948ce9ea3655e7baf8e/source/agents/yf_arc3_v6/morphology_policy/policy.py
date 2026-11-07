from pathlib import Path

from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from .src_runtime import SrcProgram, plain

HERE = Path(__file__).resolve().parent
from agents.yf_arc3_v5.drm import loader as production_loader
PRINCIPLES = Path(production_loader.__file__).with_name("morphology.drm")
FLAGS = ("framed_pair", "homologous", "asymmetric", "control_attested",
         "single_pattern_contact_change", "alignment_refuted")
OUTPUT = ("role", "composition", "operation", "route_key", "status", "reason", "alternatives",
          "falsifiers", "principle_refs", "projection_refs", "release_authority")


def xy(value):
    return tuple(value) if isinstance(value, (list, tuple)) and len(value) == 2 and all(
        type(v) is int and 0 <= v < 64 for v in value) else None


def route_binding(facts, route, expected):
    if not isinstance(route, dict):
        return "missing"
    if any(route.get(key) != facts[key] for key in ("observation_ref", "level_epoch")):
        return "stale_scope"
    start = xy(facts.get("controlled_xy"))
    end = xy(facts.get(expected + "_xy"))
    if start is None or end is None or xy(route.get("start_xy")) != start or xy(route.get("end_xy")) != end:
        return "unbound_endpoint"
    actions = route.get("actions")
    if not isinstance(actions, (tuple, list)) or not 1 <= len(actions) <= 16:
        return "missing_bounded_set"
    return "bound"


class MorphologyPolicy:
    def __init__(self, drm_path=HERE / "morphology_policy.drm"):
        self.registry = DrmRegistry()
        self.drm = load_drm_document(Path(drm_path))
        self.principles = load_drm_document(PRINCIPLES)
        self.registry.register(self.drm)
        self.registry.register(self.principles)
        self.src = SrcProgram(HERE/"morphology.src", "v6.morphology.evaluate", {"morph.project":self.project})

    def project(self, policy, facts):
        projected = project_declared_alternatives(drm=self.registry, selection_policy_ref=policy,
                                                  alternative_refs=(), descriptive_facts=facts)
        only, = projected.alternative_refs
        result = plain(projected.alternative_facts[only])
        result["projection_refs"] = [*facts.get("projection_refs", ()), *projected.projection_refs]
        return result

    def evaluate(self, facts):
        context = {k: facts.get(k) for k in ("observation_ref", "level_epoch")}
        if any(not isinstance(v, (str, int)) or isinstance(v, bool) or v == "" for v in context.values()):
            raise ValueError("Current observation and epoch required")
        for key in FLAGS:
            value = facts.get(key, False)
            if type(value) is not bool:
                raise ValueError(f"Boolean measurement required: {key}")
            context[key] = value
        orientation = facts.get("orientation_relation", "ambiguous")
        if orientation not in ("different", "aligned", "ambiguous"):
            raise ValueError("Invalid measured orientation relation")
        context["orientation_relation"] = orientation
        color=facts.get("color_relation","unmeasured")
        if color not in ("equal","different","unmeasured"):raise ValueError("Invalid public palette comparison")
        context["color_relation"]=color
        if type(facts.get("peer_discrimination_bound",False)) is not bool:
            raise ValueError("Boolean peer discrimination measurement required")
        context["peer_discrimination_bound"]=facts.get("peer_discrimination_bound",False)
        context["extension_route"]=facts.get("extension_route")
        context["extension_kind"]=facts.get("extension_kind")
        measurements = {}
        context["managed_capacity_bound"]=facts.get("managed_capacity_bound",False)
        context["entry_rebind_bound"]=facts.get("entry_rebind_bound",False)
        context["entry_probe_bound"]=facts.get("entry_probe_bound",False)
        context["feature_reaccess_bound"]=facts.get("feature_reaccess_bound",False)
        context["capacity_needed"]=facts.get("capacity_needed",False)
        for name in ("modifier", "peer","peer_access_probe","feature_probe","capacity_probe","capacity_access_probe","managed_access","entry_rebind","entry_probe"):
            route = facts.get("routes", {}).get(name)
            bound = route_binding(context | {k:facts.get(k) for k in ("controlled_xy", name+"_xy")},
                                  route, name)
            measurements[name] = bound
            context[name+"_route_bound"] = bound == "bound"
            forecast=facts.get("meter_forecast")
            length=route.get("full_access_length",len(route.get("actions",()))) if route else 0
            context[name+"_fits_forecast"]=(not forecast or length<=forecast["steps_before_empty"])
            context[name+"_approach_only"] = bool(route and route.get("contact_in_prefix") is False)
        result, receipt = self.src.run({"facts": context})
        decision = {k:result[k] for k in OUTPUT}
        for field in ("feature_hypotheses","feature_falsifiers","preserve_features"):
            if field in result:decision[field]=result[field]
        principle_evidence = []
        for ref in decision["principle_refs"]:
            declaration, source = self.registry.resolve(ref)
            if source.source_hash != self.principles.source_hash:
                raise ValueError("Morphology principle belongs to a different source")
            principle_evidence.append({"id":declaration.id, "falsifiers":list(declaration.falsifiers)})
        return {**decision, **receipt, "drm_hash":self.drm.source_hash,
                "principles_hash":self.principles.source_hash, "principle_evidence":principle_evidence,
                "route_bindings":measurements, "level_epoch":context["level_epoch"],
                "observation_ref":context["observation_ref"]}
