"""Source81 declarations executed by SRC; measurements never choose their rank."""
from copy import deepcopy
from hashlib import sha256
from inspect import getsourcefile, signature
from pathlib import Path
from uuid import uuid4

from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from agents.yf_arc3_v5.drm.runtime import build_drm_authority_registry, declared_eligibility_matches
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.scheduler.operator_builders import register_operator_builders
from agents.yf_arc3_v6.morphology_policy import src_runtime as engine

POLICY = "policy.prepare_observed_peer_composition_access"
PUBLICATION = "schema.source81_publication"
SCOPE = "schema.source81_scope"


class _DeclaredProgram:
    def __init__(self, path, workflow_id, callbacks, drm):
        self.workflow_id = workflow_id
        self.drm = drm
        self.calls = engine.SchedulerRuntimeRegistry()
        register_operator_builders(self.calls)
        self.workflows = engine.WorkflowRegistry()
        definitions = list(drm.symbol_definitions())
        for name, callback in callbacks.items():
            code_path = Path(getsourcefile(callback))
            definition = engine.SymbolDefinition(
                id=name, kind=engine.SymbolKind.WORKFLOW,
                parameters=tuple(engine.ParameterSpec(name=k, type_spec=engine.TypeSpec(name="Any"))
                                 for k in signature(callback).parameters),
                output_type=engine.TypeSpec(name="Any"), effect_class=engine.EffectClass.PURE,
                source_unit=str(code_path), source_hash=sha256(code_path.read_bytes()).hexdigest())
            definitions.append(definition)
            self.calls.register_call(definition, lambda ctx, fn=callback: fn(**engine.plain(ctx.arguments)))
        environment = engine.CompilerEnvironment(
            types=("Any", "Boolean", "Integer", "String", "Ref", "List", "Set", "Map",
                   "Assessment", "SelectionInput", "SelectionResult"), symbols=tuple(definitions))
        self.module = engine.compile_source(path.read_text(encoding="utf8"), source_name=str(path), environment=environment)
        self.entry = self.workflows.register(self.module)
        self.calls.validate_compiled_calls((self.module,), active_workflow_refs=(workflow_id,))
        self.calls.seal_qualified()

    def run(self, inputs):
        identity = "instance:" + uuid4().hex
        store = engine.EventStore("run:" + identity.split(":")[1])
        scheduler = engine.WorkflowScheduler(workflow_registry=self.workflows, runtime_registry=self.calls,
            operator_runtime=engine.OperatorRuntime(store, build_drm_authority_registry(self.drm)))
        scheduler.start(engine.WorkflowStartRequest(workflow_definition_id=self.workflow_id,
            workflow_instance_id=identity, run_id=store.run_id, timeline_id="timeline:source81-policy",
            frame_id="frame:source81-policy", expected_transitive_source_hash=self.entry.transitive_source_hash,
            inputs=inputs))
        step = scheduler.advance_bounded(identity, instruction_quantum=128, maximum_instructions=1024,
                                          durable_boundaries_only=True)
        checkpoint = step.checkpoint
        if checkpoint.status.value != "completed":
            raise ValueError(f"Source81 SRC {checkpoint.status.value}: {checkpoint.terminal_result}")
        bindings = checkpoint.local_bindings
        result = engine.plain(bindings[bindings[engine.SRC_TERMINAL_BINDING_REF]])
        return result, {"workflow": self.workflow_id, "src_hash": self.entry.transitive_source_hash,
                        "src_status": checkpoint.status.value,
                        "executed_statements": list(step.executed_statement_ids)}


class Source81Policy:
    def __init__(self):
        here = Path(__file__).parent
        self.loaded = load_drm_document(here / "source81-declarations.drm")
        self.continuation_loaded = load_drm_document(here / "source81-continuation.drm")
        self.drm = DrmRegistry()
        self.drm.register(self.loaded)
        self.drm.register(self.continuation_loaded)
        self.context_loaded = load_drm_document(here / "source81-publication-context.drm")
        self.drm.register(self.context_loaded)
        self.revision_loaded=load_drm_document(here / "source81-target-revision.drm")
        self.drm.register(self.revision_loaded)
        self.drm.seal()
        callbacks = {"source81.project_candidates": self._candidates,
                     "source81.finish_selection": self._finish,
                     "source81.abstain": self._abstain,
                     "source81.publish_continuation": self._publish_continuation,
                     "source81.publish_target_revision":self._publish_target_revision,
                     "source81.publish": self._publish}
        self.prepare_src = _DeclaredProgram(here / "source81.src", "v6.source81.prepare", callbacks, self.drm)
        self.revision_src=_DeclaredProgram(here / "source81.src", "v6.source81.revise_target", callbacks,self.drm)
        self.project_src = _DeclaredProgram(here / "source81.src", "v6.source81.project", callbacks, self.drm)
        self.continue_src = _DeclaredProgram(here / "source81.src", "v6.source81.continue_target", callbacks, self.drm)

    def _project(self, policy, refs, facts):
        return engine.plain(project_declared_alternatives(drm=self.drm, selection_policy_ref=policy,
            alternative_refs=tuple(refs), descriptive_facts=facts).model_dump())

    def _candidates(self, request):
        common = request["question_facts"]
        raw = {}
        for row in request["rows"]:
            ref = row.get("alternative_ref", row["candidate_ref"])
            if ref in raw:
                raise ValueError("duplicate Source81 alternative")
            facts = {**deepcopy(row), **deepcopy(common), "alternative_ref": ref}
            facts["current_identity_binding"] = (
                common.get("current_identity_binding") is True
                and common.get("parent_peer_component_ref") is not None
                and row.get("peer_component_ref") == common["parent_peer_component_ref"])
            cost, remaining = facts.get("total_primitive_distance"), common.get("remaining_budget")
            facts["within_remaining_budget"] = (type(cost) is int and type(remaining) is int
                                                 and 0 <= cost <= remaining)
            raw[ref] = facts
        if not raw:
            raw["source81.empty_inventory"] = {"empty_source81_inventory": True,
                "within_remaining_budget": False, "current_identity_binding": False}
        projected = self._project(POLICY, raw, raw)
        scoped = self._project(SCOPE, raw, projected["alternative_facts"])
        declaration, _ = self.drm.resolve(POLICY)
        eligible = any(declared_eligibility_matches(facts, declaration)
                       for facts in scoped["alternative_facts"].values())
        return {**scoped, "projection_refs": list(dict.fromkeys(
            projected["projection_refs"] + scoped["projection_refs"])),
            "goal_ref": common["question_ref"], "has_eligible": eligible}

    def _abstain(self, measured):
        return {"status": "abstain", "reason": "no_declared_current_composition_within_physical_budget",
                "projection_refs": measured["projection_refs"], "release_authority": False}

    def _finish(self, request, measured, assessment):
        selected = assessment.get("alternatives", {}).get("selected")
        if not selected:
            return {"status": "abstain", "assessment": assessment,
                    "projection_refs": measured["projection_refs"], "release_authority": False}
        rows = {r.get("alternative_ref", r["candidate_ref"]): r for r in request["rows"]}
        if selected not in rows:
            raise ValueError("SELECT returned an undeclared Source81 candidate")
        facts = measured["alternative_facts"][selected]
        row = {**deepcopy(rows[selected]), "facts": facts}
        return {"status": "selected", "selected_ref": selected, "selected_row": row,
                "projection_refs": measured["projection_refs"], "assessment": assessment,
                "policy_ref": POLICY, "drm_hash": self.loaded.source_hash,
                "conditional_scope": "stationary_or_one_cell_responses_not_a_complete_acquired_response_law",
                "release_authority": False}

    def _publish(self, request):
        ref = request.get("alternative_ref", "source81.current_candidate")
        contextual = self._project("schema.source81_current_publication_context", (ref,), request)
        projected = self._project(PUBLICATION, (ref,), contextual["alternative_facts"][ref])
        used = projected["projection_refs"]
        facts = projected["alternative_facts"][ref]
        return {"status": "projected" if used else "abstain", "facts": facts,
                "projected": facts, "projection_refs": used, "drm_hash": self.loaded.source_hash,
                "release_authority": False,"context_projection_refs":contextual["projection_refs"],"context_drm_hash":self.context_loaded.source_hash}

    def prepare(self, rows, question_facts):
        return self.prepare_src.run({"request": {"rows": rows, "question_facts": question_facts}})

    def project(self, facts):
        return self.project_src.run({"request": facts})

    def _publish_continuation(self, request):
        ref = request.get("alternative_ref", "source81.retained_target")
        projected = self._project("policy.v6_source81_continuation", (ref,), request)
        facts = projected["alternative_facts"][ref]
        return {"status": "continuation" if facts.get("source81_continuation_eligible") is True else "abstain",
                "facts": facts, "projected": facts, "projection_refs": projected["projection_refs"],
                "drm_hash": self.continuation_loaded.source_hash, "release_authority": False,
                "qualification_scope": "V6 continuity adaptation; current guards required; no new physics"}

    def continue_target(self, facts):
        return self.continue_src.run({"request": facts})

    def _publish_target_revision(self,request):
        ref=request.get("old_target_ref","source81.no_retained_target")
        out=self._project("policy.v6_source81_target_revision",(ref,),request)
        facts=out["alternative_facts"][ref]
        return {"status":"revision"if facts.get("target_revision_admitted")is True else"abstain","facts":facts,"projection_refs":out["projection_refs"],"drm_hash":self.revision_loaded.source_hash,"release_authority":False}

    def revise_target(self,facts):return self.revision_src.run({"request":facts})
