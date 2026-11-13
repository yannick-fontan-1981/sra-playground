# Lot 3C : preuves de la correction de l’évidence courante

Le [rapport de correction](../lot3c-current-evidence-correction.md) documente l’extension native **0.44.0** appliquée à la proposition `exposed_reception_plan`. La source est gelée sous le digest **`e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255`**, avec **251 fichiers natifs** et **262 fichiers dans l’archive**. La référence de comparaison est la publication **71 / native 0.43.0**, commit `e9fd144112b05a65af5c88e9f05c541f43ed8ed7`.

La correction rétablit l’évidence courante du dernier plan sur la trajectoire publique conservée de 0.43, sans modifier son identité, ses commandes ni les 19 événements propres déjà acquis. La nouvelle campagne dépasse ce refus, puis s’arrête sur `level_active_time_budget` après **107 actions, deux niveaux et 93 préfixes**. **La cible de trois niveaux reste non atteinte ; 3C demeure ouvert avec qualification.** La contribution fonctionnelle est établie séparément et ne transforme pas cette limite en réussite.

## Parcours des preuves

| Pièce | Contenu et qualification |
| --- | --- |
| [Limite publiée de 0.43](../lot3c-evidence/final/cwse-terminal-diagnostic/README.md) | Source originale et port identiques : scène admise au paquet 19, absente au paquet 20, admise au paquet 21 ; refus terminal parce que l’observation courante manque dans l’évidence |
| [Revue indépendante](diagnostic/README.md) et [résultat complet](diagnostic/current-evidence-result.json) | Différence limitée à trois champs d’évidence ; mémoire, plan et gardes conservés ; 14 contrôles de contrat, distincts des faits de campagne |
| [Proposition corrigée](diagnostic/candidate-terminal-proposal.json) | Proposition complète produite depuis les vrais événements et le vrai raster terminal ; aucune action exécutée par ce diagnostic |
| [Gel natif](final/source-manifest.json), [archive](final/source-archive.json) et [partitions](final/source-archive-parts.json) | Sources exactes de la livraison, archive reproductible en parties ordonnées |
| [Périmètre formel](final/release-scope.json) | 46 fichiers de tests déclarés : 45 fichiers du delta précédent et les nouveaux contrats d’évidence courante ; ne désigne pas toute la suite historique |
| [Tests formels](final/validation/delta-tests-run.json) | 1 536/1 536 tests réussis dans ces 46 fichiers ; zéro échec, annulation, ignoré ou TODO ; source et entrées de test inchangées |
| [Contrôles du projet](final/validation/checks-run.json) | Typage, audit d’entrée, audit de migration, diff et compilation : cinq contrôles réussis, source gelée inchangée |
| [Régressions](final/regressions/regression-summary.json) | CATR et RSWP : 34/34 contrôles du comparateur conservé ; rejeux des retours publics enregistrés, pas de nouvelles réussites live |
| [Campagne réelle](final/cwse-current-session/execution-cwse.json) | Une session froide avec hôte public opaque ; 107 actions, deux niveaux, 93 préfixes ; arrêt conservé sur le budget actif du niveau |
| [Contribution réelle](final/cwse-current-session/exposed-contribution.json) | 19 préfixes Exposed, 29 actions, 21 événements, huit retours sans événement et 19 restaurations ; 57 ablations dont 33 changements d’action ou de refus |
| [Navigateur](final/browser/browser-qa.json) | Session froide continue ; commandes vérifiées, progression au-delà de l’ancien refus ; arrêt volontaire à 46 actions, deux niveaux et 32 préfixes ; pas de troisième niveau revendiqué |
| [Horloge poursuivie](continued-clock.json) | Même candidat CWSE, 1 527,448427 secondes antérieures conservées ; aucune remise à zéro ; limite cumulée de 2 400 secondes |
| [Résolution et horloge finale](final/cwse-resolution.json) | 2 399,683865 secondes cumulées ; travail CWSE terminé avant la limite ; cible non atteinte, aucun nouvel essai sur ce gel |
| [Intégrité finale](final/delivery-integrity.json) | Vérification réussie du gel, de l’archive, des sources/tests, du build et des 1 786 originaux ; trois rapports reconstruits depuis 30 partitions, 25 631 639 octets identiques |
| [Protocole de coût](performance/protocol.md), [déclaration](performance/declaration.json), [politique globale](performance/global-budget-policy.json) et [contrôle préalable](performance/protocol-check.json) | Référence 0.43 remesurée et candidat 0.44 gelé ; règle globale strictement sous +10 % par jeu, déclarée avant la fenêtre |
| [Fenêtre officielle](performance/window.json), [agrégat](performance/combined-comparison.json) et [revue](performance/consolidation-review.json) | 32 sessions mesurées, 400 actions ; aucune session mesurée exclue ; 231/231 contrôles de consolidation |
| [Décision globale](performance/global-budget-decision.json) et [rapport des coûts](performance/results.md) | 2/2 jeux acceptés selon la règle autorisée ; 14/16 diagnostics de phase dans le seuil, avec les deux dépassements STCK conservés |

Les **129 tests ciblés** passent : 99 Exposed, 19 intégration et 11 nouveaux contrats. Ils sont inclus dans les **1 536 tests du delta formel**, vérifiés sous le gel exact. Le seul oracle de proposition dont l’enveloppe diffère intentionnellement est `propose:after_observed_control` ; son attente originale reste conservée, avec comparaison exhaustive de tous les autres champs.

## Résultat de coût sous la règle globale

La [décision globale](performance/global-budget-decision.json) est **`accepted_under_user_global_rule`**, avec **2/2 jeux** strictement sous +10 %. Les deux cohortes de la fenêtre A1/B1/B2/A2 sont terminées ; les huit durées de chaque jeu/version sont réunies selon le protocole. Les valeurs ci-dessous sont arrondies ; les durées et ratios complets restent dans le reçu.

| Jeu | Médiane 0.43, ms | Médiane 0.44, ms | Variation globale | Décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 9 839,262 | 9 990,867 | **+1,540821 %** | Accepté |
| SMLP | 16 722,476 | 16 659,132 | **−0,378796 %** | Accepté |

Le diagnostic historique reste **14/16**. Les deux phases STCK au-delà de +10 % sont `new_decision`, **+15,102315 %**, et `known_prefix_guard`, **+15,178145 %**. Elles sont acceptées dans cette livraison au titre du global, sans changer leurs valeurs ni le résultat du comparateur de phase. Les **231 contrôles** de consolidation passent. Les [résultats complets](performance/results.md) conservent les seize mesures, les effectifs, les dispersions et les p95 disponibles ; les huit durées de session par version ne permettent pas de publier un p95 global.

Ce coût accepté ne clôture pas 3C : la cible fonctionnelle CWSE demeure à deux niveaux sur trois.

## Portée des résultats

L’extension native ajoute la référence de l’observation effectivement remesurée à l’enveloppe de la proposition lorsqu’elle manque. Elle ne crée aucun événement, n’actualise aucune preuve d’effet appris et ne change pas `plan.state`. La liste reste limitée à 16 références. Les contrôles de TargetTree et de la garde Exposed sont inchangés. Les retours `null`/`unknown` et les conditions existantes de préfixe borné restent inchangés ; aucun résultat incomplet ne devient une preuve de résolution.

La source Python conservée présente le même refus terminal que 0.43. Cette correction est donc une extension qualifiée de la sémantique native, pas une nouvelle affirmation de parité complète avec les originaux. Les jeux, solutions et spécifications de jeux ne servent pas d’entrées à la correction. Les états synthétiques des tests ne sont pas injectés dans les campagnes.

L’utilisateur autorise le dépassement d’une phase lorsque le coût global reste sous +10 %. Le protocole applique cette règle à la médiane de `session_elapsed`, **séparément pour STCK et SMLP**, avec comparaison strictement inférieure à +10 %. Les seize diagnostics de phase, leurs dispersions et leurs éventuels dépassements restent publiés. L’acceptation de coût ne remplace ni les contrats ni la contribution fonctionnelle de 3C.

Le contrat d’évidence courante est corrigé ; la capacité à achever le troisième niveau de CWSE reste limitée. Aucun nouvel essai CWSE n’est prévu sur ce gel. Le suivi fonctionnel demeure qualifié et borné ; la prochaine priorité de transfert source autonome est 3D, selon la feuille de route, sans présenter 3C comme clos.

## Reproduction ciblée

Depuis la racine du dépôt :

```bash
node --test tests/v6-exposed-reception.test.ts tests/v6-exposed-reception-integration.test.ts tests/v6-exposed-current-evidence.test.ts
```

Le helper `tests/helpers/chunked-evidence.ts` reconstruit et vérifie en mémoire les octets de la campagne publiée depuis ses partitions suivies dans Git. La suite ne dépend donc pas d’un fichier volumineux seulement restauré dans l’espace de travail. Le [script de preuve](../../../scripts/prove-exposed-current-evidence.mjs) compare également les composants 0.43 et 0.44 à partir des mêmes entrées vérifiées ; sa [notice](diagnostic/README.md) précise le worktree de référence requis.

La [feuille de route](../v6-delivery-roadmap.md) porte la décision de passage à l’étape suivante. Ce dossier conserve les résultats propres à la correction et n’altère aucun verdict de livraison antérieure.

## Intégrité de l’index

L’[index final des empreintes](evidence-index.json) rassemble les pièces de cette livraison et les fichiers liés de source, tests et feuille de route. Son [générateur](build-evidence-index.py) permet de vérifier les fichiers retenus avec `--verify`, sans relancer de test, de campagne ou de mesure. Les rapports volumineux ignorés sous leur nom original restent conservés à l’identique dans leurs partitions et leurs manifestes de reconstruction.
