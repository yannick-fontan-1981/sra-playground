"""An assessment read preserves rejection evidence without granting execution."""
from typing import Literal
from collections.abc import Mapping

from pydantic import model_validator

from .types import FrozenMap, FrozenModel, Ref


class OperationalConsciousnessAssessmentRead(FrozenModel):
    assessment_ref: Ref | None = None
    consumption_ref: Ref | None = None
    receipt_ref: Ref
    failed_check_refs: tuple[Ref, ...] = ()
    contract_error_kind: str | None = None
    bound_return: FrozenMap | None = None
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_assessment_read.v1'] = 'operational_consciousness_assessment_read.v1'

    @model_validator(mode='after')
    def exact_read_outcome(self):
        if (self.bound_return is None) != bool(self.failed_check_refs):
            raise ValueError('assessment read must retain either its binding or its failed checks')
        if self.bound_return is not None and (self.assessment_ref is None or self.consumption_ref is None):
            raise ValueError('bound assessment read must identify producer and consumer')
        if self.contract_error_kind is not None and not self.failed_check_refs:
            raise ValueError('assessment contract error cannot be a successful binding')
        return self


class OperationalConsciousnessReviewDebtReplacement(FrozenModel):
    """Scoped replacement evidence, rechecked while its agenda remains active."""
    prior_assessment_ref: Ref
    replacement_assessment_ref: Ref
    candidate_ref: Ref
    current_receipt: FrozenMap
    measured_facts: FrozenMap
    projection_facts: FrozenMap
    policy_hash: Ref
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_review_debt_replacement.v1'] = 'operational_consciousness_review_debt_replacement.v1'

    @model_validator(mode='after')
    def exact_replacement_identity(self):
        link = self.current_receipt.get('frontier_assessment', {})
        if (self.prior_assessment_ref == self.replacement_assessment_ref
                or not isinstance(link, Mapping)
                or link.get('assessment_ref') != self.replacement_assessment_ref):
            raise ValueError('review debt replacement lost its distinct consumed assessment')
        return self
