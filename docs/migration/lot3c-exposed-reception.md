# Lot 3C : réception exposée dans le moteur commun, native 0.43

## Décision et état du lot

**Le chemin propre `exposed_reception_plan` est raccordé et vérifié dans le moteur commun. Le lot 3C reste ouvert.** La campagne CWSE atteint **deux niveaux résolus, 21 actions et 13 préfixes**, puis s'arrête au niveau 3 avec `composition_target_unbound_action_set`. La cible déclarée de trois niveaux n'est pas atteinte. La [décision conservée](lot3c-evidence/final/cwse-resolution.json) maintient ce résultat et place le suivi générique du rattachement de l'évidence courante avant le passage à 3D.

La validation du périmètre modifié réussit : **1 525 tests sur 1 525**, dans **45 fichiers**, ainsi que les **cinq contrôles du projet et de compilation**. Les régressions historiques conservent leur statut strict **échoué, 32/34** ; leur différence de schéma est qualifiée dans un reçu distinct. Le coût 3C est **accepté selon la règle globale sur 2/2 jeux** : STCK **+0,199134 %**, SMLP **−0,254060 %**. Le classement historique reste **15/16**, avec la requête STCK **+11,602583 %** conservée comme dépassement de phase accepté.

Le lot 3B est clôturé sous la règle globale explicitement autorisée par l'utilisateur. Cette décision est distincte de l'état de 3C et ne réécrit pas les résultats de phases antérieurs. Voir l'[acceptation 3B](lot3b-global-budget-acceptance.md) et son [reçu calculable](lot3b-global-budget-acceptance.json).

## Source gelée et périmètre transféré

| Élément | Référence conservée |
| --- | --- |
| Révision native | **0.43.0** |
| Digest du moteur gelé | `3e88aa12214fd3d4a4feb8d63b946123b8394cb4a0cbd0a156cc059c37f7b46c` |
| Inventaire natif | **251 fichiers** ; [manifeste](lot3c-evidence/final/source-manifest.json) |
| Archive de source | **262 fichiers** ; [manifeste d'archive](lot3c-evidence/final/source-archive.json) |
| Référence originale | Commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, **1 786 fichiers originaux vérifiés inchangés** |
| Référence publiée de comparaison | Site 70, native **0.42.0**, commit `97208e1ac39599cbca06b70fe1ff98cfec7ef8b6` |

Le transfert couvre les deux grammaires de projection des réceptions, la couche propre d'accès Exposed, ses propositions et gardes, l'acquisition de contrôles et modèles conditionnels à partir de retours publics, ainsi que sa connexion à la mémoire commune. Le noyau nominal V5 de chaîne de poussée effectivement consommé par cette couche reste distingué d'un transfert de toute la transaction V5.

Les contrôles préservent notamment l'ordre proposition–acquisition, les correspondances ambiguës, les conflits de commandes, les identités numériques des plans, les règles de changement d'époque et de disposition, et les retours sans scène admissible. Les limites supplémentaires de travail natives sont des extensions explicites : une recherche interrompue ou partielle ne devient pas une preuve d'impossibilité.

**L'héritage complet d'`EphemeralMapAccess` n'est pas transféré.** Les comparaisons de la couche propre et les tests d'intégration ne certifient donc ni la fermeture héritée entière, ni l'identité du caller original complet. Les états et preuves retenus dans le graphe ne rendent pas, à eux seuls, tous les algorithmes de raisonnement éditables comme règles déclaratives.

## Contrats source et validation formelle

L'[exporteur de référence](../../scripts/export-v6-exposed-reception-reference.py) appelle directement les composants Python conservés, sans modifier leur source. Il vérifie l'inventaire original avant et après les appels. La [fixture de parité](../../tests/fixtures/v6-exposed-reception-parity.json.gz), d'empreinte `80bf5ec28780bd398a8d8dc6ccdb63d2faa9d4759bb79b6e653e1fdedf09ebef`, contient **74 cas de composant**, **16 cas de garde**, **7 cas de façade commune** et les mesures des **100 rasters publics initiaux** déjà archivés.

Ces cas comprennent les deux tailles de scène, les chevauchements avec une réception, les changements de palette et d'orientation, les ambiguïtés, les commandes indisponibles, les recherches bornées, la restauration, les acquisitions après mouvement et les retours manquants. Les attentes proviennent de la source Python, et non des sorties TypeScript à vérifier. Les rasters contrôlés et les appels de composants ne sont pas des résultats de jeu.

La [comparaison indépendante des projections](lot3c-evidence/diagnostic/projection-parity.json) conserve **347 contrôles réussis** : 300 mesures sur les 100 vues initiales, 24 mesures de scènes contrôlées, 8 contrôles de candidats d'entrée et 15 identités de plan.

| Validation du gel | Résultat et preuve | Portée |
| --- | --- | --- |
| Périmètre déclaré | **45 fichiers** ; [liste](lot3c-evidence/final/release-scope.json) | Delta affecté du propriétaire commun, de la persistance, du caller et de la composition, plus les trois fichiers de tests Exposed |
| Tests formels | **1 525/1 525**, zéro échec, annulation, saut ou test en attente ; [reçu](lot3c-evidence/final/validation/delta-tests-run.json) | Périmètre déclaré, sans prétention de réexécution de toute la suite historique |
| Contrôles et build | **5/5** : types, audit des entrées, audit de migration, contrôle du diff et build ; [reçu](lot3c-evidence/final/validation/checks-run.json) | Sources gelées et worker de production enregistrés |
| Intégrité de livraison | Réussie avec qualification explicite des régressions ; [reçu](lot3c-evidence/final/delivery-integrity-qualified.json) | Inventaires, empreintes, archive et transport des preuves ; ne transforme pas un échec fonctionnel en succès |

## Campagne réelle CWSE et comparaison bornée

CWSE a été choisi à partir de l'admission de son **raster public initial** par la projection originale parmi les 100 vues conservées. La [sélection](lot3c-evidence/candidate-selection.json) ne repose sur aucun code de jeu ni sur une solution connue.

| Exécution | Actions | Niveaux résolus | Résultat exact |
| --- | ---: | ---: | --- |
| Référence publiée 0.42 | 12 | 0 | Essai froid borné à 12 actions ; [copie exacte des preuves](lot3c-evidence/baseline-copy.json) |
| Candidat gelé 0.43 | 21 | 2 | 13 préfixes, arrêt au niveau 3 ; cible de 3 niveaux non atteinte ; [résolution](lot3c-evidence/final/cwse-resolution.json) |

La preuve de contribution vérifie que les deux essais commencent avec le même paquet public complet et les mêmes empreintes des ressources opaques du jeu. Le plafond de la référence 0.42 ne démontre pas qu'elle serait incapable de résoudre le jeu avec davantage d'actions. Les durées de ces campagnes ne constituent pas la mesure officielle de coût.

La campagne candidate conserve son statut d'échec de la cible, son journal public et ses événements acquis. La [décision finale sur CWSE](lot3c-evidence/final/cwse-resolution.json) n'autorise aucune nouvelle tentative sur ce gel pour remplacer ce résultat. Le temps écoulé depuis la sélection jusqu'à la fin du diagnostic et des contrôles navigateur est conservé, sans réinitialisation de l'horloge.

## Contribution des connaissances acquises

Le [reçu de contribution](lot3c-evidence/final/cwse-session/exposed-contribution.json) reconstruit **12 préfixes sélectionnés Exposed et 20 actions** à partir des seuls événements réels antérieurs à chaque décision. Il reproduit les plans complets de la couche propre, les identités, les actions, les admissions et les acquisitions. Douze restaurations de la mémoire propre sont vérifiées séparément avant la proposition suivante.

Sur ces 20 transitions, **19 produisent exactement un événement propre**. Le dernier retour Exposed possède une scène non admissible : la source et le natif renvoient alors zéro événement propre et la mémoire reste inchangée. Cette absence est conservée comme telle. L'action suivante appartient à `pre_score_contact` ; elle porte le total de la campagne à 21 et n'est pas comptée comme contribution Exposed. Les deux frontières naturelles de niveau antérieures possèdent leur événement acquis.

Les ablations sont des reprises de composants hors du jeu. Elles effacent uniquement les contrôles, les modèles conditionnels, ou les deux, dans le dernier instantané acquis, tout en conservant le contexte public réel. Elles ne modifient ni la partie conservée ni ses entrées.

| Diagnostic d'ablation | Résultat conservé |
| --- | ---: |
| Ablations effectuées | **36** |
| Interventions modifiant effectivement la connaissance retenue | **33** |
| Changements d'action ou de refus | **16** |
| Changements de la projection de décision | **21** |
| Changements stricts limités à l'identité ou à la provenance, sans changement de décision | **12** |
| Décisions négatives ou inchangées | **15** |

Ces catégories ne désignent pas des parties indépendantes et ne doivent pas être additionnées comme un score de réussite. La contribution des contrôles et celle des modèles conditionnels sont démontrées séparément. Au préfixe 6 du niveau 2, effacer les modèles transforme un accès de deux actions en question de contact d'une action. Au préfixe 12, la même intervention remplace `maintain_field` par une proposition d'accès. Les interventions sans effet restent publiées.

La preuve porte sur les décisions effectivement observées et leur mémoire propre. Elle n'établit ni la nécessité de chaque action, ni l'égalité de tout l'état privé, ni la réussite d'une seconde partie contrefactuelle. Son champ `actual.targetMet` reste **faux**.

## Diagnostic du refus terminal

Le [diagnostic source](lot3c-evidence/final/cwse-terminal-diagnostic/source-result.json), sa [comparaison native](lot3c-evidence/final/cwse-terminal-diagnostic/native-result.json) et la [note détaillée](lot3c-evidence/final/cwse-terminal-diagnostic/README.md) reproduisent la même proposition terminale complète, la même identité et le même refus dans les composants originaux et natifs.

| Paquet après l'action | Admission de scène, source et native | Conséquence constatée |
| --- | --- | --- |
| 19 | Scène admise | Dernier événement propre ; l'évidence retenue se termine à la révision 20 |
| 20 | Scène absente | Aucun événement propre, état propre inchangé |
| 21 | Scène à nouveau admise, après l'action étrangère | Proposition liée à l'observation courante de révision 22, mais évidence du bundle encore arrêtée au paquet 19 |

Les actions de la proposition et celles du bundle sont identiques. Le motif `unbound_action_set` vient ici de **l'absence de la référence d'observation courante dans `bundle_template.evidence`**. La garde de rattachement refuse avant d'atteindre les contrôles spécifiques de morphologie.

Ce diagnostic ne relève pas de divergence du port Exposed sur ce retour. Il ne démontre pas que l'héritage `EphemeralMapAccess` manquant est la cause du refus précis, ni que le caller original entier aurait suivi la même trajectoire. La prochaine correction doit traiter le rattachement de l'évidence courante dans le moteur commun, avec ses contrats de source et d'acquisition explicitement qualifiés. Le refus conservé reste une limite réelle de la version 0.43.

## Régressions CATR et RSWP : résultat strict conservé

Les deux rejeux se terminent normalement, mais les comparaisons historiques restent **échouées : 32 contrôles réussis sur 34, zéro cas strict réussi sur deux**. Le [résumé original](lot3c-evidence/final/regressions/regression-summary.json) et les comparaisons [CATR](lot3c-evidence/final/regressions/catr-042-comparison.json) et [RSWP](lot3c-evidence/final/regressions/rswp-042-comparison.json) ne sont pas réécrits.

Le [contrat diagnostique distinct](lot3c-evidence/final/regressions/empty-series-diagnostic-contract.json) reproduit les 34 contrôles du comparateur inchangé. Le seul contrôle qui échoue dans chacun des deux cas compare le dictionnaire complet des compteurs de `sharedSeries` ; celui-ci possède désormais `exposedReceptionEventCount`.

Sur les **19 préfixes scellés**, les **551 anciennes valeurs entières de compteurs** gardent exactement leurs clés, types et valeurs, sans normalisation. Les deux ajouts sont respectivement un compteur entier zéro et une liste d'événements vide. Aucun plan ni capture Exposed n'apparaît dans ces rejeux.

Cette qualification ne déclare pas une égalité brute de tout `sharedSeries`. Les champs `digest` et `digestScope` diffèrent ; certaines références d'époque et d'événement portent le nouvel identifiant de session. Une comparaison complémentaire, explicitement distincte, normalise seulement cet espace de noms et exclut les deux champs de digest. Les exigences de propriétaire passif sont vides : **zéro propriétaire, préfixe ou transition vérifié à ce titre**, sans revendication de couverture passive.

Le périmètre des rejeux conserve **31 commandes, 33 paquets publics complets, 336 images d'animation, 19 préfixes, 50 requêtes et 6 frontières naturelles**. Il s'agit de retours publics archivés, sans nouvelle victoire live ni comparaison de vitesse.

## Vérification des commandes dans le navigateur

Le [reçu navigateur](lot3c-evidence/final/browser/browser-qa.json) décrit une session froide continue du preview source. Pause est observée à **0 puis 7 actions** ; les commandes d'action unique aboutissent aux compteurs 1 puis 5. Les passages naturels de niveau sont observés à **4 actions / 1 niveau / 4 plans**, puis **12 actions / 2 niveaux / 11 plans**.

L'état final visible est **21 actions, 2 niveaux résolus et 13 plans**, avec le même arrêt au niveau 3. La [capture finale](lot3c-evidence/final/browser/cwse-two-levels-and-stop.png) et les observations sont conservées. Ce contrôle porte sur les commandes visibles et leur résultat ; il reste distinct de l'exécution du worker compilé, d'une victoire complète et du budget de coût.

## Coût 3C : critère global accepté, dépassement de phase conservé

**La fenêtre est terminée et le critère global est accepté sur 2/2 jeux.** Le [reçu de décision](lot3c-evidence/performance/global-budget-decision.json) conserve l'ancien classement **15/16, `budget_review_required`**, avec la requête STCK à **+11,602583 %**. Ce dépassement de phase est accepté conformément à la règle utilisateur, car les deux sessions complètes restent strictement sous +10 %.

| Jeu | Médiane 0.42 fraîche | Médiane 0.43 | Variation globale | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 9 699,381706 ms | 9 718,696495 ms | **+0,199134 %** | Accepté |
| SMLP | 16 264,753197 ms | 16 223,430970 ms | **−0,254060 %** | Accepté |

Le [rapport de coût complet](lot3c-evidence/performance/results.md) publie les seize mesures, leurs effectifs et les p95 disponibles. La première cohorte conserve **13/16**, la seconde **16/16** ; toutes leurs sessions restent dans l'agrégat. La [revue indépendante](lot3c-evidence/performance/consolidation-review.json) passe **231/231 contrôles**. Les pointes de requête STCK **12,180009 → 17,015036 ms** et de restauration SMLP **29,114221 → 34,872477 ms** restent visibles. Ces variations proches de zéro du global ne sont pas présentées comme une accélération causale.

La règle explicite de l'utilisateur est : « si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté. » Pour cette nouvelle fenêtre, elle est déclarée **avant la mesure** dans la [politique globale](lot3c-evidence/performance/global-budget-policy.json), le [protocole](lot3c-evidence/performance/protocol.md) et la [déclaration horodatée](lot3c-evidence/performance/declaration.json).

La comparaison oppose **A = native 0.42 publiée fraîchement remesurée** à **B = native 0.43 gelée**, dans l'ordre **A1, B1, B2, A2**. Elle conserve deux cohortes, huit sessions par jeu et version, soit **32 sessions mesurées et 400 actions**. Les seules exclusions prévues sont les huit chauffes de trois actions, soit 24 actions. La [préparation de la fenêtre](lot3c-evidence/performance/readiness.json) est conservée.

Le critère global est la médiane de la durée complète `session_elapsed`, calculée sur toutes les sessions mesurées de chaque jeu. **STCK et SMLP doivent chacun rester strictement sous +10 %** ; un résultat exactement égal à +10 % est refusé. Une amélioration sur un jeu ne compense pas le dépassement de l'autre. Les phases imbriquées ne sont pas additionnées, et les dépassements de phase ainsi que les p95 disponibles restent publiés.

Le [reviewer global](../../scripts/review-native-global-cost-window.py) vérifie les engagements du protocole, les sources, l'ordre de la fenêtre, les lignes complètes du registre de sessions et leur multiplicité, puis recalcule les médianes globales. Il exige la revue indépendante de consolidation passée, liée aux mêmes fichiers, avant de recopier les diagnostics de phases. Les sorties historiques des comparateurs ne sont pas transformées en succès par cette décision globale.

Les distributions sont descriptives. Le p95 reste masqué en dessous de vingt échantillons, donc aucun p95 de session n'est déduit des huit sessions par jeu et version. Le coût mesuré exclut l'exécution du moteur du jeu, le réseau de production et le rendu du navigateur ; il ne démontre ni une latence live ni une stabilité sur plusieurs heures.

L'acceptation antérieure de 3B est différente : elle applique après sa mesure la nouvelle autorisation utilisateur à la fenêtre déjà conservée de 0.42. Les médianes globales de cette fenêtre baissent de **17,80 % sur STCK** et **13,44 % sur SMLP** ; son ancien résultat par phases **14/16** reste intact. Ces valeurs ne sont pas des résultats de la nouvelle fenêtre 3C.

## Intégrité des preuves et limites de migration

Le [vérificateur de livraison qualifiée](../../scripts/verify-native-delivery-qualified-regressions.py) conserve les fonctions historiques de vérification native, archive, tests, build, source originale et transport des pièces. Seul le contrat d'acceptation des régressions est remplacé, explicitement : le résultat strict échoué doit rester inchangé et le diagnostic d'extension vide doit se reproduire avant et après la vérification.

Son [reçu](lot3c-evidence/final/delivery-integrity-qualified.json) confirme les inventaires gelés, les 262 membres de l'archive et ses deux pièces, les 1 786 fichiers originaux inchangés et la reconstruction à l'identique de **trois rapports, huit pièces et 5 846 636 octets**, dans un dossier temporaire initialement vide. Les originaux restent inchangés. Ce reçu établit l'intégrité et la qualification déclarée ; il ne certifie ni 34/34 contrôles historiques, ni une couverture passive, ni la clôture fonctionnelle de 3C.

Les compteurs de migration restent distincts des résultats de jeu :

| Mesure de portée | État de cette révision |
| --- | ---: |
| Branches raccordées d'`observed_composition_services` | **3/6**, avec fermeture propre Exposed vérifiée et héritage encore partiel |
| Entrées déclarées raccordées | **50/76** ; aucune nouvelle entrée du registre n'est revendiquée par cette troisième branche |
| Workflows compilés | **37** |
| Modules vérifiés au niveau composant | **154** |
| Modules partiellement transférés | **135** |
| Modules encore en attente | **1 080** |
| Modules au statut de transfert complet vérifié | **0** |

L'[inventaire de couverture](v6-coverage.json) conserve `complete: false` et les portes de migration complète non satisfaites. Le transfert de cette branche, ses contrats synthétiques, ses observations de jeu, la qualification des régressions et l'acceptation du coût global sont des preuves de portée différente.

La priorité reste donc **le suivi générique du rattachement de l'évidence courante et la clôture explicite de 3C avant 3D**, avec un nouveau gel si une correction native est nécessaire. La [feuille de route](v6-delivery-roadmap.md) porte cette décision fonctionnelle et l'acceptation distincte du coût global.
