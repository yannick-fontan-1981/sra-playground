# Lot10C : contrat source de OrderedRecruitment

## Périmètre de la référence indépendante

L’oracle exécute les fonctions Python originales du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, sous `reference/v6/…/source`. Les 1 786 fichiers du manifeste original sont contrôlés intégralement avant et après chaque génération. Les 726 fichiers effectivement importés ou exécutés, ainsi que `recruitment.drm` et `recruitment.src`, ont leurs empreintes conservées dans `sourceHashes`. Les 4 389 fonctions originales réellement profilées sont conservées dans `executedSourceFunctions`, avec leur nombre d’appels.

Les sources principales sont les quatre modules V6 `morphology_policy/ordered_recruitment/{geometry,projection,family,policy}.py`, leur DRM/SRC, et le composant consommé V5 `capabilities/ordered_front_reduction_d.py` avec `mechanical_family_contracts_d.py`. L’oracle ne lit aucune sortie native pour produire un résultat attendu. Il n’importe aucun moteur de jeu et ne lance aucune partie. Le contrôle de cette famille ne vaut pas parité de l’ensemble des callers V6, ni réussite d’un niveau.

Le générateur est `scripts/export-v6-ordered-recruitment-reference.py`. La fixture livrable est `tests/fixtures/v6-ordered-recruitment-reference.json.gz`. Le consommateur natif est `tests/v6-ordered-recruitment-reference.test.ts`. Les résultats complets, y compris état, plan, trace de consommation, garde, empreinte DRM et reçu SRC, sont comparés sans supprimer de champs.

## Construction géométrique indépendante

Les rasters sont construits à partir des contraintes visibles des fonctions originales : paires de carrés de tailles 3 et 2 dans la légende, glyphes à pointe et ailes symétriques, compartiments rectangulaires de même forme, deux camps de lattices 3 × 3 au pas 2, marqueur de front et boutons typés de mêmes dimensions. Les coordonnées de la spirale d’entrée sont calculées indépendamment en triant les anneaux et leur position sur le contour. Les mesures attendues viennent ensuite uniquement de `geometry.measure` et de ses helpers originaux.

La palette de test comprend les paires `(2,3)`, `(10,11)` et `(12,13)`. Ces valeurs éprouvent notamment les clés entières supérieures à 9 dans `measurement.types`. Elles ne sont pas une table de couleurs productive. Le digest Python trie ces clés comme des entiers avant la sérialisation ; la comparaison native doit préserver ce contrat même après transport JSON.

Les variantes couvrent dispositions horizontale/verticale, translation, liens pleins ou creux, direction du glyphe distincte de l’ordre de progression, ordre conservé ou inversé, salle active intérieure avec/sans ordre, deux salles actives, absence de salle active, trous de file, marqueur manquant/surnuméraire, lattice incomplète, bouton/légende/lien manquants et 0 à 8 pour la spirale. Une mesure reconnaît des hypothèses de structure ; elle n’acquiert pas la loi complète de l’ordre ou de progression.

## Acquisition, décisions et restauration

L’état source comprend exactement sept champs : `epoch`, `order`, `methods`, `portable`, `attempts`, `continuation`, `last`.

À froid, sans contraste réel acquis, la famille ne propose pas. La calibration retenue par l’original exige un passage observé COMBAT→RECRUIT dans la même salle, avec queue alliée inchangée, un ennemi devenu absent et une relation de légende unique compatible. Le reçu conserve la commande réellement transmise et les deux observations. L’identité du jeu ou de la commande ne remplace pas ce contraste : un cas source distinct conserve aussi une commande étrangère et un autre la représentation `{data:{}}`.

Le scénario destiné au noyau commun part de `kernelCold.initialRows`, avec uniquement ACTION5 disponible et un budget initial 9. La commande primaire est celle effectivement observée par le responsable dans le runtime froid : `{action_ref:'ACTION5'}`. Le retour fourni est une nouvelle observation publique en phase RECRUIT, quota 1. La méthode acquise par l’appel original rend possible une affectation de type 1, puis le retour public suivant place la queue `[0,1]` dans la seconde salle contre l’ennemi de type 2. La continuation ne contient alors que l’engagement. Aucun état appris provenant d’une partie ou du natif n’alimente cette référence ; les branches différentielles restaurent uniquement les états déjà retournés par les appels originaux précédents.

La fixture conserve les appels et états complets sous `kernelCold.{cold,passive,offers,proposal,admitted,append,continuation,noEffect,passiveNoChange}`. Les rasters et observations sont explicites. `noEffect` utilise la révision 3 sur le raster de recrutement inchangé ; `passiveNoChange` utilise la révision 2 sur le raster initial inchangé. La frontière suivante est conservée sous `kernelPortable.{newRows,newObservation,boundary,proposal}`.

Une frontière déplace les méthodes dans `portable` avec l’autorité explicite `revisable_method_not_current_permit`. Elle remet à zéro l’ordre, les méthodes courantes, les tentatives et la continuation. Une proposition ultérieure doit mesurer à nouveau la scène, correspondre à la signature et être liée à l’observation actuelle. Les anciennes gardes refusent l’époque suivante. La restauration est comparée champ par champ et les copies ne doivent pas partager leurs objets mutables avec l’appelant.

## Projection et composant V5 réellement consommé

La projection classe les types par la légende courante et passe de vrais objets `DuelOccurrenceD`, `HeadDuelRuleD` et `OrderedFrontReductionRequestD` à `measure_ordered_front_reduction_d`. Les résultats V5 complets sont conservés : scope, cause, domaine complet/incomplet, queues restantes, ordre des consommations, curseur, frontière de reprise et faits descriptifs. Les opérations sont internes ; aucun nouvel input externe ou débit d’action n’est inventé par la projection.

Le corpus couvre gagnant gauche/droite, quatre règles d’égalité, KEEP/ADD_ONE/SET pour le rang, duel unique, files vides, suffixes consommés, signature et domaine incomplets, relation de tête absente, bornes de nœuds/profondeur/temps, reprise exacte et erreurs de commande, digest, ordre ou curseur. Il contrôle les normalisations de modèles, doublons, camps incompatibles, champs supplémentaires, coercitions et mappings vides. Le digest d’entrée de reprise est comparé séparément.

Toutes les salles visibles contribuent au résultat projeté. Le cas à trois salles avec quota requis absent dans une salle future ne peut pas produire un plan terminal. Un autre cas à trois salles et quota 2 produit des queues survivantes identiques par des chemins différents ; le profileur d’appels originaux constate 31 accès à la réduction, 28 appels au noyau V5 et 3 réutilisations du cache local. Les compteurs `sourceReductionLookups`, `sourceKernelCalls` et `sourceCacheHits` décrivent cette exécution originale, pas une mesure de performance du natif.

L’incomplétude reste explicite. Par exemple, avec borne de recherche 3, l’original conserve un plan déjà trouvé mais indique `visited:4` et `truncated:true`. Le chemin de parité source conserve exactement ce résultat. La politique native coopérative doit traiter une recherche interrompue comme une question encore ouverte ; ce résultat partiel ne devient pas une preuve d’impossibilité ou un permis de relâcher une action.

## Politique DRM et workflow SRC

Les quatre conditions exigées sont `actual_interface_contrast`, `current_scene_revalidated`, `conditional_parent_survival` et `untried_context`. Le classement original porte successivement sur priorité du type d’offre, coût, nombre décroissant de survivants et indice d’énumération. `continuation` précède `composition_question`. Les égalités complètes gardent la première offre. Les cas de faits absents/faux, d’égalité Python entre 1 et True et de chaîne `"true"` sont conservés.

Le choix provient du vrai workflow `v6.ordered_recruitment.choose` et de son appel `recruitment.select`. L’oracle conserve les quatre champs du reçu SRC et le `drm_hash`. Un résultat sélectionné garde `release_authority:false`. Une proposition possède cinq champs dans `recruitment_plan` et onze champs dans l’offre. La garde recalcule l’offre actuelle complète ; elle refuse notamment portée changée, indice non nul, payload modifié, scène différente ou deux offres identiques à la place d’une correspondance unique.

## Horloges et frontières nommées

Pour la projection pure, la dépendance externe `mechanical.monotonic` est temporairement fixée à 0 afin d’obtenir un travail fini déterministe. Les cas de borne temporelle fournissent leur séquence de millisecondes et conservent le nombre d’appels réel. Aucun fichier original n’est modifié. Cela ne mesure ni coût ni durée d’une session.

Deux frontières natives restent distinctes de la parité source : rang entier supérieur à la précision sûre JavaScript et digest générique contenant 2.5. Python accepte ces entrées et son résultat exact est conservé dans `nativeAdaptationCases`; le domaine canonique natif déclaré les refuse par TypeError. `recruitmentDigest` n’est donc pas présenté comme un remplacement général de `json.dumps` Python. Les mesures, configurations et chemins productifs de cette famille utilisent les entiers exacts du domaine portable.

## Conservation des essais

Le répertoire `oracle/` conserve les sorties brutes et snapshots de générateur des essais successifs. Le premier probe géométrique a réellement échoué à cause de proportions incohérentes dans le glyphe synthétique ; le probe suivant a reconnu les cinq constructions après correction des entrées. Le premier test natif a été bloqué avant les cas par une parameter property TypeScript incompatible avec le mode strip-only de Node. L’essai suivant a passé 165/167 tests et conservé deux écarts : await manquant dans un test de restauration et le domaine fractionnaire ci-dessus.

Les fixtures précédentes ne sont pas écrasées. Elles sont retenues avec reçu de relocalisation. Les générations supplémentaires ont été nécessaires pour des observations/révisions exactes du noyau commun, le cas de cache et les normalisations, puis pour remplacer une inférence statique de commande par la primitive réellement observée. Les attendus n’ont jamais été corrigés à partir d’une sortie native ; chaque nouvelle entrée a été soumise à nouveau aux originaux.

## Candidat issu du seul catalogue public

Le catalogue `src/games/catalog.ts` contient **RECR**, titre **Recruit Army**, description : «Recruit an ordered squad between battles to clear successive enemy rooms.» Cette correspondance justifie seulement de proposer ce candidat au responsable de livraison. Aucun moteur, asset ou spécification privée de ce jeu n’a été inspecté ici ; aucune partie n’a été lancée. L’ouverture et le suivi du budget cumulé de 40 minutes appartiennent au responsable avant toute analyse spécifique du cas.

## Validation actuelle

La génération finale 05 a réussi et le test ciblé 03 a passé **173/173 tests**, sans échec, annulation ou omission. Le TAP conserve une durée de 1 469,120703 ms. Les reçus correspondants sont `oracle/reference-05.execution.json` et `oracle/reference-tests-03.execution.json`, avec leurs sorties brutes inchangées.

La fixture finale contient 166 cas : 46 géométriques, 25 projections, 33 cas de famille, 16 cas DRM/SRC, 27 réductions V5, 17 normalisations et 2 frontières natives nommées. Trois résumés source et quatre contrôles de provenance/cache/état complètent les 173 tests. Sa taille est 1 008 627 octets et son SHA-256 est `bfcc4444286bd5a55252eacd11f6cdc06cbf0163924796a9debef302586f2460`. Le présent contrat ne remplace ni la validation intégrée, ni un contrôle navigateur, ni une comparaison originale sur un jeu réel, ni le coût global, ni une publication.
