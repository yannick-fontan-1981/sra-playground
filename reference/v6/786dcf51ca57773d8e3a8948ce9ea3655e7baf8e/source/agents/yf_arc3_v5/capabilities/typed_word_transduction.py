"""Bounded typed word algorithms over supplied masks, rules and edit domains.

Creator-side K30 implementation in progress: production-bound, with CODED
promotion pending completion of the remaining bounded continuation mechanisms.
"""
from __future__ import annotations

from collections import Counter, deque
from heapq import heappop, heappush
import hashlib
import json
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope, family_result

Word = tuple[Ref, ...]
K30_CALCULATION_REVISION = "typed_word_transduction.continuation.v2"


class WordTileTransform(FrozenModel):
    transform_ref: Ref
    quarter_turns: int = Field(ge=0, le=3)
    reflect_x: bool


class WordTile(FrozenModel):
    glyph_ref: Ref
    observed_pose_ref: Ref
    width: int = Field(ge=1, le=256)
    height: int = Field(ge=1, le=256)
    pixels: tuple[tuple[int, int, Ref], ...] = Field(min_length=1, max_length=65536)
    allowed_identity_transforms: tuple[WordTileTransform, ...] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def complete_inner_mask(self):
        points = {(x, y) for x, y, _ in self.pixels}
        if len(points) != len(self.pixels) or len(points) != self.width * self.height:
            raise ValueError("glyph identity needs the complete inner tile, including empty pixels")
        if any(not 0 <= x < self.width or not 0 <= y < self.height for x, y in points):
            raise ValueError("glyph pixels lie outside the supplied inner tile")
        if len({t.transform_ref for t in self.allowed_identity_transforms}) != len(self.allowed_identity_transforms):
            raise ValueError("allowed identity transforms need unique references")
        return self


class TypedWordRule(FrozenModel):
    rule_ref: Ref
    input_type_ref: Ref
    output_type_ref: Ref
    left: Word = Field(min_length=1, max_length=64)
    right: Word = Field(max_length=64)
    provenance_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)


class TypedWordExample(FrozenModel):
    evidence_ref: Ref
    input_type_ref: Ref
    output_type_ref: Ref
    input_word: Word = Field(max_length=4096)
    output_word: Word = Field(max_length=4096)


class WordEditVariant(FrozenModel):
    phase_ref: Ref
    rules: tuple[TypedWordRule, ...] = Field(min_length=1, max_length=64)
    glyph_offsets: tuple[tuple[int, int], ...] = Field(max_length=256)


class WordEditArc(FrozenModel):
    from_phase_ref: Ref
    to_phase_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    primitive_cost: int = Field(ge=0)


class WordEditUnit(FrozenModel):
    unit_ref: Ref
    current_phase_ref: Ref
    variants: tuple[WordEditVariant, ...] = Field(min_length=1, max_length=128)
    arcs: tuple[WordEditArc, ...] = Field(max_length=512)
    cycle_domain_complete: bool

    @model_validator(mode="after")
    def declared_phase_graph(self):
        phases = {v.phase_ref for v in self.variants}
        if len(phases) != len(self.variants) or self.current_phase_ref not in phases:
            raise ValueError("edit phases must be unique and contain the current phase")
        if any(a.from_phase_ref not in phases or a.to_phase_ref not in phases for a in self.arcs):
            raise ValueError("an edit arc cannot invent an unobserved phase")
        return self


class WordFocusArc(FrozenModel):
    from_unit_ref: Ref
    to_unit_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    primitive_cost: int = Field(ge=0)


class WordValidationTrigger(FrozenModel):
    event_ref: Ref
    triggering_operation: Literal["MUTATION", "FOCUS"]
    phase_conditions: FrozenMap
    effect_ref: Ref
    evidence_ref: Ref
    continuation_after_effect_allowed: bool


class TypedWordRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.typed_word_request.v1"
    kernel_ref: Literal["mechanics.typed_word_transduction"] = "mechanics.typed_word_transduction"
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ("mechanics.typed_word_transduction.canonicalization", "MEASURE"),
        ("mechanics.typed_word_transduction.parse_transduce", "PATH"),
        ("mechanics.typed_word_transduction.compose_types", "PATH"),
        ("mechanics.typed_word_transduction.phase_domain", "INVERSE_DOMAIN"),
        ("mechanics.typed_word_transduction.dictionary_constraints", "FIT"),
        ("mechanics.typed_word_transduction.edit_successor", "SUCCESSOR"),
        ("mechanics.typed_word_transduction.visit_cost", "MEASURE"),
        ("mechanics.typed_word_transduction.validation_evidence", "MEASURE"),
        ("mechanics.typed_word_transduction.precondition", "PRECONDITION"),
    )
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    tiles: tuple[WordTile, ...] | None = Field(default=None, max_length=256)
    rules: tuple[TypedWordRule, ...] | None = Field(default=None, max_length=512)
    input_word: Word | None = Field(default=None, max_length=4096)
    input_type_ref: Ref | None = None
    output_type_ref: Ref | None = None
    type_pipeline: tuple[Ref, ...] | None = Field(default=None, min_length=2, max_length=17)
    edit_units: tuple[WordEditUnit, ...] | None = Field(default=None, max_length=128)
    fixed_examples: tuple[TypedWordExample, ...] | None = Field(default=None, max_length=128)
    require_bijection: bool | None = None
    left_arities: FrozenMap | None = None
    right_arities: FrozenMap | None = None
    repeated_phase_groups: tuple[tuple[Ref, ...], ...] | None = Field(default=None, max_length=128)
    focus_unit_ref: Ref | None = None
    requested_unit_ref: Ref | None = None
    requested_action_ref: Ref | None = None
    requested_edit_operation: Literal["MUTATION", "FOCUS"] | None = None
    focus_arcs: tuple[WordFocusArc, ...] | None = Field(default=None, max_length=4096)
    target_phase_refs: FrozenMap | None = None
    validation_trigger_ref: Ref | None = None
    validation_trigger: WordValidationTrigger | None = None
    highlighted_spans: tuple[tuple[int, int, Ref], ...] | None = Field(default=None, max_length=512)
    supplied_derivation: tuple[tuple[int, int, Ref], ...] | None = Field(default=None, max_length=512)
    maximum_examined: int = Field(default=4096, ge=1, le=65536)
    maximum_output_length: int = Field(default=4096, ge=0, le=16384)
    maximum_parse_count: int = Field(default=128, ge=1, le=4096)
    resume_state: FrozenMap | None = None

    @model_validator(mode="after")
    def unambiguous_references(self):
        for rows, name in ((self.rules, "rule_ref"), (self.edit_units, "unit_ref"), (self.tiles, "glyph_ref")):
            if rows is not None and len({getattr(r, name) for r in rows}) != len(rows):
                raise ValueError("current instance references must be unique; duplicate rule sides remain alternatives")
        for arities in (self.left_arities, self.right_arities):
            if arities is not None and any(type(value) is not int or value < 0 for value in sorted(arities.values())):
                raise ValueError("declared word arities must be nonnegative integers")
        return self


class _WordBudget:
    def __init__(self, maximum):
        self.maximum = maximum
        self.examined = 0
        self.reached = False

    def take(self, count=1):
        if count > self.maximum - self.examined:
            self.reached = True
            return False
        self.examined += count
        return True


def canonical_word_tiles(tiles, budget, progress=None, resume=None):
    """Compare only declared whole-tile transform orbits, preserving observed pose."""
    progress = {} if progress is None else progress
    saved = resume or {}
    rows = list(saved.get("rows", ()))
    tile_index = int(saved.get("tile_index", 0))
    transform_index = int(saved.get("transform_index", 0))
    candidates = list(saved.get("candidates", ()))
    current = dict(saved["current"]) if saved.get("current") is not None else None
    comparison = dict(saved.get("comparison", {"incumbent": 0, "candidate": 1,
                                               "pixel_index": 0, "dimensions_checked": False}))
    def retain():
        progress.update({"rows": tuple(rows), "tile_index": tile_index,
            "transform_index": transform_index, "candidates": tuple(candidates), "current": current,
            "comparison": comparison})
    while tile_index < len(tiles):
        tile = tiles[tile_index]
        while transform_index < len(tile.allowed_identity_transforms):
            transform = tile.allowed_identity_transforms[transform_index]
            if current is None:
                if not budget.take():
                    retain()
                    return rows, False
                current = {"width": tile.width, "height": tile.height, "pixels": [],
                           "pixel_index": 0, "turn_index": 0}
            width, height = current["width"], current["height"]
            pixels = list(current["pixels"])
            current["pixels"] = pixels
            while current["pixel_index"] < len(tile.pixels):
                if not budget.take():
                    retain()
                    return rows, False
                x, y, value = tile.pixels[current["pixel_index"]]
                pixels.append((width - 1 - x if transform.reflect_x else x, y, value))
                current["pixel_index"] += 1
            while current["turn_index"] < transform.quarter_turns:
                if not budget.take(len(pixels)):
                    current["minimum_next_atomic_work"] = len(pixels)
                    retain()
                    return rows, False
                pixels = [(height - 1 - y, x, value) for x, y, value in pixels]
                width, height = height, width
                current.update({"pixels": pixels, "width": width, "height": height,
                                "turn_index": current["turn_index"] + 1})
            if not budget.take(len(pixels)):
                current["minimum_next_atomic_work"] = len(pixels)
                retain()
                return rows, False
            candidates.append(((width, height, tuple(sorted(pixels))), transform.transform_ref))
            transform_index += 1
            current = None
        while comparison["candidate"] < len(candidates):
            left, left_ref = candidates[comparison["candidate"]]
            right, right_ref = candidates[comparison["incumbent"]]
            if not budget.take():
                retain()
                return rows, False
            order = None
            if not comparison["dimensions_checked"]:
                left_size, right_size = tuple(left[:2]), tuple(right[:2])
                if left_size != right_size:
                    order = left_size < right_size
                else:
                    comparison["dimensions_checked"] = True
            elif comparison["pixel_index"] < len(left[2]):
                i = comparison["pixel_index"]
                left_pixel, right_pixel = tuple(left[2][i]), tuple(right[2][i])
                comparison["pixel_index"] += 1
                if left_pixel != right_pixel:
                    order = left_pixel < right_pixel
            else:
                order = left_ref < right_ref
            if order is not None:
                if order:
                    comparison["incumbent"] = comparison["candidate"]
                comparison.update({"candidate": comparison["candidate"] + 1,
                                   "pixel_index": 0, "dimensions_checked": False})
        representative, transform_ref = candidates[comparison["incumbent"]]
        rows.append({"glyph_ref": tile.glyph_ref, "observed_pose_ref": tile.observed_pose_ref,
                     "canonical_mask": representative, "representative_transform_ref": transform_ref})
        tile_index += 1
        transform_index, candidates = 0, []
        comparison = {"incumbent": 0, "candidate": 1, "pixel_index": 0, "dimensions_checked": False}
    retain()
    return rows, True


def parse_typed_word(word, rules, input_type, output_type, maximum_output, maximum_parses, budget,
                     progress=None, resume=None):
    """Position/output dynamic programming, retaining every bounded rule derivation."""
    progress = progress if progress is not None else {}
    resume = resume or {}
    by_first = {key: list(value) for key, value in sorted(resume.get("rule_lookup", {}).items())}
    scan_cursor = int(resume.get("scan_cursor", 0))
    pending = deque(resume.get("pending", ((0, (), (), 0, False),)))
    parses = list(resume.get("parses", ()))
    gaps = set(tuple(row) for row in resume.get("gaps", ()))
    output_bound_seen = bool(resume.get("output_bound_seen", False))
    rule_matches = {(row["position"], row["rule_index"]): row["matches"]
                    for row in resume.get("rule_matches", ())}
    if not 0 <= scan_cursor <= len(rules):
        raise ValueError("invalid current parse scan cursor")
    def save():
        progress.update({"scan_cursor": scan_cursor, "rule_lookup": by_first,
                         "pending": tuple(pending), "parses": tuple(parses),
                         "gaps": tuple(sorted(gaps)), "output_bound_seen": output_bound_seen,
                         "rule_matches": tuple({"position": key[0], "rule_index": key[1],
                             "matches": rule_matches[key]} for key in sorted(rule_matches))})
    for index in range(scan_cursor, len(rules)):
        rule = rules[index]
        if not budget.take(1 + len(rule.left)):
            save()
            return tuple(parses), tuple(sorted(gaps)), False
        if rule.input_type_ref == input_type and rule.output_type_ref == output_type:
            by_first.setdefault(rule.left[0], []).append(index)
        scan_cursor = index + 1
    while pending:
        if not budget.take():
            save()
            break
        position, output, derivation, cursor, matched = pending.popleft()
        output, derivation = tuple(output), tuple(derivation)
        if position == len(word):
            if len(parses) >= maximum_parses:
                pending.appendleft((position, output, derivation, cursor, matched))
                save()
                break
            parses.append({"output_word": output, "derivation": derivation})
            continue
        choices = by_first.get(word[position], ())
        while cursor < len(choices):
            rule_index = choices[cursor]
            rule = rules[rule_index]
            match_key = (position, rule_index)
            match_work = len(rule.left) if match_key not in rule_matches else 0
            if not budget.take(1 + match_work + len(rule.right) + len(output) + len(derivation)):
                pending.appendleft((position, output, derivation, cursor, matched))
                break
            end = position + len(rule.left)
            cursor += 1
            if match_key not in rule_matches:
                rule_matches[match_key] = word[position:end] == rule.left
            if not rule_matches[match_key]:
                continue
            matched = True
            following = output + rule.right
            if len(following) > maximum_output:
                output_bound_seen = True
                gaps.add((position, end, "output_length_bound"))
                continue
            trace = derivation + ((position, end, len(output), len(following), rule.rule_ref, rule.provenance_refs),)
            pending.append((end, following, trace, 0, False))
        if budget.reached:
            break
        if not matched:
            gaps.add((position, len(word), "missing_rule_for_suffix"))
    save()
    return tuple(parses), tuple(sorted(gaps)), not pending and not output_bound_seen


def compose_typed_words(request, budget, resume=None):
    """Finite typed stages with shared parse memoization and retained intermediates."""
    saved = resume or {}
    states = tuple(saved.get("states", ((request.input_word, (request.input_word,), ()),)))
    stage, state_index = int(saved.get("stage", 0)), int(saved.get("state_index", 0))
    following = list(saved.get("following", ()))
    cache = {(row["before"], row["after"], tuple(row["word"])): row["result"]
             for row in saved.get("memo", ())}
    gaps = list(saved.get("gaps", ()))
    complete = bool(saved.get("complete", True))
    current = dict(saved["current"]) if saved.get("current") is not None else None
    hard_bounds = list(saved.get("hard_bound_refs", ()))
    def retain():
        return {"composition_progress": {"states": states, "stage": stage,
            "state_index": state_index, "following": tuple(following), "current": current,
            "memo": tuple({"before": key[0], "after": key[1], "word": key[2], "result": cache[key]}
                          for key in sorted(cache)), "gaps": tuple(gaps), "complete": complete,
            "hard_bound_refs": tuple(hard_bounds)}, "hard_bound_refs": tuple(hard_bounds),
            "restart_required": bool(hard_bounds)}
    while stage < len(request.type_pipeline) - 1:
        before, after = request.type_pipeline[stage:stage + 2]
        while state_index < len(states):
            word, intermediates, provenance = states[state_index]
            word, intermediates, provenance = tuple(word), tuple(intermediates), tuple(provenance)
            key = (before, after, word)
            if current is None:
                if not budget.take():
                    return tuple(following), tuple(gaps), False, retain()
                current = {"parse_progress": {}, "ready": False, "emit_index": 0}
            if not current["ready"]:
                if key not in cache:
                    parse_progress = {}
                    parsed = parse_typed_word(word, request.rules, before, after,
                        request.maximum_output_length, request.maximum_parse_count, budget,
                        parse_progress, current["parse_progress"])
                    current["parse_progress"] = parse_progress
                    if budget.reached:
                        return tuple(following), tuple(gaps), False, retain()
                    if parse_progress.get("output_bound_seen"):
                        hard_bounds.append("typed_word.maximum_output_length")
                    if parse_progress.get("pending") and len(parsed[0]) >= request.maximum_parse_count:
                        hard_bounds.append("typed_word.maximum_parse_count")
                    cache[key] = parsed
                parses, missing, closed = cache[key]
                gaps.extend((stage, row) for row in missing)
                complete = complete and closed
                current.update({"ready": True, "parses": parses})
            parses = current["parses"]
            while current["emit_index"] < len(parses):
                if len(following) >= request.maximum_parse_count:
                    hard_bounds.append("typed_word.maximum_parse_count")
                    return tuple(following), tuple(gaps), False, retain()
                if not budget.take():
                    return tuple(following), tuple(gaps), False, retain()
                row = parses[current["emit_index"]]
                output = tuple(row["output_word"])
                following.append((output, intermediates + (output,),
                                  provenance + ((before, after, row["derivation"]),)))
                current["emit_index"] += 1
            state_index += 1
            current = None
        states = tuple(following)
        stage += 1
        state_index, following = 0, []
    return states, tuple(gaps), complete, retain()


def edit_phase_domains(units, budget, progress=None, resume=None):
    """Reach only explicit directed phases; never infer the inverse of an edit."""
    progress = {} if progress is None else progress
    saved = resume or {}
    domains = list(saved.get("domains", ()))
    unit_index = int(saved.get("unit_index", 0))
    state = dict(saved.get("unit_state", {}))
    def retain():
        progress.update({"domains": tuple(domains), "unit_index": unit_index,
                         "unit_state": state})
    while unit_index < len(units):
        unit = units[unit_index]
        if not state:
            state = {"arc_index": 0, "outgoing": {}, "pending": [unit.current_phase_ref],
                     "visited": [unit.current_phase_ref], "queue_index": 0,
                     "edge_index": 0, "variant_index": 0, "rows": []}
        outgoing = {ref: list(indices) for ref, indices in sorted(state["outgoing"].items())}
        state["outgoing"] = outgoing
        while state["arc_index"] < len(unit.arcs):
            if not budget.take():
                retain()
                return domains, False
            arc = unit.arcs[state["arc_index"]]
            outgoing.setdefault(arc.from_phase_ref, []).append(state["arc_index"])
            state["arc_index"] += 1
        pending = list(state["pending"])
        visited = set(state["visited"])
        state["pending"] = pending
        while state["queue_index"] < len(pending):
            phase = pending[state["queue_index"]]
            edges = outgoing.get(phase, ())
            while state["edge_index"] < len(edges):
                if not budget.take():
                    state["visited"] = sorted(visited)
                    retain()
                    return domains, False
                arc = unit.arcs[edges[state["edge_index"]]]
                if arc.to_phase_ref not in visited:
                    visited.add(arc.to_phase_ref)
                    pending.append(arc.to_phase_ref)
                state["edge_index"] += 1
            state["queue_index"] += 1
            state["edge_index"] = 0
        state["visited"] = sorted(visited)
        rows = list(state["rows"])
        state["rows"] = rows
        while state["variant_index"] < len(unit.variants):
            variant = unit.variants[state["variant_index"]]
            count = 1 + sum(1 + len(r.left) + len(r.right) for r in variant.rules)
            if not budget.take(count):
                retain()
                return domains, False
            if variant.phase_ref in visited:
                rows.append({"phase_ref": variant.phase_ref,
                    "rules": tuple(r.model_dump(mode="json") for r in variant.rules),
                    "glyph_offsets": variant.glyph_offsets})
            state["variant_index"] += 1
        if not budget.take(len(unit.arcs) + len(rows)):
            retain()
            return domains, False
        declared_edges = {(a.from_phase_ref, a.to_phase_ref) for a in unit.arcs}
        domains.append({"unit_ref": unit.unit_ref, "current_phase_ref": unit.current_phase_ref,
                        "reachable_variants": tuple(sorted(rows, key=lambda row: row["phase_ref"])),
                        "unsupported_inverse_edges": tuple(
                            (a.to_phase_ref, a.from_phase_ref) for a in unit.arcs
                            if (a.to_phase_ref, a.from_phase_ref) not in declared_edges),
                        "cycle_domain_complete": unit.cycle_domain_complete})
        unit_index += 1
        state = {}
    retain()
    return domains, all(row["cycle_domain_complete"] for row in domains)


def _assignment_at(rank, domains):
    selection = []
    for domain in reversed(domains):
        rank, index = divmod(rank, len(domain))
        selection.append(domain[index])
    return tuple(reversed(selection))


def fit_word_dictionary(request, budget, start_rank, retained_prefix=(), undecided_prefix=False,
                        phase_resume=None, phase_progress=None, dictionary_resume=None):
    phase_progress = {} if phase_progress is None else phase_progress
    phase_rows, phase_complete = edit_phase_domains(request.edit_units, budget, phase_progress, phase_resume)
    if len(phase_rows) != len(request.edit_units) or budget.reached:
        return tuple(retained_prefix), False, {"phase_progress": phase_progress,
            "phase_domains": phase_rows, "next_assignment_rank": start_rank,
            "undecided_examples": undecided_prefix}
    domains = [row["reachable_variants"] for row in phase_rows]
    total = 1
    for domain in domains:
        total *= len(domain)
    if start_rank > total:
        raise ValueError("resume rank lies outside the same dictionary domain")
    retained = list(retained_prefix)
    undecided_examples = undecided_prefix
    rank = start_rank
    current = dict(dictionary_resume) if dictionary_resume else None
    if current and current["rank"] != rank:
        raise ValueError("dictionary example progress does not match its current assignment")
    def frontier(**extra):
        return {"next_assignment_rank": rank, "assignment_domain_size": total,
            "undecided_examples": undecided_examples, "dictionary_progress": current, **extra}
    while rank < total:
        if len(retained) >= request.maximum_parse_count:
            break
        if current is None:
            if not budget.take():
                break
            current = {"rank": rank, "prepared": False, "rejected": False,
                       "unresolved": False, "example_index": 0, "evidence": (), "parse_progress": {}}
        chosen = _assignment_at(rank, domains)
        rules = tuple(request.rules or ()) + tuple(TypedWordRule.model_validate(r) for v in chosen for r in v["rules"])
        refs = [r.rule_ref for r in rules]
        if len(set(refs)) != len(refs):
            return retained, False, frontier(prerequisite="unique_rule_occurrences")
        phases = {u.unit_ref: v["phase_ref"] for u, v in zip(request.edit_units, chosen)}
        rules_by_ref = {r.rule_ref: r for r in rules}
        if not current["prepared"] and not budget.take(len(rules) + len(request.left_arities) + len(request.right_arities)
                           + sum(len(group) for group in request.repeated_phase_groups)):
            return retained, False, frontier()
        if any(ref not in rules_by_ref for ref in (*request.left_arities, *request.right_arities)):
            return retained, False, frontier(prerequisite="arity_constraint_rule_identity")
        if not current["prepared"]:
            current["rejected"] = any(len(rules_by_ref[k].left) != n for k, n in sorted(request.left_arities.items()))
            current["rejected"] = current["rejected"] or any(len(rules_by_ref[k].right) != n for k, n in sorted(request.right_arities.items()))
            for group in request.repeated_phase_groups:
                if any(ref not in phases for ref in group):
                    return retained, False, frontier(prerequisite="repeated_phase_unit_identity")
                current["rejected"] = current["rejected"] or len({phases[ref] for ref in group}) > 1
            if request.require_bijection:
                left = [(r.input_type_ref, r.left) for r in rules]
                right = [(r.output_type_ref, r.right) for r in rules]
                current["rejected"] = current["rejected"] or len(set(left)) != len(left) or len(set(right)) != len(right)
            current["prepared"] = True
        evidence = list(current["evidence"])
        while current["example_index"] < len(request.fixed_examples) and not current["rejected"]:
            example = request.fixed_examples[current["example_index"]]
            parse_progress = {}
            parses, gaps, closed = parse_typed_word(example.input_word, rules,
                example.input_type_ref, example.output_type_ref, request.maximum_output_length,
                request.maximum_parse_count, budget, parse_progress, current["parse_progress"])
            current["parse_progress"] = parse_progress
            witnesses = tuple(p for p in parses if p["output_word"] == example.output_word)
            if budget.reached:
                return retained, False, frontier(partial_evidence=tuple(evidence),
                    current_example_evidence_ref=example.evidence_ref, current_example_witnesses=witnesses)
            if not closed:
                hard = tuple(ref for ref, present in (
                    ("typed_word.maximum_output_length", parse_progress.get("output_bound_seen")),
                    ("typed_word.maximum_parse_count", bool(parse_progress.get("pending")))) if present)
                return retained, False, frontier(partial_evidence=tuple(evidence),
                    current_example_evidence_ref=example.evidence_ref, current_example_witnesses=witnesses,
                    hard_bound_refs=hard)
            if not witnesses and closed:
                current["rejected"] = True
            elif not witnesses:
                current["unresolved"] = True
            evidence.append({"evidence_ref": example.evidence_ref, "witnesses": witnesses,
                             "search_complete": closed, "missing_or_bounded_spans": gaps})
            current.update({"evidence": tuple(evidence), "example_index": current["example_index"] + 1,
                            "parse_progress": {}})
        if not current["rejected"]:
            undecided_examples = undecided_examples or current["unresolved"]
            retained.append({"unit_phases": tuple((u.unit_ref, v["phase_ref"]) for u, v in zip(request.edit_units, chosen)),
                             "rules": tuple(r.model_dump(mode="json") for r in rules),
                             "example_derivations": tuple(evidence), "example_witnesses_complete": not current["unresolved"]})
        rank += 1
        current = None
    return retained, phase_complete and rank == total and not undecided_examples, frontier()


def word_edit_successors(request, budget, progress=None, resume=None):
    progress = {} if progress is None else progress
    saved = resume or {}
    units = {u.unit_ref: u for u in request.edit_units}
    rows = list(saved.get("rows", ()))
    arc_index = int(saved.get("arc_index", 0))
    def retain():
        progress.update({"rows": tuple(rows), "arc_index": arc_index})
    if request.focus_unit_ref not in units or request.requested_unit_ref not in units:
        return rows, False, ("current_focus_and_selected_unit",)
    operation = request.requested_edit_operation
    if operation == "MUTATION" and request.requested_unit_ref != request.focus_unit_ref:
        return rows, False, ("mutation_target_is_not_current_focus",)
    if request.validation_trigger is None and request.validation_trigger_ref != "NO_AUTOMATIC_VALIDATION":
        return rows, False, ("qualified_automatic_validation_trigger",)
    if request.validation_trigger is not None and request.validation_trigger.event_ref != request.validation_trigger_ref:
        return rows, False, ("automatic_validation_trigger_identity",)
    if operation == "MUTATION":
        unit = units[request.requested_unit_ref]
        transitions = unit.arcs
    else:
        transitions = request.focus_arcs
    while arc_index < len(transitions):
        if not budget.take():
            retain()
            return rows, False, ()
        arc = transitions[arc_index]
        if operation == "MUTATION":
            matches = arc.from_phase_ref == unit.current_phase_ref and arc.action_ref == request.requested_action_ref
        else:
            matches = arc.from_unit_ref == request.focus_unit_ref and arc.to_unit_ref == request.requested_unit_ref and arc.action_ref == request.requested_action_ref
        arc_index += 1
        if not matches:
            continue
        phases = {u.unit_ref: u.current_phase_ref for u in request.edit_units}
        changed_rules = ()
        if operation == "MUTATION":
            phases[request.requested_unit_ref] = arc.to_phase_ref
            changed_rules = next(v.rules for v in units[request.requested_unit_ref].variants if v.phase_ref == arc.to_phase_ref)
        trigger = request.validation_trigger
        triggered = bool(trigger and trigger.triggering_operation == operation
                         and all(phases.get(k) == v for k, v in sorted(trigger.phase_conditions.items())))
        rows.append({"operation": operation, "action_ref": arc.action_ref, "payload": dict(arc.payload),
                     "primitive_cost": arc.primitive_cost, "focus_after": request.requested_unit_ref,
                     "unit_phases_after": phases, "changed_rules": tuple(r.model_dump(mode="json") for r in changed_rules),
                     "automatic_validation": trigger.model_dump(mode="json") if triggered else None,
                     "separate_submit_invented": False})
    retain()
    return rows, request.scope.input_domain_complete, ()


def word_visit_costs(request, budget, progress=None, resume=None):
    """Exact shortest traversal over supplied focus/phase states, including correct units."""
    progress = {} if progress is None else progress
    saved = resume or {}
    units = tuple(request.edit_units)
    index = {u.unit_ref: i for i, u in enumerate(units)}
    if request.focus_unit_ref not in index or any(k not in index for k in request.target_phase_refs):
        return (), False, ("current_focus_and_target_units",)
    if request.validation_trigger is None and request.validation_trigger_ref != "NO_AUTOMATIC_VALIDATION":
        return (), False, ("qualified_automatic_validation_trigger",)
    if request.validation_trigger is not None and request.validation_trigger.event_ref != request.validation_trigger_ref:
        return (), False, ("automatic_validation_trigger_identity",)
    initial = (request.focus_unit_ref, tuple(u.current_phase_ref for u in units))
    def state_key(value):
        return value[0], tuple(value[1])
    distances = {state_key(row["state"]): row["cost"] for row in saved.get("distances", ())} if saved else {initial: 0}
    routes = {state_key(row["state"]): tuple(row["route"]) for row in saved.get("routes", ())} if saved else {initial: ()}
    queue = [(row[0], state_key(row[1])) for row in saved.get("queue", ())] if saved else [(0, initial)]
    witnesses = list(saved.get("witnesses", ()))
    current = dict(saved["current"]) if saved.get("current") is not None else None
    def retain():
        progress.update({"distances": tuple({"state": key, "cost": distances[key]} for key in sorted(distances)),
            "routes": tuple({"state": key, "route": routes[key]} for key in sorted(routes)),
            "queue": tuple(queue), "current": current, "witnesses": tuple(witnesses),
            "finished": False})
    if saved.get("finished"):
        progress.update(saved)
        return witnesses, all(u.cycle_domain_complete for u in units) and request.scope.input_domain_complete, ()
    while queue or current is not None:
        if current is None:
            if not budget.take():
                retain()
                return witnesses, False, ()
            cost, state = heappop(queue)
            if distances.get(state) != cost:
                continue
            current = {"cost": cost, "state": state, "edge_index": 0, "edges": None}
        cost, state = current["cost"], state_key(current["state"])
        focus, phases = state
        if all(phases[index[k]] == v for k, v in sorted(request.target_phase_refs.items())):
            witnesses.append({"primitive_cost": cost, "route": routes[state], "phase_state": state,
                              "minimum_for_supplied_edges": True})
            current = None
            retain()
            progress["finished"] = True
            return witnesses, all(u.cycle_domain_complete for u in units) and request.scope.input_domain_complete, ()
        if current["edges"] is None:
            edge_work = len(request.focus_arcs) + len(units[index[focus]].arcs)
            if not budget.take(edge_work):
                current["minimum_next_atomic_work"] = edge_work
                retain()
                return witnesses, False, ()
            current["edges"] = tuple(("FOCUS", i) for i, a in enumerate(request.focus_arcs) if a.from_unit_ref == focus) + tuple(
                ("MUTATION", i) for i, a in enumerate(units[index[focus]].arcs) if a.from_phase_ref == phases[index[focus]])
        while current["edge_index"] < len(current["edges"]):
            if not budget.take():
                retain()
                return witnesses, False, ()
            operation, arc_index = current["edges"][current["edge_index"]]
            arc = request.focus_arcs[arc_index] if operation == "FOCUS" else units[index[focus]].arcs[arc_index]
            following = list(phases)
            if operation == "FOCUS":
                if arc.to_unit_ref not in index:
                    retain()
                    return witnesses, False, ("focus_graph_has_unknown_unit",)
                destination = arc.to_unit_ref
            else:
                following[index[focus]] = arc.to_phase_ref
                destination = focus
            child = (destination, tuple(following))
            trigger = request.validation_trigger
            triggered = bool(trigger and trigger.triggering_operation == operation
                and all(following[index[k]] == v for k, v in sorted(trigger.phase_conditions.items()) if k in index)
                and all(k in index for k in trigger.phase_conditions))
            target_met = all(following[index[k]] == v for k, v in sorted(request.target_phase_refs.items()))
            if triggered and not trigger.continuation_after_effect_allowed and not target_met:
                current["edge_index"] += 1
                continue
            child_cost = cost + arc.primitive_cost
            if child_cost < distances.get(child, child_cost + 1):
                distances[child] = child_cost
                routes[child] = routes[state] + ((arc.action_ref, dict(arc.payload), arc.primitive_cost),)
                heappush(queue, (child_cost, child))
            current["edge_index"] += 1
        current = None
    retain()
    progress["finished"] = True
    return witnesses, all(u.cycle_domain_complete for u in units) and request.scope.input_domain_complete, ()


def measure_typed_word(request: TypedWordRequest):
    """Run only the exact caller-requested bounded math question, never K09 or ACT."""
    if (request.operation_ref, request.mode) not in request.signature_pairs:
        return family_result(request, signature_supported=False, domain_complete=False)
    required = {
        "canonicalization": ("tiles",), "parse_transduce": ("rules", "input_word", "input_type_ref", "output_type_ref"),
        "compose_types": ("rules", "input_word", "type_pipeline"), "phase_domain": ("edit_units",),
        "dictionary_constraints": ("rules", "edit_units", "fixed_examples", "require_bijection", "left_arities", "right_arities", "repeated_phase_groups"),
        "edit_successor": ("edit_units", "focus_unit_ref", "requested_unit_ref", "requested_action_ref", "requested_edit_operation", "focus_arcs", "validation_trigger_ref"),
        "visit_cost": ("edit_units", "focus_unit_ref", "focus_arcs", "target_phase_refs", "validation_trigger_ref"),
        "validation_evidence": ("highlighted_spans", "supplied_derivation"), "precondition": ("rules",),
    }
    operation = request.operation_ref.rsplit(".", 1)[-1]
    missing = tuple("typed_word." + field for field in required[operation] if getattr(request, field) is None)
    if missing:
        return family_result(request, prerequisite_refs=missing, domain_complete=False)
    if operation in ("phase_domain", "dictionary_constraints", "edit_successor", "visit_cost"):
        for unit in request.edit_units:
            current = next(v for v in unit.variants if v.phase_ref == unit.current_phase_ref)
            if any(v.glyph_offsets != current.glyph_offsets for v in unit.variants):
                return family_result(request, prerequisite_refs=("typed_word.measured_shared_phase_offsets",),
                                     domain_complete=False)
    identity = request.model_dump(mode="json", exclude={"resume_state", "maximum_examined"})
    identity["calculation_revision_ref"] = K30_CALCULATION_REVISION
    # A continued calculation has a new return identity but the same current
    # owner, parent, epoch, evidence/model revisions and immutable instance.
    identity["scope"].pop("request_ref")
    identity["scope"].pop("consumed_request_refs")
    digest = hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    resume = request.resume_state or FrozenMap()
    if resume and (resume.get("input_digest") != digest or resume.get("model_revision_ref") != request.scope.model_revision_ref):
        return family_result(request, prerequisite_refs=("typed_word.current_resume_identity",), domain_complete=False)
    budget = _WordBudget(request.maximum_examined)
    values, frontier, complete, extra_missing = {}, {}, True, ()
    if operation == "canonicalization":
        progress = {}
        rows, complete = canonical_word_tiles(request.tiles, budget, progress, resume.get("canonical_progress"))
        frontier["canonical_progress"] = progress
        values = {"canonical_tiles": rows}
    elif operation == "parse_transduce":
        progress = {}
        parses, gaps, complete = parse_typed_word(request.input_word, request.rules, request.input_type_ref,
            request.output_type_ref, request.maximum_output_length, request.maximum_parse_count, budget,
            progress, resume.get("parse_progress"))
        frontier["parse_progress"] = progress
        values = {"parses": parses, "missing_or_bounded_spans": gaps,
                  "ambiguous_output": len({p["output_word"] for p in parses}) > 1}
    elif operation == "compose_types":
        rows, gaps, complete, frontier = compose_typed_words(request, budget,
                                                            resume.get("composition_progress"))
        values = {"compositions": rows, "missing_or_bounded_spans": gaps}
    elif operation == "phase_domain":
        phase_progress = {}
        rows, complete = edit_phase_domains(request.edit_units, budget, phase_progress,
                                             resume.get("phase_progress"))
        frontier["phase_progress"] = phase_progress
        values = {"phase_domains": rows}
    elif operation == "dictionary_constraints":
        phase_progress = {}
        rows, complete, frontier = fit_word_dictionary(request, budget, int(resume.get("next_assignment_rank", 0)),
            resume.get("retained_dictionary_candidates", ()), bool(resume.get("undecided_examples", False)),
            resume.get("phase_progress"), phase_progress, resume.get("dictionary_progress"))
        frontier["phase_progress"] = phase_progress
        frontier["retained_dictionary_candidates"] = tuple(rows)
        values = {"dictionary_candidates": rows, "bijection_required": request.require_bijection}
    elif operation == "edit_successor":
        progress = {}
        rows, complete, extra_missing = word_edit_successors(request, budget, progress,
                                                             resume.get("edit_progress"))
        frontier["edit_progress"] = progress
        values = {"successors": rows}
    elif operation == "visit_cost":
        progress = {}
        rows, complete, extra_missing = word_visit_costs(request, budget, progress, resume.get("visit_progress"))
        frontier["visit_progress"] = progress
        values = {"visit_cost_witnesses": rows}
    elif operation == "validation_evidence":
        atomic_work = len(request.highlighted_spans) + len(request.supplied_derivation)
        if budget.take(atomic_work):
            observed, expected = set(request.highlighted_spans), set(request.supplied_derivation)
            values = {"matching_spans": tuple(sorted(observed & expected)), "unexpected_highlights": tuple(sorted(observed - expected)),
                      "unhighlighted_derivation_spans": tuple(sorted(expected - observed)),
                      "stable_glyph_identity_changed_by_highlight": False}
        else:
            complete = False
            frontier["atomic_progress"] = {"minimum_next_atomic_work": atomic_work,
                                           "calculation_started": False}
    else:
        atomic_work = len(request.rules)
        if budget.take(atomic_work):
            keys = Counter((r.input_type_ref, r.output_type_ref, r.left) for r in request.rules)
            values = {"nonempty_left_sides": all(r.left for r in request.rules),
                      "duplicate_left_side_keys": tuple(sorted(k for k, count in sorted(keys.items()) if count > 1)),
                      "longest_match_rule_declared": False}
        else:
            complete = False
            frontier["atomic_progress"] = {"minimum_next_atomic_work": atomic_work,
                                           "calculation_started": False}
    frontier.update({"input_digest": digest, "model_revision_ref": request.scope.model_revision_ref,
        "evidence_revision_ref": request.scope.evidence_revision_ref, "operation_ref": request.operation_ref,
        "epoch": request.scope.epoch, "examined_count": budget.examined,
        "calculation_revision_ref": K30_CALCULATION_REVISION,
        "restart_required": bool(frontier.get("hard_bound_refs")) or (not complete and not any(key in frontier for key in
            ("next_assignment_rank", "parse_progress", "phase_progress", "composition_progress",
             "canonical_progress", "visit_progress", "edit_progress", "atomic_progress")))})
    values["actual_bounds"] = {"maximum_examined": request.maximum_examined,
        "maximum_output_length": request.maximum_output_length, "maximum_parse_count": request.maximum_parse_count}
    values["examination_metric_ref"] = "native_loop_visits_and_constructed_word_atoms"
    if frontier.get("prerequisite"):
        extra_missing = (*extra_missing, "typed_word." + frontier["prerequisite"])
    if operation == "parse_transduce":
        progress = frontier["parse_progress"]
        frontier["hard_bound_refs"] = tuple(ref for ref, reached in (
            ("typed_word.maximum_output_length", progress.get("output_bound_seen")),
            ("typed_word.maximum_parse_count", len(progress.get("parses", ())) >= request.maximum_parse_count and bool(progress.get("pending")))) if reached)
        if progress.get("output_bound_seen") and not progress.get("pending"):
            frontier["restart_required"] = True
    if operation == "dictionary_constraints" and frontier.get("next_assignment_rank") == frontier.get("assignment_domain_size") and not complete:
        frontier["restart_required"] = True
    if operation == "dictionary_constraints" and len(values.get("dictionary_candidates", ())) >= request.maximum_parse_count and not complete:
        frontier["hard_bound_refs"] = (*frontier.get("hard_bound_refs", ()), "typed_word.maximum_parse_count")
    return family_result(request, values=values, prerequisite_refs=extra_missing, examined_count=budget.examined,
        domain_complete=complete, computation_bound_reached=budget.reached or bool(frontier.get("hard_bound_refs")), frontier=frontier)
