"""Exact typed transport for the K29 Source call to the existing K09."""
from .recipe_composition_a import (RecipeCompositionExtract, RecipeCompositionReturned,
    extract_recipe_composition_query, return_recipe_composition_query, retain_recipe_composition_measurement)
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_family_contracts_a import MechanicalFamilyResult

RECIPE_COMPOSITION_TYPES = ('RecipeCompositionExtract', 'RecipeCompositionReturned')
ENTRIES = (
    ('capability.recipe_composition_query', extract_recipe_composition_query, RecipeCompositionExtract, SearchDomainInputC),
    ('capability.recipe_composition_return', return_recipe_composition_query, RecipeCompositionReturned, MechanicalFamilyResult),
    ('capability.recipe_composition_retained', retain_recipe_composition_measurement, RecipeCompositionExtract, MechanicalFamilyResult),
)


def recipe_composition_entries_a(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=fn, input_model=before,
        output_model=after, source_file='recipe_composition_a.py', applicability=('current_source_composition',),
        invariants=('exact_measured_step_population', 'independent_recipe_world_state', 'single_existing_k09', 'no_action_release'),
        falsifiers=('stale_scope', 'unmeasured_after_state', 'internal_successor_recursive_search'))
        for ref, fn, before, after in ENTRIES)


def recipe_composition_signatures_a(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    base = (p('request', 'RecipeOperatorRequest'), p('measurement', 'MechanicalFamilyResult'))
    return {'capability.recipe_composition_query': (base, 'SearchDomainInputC'),
        'capability.recipe_composition_retained': (base, 'MechanicalFamilyResult'),
        'capability.recipe_composition_return': ((*base, p('returned', 'MechanicalNormalizedReturn')), 'MechanicalFamilyResult')}
