# SRA public source references

This snapshot makes the source resources cited by SRA Playground available in the public `sra-playground` repository. It includes the architecture documents and code used by the articles, the complete reasoning and composition tree texts, and individually browsable sources for the 75 custom games.

Original project: `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan` (private development repository).
Original source revision: `212d8d426f07eea2b6797c2bb647545767488a96`.
Published: 25 October 2026.

This is a selected reference snapshot for reading and attribution. It is not a standalone installation of the complete SRA agent. The game engines execute from the existing browser runtime bundles.

## Reasoning trees

- [Complete reasoning tree V1.5](docs/reasoning-tree/reasoning-tree_v-1.5.txt)
- [Reasoning tree: status and interpretation](docs/reasoning-tree/reasoning-tree_v-1.5/README.md)
- [Declared runtime extensions](docs/reasoning-tree/reasoning-tree_v-1.5/runtime_extensions.json)
- [Complete composition target tree V1.0](docs/reasoning-tree/composition-target-tree_v-1.0.txt)
- [Composition tree: scope and evidence](docs/reasoning-tree/composition-target-tree_v-1.0/README.md)

## Architecture documents

| Resource | Public copy |
| --- | --- |
| Project design notes | [artificial_wisdom_design.md](docs/architecture/artificial_wisdom_design.md) |
| Conditional reasoning specification | [l1_conditional_reasoning_tree.md](docs/architecture/l1_conditional_reasoning_tree.md) |
| Current Python reasoning architecture | [resolving_architecture_overview.md](docs/architecture/resolving_architecture_overview.md) |
| Principle migration and generalization | [v5_principle_migration_generalization.md](docs/architecture/v5_principle_migration_generalization.md) |

## Python and SRC reference files

| Resource | Public copy |
| --- | --- |
| Python agent entry point | [agents/yf_arc3_v5/agent.py](agents/yf_arc3_v5/agent.py) |
| Declared reasoning knowledge | [agents/yf_arc3_v5/drm/knowledge.py](agents/yf_arc3_v5/drm/knowledge.py) |
| Bounded synthesis | [agents/yf_arc3_v5/dynamic_workflow/synthesis.py](agents/yf_arc3_v5/dynamic_workflow/synthesis.py) |
| Typed claims | [agents/yf_arc3_v5/logos/claims.py](agents/yf_arc3_v5/logos/claims.py) |
| Goal dependencies | [agents/yf_arc3_v5/logos/goal_frontier.py](agents/yf_arc3_v5/logos/goal_frontier.py) |
| Term | [agents/yf_arc3_v5/logos/terms.py](agents/yf_arc3_v5/logos/terms.py) |
| RelationFamily and related types | [agents/yf_arc3_v5/logos/types.py](agents/yf_arc3_v5/logos/types.py) |
| SRA selection-tree executor | [agents/yf_arc3_v5/runtime/compiled_selection_tree.py](agents/yf_arc3_v5/runtime/compiled_selection_tree.py) |
| Child contribution and recipient | [agents/yf_arc3_v5/scheduler/contribution_contract.py](agents/yf_arc3_v5/scheduler/contribution_contract.py) |
| Reasoning context and parent goals | [agents/yf_arc3_v5/scheduler/reasoning_context_stack.py](agents/yf_arc3_v5/scheduler/reasoning_context_stack.py) |
| Declared reasoning workflows | [agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src](agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src) |
| Consuming information and resuming the parent | [agents/yf_arc3_v5/src/arc3/continue_after_information_probe.src](agents/yf_arc3_v5/src/arc3/continue_after_information_probe.src) |
| Action release | [agents/yf_arc3_v5/src/core/release_action.src](agents/yf_arc3_v5/src/core/release_action.src) |
| Released action cycle | [agents/yf_arc3_v5/src/core/released_action_cycle.src](agents/yf_arc3_v5/src/core/released_action_cycle.src) |
| Memory reuse contract | [agents/yf_arc3_v5/state/memory_reuse_contract.py](agents/yf_arc3_v5/state/memory_reuse_contract.py) |
| Portable activity memory | [agents/yf_arc3_v5/state/portable_activity_memory.py](agents/yf_arc3_v5/state/portable_activity_memory.py) |
| Reasoning-tree usage indexer | [tools/index_v5_reasoning_tree_usage.py](tools/index_v5_reasoning_tree_usage.py) |

## Custom game engines

These 75 files are byte-for-byte copies of the engines already published in the [custom game runtime archive](../../../public/python/custom-games.zip). Required level data and the browser adapters remain in that archive and the surrounding runtime files.

### Wave 1

| Code | Game | Source |
| --- | --- | --- |
| CASC | Cascade Routing | [cascade_quiesce.py](custom_games/engines/cascade_quiesce.py) |
| CLRS | RGB Glass | [color_glass.py](custom_games/engines/color_glass.py) |
| CONN | Connect Four | [connect_four.py](custom_games/engines/connect_four.py) |
| CRAF | Crafting Console | [craft_console.py](custom_games/engines/craft_console.py) |
| DNOI | Pattern Denoising | [denoise_trame.py](custom_games/engines/denoise_trame.py) |
| ESCT | Patrol Escort | [escort_patrol.py](custom_games/engines/escort_patrol.py) |
| FITE | Arena Survival | [fite_arena.py](custom_games/engines/fite_arena.py) |
| FOGW | Hidden Motion | [fog_hidden_motion.py](custom_games/engines/fog_hidden_motion.py) |
| GORI | Ballistic Aim | [gori_ballistics.py](custom_games/engines/gori_ballistics.py) |
| HANO | Tower of Hanoi | [hanoi.py](custom_games/engines/hanoi.py) |
| KEYD | Keys and Doors | [key_doors.py](custom_games/engines/key_doors.py) |
| LIFE | Life and Lineage | [life_lineage.py](custom_games/engines/life_lineage.py) |
| LOGI | Logic Circuits | [logic_circuit.py](custom_games/engines/logic_circuit.py) |
| LS19 | Shape Alignment (Legacy) | [ls19_legacy.py](custom_games/engines/ls19_legacy.py) |
| MEMO | Memory Recall | [memo_recall.py](custom_games/engines/memo_recall.py) |
| MIND | Code Breaker | [mind_code.py](custom_games/engines/mind_code.py) |
| PORT | Portal Topology | [portal_topology.py](custom_games/engines/portal_topology.py) |
| REGN | Gauge Balance | [reign_gauges.py](custom_games/engines/reign_gauges.py) |
| SEQN | Symbol Sequences | [seqn_groups.py](custom_games/engines/seqn_groups.py) |
| SIGN | Signal Seals | [signal_seal.py](custom_games/engines/signal_seal.py) |
| SKBN | Sokoban | [sokoban.py](custom_games/engines/sokoban.py) |
| STCK | Card Stack | [stack_iso.py](custom_games/engines/stack_iso.py) |
| SWCH | Switch Rooms | [switch_rooms.py](custom_games/engines/switch_rooms.py) |
| SYME | Symmetry Repair | [symmetry_fix.py](custom_games/engines/symmetry_fix.py) |
| VALV | Valve Flow | [valve_flow.py](custom_games/engines/valve_flow.py) |

### Wave 2

| Code | Game | Source |
| --- | --- | --- |
| AS66 | Always Sliding | [always_sliding.py](custom_games/engines/always_sliding.py) |
| CGWL | Cabbage, Goat and Wolf | [cabbage_goat_wolf.py](custom_games/engines/cabbage_goat_wolf.py) |
| COLM | Falling Columns | [columns_match.py](custom_games/engines/columns_match.py) |
| COMB | Combina | [combina.py](custom_games/engines/combina.py) |
| ELAS | Elastic Grid | [elastic_grid.py](custom_games/engines/elastic_grid.py) |
| ETAG | Multi-floor Maze | [etag_floors.py](custom_games/engines/etag_floors.py) |
| FUIT | Fleeing Stones | [flee_stones.py](custom_games/engines/flee_stones.py) |
| GABA | Cargo Clearance | [transport_gabarit.py](custom_games/engines/transport_gabarit.py) |
| GARE | Rail Transfer | [gare_cadence.py](custom_games/engines/gare_cadence.py) |
| GLOB | Globe Track | [globe_track.py](custom_games/engines/globe_track.py) |
| GMAP | Engraved Map | [graved_map.py](custom_games/engines/graved_map.py) |
| GRAV | Gravity Box | [gravity_box.py](custom_games/engines/gravity_box.py) |
| HOLE | Nested Colour Palette | [hole_palette.py](custom_games/engines/hole_palette.py) |
| ISOS | Isometric Sketch | [iso_sketch.py](custom_games/engines/iso_sketch.py) |
| KATA | Pentomino Packing | [katamino.py](custom_games/engines/katamino.py) |
| LKEY | Lock and Key | [lock_and_key.py](custom_games/engines/lock_and_key.py) |
| POLA | Polarity | [polarity.py](custom_games/engines/polarity.py) |
| REWI | Rewind | [rewind.py](custom_games/engines/rewind.py) |
| SELE | Selene | [selene.py](custom_games/engines/selene.py) |
| SERI | Sequence Lab | [sequence_lab.py](custom_games/engines/sequence_lab.py) |
| TEQU | Tower Equilibrium | [tower_equilibrium.py](custom_games/engines/tower_equilibrium.py) |
| TICT | Tic-tac-toe | [tic_tac_toe.py](custom_games/engines/tic_tac_toe.py) |
| TRIA | Triade | [triade.py](custom_games/engines/triade.py) |
| VOIS | Neighbour Cubes | [neighbor_cubes.py](custom_games/engines/neighbor_cubes.py) |
| WEAV | Weave | [weave.py](custom_games/engines/weave.py) |

### Wave 3

| Code | Game | Source |
| --- | --- | --- |
| AMZE | Arrow Maze | [arrow_maze.py](custom_games/engines/arrow_maze.py) |
| CATL | Caterpillar Logic | [caterpillar_logic.py](custom_games/engines/caterpillar_logic.py) |
| CATR | Configured Attraction | [configured_attraction.py](custom_games/engines/configured_attraction.py) |
| CAVA | Knight Maze | [knight_maze.py](custom_games/engines/knight_maze.py) |
| CWSE | Catching Without Seeing | [catching_without_seeing.py](custom_games/engines/catching_without_seeing.py) |
| DAME | Checkers Solitaire | [checkers_solitaire.py](custom_games/engines/checkers_solitaire.py) |
| DICO | Dichotomy | [dichotomy.py](custom_games/engines/dichotomy.py) |
| EVAS | Escape | [evasion.py](custom_games/engines/evasion.py) |
| GIGO | Nested Rooms | [nested_rooms.py](custom_games/engines/nested_rooms.py) |
| GRIL | Grille | [grillage.py](custom_games/engines/grillage.py) |
| HPDL | Homogeneous Pair Deletion | [homogeneous_pair_deletion.py](custom_games/engines/homogeneous_pair_deletion.py) |
| KLOT | Klotski | [simple_klotski.py](custom_games/engines/simple_klotski.py) |
| MOTO | Moto Orbit | [moto_orbit.py](custom_games/engines/moto_orbit.py) |
| ONDE | Wave Alignment | [wave_alignment.py](custom_games/engines/wave_alignment.py) |
| PIPE | Pipes | [pipes.py](custom_games/engines/pipes.py) |
| PRTL | Portal Chambers | [portal_chambers.py](custom_games/engines/portal_chambers.py) |
| RECR | Recruit Army | [recruit_army.py](custom_games/engines/recruit_army.py) |
| RSWP | Role Swap | [role_swap.py](custom_games/engines/role_swap.py) |
| SMLP | Same Length Path | [same_length_path.py](custom_games/engines/same_length_path.py) |
| SNAR | Sonar Maze | [sonar_maze.py](custom_games/engines/sonar_maze.py) |
| SPOR | Spore Lab | [spore_lab.py](custom_games/engines/spore_lab.py) |
| THER | Thermometers | [thermometers.py](custom_games/engines/thermometers.py) |
| TRCP | Tracing Path | [tracing_path.py](custom_games/engines/tracing_path.py) |
| UPST | Upset | [upset.py](custom_games/engines/upset.py) |
| ZIPP | Zip | [zip.py](custom_games/engines/zip.py) |

## Integrity, attribution, and updates

The [manifest](manifest.json) records the original Git blob identities, original SHA-256 hashes, and the hashes of the public copies. All source code, the tree texts, and the engine copies retain their original bytes. Two Markdown documents have internal links to files outside this selected snapshot displayed as source paths; their text is otherwise unchanged. Every such formatting adjustment is recorded in [link-adjustments.json](link-adjustments.json).

The original repository [MIT license](LICENSE) and existing source notices are retained. The project-specific documents and custom games are attributed to Yannick Fontan; the inherited license notice does not assert that its named copyright holder authored every project-specific file.

New citations must link to a resource present in the public repository. If an article is updated to a different source revision, publish the matching files in a new snapshot directory and update its source links together. The original revision identifies provenance; it is not a commit identifier in the public repository.
