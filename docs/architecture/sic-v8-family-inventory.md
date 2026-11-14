# Familles actives dans SIC seul

Une famille est un module de résolution enregistré dans le runtime. Elle lit une observation, propose une action ou un préfixe, vérifie les conditions avant exécution, interprète le retour et conserve les faits nécessaires aux prochaines décisions. L’agenda appelle les familles selon leur ordre et le garde commun autorise la commande. Le contrat est défini par [NativeFamily](../../src/logos-engine/v6-native-types.ts#L149) et le registre SIC seul se trouve dans [standalone-families.ts](../../src/sic/standalone-families.ts).

Une primitive exprime un choix réutilisable à l’intérieur d’une famille. Par exemple, dans la voie d’apprentissage de HANO, P05 mesure l’effet d’un clic, P07 poursuit l’accès et P02 reprend une interaction confirmée. La famille fournit les faits et les actions admissibles pour chacun de ces choix. Elle emploie aussi les mesures de supports et les contraintes d’empilement. Les trois primitives sont réévaluées après chaque retour.

## Ce qu’un utilisateur peut créer

L’atelier Stratégies permet d’éditer le besoin, la situation, les conditions et la priorité de règles qui classent les épisodes. D’autres réglages SIC modifient les paramètres de workflows existants. Déclarer une nouvelle famille exécutable demande aujourd’hui du TypeScript, son enregistrement dans le runtime et des essais sur les retours réels. Voir [l’atelier de stratégies](../../src/sic/strategy-editor.ts) et la [validation des packs](../../src/sic/active-recovery.ts).

Un atelier de création de familles devrait pouvoir assembler des primitives déjà enregistrées à partir de conditions, de cibles observables et de vérifications configurables. Un effet nouveau demanderait encore une mesure ou un opérateur disponible dans le runtime. La qualification avec retrait permettrait ensuite de voir quelle famille choisit effectivement les commandes.

## Familles observées après retrait

Le banc enlève l’identifiant demandé du registre et de l’agenda avant l’initialisation de la partie. Le tableau donne les fournisseurs qui ont libéré des commandes. Une partie arrêtée à zéro niveau documente les stratégies essayées et leur limite dans le budget de l’essai. La référence AMZE est décrite dans le [journal SIC](sic-v8-validation.md).

| Jeu | Référence | Famille retirée | Familles intervenues et commandes | Niveaux gagnés / cible |
| --- | --- | --- | --- | ---: |
| KEYD | 2d2358fa | `sic_inventory_access` | `sic_public_input_exploration` × 40 | 0 / 1 |
| SYME | 2d2358fa | `sic_field_repair` | `sic_public_input_exploration` × 40 | 0 / 1 |
| FOGW | 2d2358fa | `sic_reception_access` | `sic_cavity_access` × 69, `sic_coupled_motion` × 1 | 0 / 1 |
| WA30 | 2d2358fa | `sic_oriented_delivery` | `sic_public_input_exploration` × 40 | 0 / 1 |
| AMZE | Étape AMZE | `sic_indicated_jump` | `sic_public_input_exploration` × 40 | 0 / 1 |
| MOTO | d322509d | `sic_arrange_turn_posts` | `sic_public_input_exploration` × 35 | 0 / 1 |
| SNAR | d322509d | `sic_navigate_revealed_grid` | `sic_public_input_exploration` × 40 | 0 / 1 |
| SC25 | d322509d | `sic_reproduce_cue` | `sic_cavity_access` × 4, `sic_public_input_exploration` × 30, `sic_field_repair` × 6 | 0 / 1 |
| PRTL | d322509d | `sic_link_openings` | `sic_public_input_exploration` × 40 | 0 / 1 |
| KLOT | d322509d | `sic_move_masked_pieces` | `sic_public_input_exploration` × 40 | 0 / 1 |
| TEQU | d322509d | `sic_staged_marks` | `sic_coupled_motion` × 4, `sic_public_input_exploration` × 36 | 0 / 1 |
| KA59 | d322509d | `sic_translate_coupled_pieces` | `sic_public_input_exploration` × 36, `sic_coupled_motion` × 4 | 0 / 1 |
| GIGO | d322509d | `sic_nested_passage` | `sic_public_input_exploration` × 40 | 0 / 1 |
| DNOI | d322509d | `sic_field_repair` | `sic_learn_correspondence` × 3 | 1 / 1 |
| DICO | d322509d | `sic_subset_experiment` | `sic_public_input_exploration` × 35 | 0 / 1 |
| SYME | d322509d | `sic_field_repair` | `sic_learn_correspondence` × 9 | 1 / 1 |
| HANO | d322509d | `sic_ordered_support_transfer` | `sic_framed_reception` × 3, `sic_public_input_exploration` × 37 | 0 / 1 |
| TRIA | c9fcc91f | `sic_field_repair` | `sic_coupled_motion` × 4, `sic_cavity_access` × 11, `sic_public_input_exploration` × 5 | 1 / 1 |
| DNOI | a3a61f34 | `sic_field_repair` | `sic_learn_correspondence` × 59 | 6 / 6 |
| SYME | a3a61f34 | `sic_field_repair` | `sic_learn_correspondence` × 78 | 6 / 6 |
| HANO | 100d5c43 | `sic_ordered_support_transfer` | `sic_learn_support_moves` × 60 | 4 / 4 |
| DICO | 07e5e687 | `sic_subset_experiment` | `sic_learn_scope_effects` × 71 | 6 / 6 |
| LF52 | 07e5e687 | `sic_subset_experiment` | `sic_public_input_exploration` × 28, `sic_learn_scope_effects` × 3 | 1 / 1 |

Les essais couvrent 18 jeux distincts. Les autres jeux restent à mesurer avec retrait.

## Familles observées dans les quatre parties complètes

Rejeu en configuration normale du commit `07e5e687`. Les 104 trajectoires et leurs attributions sont identiques au rejeu de référence. Une famille figure dans ce tableau dès qu’une de ses commandes est autorisée.

| Jeu | Niveaux gagnés | Familles et commandes |
| --- | ---: | --- |
| HANO | 4 | `sic_ordered_support_transfer` × 60 |
| DNOI | 6 | `sic_field_repair` × 59 |
| DICO | 6 | `sic_subset_experiment` × 71 |
| SYME | 6 | `sic_field_repair` × 78 |

## Familles observées au niveau 1 de chaque jeu

Rejeu du même commit sous SIC seul. Les 100 parties partent du niveau 1. Les 1 250 commandes sont attribuées à une famille.

| Jeu | Familles et commandes |
| --- | --- |
| AMZE | `sic_indicated_jump` × 3 |
| AR25 | `sic_reflected_placement` × 17 |
| AS66 | `sic_cavity_access` × 4 |
| BP35 | `sic_excavate_descent` × 16 |
| CASC | `sic_gated_cascade` × 6 |
| CATL | `sic_labeled_sequence` × 8 |
| CATR | `sic_public_input_exploration` × 29 |
| CAVA | `sic_highlighted_route` × 7 |
| CD82 | `sic_surface_copy` × 9 |
| CGWL | `sic_carry_to_frame` × 15 |
| CLRS | `sic_layered_fit` × 8 |
| CN04 | `sic_port_pairing` × 18 |
| COLM | `sic_queued_placement` × 17 |
| COMB | `sic_public_input_exploration` × 8 |
| CONN | `sic_public_input_exploration` × 24 |
| CRAF | `sic_symbol_contribution` × 9 |
| CWSE | `sic_directional_reception` × 4 |
| DAME | `sic_invited_capture` × 7 |
| DC22 | `sic_remote_support_route` × 22 |
| DICO | `sic_subset_experiment` × 5 |
| DNOI | `sic_field_repair` × 3 |
| ELAS | `sic_public_input_exploration` × 16 |
| ESCT | `sic_outline_service` × 16 |
| ETAG | `sic_switched_surface` × 7 |
| EVAS | `sic_lit_route` × 3 |
| FITE | `sic_public_input_exploration` × 16, `sic_cavity_access` × 2 |
| FOGW | `sic_reception_access` × 18 |
| FT09 | `sic_window_relation` × 4 |
| FUIT | `sic_reactive_target` × 48 |
| G50T | `sic_replay_access` × 27 |
| GABA | `sic_pivot_cargo` × 47 |
| GARE | `sic_framed_reception` × 7 |
| GIGO | `sic_nested_passage` × 6 |
| GLOB | `sic_program_origin` × 4 |
| GMAP | `sic_chart_route` × 5 |
| GORI | `sic_animation_contact` × 2 |
| GRAV | `sic_public_input_exploration` × 11 |
| GRIL | `sic_catalogue_comparison` × 5 |
| HANO | `sic_ordered_support_transfer` × 6 |
| HOLE | `sic_legend_recolor` × 5 |
| HPDL | `sic_window_coverage` × 3 |
| ISOS | `sic_facet_growth` × 3 |
| KA59 | `sic_translate_coupled_pieces` × 15 |
| KATA | `sic_preview_placement` × 8 |
| KEYD | `sic_inventory_access` × 34 |
| KLOT | `sic_move_masked_pieces` × 14 |
| LF52 | `sic_public_input_exploration` × 28, `sic_subset_experiment` × 3 |
| LIFE | `sic_material_assembly` × 14 |
| LKEY | `sic_profile_transfer` × 8 |
| LOGI | `sic_display_coupling` × 2 |
| LP85 | `sic_slot_permutation` × 5 |
| LS19 | `sic_framed_contact` × 5 |
| LS20 | `sic_framed_contact` × 14, `sic_public_input_exploration` × 1 |
| M0R0 | `sic_coupled_motion` × 19 |
| MEMO | `sic_occurrence_recall` × 10 |
| MIND | `sic_feedback_trial` × 8 |
| MOTO | `sic_arrange_turn_posts` × 6 |
| ONDE | `sic_public_input_exploration` × 7 |
| PIPE | `sic_radial_connection` × 4 |
| POLA | `sic_public_input_exploration` × 7 |
| PORT | `sic_paired_passage` × 16 |
| PRTL | `sic_link_openings` × 6 |
| R11L | `sic_linked_midpoint` × 3 |
| RE86 | `sic_marker_coverage` × 26 |
| RECR | `sic_ordered_replenishment` × 3 |
| REGN | `sic_public_input_exploration` × 2 |
| REWI | `sic_framed_search` × 3 |
| RSWP | `sic_panel_matching` × 3 |
| S5I5 | `sic_marked_gauge` × 13 |
| SB26 | `sic_slot_transfer` × 9 |
| SC25 | `sic_reproduce_cue` × 17 |
| SELE | `sic_public_input_exploration` × 30 |
| SEQN | `sic_public_input_exploration` × 4 |
| SERI | `sic_visual_pattern` × 4 |
| SIGN | `sic_marked_lattice` × 15 |
| SK48 | `sic_ordered_contact` × 19 |
| SKBN | `sic_transport_contact` × 22 |
| SMLP | `sic_shared_arrival` × 3 |
| SNAR | `sic_navigate_revealed_grid` × 16 |
| SP80 | `sic_branch_alignment` × 8 |
| SPOR | `sic_public_input_exploration` × 18 |
| STCK | `sic_marked_collection` × 3 |
| SU15 | `sic_point_reach` × 7 |
| SWCH | `sic_seated_contact` × 25 |
| SYME | `sic_field_repair` × 9 |
| TEQU | `sic_staged_marks` × 8 |
| THER | `sic_cavity_access` × 4, `sic_public_input_exploration` × 21 |
| TICT | `sic_public_input_exploration` × 5 |
| TN36 | `sic_code_route` × 8 |
| TR87 | `sic_framed_contact` × 4, `sic_glyph_editing` × 22 |
| TRCP | `sic_paired_channels` × 24 |
| TRIA | `sic_field_repair` × 1, `sic_cavity_access` × 7 |
| TU93 | `sic_material_route` × 30 |
| UPST | `sic_public_input_exploration` × 30 |
| VALV | `sic_field_isolation` × 10 |
| VC33 | `sic_band_alignment` × 5 |
| VOIS | `sic_population_placement` × 14 |
| WA30 | `sic_oriented_delivery` × 26 |
| WEAV | `sic_crossing_rows` × 27 |
| ZIPP | `sic_trace_coverage` × 8 |
