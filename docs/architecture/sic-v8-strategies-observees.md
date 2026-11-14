# Stratégies effectivement utilisées par SIC et le moteur natif

Chaque entrée correspond à une commande envoyée au jeu puis à un retour enregistré par le moteur. Le jeu, le niveau et le numéro d’action donnent un témoin minimal. Le classement s’appuie sur l’identifiant de stratégie enregistré à la libération du plan, sur la sous-question native lorsqu’elle est publiée et sur le type du plan. Une même famille peut proposer plusieurs démarches et une même démarche peut s’appliquer à plusieurs jeux.

Le résultat du témoin qualifie la prédiction associée à cette commande. « Confirmée » et « Contredite » reprennent le contrôle du moteur. « Sans prédiction vérifiée » couvre notamment les commandes d’exploration. Le passage de niveau constitue une observation distincte. Les codes OP restent des opérations de composition attachées aux plans.

## Reproduire l’inventaire

Ouvrir `/tests/sic-qualification.html?strategy-inventory&actions=16` sur le serveur de développement et lancer la comparaison. La campagne part du niveau 1 de chaque jeu jouable avec les réglages usuels du Playground. Les paramètres `shards` et `shard` répartissent le catalogue. Le paramètre `games` accepte une liste de codes et `curious` active la curiosité d’ouverture pour une campagne ciblée. Le rapport donne par jeu le nombre de commandes, le nombre de preuves associées, les niveaux terminés et le motif d’arrêt. Il conserve par démarche un témoin, les jeux où elle apparaît et le nombre de commandes.

Les comptes d’une campagne avec un autre réglage ou une borne plus large correspondent à des sessions distinctes. Une borne à 16 actions permet de comparer les ouvertures de tout le catalogue. Les démarches qui se déclenchent plus tard requièrent une campagne plus profonde ou une trace de reprise.

## Campagne sur les 100 jeux

Sur le commit `8ce7ee35`, les 100 parties ont produit 1 519 commandes avec un retour associé pour chacune et 95 démarches distinctes. La borne est de 16 actions par partie. « Commandes » désigne le total d’utilisations observées dans cette campagne. Le numéro du témoin compte depuis le début de la partie. Les identifiants reprennent la famille, la stratégie SIC si elle est distincte, la sous-question publiée et le type de plan.

| Stratégie observée | Identifiants moteur | Jeu · niveau · action · commande | Retour du témoin | Commandes |
| --- | --- | --- | --- | ---: |
| Identifier la commande qui agit sur la cible | `acquire_control_for_target` / `experiment` | ZIPP · N2 · 15 · `ACTION2` | Sans prédiction vérifiée | 8 |
| Tester un contact visible au cours d’une animation | `animated_contact` / `measured_animated_contact` | LIFE · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 21 |
| Transférer des bandes en conservant leur alignement | `band_transfer` / `conserved_band_transfer` / `aligned_band_transfers` | VC33 · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Préparer les branches avant de tester la propagation | `branch_routing` / `parallel_branch_routing` | SP80 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 11 |
| Exécuter un programme dont le codage a été appris | `code_program` / `learned_code_program` | TN36 · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Composer les trajets selon leurs premières arrivées observées | `configured_arrivals` / `configured_first_arrival_composition` | SMLP · N1 · 2 · `ACTION6` | Sans prédiction vérifiée | 13 |
| Déplacer des supports pour couvrir une constellation de repères | `constellation_cover` / `controlled_constellation_cover` | RE86 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 16 |
| Mesurer les déplacements et les contacts entre contenant et contenu | `containment` / `containment_and_contact` | AR25 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 39 |
| Tester le rôle de la séparation entre compartiments | `contextual_compartments` / `contextual_compartment_question` | SPOR · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 17 |
| Déduire une transformation des facettes qui servent d’exemples | `facet_examples` / `facet_example` / `public_facet_example` | ISOS · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 12 |
| Isoler un effet matériel parmi plusieurs changements | `factored_material_return` / `public_factored_return` | SEQN · N1 · 8 · `ACTION1` | Confirmée | 4 |
| Choisir la suite d’une séquence à partir de son retour | `feedback_sequences` / `public_feedback_sequence` | MIND · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Vérifier le prérequis d’un programme à origine fixe | `fixed_origin` / `fixed_origin_dependency` | GLOB · N1 · 3 · `ACTION5` | Sans prédiction vérifiée | 1 |
| Rendre accessible le point d’origine d’un programme | `fixed_origin` / `fixed_program_origin_access` | GLOB · N1 · 4 · `ACTION6` | Confirmée | 2 |
| Mesurer quels affichages répondent ensemble | `information_goal` / `coupled_displays` / `experiment` | LOGI · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 24 |
| Départager les explications possibles d’un clic | `information_goal` / `point_contrast` / `experiment` | UPST · N1 · 4 · `ACTION6` | Sans prédiction vérifiée | 5 |
| Réduire un ensemble en suivant les contacts proposés | `invited_reduction` / `invited_population_reduction` | DAME · N1 · 1 · `ACTION6` | Confirmée | 16 |
| Mesurer une commande nécessaire à une préparation de contact | `linked_temporal_preparation` / `linked_contact_experiment` | G50T · N1 · 3 · `ACTION1` | Sans prédiction vérifiée | 14 |
| Accéder à une configuration qui satisfait des relations de distance | `metric_composition` / `metric_composition_access` | ELAS · N1 · 1 · `ACTION6` | Confirmée | 11 |
| Comparer les formes pour tester un trajet | `morphology` / `morphology_probe` | LS20 · N1 · 7 · `ACTION3` | Confirmée | 10 |
| Utiliser un motif observé pour déterminer un accès | `motif_access` / `motif_conditioned_access` / `motif_to_geometric_access` | SC25 · N1 · 2 · `ACTION1` | Sans prédiction vérifiée | 12 |
| Rejoindre un état connu où reste une commande à essayer | `observed_frontier` / `reach_open_input` / `access` | REGN · N3 · 16 · `ACTION4` | Confirmée | 1 |
| Essayer une commande inédite sur le plateau courant | `observed_frontier` / `test_local_input` / `experiment` | G50T · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 405 |
| Déduire le déplacement des pièces en suivant leurs emplacements | `orbit_constraints` / `measured_slot_permutation` | LP85 · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Transférer les pièces entre supports dans l’ordre requis | `ordered_support_transfer` / `conditional_ordered_support_transfer` | HANO · N1 · 1 · `ACTION6` | Confirmée | 16 |
| Tester le contact entre deux contours orientés | `oriented_coupling` / `conditional_oriented_coupling` | WA30 · N1 · 3 · `ACTION5` | Sans prédiction vérifiée | 13 |
| Vérifier quel canal contribue à une somme périodique | `periodic_sums` / `periodic_sum_channel_question` | ONDE · N3 · 7 · `ACTION6` | Sans prédiction vérifiée | 2 |
| Identifier la commande d’une phase périodique | `periodic_sums` / `periodic_sum_initial_control_question` | ONDE · N1 · 1 · `ACTION3` | Sans prédiction vérifiée | 1 |
| Aligner les phases pour atteindre la somme recherchée | `periodic_sums` / `periodic_sum_joint_phase_target` | ONDE · N1 · 2 · `ACTION3` | Sans prédiction vérifiée · niveau terminé | 10 |
| Assembler les pièces rigides par leurs ports compatibles | `port_assembly` / `rigid_port_assembly` | CN04 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 16 |
| Rendre accessible un contact pour en observer le retour | `pre_score_contact` / `observed_effect_access` | WA30 · N1 · 16 · `ACTION1` | Sans prédiction vérifiée | 11 |
| Préparer le placement d’une pièce annoncée en aperçu | `preview_packing` | KATA · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Tester une relation géométrique le long d’un axe | `public_axial_question` / `axial_question` | POLA · N1 · 4 · `ACTION4` | Sans prédiction vérifiée · niveau terminé | 6 |
| Déterminer un trajet à partir de repères cartographiques | `public_chart_navigation` / `chart_navigation` | GMAP · N1 · 1 · `ACTION4` | Sans prédiction vérifiée | 16 |
| Transférer une configuration dans un cadre observé | `public_framed_transfer` / `observed_framed_transfer` | GARE · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 11 |
| Réutiliser une analogie de disposition entre cadres | `public_framed_transfer` / `observed_framed_analogy` | GARE · N1 · 4 · `ACTION6` | Sans prédiction vérifiée | 9 |
| Réutiliser la liaison observée entre une commande et un objet | `public_observed_binding` / `observed_object_binding` | CGWL · N1 · 2 · `ACTION2` | Sans prédiction vérifiée | 15 |
| Composer une action à partir des ressources de l’inventaire | `public_observed_inventory` / `observed_inventory_composition` / `public_inventory_composition` | SKBN · N1 · 14 · `ACTION1` | Contredite | 31 |
| Rejoindre une configuration par des transitions alternées | `public_occurrence_recall` / `alternating_graph_composition` / `alternating_graph_access` | TU93 · N1 · 15 · `ACTION4` | Confirmée | 2 |
| Changer de vue pour accéder à un catalogue masqué | `public_occurrence_recall` / `catalogue_view_experiment` | GRIL · N1 · 4 · `ACTION3` | Sans prédiction vérifiée | 2 |
| Placer un motif de cellules à partir d’une occurrence repérée | `public_occurrence_recall` / `cell_patch_composition` / `cell_patch_placement` | SP80 · N2 · 12 · `ACTION6` | Sans prédiction vérifiée | 45 |
| Accéder à la cible en exploitant les relations entre chambres | `public_occurrence_recall` / `observed_composition_services` / `chamber_relations` | CATR · N1 · 1 · `ACTION6` | Confirmée | 16 |
| Reprendre un préfixe d’actions dont les effets sont couplés | `public_occurrence_recall` / `coupled_prefix_reference` | WEAV · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Tester le remplissage d’une enveloppe visible | `public_occurrence_recall` / `field_service_composition` / `envelope_fill_experiment` | VALV · N1 · 2 · `ACTION6` | Sans prédiction vérifiée | 3 |
| Atteindre une zone de réception rendue visible | `public_occurrence_recall` / `observed_composition_services` / `exposed_reception` | CWSE · N1 · 1 · `ACTION4` | Sans prédiction vérifiée | 16 |
| Tester comment les facteurs se combinent dans un panneau | `public_occurrence_recall` / `product_panel_composition` / `factor_product_experiment` | COMB · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 13 |
| Tester une commande qui agit sur un champ visible | `public_occurrence_recall` / `field_service_composition` / `field_service_experiment` | VALV · N1 · 5 · `ACTION6` | Sans prédiction vérifiée | 6 |
| Tester le transfert d’un effet entre régions | `public_occurrence_recall` / `field_service_composition` / `field_service_transfer_experiment` | VALV · N2 · 11 · `ACTION6` | Sans prédiction vérifiée | 6 |
| Tester la relation entre une fenêtre et son cadre | `public_occurrence_recall` / `framed_window_composition` / `framed_window_experiment` | REWI · N1 · 9 · `ACTION6` | Sans prédiction vérifiée · niveau terminé | 1 |
| Tester la prochaine étape d’une séquence repérée | `public_occurrence_recall` / `labeled_sequence_composition` / `labeled_sequence_experiment` | CATL · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Suivre les réponses liées de plusieurs éléments | `public_occurrence_recall` / `linked_packet_composition` / `linked_packet_experiment` | SELE · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Modifier une collection repérée avant d’en tester l’effet | `public_occurrence_recall` / `observed_program_composition` / `marked_collection_edit` | STCK · N1 · 1 · `ACTION6` | Confirmée | 3 |
| Tester la commande associée à un motif imbriqué | `public_occurrence_recall` / `field_service_composition` / `nested_control_experiment` | GIGO · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 6 |
| Interroger une occurrence visible dans un catalogue partiellement masqué | `public_occurrence_recall` / `occluded_catalogue_composition` / `occluded_catalogue_experiment` | GRIL · N1 · 2 · `ACTION6` | Sans prédiction vérifiée | 9 |
| Exploiter une relation mesurée entre panneau et zone de jeu | `public_occurrence_recall` / `observed_composition_services` / `panel_service` | RSWP · N1 · 1 · `ACTION6` | Confirmée | 16 |
| Retrouver une occurrence observable à partir d’un exemple acquis | `public_occurrence_recall` / `observed_occurrence_recall` | SPOR · N1 · 3 · `ACTION6` | Sans prédiction vérifiée | 25 |
| Exécuter la composition de commandes apprise | `public_occurrence_recall` / `observed_program_composition` / `public_program_composition` | STCK · N2 · 4 · `ACTION6` | Confirmée | 8 |
| Identifier les éléments affectés par un programme | `public_occurrence_recall` / `observed_program_composition` / `public_program_respondent_probe` | STCK · N3 · 12 · `ACTION6` | Confirmée | 2 |
| Mesurer comment une commande agit sur une file d’éléments | `public_occurrence_recall` / `queued_field_composition` / `queued_field_experiment` | COLM · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 16 |
| Raccorder des ports disposés autour d’un centre | `public_occurrence_recall` / `radial_port_composition` | PIPE · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Préparer un récepteur pour obtenir le contact attendu | `public_occurrence_recall` / `observed_composition_services` / `reception_service` | FOGW · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 16 |
| Composer progressivement la population d’éléments de référence | `public_occurrence_recall` / `observed_composition_services` / `reference_population` | VOIS · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Prolonger ou compléter une ligne répétée | `public_occurrence_recall` / `recurrent_series` / `repeated_line_completion` | CONN · N1 · 1 · `ACTION6` | Confirmée | 5 |
| Rechercher un accès qui ordonne les pièces autour d’un point d’appui | `public_occurrence_recall` / `observed_composition_services` / `rooted_line` | SK48 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 12 |
| Tester la quantité requise autour d’un point d’appui | `public_occurrence_recall` / `rooted_quota_composition` / `rooted_quota_experiment` | THER · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Préparer un appui pour compléter une ligne | `public_occurrence_recall` / `recurrent_series` / `supported_line_preparation` | CONN · N3 · 13 · `ACTION6` | Confirmée | 4 |
| Vérifier la relation entre la trace laissée et le champ visible | `public_occurrence_recall` / `trace_field_composition` / `trace_field_experiment` | ZIPP · N1 · 1 · `ACTION6` | Confirmée | 8 |
| Suivre puis sélectionner les éléments produits par un transfert | `public_occurrence_recall` / `typed_material_flow` / `typed_carrier_experiment` | LIFE · N1 · 2 · `ACTION6` | Sans prédiction vérifiée | 6 |
| Suivre puis sélectionner les éléments produits par un transfert | `public_occurrence_recall` / `typed_material_flow` | LIFE · N1 · 5 · `ACTION6` | Sans prédiction vérifiée | 8 |
| Recruter des éléments dans l’ordre observé | `public_ordered_recruitment` / `ordered_recruitment` | RECR · N1 · 2 · `ACTION6` | Sans prédiction vérifiée | 8 |
| Utiliser un contour mesuré pour préparer un accès | `public_outline_service` / `observed_outline_service` | ZIPP · N2 · 14 · `ACTION5` | Sans prédiction vérifiée | 11 |
| Choisir un élément de l’atelier selon l’ordre observé | `public_ranked_workshop` / `observed_ranked_workshop` | LKEY · N1 · 11 · `ACTION1` | Sans prédiction vérifiée | 6 |
| Tester une conversion entre symboles | `public_symbol_transaction` / `observed_symbol_transaction` | CRAF · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Recolorer une région à partir de ses relations de voisinage | `public_topological_recolor` / `topological_recolor` | HOLE · N1 · 6 · `ACTION6` | Sans prédiction vérifiée | 6 |
| Tester une relation de fenêtre dans le plateau courant | `public_window_question` / `window_question` | HPDL · N1 · 4 · `ACTION6` | Sans prédiction vérifiée | 10 |
| Réduire une composition de trois éléments en gardant l’appui requis | `reduction_transport` / `supported_ternary_reduction` | LF52 · N1 · 1 · `ACTION6` | Confirmée | 8 |
| Compléter une couverture par réflexion en conservant les parties acquises | `reflected_cover` / `conditional_reflected_cover` | AR25 · N1 · 4 · `ACTION3` | Confirmée | 13 |
| Réparer une cellule par correspondance géométrique ou répétition | `regular_field_correspondence` / `public_symmetric_field` | SYME · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 32 |
| Comparer les positions relatives pour déterminer l’intervention | `relative_arrangements` / `relative_arrangement` / `public_relative_arrangement` | TRIA · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 16 |
| Comparer le retour d’une branche aux alternatives accessibles | `returned_branch_contrast` / `access` | REGN · N1 · 3 · `ACTION3` | Confirmée | 5 |
| Revalider une transformation locale qui a fait progresser le jeu | `scored_local_rewrite` / `public_scored_rewrite` | SEQN · N2 · 12 · `ACTION1` | Confirmée | 5 |
| Déplacer la pièce rigide dont la sélection a été confirmée | `selected_rigid` | KLOT · N1 · 1 · `ACTION6` | Confirmée | 12 |
| Tester la direction qui donne accès à une cavité | `sliding_cavity` / `cavity_direction_question` | AS66 · N2 · 6 · `ACTION1` | Sans prédiction vérifiée | 2 |
| Faire glisser une pièce pour atteindre une cavité | `sliding_cavity` / `sliding_cavity_access` | AS66 · N1 · 5 · `ACTION2` | Sans prédiction vérifiée · niveau terminé | 7 |
| Substituer les pièces dans les emplacements selon l’ordre mesuré | `slot_substitution` / `ordered_slot_substitution` | SB26 · N1 · 3 · `ACTION6` | Confirmée | 11 |
| Naviguer jusqu’au sous-ensemble à inspecter | `subset_diagnosis` / `subset_scope_navigation` | DICO · N1 · 2 · `ACTION6` | Sans prédiction vérifiée | 5 |
| Tester le sous-ensemble courant pour le discriminer | `subset_diagnosis` / `subset_scope_query` | DICO · N1 · 4 · `ACTION6` | Sans prédiction vérifiée | 10 |
| Reconfigurer un support pour accéder à la cible | `support_navigation` / `reconfigurable_support` | DC22 · N1 · 2 · `ACTION2` | Sans prédiction vérifiée | 15 |
| Composer les transformations locales d’une surface | `surface_program` / `surface_rewrite` / `surface_rewrite_program` | CD82 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 16 |
| Atteindre un bord susceptible de révéler une autre partie du plateau | `view` / `approach_view_edge` / `public_view_frontier` | LS19 · N1 · 3 · `ACTION1` | Confirmée | 43 |
| Répéter le mouvement pour vérifier qu’un passage est bloqué | `view` / `confirm_access_obstruction` / `public_view_frontier` | LS19 · N1 · 13 · `ACTION2` | Sans prédiction vérifiée | 3 |
| Tester une commande pour reprendre l’exploration quand la vue est indéterminée | `view_continuity` / `test_local_input` / `experiment` | LS19 · N1 · 14 · `ACTION3` | Sans prédiction vérifiée | 2 |
| Utiliser les retours visuels pour poursuivre une séquence | `visual_sequences` / `public_visual_sequence` | SERI · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 8 |
| Tester une contrainte qui se répète dans des fenêtres du plateau | `window_constraints` / `multiscale_constraints` / `public_window_constraint` | FT09 · N1 · 1 · `ACTION6` | Sans prédiction vérifiée | 4 |
| Tester les correspondances entre objets de types distincts | `word_interface` / `typed_word_interface` | TR87 · N1 · 1 · `ACTION1` | Sans prédiction vérifiée | 16 |

## Démarches révélées par les campagnes ciblées

Les commandes de ce tableau proviennent de sessions distinctes et ne sont pas incluses dans les totaux du catalogue. La campagne DICO a activé la curiosité d’ouverture et confirmé les six niveaux en 58 actions.

| Stratégie observée | Identifiants moteur | Jeu · niveau · action · commande | Retour du témoin | Commandes |
| --- | --- | --- | --- | ---: |
| Réviser la projection de contact après un retour contraire | `public_occurrence_recall` / `revise_rooted_contact` / `observed_composition_services` / `rooted_line` | SK48 · N1 · 13 · `ACTION3` | Confirmée | 7 |
| Rejoindre une cavité au bon moment de son cycle | `sliding_cavity` / `clocked_cavity_access` | AS66 · N3 · 14 · `ACTION1` | Confirmée | 6 |
| Tester d’abord la composition observable la plus riche | `observed_frontier` / `opening_curiosity` / `experiment` | DICO · N1 · 1 · `ACTION6` | Sans prédiction vérifiée · niveau terminé | 2 |

Sur SK48, la récupération commence après la contradiction observée à l’action 12. Elle s’appuie sur OP03, OP12, OP08 et OP26 pour qualifier l’écart et rechercher un accès, puis OP18 engage le plan. La partie ouvre le niveau 2 à l’action 19.

## Paramètres des démarches attestées

| Démarche | Réglages exécutables dans Stratégies | Éléments à rendre configurables |
| --- | --- | --- |
| Essayer une commande inédite | Ordre des commandes admissibles. Une règle locale peut conditionner cet ordre au domaine de la commande et à l’écart entre usages précédents. | D’autres critères de sélection issus du retour et de la situation. |
| Rejoindre un état où reste une commande inédite | Le graphe SIC sélectionne le trajet quand aucun essai local ne reste. | Les conditions d’accès, le classement des trajets et le coût acceptable. |
| Réviser une projection de contact | Priorité entre les branches de récupération, profondeur et nombre d’états examinés. | Les preuves requises selon la situation et la règle d’arrêt après contradiction. |
| Tester la composition observable la plus riche | Modes natif, shadow et actif. | Le poids des relations de voisinage et les critères de déclenchement. |
| Atteindre un bord ou vérifier une obstruction | Graphes SIC évalués lors de la décision. | Les preuves d’accès, les limites de répétition et la priorité relative des stratégies de vue. |
| Comparer des affichages couplés ou des hypothèses sur un clic | Stratégies SIC exécutées quand le moteur dispose d’une expérience admissible. | Les preuves minimales, les limites de préservation et le classement des expériences admissibles. |

Les entrées natives restantes donnent des témoins pour extraire leurs conditions et leurs limites à partir des planificateurs existants. Les intitulés français décrivent la démarche observée. Les identifiants moteur permettent de retrouver son implémentation.
