/** The plan stays open only while its next step can still be checked in the current situation. */
export function decidePlanContinuation(input: {
  readonly boundary: boolean;
  readonly matched: boolean | null;
  readonly sealRequested: boolean;
  readonly hasNextStep: boolean;
  readonly budgetReason: string | null;
}) {
  const interruption = input.boundary ? 'official_boundary_or_terminal'
    : input.matched === false ? 'observed_path_expectation_diverged'
      : input.sealRequested && input.hasNextStep ? 'frontier_outcome_sealed_prefix'
        : input.budgetReason;
  return { interruption, continue: input.hasNextStep && !input.sealRequested && interruption === null };
}
