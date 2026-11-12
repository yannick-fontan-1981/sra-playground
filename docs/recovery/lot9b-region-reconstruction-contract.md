# Lot 9B Region reconstruction contract - 2026-11-12

## Status

This is a **new reconstruction contract** for `region_intervention`.

It is not claimed to be the historical 0.69 implementation.

The contract is limited to behavior supported by durable Lot 9 evidence:

- an intervention records the regions actually affected;
- effects contrary to a prediction must be preserved;
- a refuted assignment changes what may be proposed next;
- predictions are used only within their valid scope;
- every added path must have a real contribution, correct restoration, and bounded search.

Historical recovery notes additionally establish that Region must not propose a
continuation before an intervention effect has been observed and that a
contradiction invalidates learned continuation. These notes are treated as
behavioral evidence, not source identity.

## Non-goals

This reconstruction does not:

- infer separator geometry from pixels;
- invent equivalence between two separators;
- claim historical field names or historical state layout;
- claim the old 183-test result;
- claim the old 71/76 candidate count;
- claim public-worker or browser qualification;
- claim official STCK/SMLP performance.

## Explicit symbolic input

A caller that has already measured the scene may supply a `methodRef`.

The same `methodRef` means that the caller has independent evidence that two
interventions belong to the same reusable method family.

Region itself does not infer that equivalence.

Each observed intervention contains:

- `methodRef`;
- `separatorRef`;
- `actionRef`;
- `affectedRegions`;
- `effectKey`;
- `levelEpoch`;
- `observationRevision`.

A useful observation must contain at least one affected region.

## Learning rule

For one `methodRef`:

1. the first useful observation creates one learned method;
2. an equal later observation adds supporting evidence;
3. a different action, effect, or affected-region set is preserved as a
   contradiction and invalidates the learned method;
4. stale revisions never overwrite newer evidence.

The affected-region set is compared as a set, not by input order.

## Proposal rule

A proposal is possible only when:

- the learned method exists;
- it is not contradicted;
- the candidate explicitly carries the same `methodRef`;
- the learned action is currently available;
- the candidate separator was not already used as supporting evidence for the
  same learned method;
- the requested `levelEpoch` matches the method scope.

A proposal contains the action and the expected effect, but the expected effect
is a prediction only. The next real return must still be acquired and compared.

## Contradiction rule

If the acquired return for a proposed intervention differs in action, effect, or
affected-region set, the method becomes invalid and future proposals stop.

The contradictory return is retained in state.

## Restoration

The component exposes a JSON-safe snapshot and restore operation.

Restore validates the snapshot structure and restores the exact bounded state.
It does not manufacture evidence.

## Bounds

- maximum learned methods: 128;
- maximum evidence records per method: 32;
- maximum affected regions per observation: 256.

If a bound is exceeded, the component rejects the input instead of silently
truncating decision-relevant evidence.

## Qualification targets

Minimum tests:

1. no proposal before observation;
2. first regional effect creates a method;
3. same evidence is reusable for another explicitly linked separator;
4. input region order does not change equality;
5. stale observation does not overwrite current evidence;
6. contradictory effect invalidates the method;
7. contradictory affected-region set invalidates the method;
8. unavailable action blocks proposal;
9. different methodRef blocks proposal;
10. evidence separator is not proposed again;
11. snapshot/restore preserves state;
12. invalid or oversized inputs are rejected.

## Performance

Official performance is not measurable until the historical/native harness is
restored.

Status after functional qualification must therefore be:

**fonctionnellement qualifié, performance officielle à confirmer**
