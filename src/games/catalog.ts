/**
 * The upstream 100-game evaluation suite: 25 official games + 75 custom games.
 *
 * Custom identifiers, families, waves and level counts come from
 * custom_games/registry.py. Official identifiers come from
 * run_all_level1_v5.py (GAMES / OFFICIAL_GAME_IDS).
 * Both sources are pinned to SOURCE_COMMIT below.
 *
 * Friendly custom names and a few descriptions are translated into English.
 * Official titles and level counts are intentionally not guessed.
 * "playable" describes the browser game port, not SRA integration.
 */

export const SOURCE_REPOSITORY = 'https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan';
export const SOURCE_COMMIT = '212d8d426f07eea2b6797c2bb647545767488a96';

export type GameGroup = 'official' | 'custom' | 'custom_2' | 'custom_3';
export type GameAvailability = 'playable' | 'port-pending';

export interface GameCatalogEntry {
  code: string;
  id: string;
  name: string;
  group: GameGroup;
  family: string;
  levels: number | null;
  description: string;
  sourcePath: string;
  sourceUrl: string;
  availability: GameAvailability;
}

const records: Omit<GameCatalogEntry, 'sourceUrl'>[] = [
  {
    "code": "AR25",
    "id": "ar25-0c556536",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "BP35",
    "id": "bp35-0a0ad940",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "CD82",
    "id": "cd82-fb555c5d",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "CN04",
    "id": "cn04-2fe56bfb",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "DC22",
    "id": "dc22-fdcac232",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "FT09",
    "id": "ft09-0d8bbf25",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "G50T",
    "id": "g50t-5849a774",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "KA59",
    "id": "ka59-38d34dbb",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "LF52",
    "id": "lf52-271a04aa",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "LP85",
    "id": "lp85-305b61c3",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "LS20",
    "id": "ls20-9607627b",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "M0R0",
    "id": "m0r0-492f87ba",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "R11L",
    "id": "r11l-495a7899",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "RE86",
    "id": "re86-8af5384d",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "S5I5",
    "id": "s5i5-18d95033",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "SB26",
    "id": "sb26-7fbdac44",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "SC25",
    "id": "sc25-635fd71a",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "SK48",
    "id": "sk48-d8078629",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "SP80",
    "id": "sp80-589a99af",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "SU15",
    "id": "su15-1944f8ab",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "TN36",
    "id": "tn36-ef4dde99",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "TR87",
    "id": "tr87-cd924810",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "TU93",
    "id": "tu93-0768757b",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "VC33",
    "id": "vc33-5430563c",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "WA30",
    "id": "wa30-ee6fef47",
    "name": "Official ARC-AGI-3 game",
    "group": "official",
    "family": "official_arc_agi_3",
    "levels": null,
    "description": "An official ARC-AGI-3 game included in the upstream 100-game evaluation suite. Its game-specific title and level count are not documented in the catalogue source.",
    "sourcePath": "run_all_level1_v5.py",
    "availability": "port-pending"
  },
  {
    "code": "SKBN",
    "id": "skbn-c0000001",
    "name": "Sokoban",
    "group": "custom",
    "family": "push_only_box_deadlock",
    "levels": 6,
    "description": "Custom Sokoban: push boxes onto targets (6 levels).",
    "sourcePath": "custom_games/engines/sokoban.py",
    "availability": "port-pending"
  },
  {
    "code": "CLRS",
    "id": "clrs-c0000001",
    "name": "RGB Glass",
    "group": "custom",
    "family": "additive_rgb_glass",
    "levels": 6,
    "description": "Additive RGB glass panes: R+G=Y, G+B=C, B+R=M, RGB=W. Click select, arrows move, SPACE rotate; match center 10x10 to legend.",
    "sourcePath": "custom_games/engines/color_glass.py",
    "availability": "port-pending"
  },
  {
    "code": "SWCH",
    "id": "swch-c0000001",
    "name": "Switch Rooms",
    "group": "custom",
    "family": "switch_door_battery",
    "levels": 6,
    "description": "Multi-piece rooms: light switches (yellow+piece), door switches (A+grey+B), battery budget; dark when unlit; arrows only.",
    "sourcePath": "custom_games/engines/switch_rooms.py",
    "availability": "port-pending"
  },
  {
    "code": "STCK",
    "id": "stck-c0000001",
    "name": "Card Stack",
    "group": "custom",
    "family": "isometric_card_stack_combat",
    "levels": 6,
    "description": "Isometric diamond grid: build a color card stack at the magenta shop (per-level palette + max_stack). SPACE executes bottom→top (cyan L, blue U, green R, yellow D, red attack-8, pink push-8-neighbours). Damage removes top; orange/grey holes kill; clear all foes.",
    "sourcePath": "custom_games/engines/stack_iso.py",
    "availability": "port-pending"
  },
  {
    "code": "HANO",
    "id": "hano-c0000001",
    "name": "Tower of Hanoi",
    "group": "custom",
    "family": "hanoi_order",
    "levels": 4,
    "description": "Tower of Hanoi: only top disc moves; only a smaller disc may rest on a larger one. Start left; rebuild full ordered tower on the rightmost peg (white + ghost outline). Click peg to pick/place (ACTION6).",
    "sourcePath": "custom_games/engines/hanoi.py",
    "availability": "port-pending"
  },
  {
    "code": "SEQN",
    "id": "seqn-c0000001",
    "name": "Symbol Sequences",
    "group": "custom",
    "family": "directional_symbol_sequence_groups",
    "levels": 6,
    "description": "Red frames of symbol sequences (triangle/circle/square/star). Direction keys light matching white-focus symbols green; mismatch resets unfinished frames; completed frames lock green. Tight pip bar; start-order is the puzzle.",
    "sourcePath": "custom_games/engines/seqn_groups.py",
    "availability": "port-pending"
  },
  {
    "code": "MIND",
    "id": "mind-c0000001",
    "name": "Code Breaker",
    "group": "custom",
    "family": "mastermind_code",
    "levels": 6,
    "description": "Mastermind-style code breaking: click palette colours to build a guess, SPACE/SUBMIT to score. Feedback uses yellow (exact place) and cyan (colour present, wrong place) — not semantic black/white pegs. L01 has white didactic click outlines.",
    "sourcePath": "custom_games/engines/mind_code.py",
    "availability": "port-pending"
  },
  {
    "code": "MEMO",
    "id": "memo-c0000001",
    "name": "Memory Recall",
    "group": "custom",
    "family": "identity_match_across_time",
    "levels": 6,
    "description": "Circle recall: click a symbol that was present on the previous step. 10 stages, 15-click budget. Colours/rotation/zoom harden across levels. L01 has white didactic outlines on the target symbol.",
    "sourcePath": "custom_games/engines/memo_recall.py",
    "availability": "port-pending"
  },
  {
    "code": "REGN",
    "id": "regn-c0000001",
    "name": "Gauge Balance",
    "group": "custom",
    "family": "multi_gauge_equilibrium",
    "levels": 6,
    "description": "Three RGB gauges with low/high limits. Choose left or right trios of +/− consumables, recurring triangles, and coloured transfers. Keep all gauges in-bounds for N steps (10+2 per level).",
    "sourcePath": "custom_games/engines/reign_gauges.py",
    "availability": "port-pending"
  },
  {
    "code": "CONN",
    "id": "conn-c0000001",
    "name": "Connect Four",
    "group": "custom",
    "family": "line_config_vs_adversary",
    "levels": 6,
    "description": "Connect Four 7×6: click a column to drop. L01 teaches the four winning lines on mini-boards; L02–L06 are versus a scripted AI of rising strength. Player is yellow, adversary red.",
    "sourcePath": "custom_games/engines/connect_four.py",
    "availability": "port-pending"
  },
  {
    "code": "DNOI",
    "id": "dnoi-c0000001",
    "name": "Pattern Denoising",
    "group": "custom",
    "family": "consensus_line_denoise",
    "levels": 6,
    "description": "Denoise a patterned grid: click big pixels to toggle broken↔correct. L01 foreign noise colour; later levels camouflage noise using trame colours. Oracle matches ARC-2 constelize consensus denoise.",
    "sourcePath": "custom_games/engines/denoise_trame.py",
    "availability": "port-pending"
  },
  {
    "code": "SYME",
    "id": "syme-c0000001",
    "name": "Symmetry Repair",
    "group": "custom",
    "family": "symmetric_completion",
    "levels": 6,
    "description": "Repair broken symmetry by toggling broken↔correct. No axis is drawn: infer H/V/rot180 or H+V. Foreign holes early; camouflage on double-axis late levels. UX like DNOI.",
    "sourcePath": "custom_games/engines/symmetry_fix.py",
    "availability": "port-pending"
  },
  {
    "code": "GORI",
    "id": "gori-c0000001",
    "name": "Ballistic Aim",
    "group": "custom",
    "family": "ballistic_hit_under_gravity",
    "levels": 6,
    "description": "Gorillas-like ballistic aim: left/right power gauge (start 50%), click to fire toward a point. Passive target is passive. Miss reconfigures the whole skyline. L04 one portal pair; L05 two pairs; L06 two pairs with 90° velocity rotation.",
    "sourcePath": "custom_games/engines/gori_ballistics.py",
    "availability": "port-pending"
  },
  {
    "code": "KEYD",
    "id": "keyd-c0000001",
    "name": "Keys and Doors",
    "group": "custom",
    "family": "typed_key_allocation_interlevel",
    "levels": 6,
    "description": "Typed keys and doors under bounded inventory: consumption, reusable keys, non-commutative allocation, topology-coded types, and hidden inter-level possession recall.",
    "sourcePath": "custom_games/engines/key_doors.py",
    "availability": "port-pending"
  },
  {
    "code": "LOGI",
    "id": "logi-c0000001",
    "name": "Logic Circuits",
    "group": "custom",
    "family": "abstract_coloured_electronic_circuits",
    "levels": 6,
    "description": "Dense coloured circuits with abstract three- and four-wire gates, live propagation, direct switch clicks, mixed solutions, and automatic lamp completion.",
    "sourcePath": "custom_games/engines/logic_circuit.py",
    "availability": "port-pending"
  },
  {
    "code": "PORT",
    "id": "port-c0000001",
    "name": "Portal Topology",
    "group": "custom",
    "family": "portal_topology_graph_rewrite_interlevel",
    "levels": 6,
    "description": "Oriented portal pairs across separated rooms: learn stable identities, preserve exit pose, remember hidden pairings between levels, and replan when a switch rewrites the topology.",
    "sourcePath": "custom_games/engines/portal_topology.py",
    "availability": "port-pending"
  },
  {
    "code": "FOGW",
    "id": "fogw-c0000001",
    "name": "Hidden Motion",
    "group": "custom",
    "family": "hidden_motion_delayed_causality_interlevel",
    "levels": 6,
    "description": "Track shaped entities through opaque fog, preserve episode-specific direction and timing, synchronize capture bays, and revise hidden routes after delayed switches.",
    "sourcePath": "custom_games/engines/fog_hidden_motion.py",
    "availability": "port-pending"
  },
  {
    "code": "LIFE",
    "id": "life-c0000001",
    "name": "Life and Lineage",
    "group": "custom",
    "family": "entity_lifecycle_lineage_interlevel",
    "levels": 6,
    "description": "Follow stable lineage signatures through birth, compatible merges, compound splits, changed shells, and episode-specific destination phenotypes remembered between levels.",
    "sourcePath": "custom_games/engines/life_lineage.py",
    "availability": "port-pending"
  },
  {
    "code": "VALV",
    "id": "valv-c0000001",
    "name": "Valve Flow",
    "group": "custom",
    "family": "finite_flow_inverse_pump_tower_overflow_interlevel",
    "levels": 6,
    "description": "Route and recover a finite water stock through reversible valves, prime hidden relays, stage all-at-once water-tower bursts, and satisfy permuted target gauges without sewer loss or animated overflow.",
    "sourcePath": "custom_games/engines/valve_flow.py",
    "availability": "port-pending"
  },
  {
    "code": "SIGN",
    "id": "sign-c0000001",
    "name": "Signal Seals",
    "group": "custom",
    "family": "deceptive_signal_terminal_validation",
    "levels": 6,
    "description": "Authenticate true beacons among decoys: step-on glow is only a visual cue; SPACE seals underfoot (true→gauge+white core, false→brown). No click. Covers inverted HUD until calibrate, shape/position channels, and delayed SPACE validation.",
    "sourcePath": "custom_games/engines/signal_seal.py",
    "availability": "port-pending"
  },
  {
    "code": "CASC",
    "id": "casc-c0000001",
    "name": "Cascade Routing",
    "group": "custom",
    "family": "autonomous_cascade_quiescence",
    "levels": 6,
    "description": "Metro-like domino routing: 3x3 tiles with 1px gaps, brown blockers, magenta continuators. L01 is SPACE-only; later levels need precise smother/bridge. Multi-terminal Tokyo/NY/Paris maps. Pink O; spent=brown.",
    "sourcePath": "custom_games/engines/cascade_quiesce.py",
    "availability": "port-pending"
  },
  {
    "code": "CRAF",
    "id": "craf-c0000001",
    "name": "Crafting Console",
    "group": "custom",
    "family": "craft_recipe_multiset_economy",
    "levels": 6,
    "description": "Night-watch craft console: click stock bins into recipe slots, SPACE crafts (A+B→C), click ORDER to ship. Shared rare resources, morphology swap, intermediate chains, tight energy, and X↔Y exchange bay.",
    "sourcePath": "custom_games/engines/craft_console.py",
    "availability": "port-pending"
  },
  {
    "code": "ESCT",
    "id": "esct-c0000001",
    "name": "Patrol Escort",
    "group": "custom",
    "family": "other_agent_patrol_escort_passage",
    "levels": 6,
    "description": "Night-watch escort console: a passive convoy advances on a rail while a deterministic patrol closes in. Cage hunters and clear several delayed rail chokes; collision resets the level. Later arenas mix fast and predictive hunters while role colours stay stable.",
    "sourcePath": "custom_games/engines/escort_patrol.py",
    "availability": "port-pending"
  },
  {
    "code": "LS19",
    "id": "ls19-c0000001",
    "name": "Shape Alignment (Legacy)",
    "group": "custom",
    "family": "legacy_shape_color_rotation_alignment",
    "levels": 8,
    "description": "Preserved standalone LS20 Legacy game under the LS19 custom identity: navigate, change shape/color/rotation, manage oxygen, and align with the matching target across all 8 original levels.",
    "sourcePath": "custom_games/engines/ls19_legacy.py",
    "availability": "port-pending"
  },
  {
    "code": "FITE",
    "id": "fite-c0000001",
    "name": "Arena Survival",
    "group": "custom",
    "family": "survive_N_affinity_combat",
    "levels": 6,
    "description": "Turn-based arena: colour kits, move then auto-power (no SPACE), white-outline player, initiative HUD. Survive 10+level turns with 3 hearts. Immortal enemies aggro nearest (fight each other). Damage copies attacker kit.",
    "sourcePath": "custom_games/engines/fite_arena.py",
    "availability": "port-pending"
  },
  {
    "code": "AS66",
    "id": "as66-c0000001",
    "name": "Always Sliding",
    "group": "custom_2",
    "family": "always_sliding_wrap_slots",
    "levels": 9,
    "description": "Always Sliding (AS66): arrows slide all cursors until blocked; wrap at edges (edge flashes green). Seat every cursor in a U-slot at once. Later levels add colour matching, paint portals, and orange blockers/patrols.",
    "sourcePath": "custom_games/engines/always_sliding.py",
    "availability": "port-pending"
  },
  {
    "code": "GARE",
    "id": "gare-c0000001",
    "name": "Rail Transfer",
    "group": "custom_2",
    "family": "cadenced_rail_transfer",
    "levels": 6,
    "description": "Click rail controls to slide trains and let mechanical arms transfer their cargo. Later levels introduce inverse arms, multiple trains, mismatched slots and trap entries.",
    "sourcePath": "custom_games/engines/gare_cadence.py",
    "availability": "port-pending"
  },
  {
    "code": "COLM",
    "id": "colm-c0000001",
    "name": "Falling Columns",
    "group": "custom_2",
    "family": "falling_column_match3",
    "levels": 6,
    "description": "Columns-like: steer a falling triple of jewels, cycle their colours, match 3+ in a line (H/V/diag). Clears cascade with gravity. Distinct from craft/inventory games.",
    "sourcePath": "custom_games/engines/columns_match.py",
    "availability": "port-pending"
  },
  {
    "code": "GABA",
    "id": "gaba-c0000001",
    "name": "Cargo Clearance",
    "group": "custom_2",
    "family": "transport_footprint_clearance",
    "levels": 6,
    "description": "Carry cargo through corridors while accounting for its complete footprint. Attach, detach and rotate loads to pass through narrow spaces.",
    "sourcePath": "custom_games/engines/transport_gabarit.py",
    "availability": "port-pending"
  },
  {
    "code": "FUIT",
    "id": "fuit-c0000001",
    "name": "Fleeing Stones",
    "group": "custom_2",
    "family": "flee_push_trap",
    "levels": 6,
    "description": "Catch a fleeing element by pushing stones to close its escape routes. The element moves after each player action.",
    "sourcePath": "custom_games/engines/flee_stones.py",
    "availability": "port-pending"
  },
  {
    "code": "ETAG",
    "id": "etag-c0000001",
    "name": "Multi-floor Maze",
    "group": "custom_2",
    "family": "multi_floor_labyrinth",
    "levels": 6,
    "description": "Navigate a multi-floor maze with several stairwells and return trips to reach the exit within the action budget.",
    "sourcePath": "custom_games/engines/etag_floors.py",
    "availability": "port-pending"
  },
  {
    "code": "TICT",
    "id": "tict-c0000001",
    "name": "Tic-tac-toe",
    "group": "custom_2",
    "family": "align_3_vs_adversary",
    "levels": 6,
    "description": "Tic-tac-toe 3×3: click empty cells (X yellow vs O red). L01 saboteur AI; later levels add opponent/player pre-moves, then multi-boards (win ≥1). L06 perfect minimax on 4 boards. Animated pulse on three-in-a-row.",
    "sourcePath": "custom_games/engines/tic_tac_toe.py",
    "availability": "port-pending"
  },
  {
    "code": "GLOB",
    "id": "glob-c0000001",
    "name": "Globe Track",
    "group": "custom_2",
    "family": "globe_track_record",
    "levels": 6,
    "description": "Globe track: 7 latitude rings (1-4-7-10-7-4-1). Click a slot to arm a path; SPACE plays recorded directions. Lava/cyclone/cyan hazards; reach the green goal. Exact ASCII globe frame.",
    "sourcePath": "custom_games/engines/globe_track.py",
    "availability": "port-pending"
  },
  {
    "code": "KATA",
    "id": "kata-c0000001",
    "name": "Pentomino Packing",
    "group": "custom_2",
    "family": "pentomino_packing",
    "levels": 6,
    "description": "Katamino-style pentomino packing: pick, move, rotate and release pieces to tile the board. Fixed hint pieces, collision preview, and increasing board sizes across L01–L06.",
    "sourcePath": "custom_games/engines/katamino.py",
    "availability": "port-pending"
  },
  {
    "code": "HOLE",
    "id": "hole-c0000001",
    "name": "Nested Colour Palette",
    "group": "custom_2",
    "family": "additive_hole_paint",
    "levels": 6,
    "description": "Hole palette: paint nested regions with R/G/B primaries. Mixing yields Y/P/C; same-color parent/child conflicts error-reset. Inspired by ARC e3721c99.",
    "sourcePath": "custom_games/engines/hole_palette.py",
    "availability": "port-pending"
  },
  {
    "code": "GRAV",
    "id": "grav-c0000001",
    "name": "Gravity Box",
    "group": "custom_2",
    "family": "gravity_box",
    "levels": 6,
    "description": "Gravity Box: choose wall gravity (N/E/S/W) so colored crates slide and stick to matching walls. Later levels add obstacles and a glue toggle. 64×64 pixel controls; six authored boards.",
    "sourcePath": "custom_games/engines/gravity_box.py",
    "availability": "port-pending"
  },
  {
    "code": "VOIS",
    "id": "vois-c0000001",
    "name": "Neighbour Cubes",
    "group": "custom_2",
    "family": "neighbor_cubes",
    "levels": 6,
    "description": "Neighbor Cubes: arrange movable cubes so their orthogonal-neighbor colors reproduce the legend inside one of the outlined zones. Six authored 64x64 boards with keyboard and pixel-click controls.",
    "sourcePath": "custom_games/engines/neighbor_cubes.py",
    "availability": "port-pending"
  },
  {
    "code": "POLA",
    "id": "pola-c0000001",
    "name": "Polarity",
    "group": "custom_2",
    "family": "polarity",
    "levels": 6,
    "description": "Polarity: rotate selected red/blue magnets, then let attraction and repulsion settle the board until a magnet reaches the green target. Six authored 64x64 magnetic-physics puzzles.",
    "sourcePath": "custom_games/engines/polarity.py",
    "availability": "port-pending"
  },
  {
    "code": "ELAS",
    "id": "elas-c0000001",
    "name": "Elastic Grid",
    "group": "custom_2",
    "family": "elastic_grid",
    "levels": 6,
    "description": "Elastic Grid: move and stack colored tiles on an irregular grid until the visible raster exactly matches the legend at a uniform scale. Six authored 64x64 boards with hidden stacked tiles.",
    "sourcePath": "custom_games/engines/elastic_grid.py",
    "availability": "port-pending"
  },
  {
    "code": "TRIA",
    "id": "tria-c0000001",
    "name": "Triade",
    "group": "custom_2",
    "family": "triade",
    "levels": 6,
    "description": "Triade: steer three colored cubes with three independent joysticks until their relative arrangement matches the legend. Six authored 64x64 toroidal movement puzzles.",
    "sourcePath": "custom_games/engines/triade.py",
    "availability": "port-pending"
  },
  {
    "code": "SERI",
    "id": "seri-c0000001",
    "name": "Sequence Lab",
    "group": "custom_2",
    "family": "sequence_lab",
    "levels": 6,
    "description": "Sequence Lab: infer the missing glyph in four visual sequences per level, select one of three proposals, and submit it. Six authored 64x64 visual-reasoning levels.",
    "sourcePath": "custom_games/engines/sequence_lab.py",
    "availability": "port-pending"
  },
  {
    "code": "COMB",
    "id": "comb-c0000001",
    "name": "Combina",
    "group": "custom_2",
    "family": "combina",
    "levels": 6,
    "description": "Combina: press two to four cyclic indicator buttons and visit every possible joint configuration within a bounded action budget. Six authored 64x64 combinatorial puzzles.",
    "sourcePath": "custom_games/engines/combina.py",
    "availability": "port-pending"
  },
  {
    "code": "ISOS",
    "id": "isos-c0000001",
    "name": "Isometric Sketch",
    "group": "custom_2",
    "family": "iso_sketch",
    "levels": 6,
    "description": "Iso Sketch: construct an isometric voxel drawing by clicking visible faces, or erase visible cubes, until the cropped view matches the legend. Six authored 64x64 construction puzzles.",
    "sourcePath": "custom_games/engines/iso_sketch.py",
    "availability": "port-pending"
  },
  {
    "code": "SELE",
    "id": "sele-c0000001",
    "name": "Selene",
    "group": "custom_2",
    "family": "selene",
    "levels": 6,
    "description": "Selene: rotate selected lunar relays and launch a laser through the complete sphere chain to the terminal target. Six authored 64x64 analytical ray puzzles.",
    "sourcePath": "custom_games/engines/selene.py",
    "availability": "port-pending"
  },
  {
    "code": "REWI",
    "id": "rewi-c0000001",
    "name": "Rewind",
    "group": "custom_2",
    "family": "rewind",
    "levels": 6,
    "description": "Rewind: scan a photographic film, observe its complete playback, and click the unique image region matching the target fragment. Six authored 64x64 visual-search puzzles.",
    "sourcePath": "custom_games/engines/rewind.py",
    "availability": "port-pending"
  },
  {
    "code": "LKEY",
    "id": "lkey-c0000001",
    "name": "Lock and Key",
    "group": "custom_2",
    "family": "lock_and_key",
    "levels": 6,
    "description": "Lock & Key: swap keys between rows, apply each row's tool, and test the resulting teeth against the real locks. Six authored 64x64 puzzles with empty lock slots.",
    "sourcePath": "custom_games/engines/lock_and_key.py",
    "availability": "port-pending"
  },
  {
    "code": "TEQU",
    "id": "tequ-c0000001",
    "name": "Tower Equilibrium",
    "group": "custom_2",
    "family": "tower_equilibrium",
    "levels": 6,
    "description": "Tower Equilibrium: place beams of three lengths to connect both foundations to the target while keeping every supported structure stable. Six authored physics puzzles.",
    "sourcePath": "custom_games/engines/tower_equilibrium.py",
    "availability": "port-pending"
  },
  {
    "code": "GMAP",
    "id": "gmap-c0000001",
    "name": "Engraved Map",
    "group": "custom_2",
    "family": "graved_map",
    "levels": 6,
    "description": "Graved Map: explore connected rooms, reveal the engraved map, collect keys automatically and enter matching doors from their keyed side. Six levels with a 30-move limit.",
    "sourcePath": "custom_games/engines/graved_map.py",
    "availability": "port-pending"
  },
  {
    "code": "CGWL",
    "id": "cgwl-c0000001",
    "name": "Cabbage, Goat and Wolf",
    "group": "custom_2",
    "family": "cabbage_goat_wolf",
    "levels": 6,
    "description": "Cabbage, Goat & Wolf: guide the shepherd and transport each passenger safely across the river, using the calming zone and colored reception slots. Six tutorial levels.",
    "sourcePath": "custom_games/engines/cabbage_goat_wolf.py",
    "availability": "port-pending"
  },
  {
    "code": "WEAV",
    "id": "weav-c0000001",
    "name": "Weave",
    "group": "custom_2",
    "family": "weave",
    "levels": 6,
    "description": "Weave colored horizontal and vertical threads through a small grid to reproduce the visible target motif. Six authored levels.",
    "sourcePath": "custom_games/engines/weave.py",
    "availability": "port-pending"
  },
  {
    "code": "GRIL",
    "id": "gril-c3000001",
    "name": "Grille",
    "group": "custom_3",
    "family": "grillage",
    "levels": 6,
    "description": "Identify colored shapes behind a grille by translating them, then select their matching models within a shared movement budget.",
    "sourcePath": "custom_games/engines/grillage.py",
    "availability": "port-pending"
  },
  {
    "code": "DICO",
    "id": "dico-c3000001",
    "name": "Dichotomy",
    "group": "custom_3",
    "family": "dichotomy",
    "levels": 6,
    "description": "Locate a faulty lamp by testing and subdividing series circuits. Read the complete outage animation within the fixed test budget.",
    "sourcePath": "custom_games/engines/dichotomy.py",
    "availability": "port-pending"
  },
  {
    "code": "EVAS",
    "id": "evas-c3000001",
    "name": "Escape",
    "group": "custom_3",
    "family": "evasion",
    "levels": 6,
    "description": "Reach the exit while avoiding guards and their moving light cones. Click a destination to walk or wait with ACTION5.",
    "sourcePath": "custom_games/engines/evasion.py",
    "availability": "port-pending"
  },
  {
    "code": "KLOT",
    "id": "klot-c3000001",
    "name": "Klotski",
    "group": "custom_3",
    "family": "simple_klotski",
    "levels": 6,
    "description": "Slide rigid pieces one cell at a time to bring the gold bar or L into its exit. Selection and movement each consume one action.",
    "sourcePath": "custom_games/engines/simple_klotski.py",
    "availability": "port-pending"
  },
  {
    "code": "UPST",
    "id": "upst-c3000001",
    "name": "Upset",
    "group": "custom_3",
    "family": "upset",
    "levels": 6,
    "description": "Open and close doors to reshape colored entities' routes and reactions until the red entity eats the violet boss.",
    "sourcePath": "custom_games/engines/upset.py",
    "availability": "port-pending"
  },
  {
    "code": "THER",
    "id": "ther-c3000001",
    "name": "Thermometers",
    "group": "custom_3",
    "family": "thermometers",
    "levels": 6,
    "description": "Fill each thermometer continuously from its bulb until all row and column totals match the visible clues.",
    "sourcePath": "custom_games/engines/thermometers.py",
    "availability": "port-pending"
  },
  {
    "code": "ZIPP",
    "id": "zipp-c3000001",
    "name": "Zip",
    "group": "custom_3",
    "family": "zip",
    "levels": 6,
    "description": "Draw a path from the blue start through every cell exactly once, reaching the green exit last without crossing walls.",
    "sourcePath": "custom_games/engines/zip.py",
    "availability": "port-pending"
  },
  {
    "code": "AMZE",
    "id": "amze-c3000001",
    "name": "Arrow Maze",
    "group": "custom_3",
    "family": "arrow_maze",
    "levels": 6,
    "description": "Jump along the current arrow's ray to reach the goal within the click reserve. Legal destinations are highlighted in cyan.",
    "sourcePath": "custom_games/engines/arrow_maze.py",
    "availability": "port-pending"
  },
  {
    "code": "PIPE",
    "id": "pipe-c3000001",
    "name": "Pipes",
    "group": "custom_3",
    "family": "pipes",
    "levels": 6,
    "description": "Rotate pipes to connect every cell to the source without leaks or cycles.",
    "sourcePath": "custom_games/engines/pipes.py",
    "availability": "playable"
  },
  {
    "code": "GIGO",
    "id": "gigo-c3000001",
    "name": "Nested Rooms",
    "group": "custom_3",
    "family": "nested_rooms",
    "levels": 6,
    "description": "Move nested rooms and their descendants to open a path from the source to the outer exit.",
    "sourcePath": "custom_games/engines/nested_rooms.py",
    "availability": "port-pending"
  },
  {
    "code": "CATL",
    "id": "catl-c3000001",
    "name": "Caterpillar Logic",
    "group": "custom_3",
    "family": "caterpillar_logic",
    "levels": 6,
    "description": "Infer the classification rule from examples and sort eight caterpillars into violet or orange.",
    "sourcePath": "custom_games/engines/caterpillar_logic.py",
    "availability": "port-pending"
  },
  {
    "code": "PRTL",
    "id": "prtl-c3000001",
    "name": "Portal Chambers",
    "group": "custom_3",
    "family": "portal_chambers",
    "levels": 6,
    "description": "Place linked portals and move crates through chambers to reach the exit.",
    "sourcePath": "custom_games/engines/portal_chambers.py",
    "availability": "port-pending"
  },
  {
    "code": "MOTO",
    "id": "moto-c3000001",
    "name": "Moto Orbit",
    "group": "custom_3",
    "family": "moto_orbit",
    "levels": 6,
    "description": "Reposition turning posts, then launch an autonomous motorcycle run to reach the exit.",
    "sourcePath": "custom_games/engines/moto_orbit.py",
    "availability": "port-pending"
  },
  {
    "code": "ONDE",
    "id": "onde-c3000001",
    "name": "Wave Alignment",
    "group": "custom_3",
    "family": "wave_alignment",
    "levels": 6,
    "description": "Shift individual waves or the shared film to match every detector's target height.",
    "sourcePath": "custom_games/engines/wave_alignment.py",
    "availability": "port-pending"
  },
  {
    "code": "SNAR",
    "id": "snar-c3000001",
    "name": "Sonar Maze",
    "group": "custom_3",
    "family": "sonar_maze",
    "levels": 6,
    "description": "Reveal hidden walls with sonar and navigate moving obstacles to reach the exit.",
    "sourcePath": "custom_games/engines/sonar_maze.py",
    "availability": "port-pending"
  },
  {
    "code": "TRCP",
    "id": "trcp-c3000001",
    "name": "Tracing Path",
    "group": "custom_3",
    "family": "tracing_path",
    "levels": 6,
    "description": "Excavate irreversible tunnels and route source pigments to their matching pockets within the tile budget.",
    "sourcePath": "custom_games/engines/tracing_path.py",
    "availability": "port-pending"
  },
  {
    "code": "SPOR",
    "id": "spor-c3000001",
    "name": "Spore Lab",
    "group": "custom_3",
    "family": "spore_lab",
    "levels": 6,
    "description": "Schedule biological production and deliver sufficiently fresh doses within the action budget.",
    "sourcePath": "custom_games/engines/spore_lab.py",
    "availability": "port-pending"
  },
  {
    "code": "CWSE",
    "id": "cwse-c3000001",
    "name": "Catching Without Seeing",
    "group": "custom_3",
    "family": "catching_without_seeing",
    "levels": 6,
    "description": "Use an eight-direction lamp and coordinated crate pushes to fill target slots.",
    "sourcePath": "custom_games/engines/catching_without_seeing.py",
    "availability": "port-pending"
  },
  {
    "code": "CAVA",
    "id": "cava-c3000001",
    "name": "Knight Maze",
    "group": "custom_3",
    "family": "knight_maze",
    "levels": 6,
    "description": "Use knight jumps, seals, switches, portals and fragile cells to reach the goal.",
    "sourcePath": "custom_games/engines/knight_maze.py",
    "availability": "port-pending"
  },
  {
    "code": "SMLP",
    "id": "smlp-c3000001",
    "name": "Same Length Path",
    "group": "custom_3",
    "family": "same_length_path",
    "levels": 6,
    "description": "Configure gates so every runner reaches the shared exit on the same tick.",
    "sourcePath": "custom_games/engines/same_length_path.py",
    "availability": "port-pending"
  },
  {
    "code": "DAME",
    "id": "dame-c3000001",
    "name": "Checkers Solitaire",
    "group": "custom_3",
    "family": "checkers_solitaire",
    "levels": 6,
    "description": "Select a piece and chain diagonal captures until the solitaire objective is satisfied.",
    "sourcePath": "custom_games/engines/checkers_solitaire.py",
    "availability": "port-pending"
  },
  {
    "code": "HPDL",
    "id": "hpdl-c3000001",
    "name": "Homogeneous Pair Deletion",
    "group": "custom_3",
    "family": "homogeneous_pair_deletion",
    "levels": 6,
    "description": "Configure receiver capacities, color filters and outputs to process the cube train.",
    "sourcePath": "custom_games/engines/homogeneous_pair_deletion.py",
    "availability": "port-pending"
  },
  {
    "code": "CATR",
    "id": "catr-c3000001",
    "name": "Configured Attraction",
    "group": "custom_3",
    "family": "configured_attraction",
    "levels": 6,
    "description": "Toggle attraction relations in the control panel to match the target arrangement.",
    "sourcePath": "custom_games/engines/configured_attraction.py",
    "availability": "port-pending"
  },
  {
    "code": "RECR",
    "id": "recr-c3000001",
    "name": "Recruit Army",
    "group": "custom_3",
    "family": "recruit_army",
    "levels": 6,
    "description": "Recruit an ordered squad between battles to clear successive enemy rooms.",
    "sourcePath": "custom_games/engines/recruit_army.py",
    "availability": "port-pending"
  },
  {
    "code": "RSWP",
    "id": "rswp-c3000001",
    "name": "Role Swap",
    "group": "custom_3",
    "family": "role_swap",
    "levels": 6,
    "description": "Configure three workers and execute shared workshop turns with role changes.",
    "sourcePath": "custom_games/engines/role_swap.py",
    "availability": "port-pending"
  }
];

export const GAME_CATALOG: readonly GameCatalogEntry[] = records.map((entry) => ({
  ...entry,
  sourceUrl: `${SOURCE_REPOSITORY}/blob/${SOURCE_COMMIT}/${entry.sourcePath}`,
}));

/** Look up an exact four-character game code, regardless of letter case. */
export function getGameByCode(code: string): GameCatalogEntry | undefined {
  const normalizedCode = code.trim().toUpperCase();
  return GAME_CATALOG.find((entry) => entry.code === normalizedCode);
}

