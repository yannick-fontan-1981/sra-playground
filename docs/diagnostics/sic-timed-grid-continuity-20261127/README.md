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

## Qualified partial milestone and the first remaining rail cut

Candidate `c137a9d5` is durable as GitHub `169632339da810e429567529b18c58688316ff7e`, exact tree `abeef6cb978055067b1d82e46f4b9586fd43342a`. Its frozen strict replay wins five levels in 16, 24, 23, 36 and 35 commands. These reproduce the historical winning cumulative trajectories through 134 commands. The unchanged 17,000 ms watchdog stops L6 after 22/35 commands. The attached strict result remains partial.

The subsequent full-horizon public capture reproduces that exact command prefix. At global150/L6-16 it offers six ordinary known moves, then closes after one. The independently recognized patrol at cell111 is also classified as static wall, changing known free terrain outside the route. Equivalent false contradictions recur at cells112 and113 on commands152 and154. These numeric locations describe retained evidence only; production has no such constants.

The reader now treats an independently recognized patrol as an occluder of terrain. It preserves any acquired underlying cell and still tracks the moving hazard. The actual route cells remain free throughout the six returns. Two complete native public-teaching sessions (original and reflected/palette/silhouette/command variation) verify one six-command seal, unchanged facts until reconciliation, and the six clock updates in order. True unknown wall signatures, changed route terrain and duplicate carriers still close the prefix. All 54 targeted navigation tests pass. This read correction still needs its own frozen strict replay.

## Reuse of an actually observed stationary control

The same L6 capture also exposes an earlier unnecessary boundary. Command143 establishes that the selected directional command hits a visibly static wall, leaves the unique controlled carrier in place and preserves the pulse reserve. The next three commands144–146 repeat that same needed hold while a measured rail still covers the desired passage. Its acquired cadence predicts the next rail movement after three returned turns. Previously each hold was acquired and replanned individually.

The acquisition now retains that control's actual before/after references, input, carrier site and blocking wall. Reuse requires the same current site/input, a currently visible static wall, unchanged reserve, a uniquely measured rail covering the desired passage, and its previously measured period. The offered prefix is bounded by the next scheduled rail movement, the remaining budget and the common maximum of16. Every actual return and intermediate guard checks the unique carrier, current wall, reserve, continued passage occupation, rail period and next hazard forecast. The prefix closes immediately when the passage clears or any premise changes. There is no pulse repetition and no optimistic movement through an unobserved cell.

The two native transfer sessions now also verify that the first useful repetition reuses this role, executes three actual holds under one decision, and reconciles them once while retaining the pulse. Seven targeted counterexamples cover no change, missing/duplicate carrier, displacement, spent charge, an opened blocking wall and an earlier cleared passage. The last one closes successfully; contradictory controls close as unmatched. Exact predecessor references remain mandatory. All61 targeted tests and TypeScript compilation pass.

## Observed recurrent rails and scoped future clearance

Frozen candidate `d5ff51c4` (durable GitHub `a78c25c2db0c7fc0fde219b9d2b58c13efdf2db5`, exact tree `46ce0c5b3d2bf53f305bbd69bb33e195c847f9cb`) again preserves all134 winning commands through L5. Its strict L6 advances to25 commands before the unchanged17,000 ms watchdog. The actual six-command prefix150–155 now continues with60–80 ms between returned commands. This remains a partial5/6 result.

The next loss is the truncation before an already known free cell merely because a rail occupied it historically. The retained public wall track contains two identical full spatial cycles. Its own cadence is separately acquired. At the intended arrival turn the same measured wall is elsewhere. The old rule considers a one-turn hazard against every later route leg, and a permanent history flag also prevents that later known step from belonging to the prefix.

The additional clearance rule applies only when exactly one retained wall track contains the cell, exactly one currently measured rail role binds that track, its period is known, and two complete consecutive spatial cycles agree. Every admissible repeated cycle must predict the same future position. The current command still refuses actual occupation and the next measured hazard. A later leg may be retained only if its relevant future turn is clear under that acquired recurrence. Unknown cells, patrol areas, pads and doors retain their existing stopping boundaries. A changed actual return invalidates the recurrence and closes the prefix before the crossing.

Two native transfer variants now execute an eight-command prefix. Seven returns come from the retained full-horizon capture. The eighth is explicitly a functional public test return: the actual directional command translates the carrier while the other observed bodies retain their current pose. This final fixture frame is not claimed as an actual backend observation; the chronological strict replay remains the required real qualification. Additional cases deny missing periods, incomplete/contradictory cycles and ambiguous wall tracks, and close on an actual rail return that contradicts the acquired cadence/path. No budget or source game logic is changed.

## Third frozen strict checkpoint

Source `8108415232df9f865739960afed70d3cab3a84f9`, durable as `9e38a8c18a3e1ad97ed0aab5d257dc565da6dcba` (tree `b9b5dc22059a4d0914bd84ee670b5e90fea67b4a`), passed67 targeted tests and TypeScript. The attached freeze proves that production and budget sources stayed unchanged throughout its strict replay. The first five wins retain the same134 commands. L6 executes the eight-step prefix150–157 with52–76 ms between its last returned commands, then reaches global161/L6-27 before the original17,000 ms watchdog. It therefore remains5/6; no final-game qualification is claimed.

`replay-observed-tail.mjs` is a short public diagnostic for the remaining boundary157→158. It replays the156 already captured commands from L1, requires every public frame (and each archived animation) to match, verifies the overlap with the supervisor's actual recent commands, then obtains only the missing actual returns157–161. It neither constructs new commands nor instantiates an agent. Those receipts can subsequently be reconciled in an injected native-family test to inspect the first remaining decision. This restitution is not a new chronological qualification and does not alter the strict result.
