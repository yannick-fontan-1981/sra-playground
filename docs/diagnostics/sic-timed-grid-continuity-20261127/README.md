# Completed navigation and actual timed-grid continuity

## First loss from the unchanged horizon

`first-loss.full-horizon.json.gz` is a public-only chronological diagnostic of source `38809c07707b964c20b663eafabf1c7ee389ed4c`, from L1 in one SIC session and one worker. The archived action/time budgets and original `agent.run` horizon were retained. No private game state was read. The passive capture does not qualify active time. It reproduced all four prior completed level prefixes exactly: 16, 21, 23 and 36 commands. Level 5 stopped at 40 commands on its 28,000 ms active budget (42-command cap).

The first lost role is command 97. Navigation actually reached the observed goal on command 96 and the official score increased. Its acquisition skipped that boundary, retaining neither an explicit completed-navigation witness nor its before/after references. A compatible new grid was then offered after unrelated preview hypotheses. Commands 97–98 followed a two-pixel meter; commands 99–102 followed moving patrol shapes and consumed two pulses. These are distinct public phenomena, not evidence of one controlled carrier.

A second loss appears at command 103: navigation already proposed a six-cell ordinary route through observed free terrain. Its measured state included moving walls and patrols, but no established rail clock. The proposer therefore restricted this known prefix to one command. Each following return forced a new decision even though the next known cell and independently measured hazards remained admissible.

## Learned roles and reuse

A completed navigation witness is acquired only when an actually executed ordinary move targets the measured goal and the official score increases by exactly one. It retains the winning command's public before/after references, old epoch, resulting score, measured carrier and surface palette roles, and available input set. It does not retain a new-board route.

The early observed-role group admits the next board only in the same public session, immediately after that acquired epoch, at the witnessed score and with the same inputs. The ordinary recognizer must independently measure one carrier, the lattice and goal; carrier and surface roles must match. Missing/ambiguous actors or goals, changed inputs, score or session reject only this association and retain independently acquired state. Other preview/contact strategies are unchanged.

Known ordinary timed walks now use the same bounded native mechanism as other known walks. Pads, doors, nonlocal landings, unknown terrain and measured hazards terminate the offered prefix. Every actual returned raster updates a private per-prefix reading and wall/patrol history. The next native guard requires the exact preceding acquired observation reference, remeasures the unique carrier and next target, and checks the updated hazard forecast. A missing/ambiguous carrier, wrong displacement, changed known terrain or route hazard closes the prefix. Only the ordered `record` pass publishes acquired facts, once at reconciliation. A single helper constructs each leg's real command/target; the guard never treats the first command as all later commands.

## Native validation

`tests/sic-grid-completion-role.test.ts` runs two native sessions through 16 actual public learning commands and the official boundary, including the real prepared-effect family and production selection groups. The second scenario reflects geometry, remaps colors, changes the carrier silhouette and swaps horizontal commands. Both first commands belong to the acquired navigation role. Missing/duplicate carrier, missing goal, changed inputs/score and foreign session are rejected while retaining the role. A declared functional public return executes the actually issued command.

`tests/sic-timed-grid-continuity.test.ts` runs two native sessions through 102 chronological public teaching returns. One reflects the timed grid, changes the palette and carrier shape, and swaps horizontal commands. Both then execute the six real public returns of the known prefix under one decision. Guards are repeated to prove they do not publish state and reject an unacquired predecessor. The native runtime emits one six-record seal; only then are all ordered terrain and patrol facts visible. Additional native scenarios close on missing/duplicate carrier, wrong displacement and a new future route hazard while preserving the previous completion witness.

The other 40 existing navigation, ordinary continuity and reassociation tests pass. TypeScript compilation passes. The existing ordinary tests now bind their counterexample proposals to the actual measured input reference, as required by exact native prefix identity.

## Qualification boundary

The first-loss capture is diagnostic, not a success claim. A frozen-source chronological strict replay from L1 to the final level with the unchanged archived per-level budgets is required before this candidate is counted complete. Physical continuity and the global regression gate must then retain the previously won levels. CGWL remains independently qualified at the earlier `50dcefe1` boundary.
