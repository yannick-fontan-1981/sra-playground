# Proposition de mise à jour de la feuille de route après 3I

Ce texte prépare la mise à jour de `docs/migration/v6-delivery-roadmap.md`. **La feuille de route active n’a pas été modifiée.** Les champs **ATTENTE** doivent être complétés par les reçus réellement achevés avant publication ; le présent brouillon ne clôture pas 3I. Les noms des lots et des entrées ci-dessous reprennent la feuille de route existante. Les résultats et compteurs décrivent uniquement le gel 0.50 ; les travaux isolés de préparation 4A ne constituent pas une livraison publiée.

## Texte proposé pour l’état courant

### État courant : RecurrentSeries et CONN validés, WEAV et coût en attente

Le moteur **0.50.0**, gel **`e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87`**, raccorde **3I, `recurrent_series`**, dans le propriétaire commun. Le transfert comprend RepeatedLine et le repli SupportedLine réellement consommé : mesures courantes, continuation entre champs, témoin scoré, insertions passives, ordre public du paquet et préparation conditionnelle à six plis. Le gel contient **270 fichiers natifs**, avec une archive de **281 fichiers**.

Le registre atteint **54/76 entrées raccordées**, sans entrée partielle ; **22 entrées restent ouvertes**. La façade observée demeure **6/6**, avec **37 workflows compilés**. L’audit compte **163 composants vérifiés, 141 transferts partiels et 1 065 modules en attente**, zéro module entièrement vérifié et six portes globales encore ouvertes. Le raccordement de la dernière entrée du lot 3 ne clôture pas ses réserves fonctionnelles antérieures.

Les ciblages d’accès et de contrats natifs passent **220/220** tests. Le [périmètre formel annoncé](final/validation/delta-tests-run.json) passe **3 225/3 225 tests dans 76 fichiers**, sans échec, annulation, exclusion ou TODO et sans modification des entrées source/tests. Les [5/5 contrôles du projet, compilation comprise](final/validation/checks-run.json), passent, avec un [reçu séparé de résolution de l’audit](final/validation/migration-audit-resolution.json) après écriture de la filiation ; le premier journal est conservé. La [boucle commune contrôlée](final/recurrent-series-common-loop.json.gz) vérifie 18 groupes dans deux sessions froides synthétiques ; les tests d’intégration préservent 19 checkpoints réellement publiés du natif 0.49. Ces preuves sont distinctes d’une campagne en jeu.

Les quatre rejeux **CATR/RSWP/FOGW/VOIS passent 68/68 contrôles**, préservant 159 actions, 88 préfixes et douze frontières naturelles. **WEAV reste ATTENTE** : un premier rejeu est interrompu par SIGKILL, code −9, après 67 actions journalisées ; la cause de ce signal reste indéterminée. La reprise isolée à 768 Mio de heap Node échoue avec code −6 et épuisement du heap. Les [résultats initiaux](final/regressions/regression-summary.json), le [premier résumé interrompu](final/regressions/regression-summary-interrupted.json) et le [résultat de reprise](final/weav-retry/regressions/regression-summary.json) sont conservés. Le gel et les entrées immuables restent inchangés. La récupération est en préparation, sans annuler les quatre réussites ni conclure de ces échecs instrumentés à une incapacité en jeu.

La référence publiée est **Site 78 / native 0.49.0**, commit **`8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`**, gel **`d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054`**, 268 fichiers natifs. Sa comparaison CONN s’arrête à la borne préannoncée de **huit actions et zéro niveau**, sans conclure à une incapacité complète. Le [candidat CONN](final/conn-resolution.json) atteint **trois niveaux en une session froide : 21 actions, 21 préfixes, arrivée au niveau 4**, avec arrêt sur la cible annoncée et état `NOT_FINISHED`.

La [comparaison indépendante](diagnostic/conn-public-parity.json) passe **1 361 contrôles** : 14 préfixes propres sélectionnés, 21 retours acquis, 34 événements propres et 35 restaurations, depuis des mémoires froides sans amorçage par une mémoire capturée. Les **84 ablations de composant** comprennent **33 changements d’action/refus et 51 résultats négatifs ou inchangés** ; les 35 changements de projection de décision sont un compteur distinct. L’appelant hérité complet et son contrefactuel restent hors de cette revendication. Le [navigateur](final/browser/browser-qa.json) confirme **21 actions/trois niveaux/21 plans** après Pause, une action isolée et reprise. L’horloge CONN se termine à **1 014,763812 secondes cumulées**, avec **1 385,236188 secondes restantes** sur 2 400 ; elle inclut le scan, la référence, la campagne, les comparaisons, les ablations, le navigateur et la revue, sans pause ni remise à zéro. Tout diagnostic futur de CONN reprendra cette valeur.

**Coût global 0.50 : ATTENTE.** La nouvelle fenêtre conserve l’ordre A1/B1/B2/A2, 32 sessions et 400 actions mesurées, contre une référence 0.49 fraîche. L’acceptation exige pour chaque jeu séparément une médiane groupée de session complète **strictement sous +10 %**. Les dépassements de phase peuvent être acceptés sous cette condition, tout en restant visibles ; aucune compensation entre jeux ni exclusion de session mesurée. Le précontrôle statique passe 52/52 et la revue indépendante des inputs 56/56 ; ces reçus ne sont pas une décision de coût. **Intégrité finale, publication et clôture du lot 3I : ATTENTE**, après résolution de WEAV et décision de coût.

Le préfiltre géométrique n’est pas préempté à chaque opération. Les 250 000 nœuds et l’échéance limitent la recherche Supported, sans garantir la latence de toute la question. La mémoire propre suit le tri Unicode Python ; les digests partagés gardent le tri UTF-16 historique. Ces ordres sont identiques pour les identifiants source hexadécimaux produits, mais leurs domaines de compatibilité restent qualifiés. La parité de l’appelant hérité complet reste ouverte.

**Prochaine entrée autonome planifiée : `observed_feedback_sequence`**, première entrée du **lot 4**, puis `relative_arrangement` et `facet_example`. Une préparation 4A existe isolément ; elle n’ajoute aucun résultat publié au présent gel. La priorité immédiate reste l’achèvement et la décision de livraison de 3I. Les réserves FramedWindow en jeu, de préemption, de revalidation Population/Reception et de modèle RootedLine demeurent explicites. Les horloges **CWSE 2 399,683865 s**, **SK48 667,35444 s**, **FOGW 951,320275 s**, **VOIS 1 017,469531 s** et **WEAV 1 277,782615 s** ne changent pas ; les rejeux de livraison ne constituent pas une nouvelle campagne WEAV.

## Remplacement proposé pour le tableau des lots 3 à 11

| Lot | Résultat attendu | Entrées restantes | Dépendance nécessaire | Statut proposé |
| --- | --- | ---: | --- | --- |
| 3 | Mémoire commune et compositions | **0 au registre** | Propriétaire commun, acquisition et contrats de continuation | 3I / 0.50 raccorde `recurrent_series` et son repli SupportedLine. Validation formelle, CONN, contribution et navigateur acquis ; livraison **ATTENTE** de WEAV, du coût et de la publication. Réserves CWSE/SK48, contribution FramedWindow et limites communes conservées. |
| 4 | Exemples et retours discriminants | **3** | Observations, callbacks SRC et gardes | Prochaine entrée autonome : **`observed_feedback_sequence`**, puis `relative_arrangement`, `facet_example`. Préparation 4A isolée, aucune livraison publiée. Le lot 3 complet n’est pas un prérequis global. |
| 5 | Temps, adressage et objets | **3** | Historique public ; contrat de conservation pour les consommateurs concernés | Planifié : `linked_temporal_preparation`, `observed_addressed_material`, `observed_object_binding`. |
| 6 | Pièces rigides, cargaisons et stabilisation | **4** | Géométrie, contrôles, recherche bornée et interruption | Planifié : `preview_packing`, `selected_rigid`, `observed_rigid_cargo`, `shared_settlement`. |
| 7 | Ateliers et transactions | **2** | Interfaces mesurées, SRC et mémoire des méthodes | Planifié : `observed_ranked_workshop`, `observed_symbol_transaction`. |
| 8 | Accès conditionné et branches | **2** | Calibration des commandes et préfixes gardés | Planifié : `motif_conditioned_access`, `parallel_branch_routing`. |
| 9 | Navigation, régions et canaux | **3** | Graphes, retours publics et budgets courants | Planifié : `chart_navigation`, `region_intervention`, `joint_channels`. `topological_recolor` reste acquis ; vérifier aussi `discrete_network` hors compteur 76 selon l’appelant source. |
| 10 | Axe, fenêtre, ordre et temps | **5** | Observations, séquences et méthodes revalidées | Planifié : `axial_question`, `window_question`, `ordered_recruitment`, `temporal_selection`, `invited_endpoints`. |
| 11 | Consolidation et lisibilité | **Hors compteur** | Résultats et preuves des lots précédents | Réconcilier les propriétaires, chemins hors registre, 31 opérations, workflows, preuves, restauration, longues sessions et coûts ; contrôler notamment l’export progressif des diagnostics. |

Les nombres des lots 4 à 10 totalisent **22 entrées** : 3 + 3 + 4 + 2 + 2 + 3 + 5. Les 26 noms du plan initial restent réconciliés sans en ajouter : `observed_composition_services`, `framed_window_composition`, `coupled_prefix_reference` et `recurrent_series` sont désormais raccordés.

## Critères de préparation du lot 4

Pour `observed_feedback_sequence`, reprendre le producteur d’hypothèses, le callback de retour et la consommation SRC réellement appelés. Le critère existant exige qu’un retour de séquence élimine ou sélectionne une hypothèse et **change l’essai suivant**. Les reconnaissances et refus interruptifs de la source doivent être conservés, ainsi que la revalidation d’une méthode rappelée après frontière.

Les deux autres entrées gardent leurs objectifs propres : `relative_arrangement` vérifie déplacement et préservation des autres participants ; `facet_example` produit puis révise une correspondance. Le partage d’observations ou d’un helper ne rend pas toutes les autres familles préalables obligatoires. Le détail du périmètre du premier sous-lot devra être déclaré depuis le vrai graphe d’appels avant ses modifications.

## Ligne proposée pour le journal de livraison

| Jalon | Statut | Preuves à consigner |
| --- | --- | --- |
| Lot 3I / RecurrentSeries | **0.50 gelée et raccordée ; clôture ATTENTE** | 270 fichiers natifs/281 archive ; 54/76 entrées ; 163 composants/141 partiels/1 065 en attente ; 3 225/3 225 tests sur 76 fichiers ; cinq contrôles et audit résolu ; quatre rejeux 68/68. Boucle synthétique : 18 groupes/deux sessions ; 19 checkpoints 0.49. CONN : 21 actions/trois niveaux/21 plans ; 1 361 contrôles, 84 ablations dont 33 changements et 51 inchangées ; navigateur acquis ; horloge 1 014,763812 s. WEAV, coût global et publication : **ATTENTE** ; les deux échecs instrumentés WEAV restent conservés. |

## Remplacements à effectuer après réception des preuves

- Intégrer le reçu final de récupération WEAV et le bilan des cinq rejeux, en conservant les deux échecs instrumentés, les quatre réussites déjà acquises et le périmètre exact du comparateur.
- Inscrire les médianes STCK/SMLP, leurs variations, les verdicts de cohorte/phase, les p95 disponibles et la revue arithmétique ; décider le budget uniquement selon le critère global préannoncé.
- Vérifier l’intégrité finale et identifier la publication effective du gel 0.50. La publication n’est pas acquise par la seule présence d’une branche, d’un brouillon ou d’un travail 4A isolé.
- Statuer explicitement sur la livraison de 3I, puis intégrer ce texte dans les documents actifs. La fin de raccordement du lot 3 ne ferme pas ses réserves, ses héritages ou la migration V5/V6 entière.

Documents source de cette proposition : `docs/migration/v6-delivery-roadmap.md`, `docs/migration/lot3i-recurrent-series.md`, `docs/migration/lot3i-recurrent-series-lineage.md`, les registres `v6-entry-point-progress.json` et `v6-coverage.json`, et les reçus conservés sous `docs/migration/lot3i-evidence/`.
