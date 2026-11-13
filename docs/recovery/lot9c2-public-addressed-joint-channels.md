# Lot 9C2 — real public addressed joint channels

## Status

Lot 9C2 is a **new bounded reconstruction** of a real `joint_channels` use case.

It is not claimed to be the lost historical implementation and it does not
restore a historical registry count.

Functional status:

**qualified on a real public SMLP corpus with two distinct causal producers.**

Performance status:

**official performance to be confirmed.**

## Need

SMLP exposes ACTION6, but a safe addressed action requires two different facts:

1. ACTION6 is currently admissible in the public action list;
2. a concrete visible gate exists and its public pixel geometry determines the
   click coordinates.

Neither fact is sufficient by itself.

## Real producers

### Public action availability

Channel:

`public_action_availability_v1`

Evidence source:

- current `AgentObservation.availableActionIds` only.

Contribution:

- ACTION6 is currently admissible for the exact public observation revision;
- no target geometry is produced.

### Public visible target

Channel:

`public_visible_target_v1`

Producer:

`public_smlp_gate_target_v1`

Evidence source:

- current public 64×64 palette frame only;
- source-qualified visible SMLP gate glyphs;
- deterministic row-major tie rule.

Contribution:

- one visible gate identity;
- one addressed ACTION6 coordinate;
- exact observation revision and pixel-patch signature;
- no hidden engine state, fixture, control id, route or prepared solution.

## Joint contract

The two channels produce:

- different `channelId` values;
- different `contributionRef` values;
- the same explicit `jointRef`;
- the same ACTION6 action reference;
- the same release payload and observation identity.

`JointChannelOwner` produces one proposal only when both contributions are
present and compatible.

The selected proposal is released through the existing OP28 authority. The
physical return is then routed to both contributing channels with the same
`needId`, proposal identity and joint identity.

## Causal removal proof

The qualification removes each contribution independently:

- availability without target: no action;
- target without availability: no action;
- changed or stale target pixels: no target contribution;
- ACTION6 unavailable: native release safety blocks the action.

Therefore neither channel is decorative or redundant for the qualified action.

## Real native corpus

Archive:

`public/python/custom-games.zip`

Game:

- code: `SMLP`;
- game id: `smlp-c3000001`;
- seed: `0`;
- start level: `1`.

Observed result:

- joint action: `ACTION6(x=32, y=26)`;
- public changed pixels: `9`;
- both channels acquired the selected return;
- removing either channel produced no action.

## GitHub Actions evidence

Workflow:

`.github/workflows/lot9c2-public-addressed-joint-channels.yml`

Run:

`43361101707`

Job:

`131674532862`

Qualified head:

`9b8a3b56b806537782e63c946fe529ffe78a776a`

Results:

- production build: PASS;
- targeted Lot 9C2 causal tests: **7/7 PASS**;
- real archive qualification: PASS;
- complete TypeScript regression suite: **351/351 PASS**;
- failures, cancellations, skipped tests and TODOs: `0`.

Artifact:

- id: `14007922680`;
- name: `lot9c2-public-addressed-joint-report`;
- digest: `2f896db9b1d6c4cee8dfdb50c33a78d88daa0736f6ac1832a3a818448af32d05`.

## Files

Product/runtime:

- `src/logos-engine/v6-public-addressed-joint-channels.ts`;
- `src/logos-engine/v6-joint-channel-owner.ts`;
- `src/logos-engine/v6-joint-channel-action.ts`;
- `src/runtime/v6-common-campaign-decision-port.ts`.

Qualification:

- `tests/v6-public-addressed-joint-channels.test.ts`;
- `scripts/qualify-lot9c2-public-addressed-joint.mjs`;
- `.github/workflows/lot9c2-public-addressed-joint-channels.yml`.

## Limits

This qualification does not claim:

- historical source identity;
- a general SMLP solver;
- hidden-state access;
- automatic ranking between independent owner proposals;
- a STCK joint-channel producer;
- official STCK/SMLP performance qualification for Lot 9C;
- Site publication;
- restoration or increment of the historical 70/76 registry count.

## Next step

Lot 9C3 must establish the performance boundary without weakening causality:

1. preserve the exact two-producer contract;
2. add or justify a second durable public corpus path for STCK, or document why
   STCK is not a valid `joint_channels` exercise;
3. define explicit A/B source identities and timing scope;
4. execute the strict A1/B1/B2/A2 protocol only when STCK and SMLP runners are
   both real and comparable;
5. keep per-game acceptance strictly below +10%, without cross-game
   compensation or sample removal.
