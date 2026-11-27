# Continuité de marche d’un transport sous contraintes

La capture part du L1 sur `d558c9d8`. Les quatre premières victoires conservent leurs préfixes en **15, 16, 15 et 18 commandes**. Au premier geste du L5 (global65), le rôle a déjà calculé 18 gestes : deux marches précèdent la prise, mais une seule commande est exposée. Après la prise réelle, global68, sept marches de portage déjà calculées sont encore séparées. Les positions des passagers et du porteur sont confirmées à chaque retour.

Les commandes et les observations réelles sont conservées dans `first-public-prefix.json.gz`. L’arrêt borné après74 commandes produit volontairement le message de board changed du contrôleur lorsque canDispatch devient faux ; ce statut de diagnostic ne décrit pas un échec du jeu. Aucun plafond de planification n’a été réduit. Cette capture ne qualifie aucun temps.

Le rôle acquis, la condition de réutilisation et la contradiction qui doit arrêter la série sont précisés dans `first-loss.json`. La prochaine modification expose seulement le préfixe des marches ordinaires ; prises, dépôts et franchissements restent des décisions distinctes.

## Candidat natif

La modification conserve les marches consécutives déjà calculées, avec un maximum de 16 commandes et arrêt avant la prise, le dépôt ou le franchissement. Les gardes chaînent uniquement les retours réellement observés ; l’état appris reste publié une fois, dans l’ordre, à la clôture native. Une absence de prédécesseur acquis interrompt la réconciliation. Les animations contradictoires continuent à apprendre les paires incompatibles.

Les deux salles indépendantes déclarent uniquement un savoir de mouvement et de franchissement antérieur. Elles ne préparent ni route, ni association des passagers, ni paire incompatible. Elles varient formes, palette, positions, pas et commandes ; les tickets natifs montrent la préparation continue, la prise réelle, les marches de portage et la clôture unique. Chacune apprend deux incompatibilités à partir des animations observées puis termine la salle. Quatre contradictions et la référence exacte du prédécesseur sont également vérifiées : **7/7 tests ciblés**.

Une première salle synthétique avait un bord de cadre pouvant être confondu avec un second corps à la prise. Le garde l’a refusé. `fixture-ambiguity.json` conserve les deux composants ; seul le cadre de la fixture est élargi pour garder leurs identités distinctes. La production n’est pas assouplie.

Le rejeu réel chronométré depuis L1, le collecteur de continuité et le contrôle complet restent à effectuer sur ce candidat ; aucune livraison de CGWL n’est annoncée ici.


## Reprise : qualification stricte complète

Le 27 novembre 2026, le candidat repris sur `main` `22e60471` gagne **6/6 niveaux en 167 commandes**, depuis L1 dans une seule session SIC et avec un worker. La source locale figée est `aa658276`, sauvegardée sur GitHub sous `94f1c45159d00d4149e8b90820bbfa700a7116ce` avec le même arbre. Les commandes par niveau sont **15, 16, 15, 18, 61 et 42**. Les 167 commandes sont autorisées et acquises ; aucun reset ni undo.

Les plafonds archivés sont inchangés : **20/21/19/23/74/48 commandes** et **12/12/12/14/45/30 secondes**. Le score L5 est obtenu à **25,085 s sous 45 s**, et le score L6 à **26,057 s sous 30 s**. La réconciliation ultérieure dure respectivement 0,844 s et 0,888 s. Les quatre premiers préfixes sont identiques à la campagne de départ. La distinction entre score officiel et réconciliation est conservée dans les données.

Les sept tests ciblés passent, dont les deux salles natives distinctes et les retours contradictoires. Le dossier `qualification/` archive les résultats stricts complets, les budgets, les empreintes et la correspondance locale/GitHub. Le contrôle physique des séries, la CI combinée et le viewer livré restent des étapes séparées ; cette qualification ne les anticipe pas.

## Passive physical continuity collection

The native collector on local `37d87338` / GitHub `f642211d` also completes all six levels in 167 commands. Its full trajectory is exactly the strict trajectory above, including all frames and animations. The collector uses a uniform cap of 74; the separate strict qualification keeps the original per-level caps. The archive is `qualification/continuity-initial-component-observer.jsonl.gz`, with its exact hash and scope in `continuity-initial-manifest.json`.

The executed tickets establish native continuation counts of **3, 0, 0, 0, 29, 13**. The passenger-specific series in level 5 comprise 22 continuations while carrying and seven while approaching; level 6 comprises 12 while carrying and one while approaching. Each series is bounded by 16, carries one decision identity, has one actual outcome per ticket and reconciles its executed prefix once.

The first passive physical contract correctly refused the archive at global command 107: a connected component of the passenger's ink also touches neighboring artwork. Its box changes from `[48,23,57,32]` to `[50,24,57,32]` while the measured carrier moves down by four pixels. These component extents cannot stand in for the passenger's transported footprint. The counterexample preserves the original ticket, preceding acquired state and actual command hashes in `qualification/physical-observer-counterexample.json`.

The corrected passive observer starts from the offset acquired at the actual pickup, anchors it to the independently measured current carrier, and counts the current public pixels in that footprint. It does not accept a projected position without the carrier and passenger pixels. A unit test attaches extra same-ink artwork and verifies that it cannot change the footprint measurement; removing the transported pixels prevents confirmation. Missing and ambiguous carriers also remain unknown. Six observer tests pass. There is no production change after the strict-qualified transport implementation.

The initial collector archive remains an explicitly failed component-box observation. A fresh run with the corrected observer is required by the combined continuity gate before integration. The gate protects loaded transport and approach separately at each level; walking elsewhere cannot compensate for a missing carried passenger.
