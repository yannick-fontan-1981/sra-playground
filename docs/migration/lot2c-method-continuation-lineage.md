# Lot 2C : filiation des méthodes et des continuations morphologiques

## Source et portée

La référence immuable est le commit V6
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, dans
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.
Les 1 786 fichiers du manifeste sont vérifiés avant et après chaque export.
Les attentes proviennent des originaux Python inchangés. Aucun moteur, état
privé, spécification ou solution de jeu ne fournit les résultats attendus.

Les preuves de ce document sont des contrats de composants. Une méthode
historique, un arbre de cible ou une frontière fournis comme prémisses d'un
contrat sont identifiés explicitement. Ils ne constituent pas une exécution
du caller historique complet. Les preuves de campagne et du Kernel réel sont
distinctes de ces contrats.

Fichiers de preuve :

- `scripts/export-v6-morphology-methods-reference.py` : export reproductible ;
- `tests/fixtures/v6-morphology-methods-reference.json.gz` : résultats des
  originaux, provenance, positions, empreintes et prémisses ;
- `tests/v6-morphology-methods-reference.test.ts` : comparaison native et
  contrôles de propriété/restauration ;
- `scripts/export-v6-morphology-entry-reference.py` et
  `tests/fixtures/v6-morphology-entry-reference.json.gz` : contrats directs
  complémentaires des producteurs d'entrée/reprise ;
- `scripts/compare-native-morphology-public-evidence.py` : comparaison passive
  des appels capturés dans une campagne avec le composant original ;
- `scripts/extract-native-method-continuation-evidence.py` : index passif des
  chaînes effectivement capturées, sans inférence de succès ni de causalité.

## Propriétaires et ordre du flux historique

Les chemins du tableau sont relatifs au répertoire source V6.

| Donnée | Production dans l'original | Propriétaire et persistance | Lecture et invalidation |
| --- | --- | --- | --- |
| `target_method` | `agents/yf_arc3_v6/laya_proto/target_method.py`, `at_boundary` ; enrichissement dans `laya_proto/common_frontier_runtime.py`, lignes 1274–1304 | Un seul `memory.put(episode, 'target_method', ...)`, puis relecture dans `strategy_router.target_method` | Une frontière qui ne produit aucune méthode conserve l'ancienne ; une nouvelle méthode valide remplace l'ancienne |
| `station_method` | Projection `target_method.get('station_hypothesis')`, immédiatement après la relecture du propriétaire | Miroir du routeur morphologique, sans second `put` de méthode | `measure_routes`, les projections gérées et `target_tree.extend_target` revalident ses conditions courantes |
| `entry_method` | Projection de la méthode complète après le même `put` | Miroir du routeur morphologique | `entry_rebind.approach` est consulté seulement lorsque le contrôle courant n'est pas attesté |
| `entry_access_return` | `morphology_policy/adapter.py`, `record`, à la fin d'un préfixe `entry_rebind` avec probe différé | `apply_event` affecte le retour, puis s'arrête avant les acquisitions de contacts/trials | `continuation.resume` exige notamment la référence courante exacte, l'époque, le score, la paire, la géométrie et la réserve ; une proposition ne consomme pas le retour |

L'acquisition d'une méthode est conditionnelle : un effet sélectif vérifié,
un accès pair complet portant la même paire, une seule unité de score ajoutée,
la même époque source, puis des références de retour et de frontière cohérentes.
La qualification historique reste
`observed_sequence_possible_goal; necessity_and_sufficiency_open`.
Une telle méthode ne certifie ni nécessité, ni suffisance, ni réussite future.

L'enrichissement de station parcourt tous les contacts de l'époque source.
Une entrée est admissible si son `after` est celui de l'effet sélectif vérifié
et si `peer_preserved` est vrai. L'original n'ajoute pas de filtre sur la clé
de paire du contact. Il faut exactement une entrée admissible. Zéro ou
plusieurs entrées n'empêchent pas l'acquisition de la méthode cible ; elles
empêchent seulement l'ajout de `station_hypothesis`.

Les champs copiés sont `site_surface`, `size`, `role_refs`, `delta`,
`peer_scale`, `observed_scales`, `after`, complétés par `source_epoch`.
Une nouvelle méthode sans station remet le miroir station à `None`.
En revanche, un appel à `at_boundary` qui retourne `None` ne réinitialise
aucun des miroirs de la méthode précédente.

## Fragment original exécuté

L'enrichissement est inline dans `common_frontier_runtime.py` ; il n'existe
pas de fonction originale autonome à appeler. L'exporteur extrait les deux
instructions AST originales, l'affectation `method = at_boundary(...)` et
le bloc `if method`, sans modifier leurs corps, leurs positions ou leur AST.
Il les compile sous le chemin original et vérifie que l'AST n'a pas changé.

| Élément | Valeur |
| --- | --- |
| Positions originales | 1274–1304 |
| Nombre d'instructions de premier niveau | 2 |
| SHA-256 du fichier source | `bcc9bc79d04287c830efedce48b4cc2ab89b5600b8a77fe09782c35d1c05c064` |
| SHA-256 du segment littéral | `18d40f555e45314ec8ebb5fcefd2acf51eb60fb68bb041fc380be7fa606513ea` |
| SHA-256 de l'AST avec positions | `9567635f90b493b8e88b163bea41842064ff429f5ea4f171fabad2e8e9c17523` |
| Doubles déclarés | stockage `memory.put/get` et conteneur de propriétés `strategy_router` |
| Fonctions de décision exécutées | le vrai `at_boundary` et les instructions originales d'enrichissement |
| Exécution intégrale du runtime historique | non |

Le double de mémoire enregistre les écritures sans fournir une décision.
Le conteneur du routeur expose les contacts et les miroirs exigés par le
fragment. Les cas boundary déclarent leur arbre de cible et leur frontière
comme prémisses. Des variantes d'historiques d'événements sont également
déclarées pour tester les ambiguïtés, les époques étrangères et les refus.

Le cas positif possède en plus une chaîne de contacts réellement produite
par `MorphologyAdapter.propose` et `MorphologyAdapter.record` sur les rasters
publics. Le test natif rejoue lui-même `propose` et `record` avant de consulter
`stationHypothesisFor` ; il ne lui installe pas le résultat attendu.

## Raccord natif

`NativeCallerCoordinator` conserve le propriétaire déjà existant
`targetMethod`, dans son checkpoint `caller:counters` et la mémoire raisonnée
`target_method`. `boundaryWitness` accepte une lecture pure facultative
`(method, witness) => station | null`. Cette lecture enrichit la méthode avant
son unique écriture. Elle n'appelle pas une seconde fois `at_boundary`.

`NativeMorphologyFamily.stationHypothesisFor` lit exclusivement les contacts
acquis. `Context.targetMethod()` lit le propriétaire du caller au moment de
la proposition. Les vues `entryMethod` et `stationMethod` sont dérivées de
cette lecture ; elles ne deviennent pas de nouveaux champs persistés dans
la famille.

L'ordre de proposition reste celui de `MorphologyAdapter.propose` :

1. Mesurer l'observation courante, les routes et la réserve via les
   propriétaires existants.
2. Essayer la reprise de `entry_access_return`.
3. Si le contrôle n'est pas attesté et qu'une méthode existe, essayer
   `entry_rebind.approach`.
4. Filtrer les actions indisponibles, puis construire l'extension de cible.
5. Évaluer la politique morphologique et construire la proposition.

`record` traite le retour d'approche avant le refus générique d'acquisition
des préfixes `access_phase == 'approach'`. Il exige le dernier pas, un probe
différé, une époque inchangée et conforme au plan, un score inchangé entre
les observations et la bonne empreinte d'arrivée. L'événement contient la
référence de départ du plan, celle du retour, le plan différé et
`return:<trial>:<observation_ref>`.

La garde d'un `entry_probe` revalide le contour inédit, la surface de retour
et la disponibilité de l'action de retraite, en plus des gardes communes.
La continuation exige au moins deux actions restantes et une réserve
mesurée d'au moins deux pas. Elle conserve ses risques et sa qualification
conditionnelle dans le plan source.

## Checkpoints et refus

La famille utilise `native.current_morphology.v2`, avec six champs :
`format`, `journal`, `contacts`, `tried`, `feature_trials`,
`entry_access_return`. Le journal acquis reste le moyen de reconstruire
la projection. La restauration compare toute la projection rejouée au
checkpoint avant de remplacer l'état vivant.

Le lecteur accepte également le format v1 historique à cinq champs. Sa
projection v2 ajoute seulement `entry_access_return: null`. Il n'invente
aucune acquisition. Un ancien format contenant un journal de retour
d'entrée nouveau est refusé, puisque sa projection déclarée ne correspond
plus au replay.

Les tests refusent atomiquement une projection de retour supprimée ou
altérée, un événement dont le digest ne correspond plus, un doublon
d'identité de journal et une déclaration legacy incompatible. Ils vérifient
également qu'une relecture externe ne peut modifier les contacts détenus,
qu'un retour sélectionné répété ne s'acquiert pas deux fois et qu'une simple
proposition ne supprime pas l'événement de retour.

L'original ne propose pas ici de format de checkpoint général. Ces tests
établissent la restauration de la représentation native et la conservation
des projections originales ; ils ne revendiquent pas une équivalence avec
un mécanisme de restauration inexistant dans `MorphologyAdapter`.

## Couverture mesurée des contrats

`node --test tests/v6-morphology-methods-reference.test.ts` exécute 39 tests :

| Ensemble | Couverture |
| --- | --- |
| Provenance | 1 test : positions/hash du fragment, générateur et entrées, fonctions réellement exécutées, sources V5/V6 |
| Frontière/méthode | 15 cas : entrée unique, absence, ambiguïté, époque, pair préservé, référence d'effet, absence de filtre supplémentaire de paire et 8 refus de méthode |
| Acquisition locale indépendante | 1 test : vraie proposition/retour, enrichissement du caller, propriété unique, lecture pure et migration v1 |
| Rappel des directions | 7 cas : succès à une nouvelle époque et refus de portée/composition/alignement/rôle |
| Chaîne complète adapter | 1 test : approche de 3 pas, retour acquis, checkpoint/restauration, probe reprenant le bon parent |
| Gardes du probe | 7 cas : géométrie originale, contour, retraite, disponibilité de chaque commande, époque et observation |
| Retours d'approche | 6 cas : retour final, préfixe incomplet, absence de probe différé, époque, score et empreinte |
| Intégrité de restauration | 1 test : cinq corruptions atomiquement rejetées |

Le scénario de continuation n'injecte pas sa proposition ni ses facts.
Il fournit une méthode historique explicitement déclarée et un historique
public de mouvements. L'adapter original calcule son propre `entry_rebind`,
puis acquiert le retour de ses trois pas observés et produit `entry_probe`.
Un vrai `ObservedMeter` source observe une bande publique décroissante : la
prévision vaut neuf pas au départ, six au retour, et le probe conserve cinq
pas de réserve. Le test natif compare la proposition entière, chaque garde,
chaque réponse et chaque acquisition aux résultats originaux.

L'export contient les empreintes des 59 fichiers source utilisés, dont les
consommateurs et interprètes V5 réellement importés par V6. Les anciennes
fixtures 2A/2B restent inchangées. Les scénarios synthétiques ne sont pas un
nouveau jeu réussi et n'annoncent aucun niveau accompli dans une campagne.

## Comparaison passive des campagnes

Le comparateur accepte les checkpoints v1 et v2. Il reconstruit les
observations et les historiques depuis le journal public effectivement
capturé. Le compteur et les preuves de collection originaux repartent à
froid et rejouent leurs appels capturés ; leur état natif n'est pas installé
comme résultat attendu.

Pour v2, chaque appel `propose` apporte la vue capturée du `targetMethod`
détenu par le caller. Cette vue doit être identique au propriétaire scellé
à la fin du préfixe précédent. Elle devient la dépendance externe
`entry_method`/`station_method` du composant source. Elle ne fournit aucune
décision, route ou fait attendu : tous sont recalculés par les originaux.
L'acquisition de cette méthode par le caller historique complet reste hors
du périmètre de ce comparateur.

`entry_access_return` repart à `None` et doit être acquis uniquement par les
appels `record` originaux. Il est comparé avant et après chaque appel, dans
les checkpoints et dans le journal reconstruit. Les routes `entry_rebind`,
`entry_probe` et `managed_access` ne sont plus exclues. Les anciennes
captures sans vue de méthode restent compatibles en v1 avec des vues nulles.

## Chaîne observée dans la campagne LS20 du lot 2C

Le dossier `docs/migration/lot2c-evidence/final/ls20-method-continuation/`
contient les captures finales et les deux reçus spécialisés :

- `ls20-method-continuation-attribution-v2.json` : index passif, pointeurs JSON
  et comptage des extensions dans toutes les décisions, y compris les
  abstentions ;
- `ls20-method-continuation-attribution.json` : premier reçu dérivé préservé ;
- `ls20-method-continuation-attribution-lineage.json` : lien byte-à-byte entre
  les deux reçus et les deux copies archivées exactes de l'extracteur ;
- `ls20-morphology-original-comparison.json.gz` : comparaison avec l'adapter
  original, statut `passed`, sans tolérance ni changement des décisions.

La source native gelée est 0.35.0 : 242 fichiers, digest
`3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779`.
La campagne observe trois niveaux accomplis en 142 actions et 58 préfixes
scellés, répartis en 17, 67 et 58 actions sur les trois niveaux sources.
Elle s'arrête à l'objectif demandé, au niveau public 4 avec l'état
`NOT_FINISHED` ; aucun `WIN` final du jeu complet n'est revendiqué.

| Lien capturé | Observation et référence dans le rapport |
| --- | --- |
| Méthode acquise au premier score | Action 17, `/prefixes/10/morphologyOwnership/targetMethod` ; effet sélectif, époque source et retour de score concordent |
| Station enrichie | Une unique entrée acquise satisfait le filtre historique dans le checkpoint du même préfixe |
| Consommation de la méthode | 47 appels `propose` relisent cette méthode et son hypothèse de station |
| Approches et accès sélectionnés | 2 `entry_rebind`, 1 `entry_probe`, 14 `managed_access` |
| Retour d'approche acquis | Après l'action 91, `/prefixes/41/morphologyOwnership/nativeCheckpoint/journal/18`, également présent dans `/morphologySourceCalls/197` |
| Reprise du parent | `/prefixes/42/morphologyOwnership/proposal` nomme exactement le `return_ref` acquis ; l'observation et l'époque concordent |
| Extension conservée au probe | `remaining_alignment`, `currently_bound: false`, `release_authority: false` ; sa présence n'accorde aucune autorité supplémentaire |

L'extracteur n'observe aucune anomalie dans ces liens. Cela établit leur
présence et leur cohérence dans cette exécution. La contribution causale
exclusive d'une branche n'est pas déduite de sa participation.

La portée des extensions de cible est mesurée séparément des offres et des
libérations. Sur 58 décisions morphologiques évaluées, 42 portent une
extension et 16 n'en portent pas :

| Type d'extension | Actuellement liée, offre produite | Actuellement liée, abstention | Non liée, offre produite | Non liée, abstention |
| --- | ---: | ---: | ---: | ---: |
| `remaining_alignment` | 9 | 6 | 9 | 16 |
| `observed_derivation` | 1 | 0 | 1 | 0 |
| Total | 10 | 6 | 10 | 16 |

Les 30 offres morphologiques sont toutes sélectionnées dans cette capture.
Vingt de leurs propositions portent une extension : dix liée et dix non
liée ; les dix autres n'en portent pas. Les dix extensions liées des
propositions sélectionnées accompagnent huit `managed_access`, un
`capacity_probe` et un `feature_probe`. Les préfixes concernés sont 29, 30,
32, 33, 35, 48, 51, 52, 53 et 55 ; le type `observed_derivation` lié se trouve
au préfixe 35.

Les six autres extensions liées accompagnent une abstention, avec
`route_key: null` et `result: null`, dans les appels morphologiques 72, 74,
76, 78, 80 et 82. Le champ `currently_bound` ne certifie donc ni une offre,
ni une action libérée. Les 42 extensions portent toutes
`release_authority: false`. L'extension `remaining_alignment` du probe
d'entrée, au préfixe 42, est consommée comme contexte de raisonnement tout
en restant non liée. Les autorisations et les retours des actions réelles
restent ceux du protocole commun.

La comparaison originale vérifie les 143 paquets publics, 600 appels du
contexte partagé et 312 appels morphologiques : 58 propositions, 112
retours sélectionnés et 142 observations de départ. Elle reconstruit
1 128 transitions d'historiques et compare 58 ensembles de facts/décisions
ainsi que 58 checkpoints. Les 30 offres et 28 abstentions concordent ;
les 27 événements sélectionnés, dont le retour d'entrée, et les 112
réponses d'actions sélectionnées concordent également. Les 1 786 fichiers
originaux sont inchangés avant et après cette comparaison.

Le reçu de comparaison fait 86 460 octets, SHA-256
`675533dd1a5719beba94b3b655e82a1174ec69844ec283ca13897b25234b39be`.
Sa portée reste celle du composant avec les vues du propriétaire de méthode
capturées. La parité intégrale du caller historique demeure ouverte.

## Réutilisation de la baseline 0.34

Le fichier `docs/migration/lot2b-evidence/performance/after.json.gz` est une
baseline réutilisable pour comparer la suite 2C au natif 0.34. Son inventaire
est celui de la source publiée 62 : 240 fichiers, digest
`17252e294212a1563b75037a0b0dd782c2ecbc8cc4e1997a4f2bb2103bdf4e8b`.
Le reçu indique une source inchangée et les empreintes du runner et des
entrées correspondantes. Sa fenêtre mesurée est le 9 novembre 2026,
19:42:11–19:51:27 UTC.

La comparaison doit conserver le runner, les cas, l'environnement et le
chemin d'entrée `docs/migration/lot2b-evidence/performance/cases.json`.
Le comparateur vérifie aussi les chemins des entrées ; copier les mêmes
cas vers un autre chemin rendrait ce reçu différent. Une copie de la
baseline peut avoir son reçu de transport, tout en conservant son origine.
Elle doit être présentée comme une mesure antérieure réutilisée, pas comme
une nouvelle mesure 2C. Cette réutilisation ne relève aucun seuil de coût et
ne permet pas de neutraliser un dépassement en l'attribuant au bruit.
