# Familles actives dans SIC seul

Une famille est un module de résolution enregistré dans le runtime. Elle lit une observation, propose une action ou une courte suite de commandes, vérifie les conditions avant exécution, interprète le retour et conserve les faits nécessaires aux prochaines décisions. Elle peut s’abstenir si les preuves lui manquent. L’agenda consulte les familles selon son ordre de sélection et le garde commun autorise la commande. Le contrat est défini par [NativeFamily](../../src/logos-engine/v6-native-types.ts#L149) et le registre SIC seul se trouve dans [standalone-families.ts](../../src/sic/standalone-families.ts).

Une primitive exprime un choix réutilisable à l’intérieur d’une famille. Par exemple, dans la voie d’apprentissage de HANO, P05 mesure l’effet d’un clic, P07 poursuit l’accès et P02 reprend une interaction confirmée. La famille fournit les faits et les actions admissibles pour chacun de ces choix. Elle emploie aussi les mesures de supports et les contraintes d’empilement. Les trois primitives sont réévaluées après chaque retour.

## Ce qu’un utilisateur peut créer

L’atelier Stratégies permet d’éditer le besoin, la situation, les conditions et la priorité de règles qui classent les épisodes. D’autres réglages SIC modifient les paramètres de workflows existants. Ajouter une nouvelle famille qui peut produire ses propres propositions demande aujourd’hui un module TypeScript enregistré dans le runtime. Voir [l’atelier de stratégies](../../src/sic/strategy-editor.ts), la [validation des packs](../../src/sic/active-recovery.ts) et le [point d’enregistrement](../../src/logos-engine/v6-native-runtime.ts#L2450).

Le SRC reste exécutable. Sur une session SIC seul, l’agenda actif est le chemin par défaut. Si le programme SRC de sélection `v6.composition_strategy.choose` est remplacé dans le graphe de la session, le runtime exécute ce programme compilé pour choisir parmi les offres des familles SIC déjà enregistrées. Une famille peut aussi enregistrer son propre workflow SRC et lui fournir des opérations. La modification d’un programme existant passe par l’API d’édition du graphe. Le panneau Stratégies ne dispose pas d’un éditeur de workflows SRC ni d’une commande d’enregistrement d’une famille. Voir [l’arbitrage dans le runtime](../../src/logos-engine/v6-native-runtime.ts#L810), [l’interpréteur SRC](../../src/logos-engine/interpreter.ts) et [l’API d’édition](../../src/logos-engine/v6-native-runtime.ts#L2005).

Le SRC peut porter les décisions de cet atelier à partir d’opérations déjà enregistrées. Une carte décrirait une décision avec un mode de réflexion, un besoin, une situation observable, une primitive, une cible et un effet attendu. Après chaque retour, le runtime réévaluerait les cartes éligibles. Par exemple, une carte proposerait de tester une sélection quand la pièce contrôlée reste inconnue. Une autre proposerait de déposer cette pièce dès que la sélection est confirmée et qu’un support compatible est visible. L’utilisateur pourrait essayer ces cartes sur des parties enregistrées et comparer les commandes proposées et les effets observés. Une mesure ou un opérateur absent du runtime demanderait encore du code.

## Essais ciblés après retrait

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

Ces essais couvrent 18 jeux distincts. Les retraits y ciblent des familles précises et certains essais poursuivent la partie sur plusieurs niveaux. Le tableau du catalogue applique le même critère de retrait et le même budget à chaque niveau 1.

## Retrait de la famille principale sur les 100 niveaux 1

Campagne SIC seul sur le runtime de `07e5e687`. Pour chaque jeu, le banc prend la famille qui a émis le plus de commandes dans le rejeu de référence, la retire du registre et de l’agenda avant de lancer une nouvelle partie, puis laisse jusqu’à 40 commandes pour gagner le niveau 1. Les 100 références gagnent en configuration normale. Les reçus de toutes les commandes du retrait les attribuent à SIC seul. Plusieurs familles peuvent agir dans une même partie. Les effectifs ci-dessous comptent des jeux distincts pour chaque famille. Le tableau conserve la première campagne comme référence de comparaison.

**Premier bilan du retrait, 6/100 niveaux gagnés.** 73 essais ont atteint le budget de 40 commandes, 20 se sont arrêtés faute de nouvelle proposition et un s’est terminé par une défaite. Quinze essais se sont arrêtés sans aucune commande. Le tableau distingue la fréquence de repli, la diversité des familles retirées et le succès observé. Une victoire avec plusieurs familles indique leur participation au parcours. Elle ne prouve pas que chacune était nécessaire.

**Suivi des gains, 8/100.** SNAR gagne en 17 commandes avec `sic_navigate_revealed_grid` retirée. `sic_learn_grid_access` fournit les 17 commandes. KLOT gagne en 30 commandes avec `sic_move_masked_pieces` retirée. `sic_public_input_exploration` en fournit 16, puis `sic_learn_selected_access` en fournit 14. Les résultats de la première campagne demeurent visibles dans le tableau ci-dessous. Voir les rejeux de [SNAR](sic-v8-generalization.md#apprendre-un-trajet-sur-des-cases-révélées) et de [KLOT](sic-v8-generalization.md#transmettre-la-preuve-de-sélection-à-un-planificateur).

| Famille de repli | Jeux où elle agit | Familles retirées distinctes | Victoires auxquelles elle participe | Victoires où elle émet toutes les commandes |
| --- | ---: | ---: | ---: | ---: |
| `sic_public_input_exploration` | 72 | 71 | 2 | 1 |
| `sic_cavity_access` | 18 | 18 | 0 | 0 |
| `sic_coupled_motion` | 6 | 6 | 0 | 0 |
| `sic_field_repair` | 2 | 2 | 1 | 0 |
| `sic_learn_correspondence` | 2 | 1 | 2 | 2 |
| `sic_learn_scope_effects` | 2 | 2 | 1 | 1 |
| `sic_framed_contact` | 1 | 1 | 0 | 0 |
| `sic_framed_reception` | 1 | 1 | 0 | 0 |
| `sic_learn_support_moves` | 1 | 1 | 1 | 1 |
| `sic_subset_experiment` | 1 | 1 | 0 | 0 |

DNOI et SYME transfèrent la même famille d’apprentissage sur deux jeux et six niveaux par jeu. HANO réévalue P05, P07 et P02 sur les retours de sélection et de dépôt. DICO alterne P05 et P02 pour mesurer puis réutiliser un test de groupe. Les gains d’AS66 et de TRIA incluent l’exploration des commandes publiques. Les familles d’apprentissage utilisent encore des mesures de scène codées dans le runtime. Ces résultats attestent des transferts observés sur ce catalogue.

La famille d’exploration est elle-même la famille principale de 16 jeux. LF52 s’arrête sans commande lorsqu’on la retire. Dans l’essai ciblé qui retire plutôt `sic_subset_experiment`, l’exploration et `sic_learn_scope_effects` gagnent ensemble en 31 commandes, ce qui confirme un deuxième jeu pour l’apprentissage des effets de groupe. Deux références normales dépassent 40 commandes, FUIT et GABA. Avec un budget d’essai élargi à 60, le retrait s’arrête respectivement après 39 et 44 commandes sans gain. L’exploration a son propre budget interne.

### Résultats par jeu

Les fournisseurs sont présentés dans leur ordre de première intervention, avec le nombre total de commandes de chacun. Le tableau compte le retrait de la famille principale et le résultat de ce seul retrait pour chaque jeu. Les essais ciblés ci-dessus documentent d’autres retraits.

| Jeu | Famille retirée | Familles intervenues et commandes | Résultat |
| --- | --- | --- | --- |
| AMZE | `sic_indicated_jump` | `sic_public_input_exploration` × 40 | Budget atteint |
| AR25 | `sic_reflected_placement` | `sic_public_input_exploration` × 40 | Budget atteint |
| AS66 | `sic_cavity_access` | `sic_public_input_exploration` × 11 | **Gagné** |
| BP35 | `sic_excavate_descent` | `sic_public_input_exploration` × 40 | Budget atteint |
| CASC | `sic_gated_cascade` | `sic_public_input_exploration` × 40 | Budget atteint |
| CATL | `sic_labeled_sequence` | `sic_public_input_exploration` × 40 | Budget atteint |
| CATR | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| CAVA | `sic_highlighted_route` | `sic_public_input_exploration` × 40 | Budget atteint |
| CD82 | `sic_surface_copy` | `sic_public_input_exploration` × 40 | Budget atteint |
| CGWL | `sic_carry_to_frame` | `sic_public_input_exploration` × 40 | Budget atteint |
| CLRS | `sic_layered_fit` | `sic_cavity_access` × 4, `sic_public_input_exploration` × 36 | Budget atteint |
| CN04 | `sic_port_pairing` | `sic_cavity_access` × 40 | Budget atteint |
| COLM | `sic_queued_placement` | `sic_public_input_exploration` × 40 | Budget atteint |
| COMB | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| CONN | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| CRAF | `sic_symbol_contribution` | `sic_public_input_exploration` × 30 | Aucune proposition restante |
| CWSE | `sic_directional_reception` | `sic_public_input_exploration` × 40 | Budget atteint |
| DAME | `sic_invited_capture` | `sic_public_input_exploration` × 40 | Budget atteint |
| DC22 | `sic_remote_support_route` | `sic_cavity_access` × 40 | Budget atteint |
| DICO | `sic_subset_experiment` | `sic_learn_scope_effects` × 5 | **Gagné** |
| DNOI | `sic_field_repair` | `sic_learn_correspondence` × 3 | **Gagné** |
| ELAS | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| ESCT | `sic_outline_service` | `sic_cavity_access` × 40 | Budget atteint |
| ETAG | `sic_switched_surface` | `sic_cavity_access` × 4, `sic_public_input_exploration` × 36 | Budget atteint |
| EVAS | `sic_lit_route` | `sic_public_input_exploration` × 40 | Budget atteint |
| FITE | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| FOGW | `sic_reception_access` | `sic_cavity_access` × 39, `sic_coupled_motion` × 1 | Budget atteint |
| FT09 | `sic_window_relation` | `sic_public_input_exploration` × 40 | Budget atteint |
| FUIT | `sic_reactive_target` | `sic_public_input_exploration` × 39 | Aucune proposition restante |
| G50T | `sic_replay_access` | `sic_public_input_exploration` × 40 | Budget atteint |
| GABA | `sic_pivot_cargo` | `sic_coupled_motion` × 4, `sic_public_input_exploration` × 36 | Budget atteint |
| GARE | `sic_framed_reception` | `sic_public_input_exploration` × 40 | Budget atteint |
| GIGO | `sic_nested_passage` | `sic_public_input_exploration` × 40 | Budget atteint |
| GLOB | `sic_program_origin` | `sic_public_input_exploration` × 31 | Aucune proposition restante |
| GMAP | `sic_chart_route` | `sic_public_input_exploration` × 40 | Budget atteint |
| GORI | `sic_animation_contact` | `sic_public_input_exploration` × 40 | Budget atteint |
| GRAV | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| GRIL | `sic_catalogue_comparison` | `sic_public_input_exploration` × 40 | Budget atteint |
| HANO | `sic_ordered_support_transfer` | `sic_learn_support_moves` × 6 | **Gagné** |
| HOLE | `sic_legend_recolor` | `sic_public_input_exploration` × 40 | Budget atteint |
| HPDL | `sic_window_coverage` | `sic_cavity_access` × 30, `sic_public_input_exploration` × 10 | Budget atteint |
| ISOS | `sic_facet_growth` | `sic_public_input_exploration` × 40 | Budget atteint |
| KA59 | `sic_translate_coupled_pieces` | `sic_public_input_exploration` × 36, `sic_coupled_motion` × 4 | Budget atteint |
| KATA | `sic_preview_placement` | `sic_public_input_exploration` × 40 | Budget atteint |
| KEYD | `sic_inventory_access` | `sic_public_input_exploration` × 40 | Budget atteint |
| KLOT | `sic_move_masked_pieces` | `sic_public_input_exploration` × 40 | Budget atteint |
| LF52 | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| LIFE | `sic_material_assembly` | `sic_public_input_exploration` × 40 | Budget atteint |
| LKEY | `sic_profile_transfer` | `sic_framed_reception` × 3, `sic_public_input_exploration` × 37 | Budget atteint |
| LOGI | `sic_display_coupling` | `sic_public_input_exploration` × 40 | Budget atteint |
| LP85 | `sic_slot_permutation` | `sic_public_input_exploration` × 40 | Budget atteint |
| LS19 | `sic_framed_contact` | `sic_coupled_motion` × 4, `sic_cavity_access` × 36 | Budget atteint |
| LS20 | `sic_framed_contact` | `sic_public_input_exploration` × 40 | Budget atteint |
| M0R0 | `sic_coupled_motion` | `sic_public_input_exploration` × 40 | Budget atteint |
| MEMO | `sic_occurrence_recall` | `sic_public_input_exploration` × 40 | Budget atteint |
| MIND | `sic_feedback_trial` | `sic_public_input_exploration` × 40 | Budget atteint |
| MOTO | `sic_arrange_turn_posts` | `sic_public_input_exploration` × 35 | Aucune proposition restante |
| ONDE | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| PIPE | `sic_radial_connection` | `sic_cavity_access` × 4, `sic_public_input_exploration` × 36 | Budget atteint |
| POLA | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| PORT | `sic_paired_passage` | `sic_cavity_access` × 40 | Budget atteint |
| PRTL | `sic_link_openings` | `sic_public_input_exploration` × 40 | Budget atteint |
| R11L | `sic_linked_midpoint` | `sic_public_input_exploration` × 40 | Budget atteint |
| RE86 | `sic_marker_coverage` | `sic_public_input_exploration` × 40 | Budget atteint |
| RECR | `sic_ordered_replenishment` | `sic_public_input_exploration` × 40 | Budget atteint |
| REGN | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| REWI | `sic_framed_search` | `sic_cavity_access` × 2, `sic_public_input_exploration` × 38 | Budget atteint |
| RSWP | `sic_panel_matching` | `sic_public_input_exploration` × 40 | Budget atteint |
| S5I5 | `sic_marked_gauge` | `sic_public_input_exploration` × 40 | Budget atteint |
| SB26 | `sic_slot_transfer` | `sic_public_input_exploration` × 40 | Budget atteint |
| SC25 | `sic_reproduce_cue` | `sic_cavity_access` × 4, `sic_public_input_exploration` × 30, `sic_field_repair` × 6 | Budget atteint |
| SELE | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| SEQN | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| SERI | `sic_visual_pattern` | `sic_public_input_exploration` × 36, `sic_coupled_motion` × 4 | Budget atteint |
| SIGN | `sic_marked_lattice` | `sic_public_input_exploration` × 40 | Budget atteint |
| SK48 | `sic_ordered_contact` | `sic_public_input_exploration` × 40 | Budget atteint |
| SKBN | `sic_transport_contact` | `sic_cavity_access` × 40 | Budget atteint |
| SMLP | `sic_shared_arrival` | `sic_public_input_exploration` × 40 | Budget atteint |
| SNAR | `sic_navigate_revealed_grid` | `sic_public_input_exploration` × 40 | Budget atteint |
| SP80 | `sic_branch_alignment` | `sic_cavity_access` × 4, `sic_public_input_exploration` × 26 | Défaite |
| SPOR | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| STCK | `sic_marked_collection` | `sic_public_input_exploration` × 8, `sic_subset_experiment` × 22, `sic_learn_scope_effects` × 10 | Budget atteint |
| SU15 | `sic_point_reach` | `sic_public_input_exploration` × 40 | Budget atteint |
| SWCH | `sic_seated_contact` | `sic_public_input_exploration` × 40 | Budget atteint |
| SYME | `sic_field_repair` | `sic_learn_correspondence` × 9 | **Gagné** |
| TEQU | `sic_staged_marks` | `sic_coupled_motion` × 4, `sic_public_input_exploration` × 36 | Budget atteint |
| THER | `sic_public_input_exploration` | `sic_cavity_access` × 4 | Aucune proposition restante |
| TICT | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| TN36 | `sic_code_route` | `sic_public_input_exploration` × 40 | Budget atteint |
| TR87 | `sic_glyph_editing` | `sic_framed_contact` × 4, `sic_public_input_exploration` × 36 | Budget atteint |
| TRCP | `sic_paired_channels` | `sic_public_input_exploration` × 40 | Budget atteint |
| TRIA | `sic_cavity_access` | `sic_field_repair` × 1, `sic_public_input_exploration` × 38 | **Gagné** |
| TU93 | `sic_material_route` | `sic_cavity_access` × 40 | Budget atteint |
| UPST | `sic_public_input_exploration` | Aucune commande | Aucune proposition restante |
| VALV | `sic_field_isolation` | `sic_public_input_exploration` × 40 | Budget atteint |
| VC33 | `sic_band_alignment` | `sic_public_input_exploration` × 40 | Budget atteint |
| VOIS | `sic_population_placement` | `sic_public_input_exploration` × 40 | Budget atteint |
| WA30 | `sic_oriented_delivery` | `sic_public_input_exploration` × 40 | Budget atteint |
| WEAV | `sic_crossing_rows` | `sic_cavity_access` × 19, `sic_public_input_exploration` × 21 | Budget atteint |
| ZIPP | `sic_trace_coverage` | `sic_public_input_exploration` × 39, `sic_cavity_access` × 1 | Budget atteint |

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
