# Progression vérification OP01 à OP31 du Logos Engine

## État du chantier

- Branche de travail : `op01-op31-c0-c7-audit`
- Dépôt GitHub accessible : `yannick-fontan-1981/sra-playground`
- Base GitHub de la branche : `8f8b179718d06a51dc8818deb68c977cd5e1e820`
- Baseline de référence du plan : `8462204043aa368faa7df280d796bb706eb53b38` (checkout 0.67 consulté lors de la préparation du plan)
- Divergence importante : le commit `8462204…` et les chemins `src/logos-engine/v6-*` ne sont pas présents dans l'historique/branche GitHub actuellement visible de `sra-playground`. Les qualifications C0 ci-dessous s'appuient donc sur les preuves explicitement consignées dans le plan persistant ; elles ne sont pas étendues au-delà de leur portée.
- Plan stable dans le dépôt : `docs/migration/op01-op31-verification-plan.md`

## C0 — inventaire et contrats

Statut : **terminé au niveau audit documentaire borné ; reprise sur checkout runtime nécessaire avant C1**.

### Règles de qualification utilisées

On distingue : (1) calcul couvert par l'implémentation/fixtures, (2) routage dans le pont de test, (3) appel runtime explicite, (4) résultat lu par un consommateur, (5) contribution démontrée à une décision. Les niveaux 4 et 5 ne sont jamais inférés d'une simple trace.

### Registre des 31 opérations

| OP | Nom | Lot | Besoin | Producteur runtime | Appel runtime | Consommateur attendu | Preuve disponible | Limite / manque | Disposition C0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OP01 | Inventorier | C4 | regroupement de compositions | à identifier/valider dans runtime | non démontré | sélecteur/index | implémentation + fixtures de référence (S1/S2); oui (analysis-OP01) | aucun appel runtime démontré | usage runtime non démontré |
| OP02 | Équivalence | C4 | équivalence de chemins | à identifier/valider dans runtime | non démontré | sélection de chemins | implémentation + fixtures de référence (S1/S2); oui (analysis-OP02) | aucun appel runtime démontré | usage runtime non démontré |
| OP03 | Préconditions | C3 | vérifier les conditions d'une composition | à identifier/valider dans runtime | non démontré | admission/plan | implémentation + fixtures de référence (S1/S2); oui (analysis-OP03) | producteur absent sur le chemin matériel historique S6 | besoin requis non raccordé / producteur manquant |
| OP04 | Ouvertures | C3 | relier effets et exigences | à identifier/valider dans runtime | non démontré | planificateur | implémentation + fixtures de référence (S1/S2); oui (analysis-OP04) | aucun appel runtime démontré | usage runtime non démontré |
| OP05 | Ambiguïtés | C4 | préserver des alternatives au même effet | à identifier/valider dans runtime | non démontré | décideur/stratégie | implémentation + fixtures de référence (S1/S2); oui (analysis-OP05) | aucun appel runtime démontré | usage runtime non démontré |
| OP06 | Exceptions | C5 | confronter retour et effet attendu | à identifier/valider dans runtime | non démontré | propriétaire du modèle | implémentation + fixtures de référence (S1/S2); oui (analysis-OP06) | aucun appel runtime démontré | usage runtime non démontré |
| OP07 | Frontières | C5 | explorer une frontière liée à une question | à identifier/valider dans runtime | non démontré | choix d'exploration | implémentation + fixtures de référence (S1/S2); oui (analysis-OP07) | aucun appel runtime démontré | usage runtime non démontré |
| OP08 | Prédécesseurs | C3 | trouver un préalable à une exigence manquante | à identifier/valider dans runtime | non démontré | stratégie | implémentation + fixtures de référence (S1/S2); oui (analysis-OP08) | producteur effect/requires absent sur le chemin matériel historique S6 | besoin requis non raccordé / producteur manquant |
| OP09 | Obligatoires | C3 | extraire les préalables communs à toutes les alternatives | à identifier/valider dans runtime | non démontré | stratégie | implémentation + fixtures de référence (S1/S2); oui (analysis-OP09) | domaine complet non démontré | usage runtime non démontré |
| OP10 | Finaux | C4 | identifier les objectifs terminaux déclarés | à identifier/valider dans runtime | non démontré | choix de cible/contrôle de fin | implémentation + fixtures de référence (S1/S2); oui (analysis-OP10) | producteur d'objectifs non qualifié ici | usage runtime non démontré |
| OP11 | Déblocages | C3 | relier compositions qui satisfont d'autres conditions | à identifier/valider dans runtime | non démontré | stratégie | implémentation + fixtures de référence (S1/S2); oui (analysis-OP11) | aucun appel runtime démontré | usage runtime non démontré |
| OP12 | Inconnues | C3 | identifier une dépendance bloquée par information absente | à identifier/valider dans runtime | non démontré | plan/stratégie d'acquisition | implémentation + fixtures de référence (S1/S2); oui (analysis-OP12) | producteur depends_on/requires absent sur le chemin matériel historique S6 | besoin requis non raccordé / producteur manquant |
| OP13 | Portée des effets | C5 | borner la portée connue d'un effet | à identifier/valider dans runtime | non démontré | modèle/garde | implémentation + fixtures de référence (S1/S2); oui (analysis-OP13) | aucun appel runtime démontré | usage runtime non démontré |
| OP14 | Contraintes | C3 | préserver des propriétés pendant une composition | à identifier/valider dans runtime | admission générique seulement | filtre/garde | implémentation + fixtures de référence (S1/S2); oui (analysis-OP14) | admission générique documentée mais pas admise par release S4; contribution non démontrée | routage générique sans usage runtime qualifié |
| OP15 | Intermédiaire | C4 | choisir un objectif intermédiaire déclaré | à identifier/valider dans runtime | non démontré | sélecteur d'objectif | implémentation + fixtures de référence (S1/S2); oui (analysis-OP15) | aucun appel runtime démontré | usage runtime non démontré |
| OP16 | Blocages | C6 | traiter un blocage global prouvé | à identifier/valider dans runtime | non démontré | décideur/reprise | implémentation + fixtures de référence (S1/S2); oui (analysis-OP16) | producteur de deadlocks non qualifié ici | usage runtime non démontré |
| OP17 | Reprise | C6 | sélectionner une reprise autorisée | à identifier/valider dans runtime | non démontré | sélecteur/exécution | implémentation + fixtures de référence (S1/S2); oui (analysis-OP17) | producteur recovery non qualifié ici | usage runtime non démontré |
| OP18 | Explorer | C2 | expérimenter une composition non observée liée à une question | à identifier/valider dans runtime | oui explicite | autorité/admission puis acquisition du retour | implémentation + fixtures de référence (S1/S2); oui (analysis-OP18) | appel explicite dans release S4; contribution décisionnelle à démontrer | appel sans contribution établie |
| OP19 | Pas forcés | C6 | exécuter un préfixe de pas réellement forcés | à identifier/valider dans runtime | non démontré | consommateur d'exécution | implémentation + fixtures de référence (S1/S2); oui (analysis-OP19) | producteur de preuves forced non qualifié ici | usage runtime non démontré |
| OP20 | Utilité des objets | C5 | traiter l'utilité inconnue d'un objet si décisionnelle | à identifier/valider dans runtime | non démontré | stratégie/hypothèse | implémentation + fixtures de référence (S1/S2); oui (analysis-OP20) | aucun appel runtime démontré | usage runtime non démontré |
| OP21 | Utilité des espaces | C5 | traiter l'utilité inconnue d'un espace | à identifier/valider dans runtime | non démontré | stratégie/exploration | implémentation + fixtures de référence (S1/S2); oui (analysis-OP21) | aucun appel runtime démontré | usage runtime non démontré |
| OP22 | Effets distants | C5 | intégrer un effet distant observé | à identifier/valider dans runtime | non démontré | modèle/contraintes | implémentation + fixtures de référence (S1/S2); oui (analysis-OP22) | aucun appel runtime démontré | usage runtime non démontré |
| OP23 | Autonomes | C5 | prévoir une évolution autonome prouvée | à identifier/valider dans runtime | non démontré | plan | implémentation + fixtures de référence (S1/S2); oui (analysis-OP23) | aucun appel runtime démontré | usage runtime non démontré |
| OP24 | Détours | C6 | filtrer des chemins alternatifs | à identifier/valider dans runtime | non démontré | choix de plan | implémentation + fixtures de référence (S1/S2); oui (analysis-OP24) | générateur de chemins non qualifié ici | usage runtime non démontré |
| OP25 | Choisir une cible | C4 | filtrer plusieurs compositions candidates à un objectif | à identifier/valider dans runtime | non démontré | décideur de cible | implémentation + fixtures de référence (S1/S2); oui (analysis-OP25) | aucun appel runtime démontré; non réfuté != faisable | usage runtime non démontré |
| OP26 | Accès admissible | C3 | sélectionner un accès vérifié à une cible | à identifier/valider dans runtime | non démontré | admission/gardes | implémentation + fixtures de référence (S1/S2); oui (analysis-OP26) | producteur accesses absent sur le chemin matériel historique S6 | besoin requis non raccordé / producteur manquant |
| OP27 | Permutations | C6 | filtrer des organisations alternatives avec préservation | à identifier/valider dans runtime | non démontré | plan | implémentation + fixtures de référence (S1/S2); oui (analysis-OP27) | générateur de permutations non qualifié ici | usage runtime non démontré |
| OP28 | Réaliser | C2 | libérer un bundle courant admis et non vide | à identifier/valider dans runtime | oui explicite | autorité release | implémentation + fixtures de référence (S1/S2); oui (analysis-OP28) | appel explicite dans release S4; possible redondance avec admission amont à trancher | appel sans contribution établie |
| OP29 | Comparer | C2 | comparer retour observé et attentes du même événement | à identifier/valider dans runtime | oui explicite | modèle/garde/décideur potentiel | implémentation + fixtures de référence (S1/S2); oui (analysis-OP29) | appel explicite postAnalysis S4; lecteur décisionnel non identifié | appel sans contribution établie |
| OP30 | Réviser | C2 | filtrer des mises à jour de connaissance étayées et de bonne révision | à identifier/valider dans runtime | oui explicite | propriétaire autorisé du modèle | implémentation + fixtures de référence (S1/S2); oui (analysis-OP30) | appel explicite postAnalysis S4; persistance/apprentissage effectif non démontré | appel sans contribution établie |
| OP31 | Réexaminer | C2 | réévaluer le statut d'un objectif à partir de nouvelles preuves | à identifier/valider dans runtime | oui explicite | décideur d'objectif | implémentation + fixtures de référence (S1/S2); oui (analysis-OP31) | appel explicite postAnalysis S4; effet sur maintien/fin/suspension/réorientation non démontré | appel sans contribution établie |

### Chaîne prioritaire C2 choisie pour C1

Chaîne témoin : **OP18/OP28 → retour → OP29 → OP30 → OP31**. Le plan établit que `release` accepte OP18 et OP28 et que `postAnalysis` appelle OP29, OP30 et OP31. Ce fait prouve l'existence d'appels, pas leur contribution. C1 doit donc capturer pour un même événement : besoin initial, données d'entrée, sélection/rejet, bundle libéré, retour attribué, résultats OP29/30/31, lecteur réel et effet sur la décision suivante.

Cas négatif obligatoire : une composition qui ne répond à aucune question ouverte ne doit pas déclencher OP18 ni préparer ses entrées coûteuses. Pour OP28, un bundle non admis ou sans actions doit être rejeté avant libération.

### Premier manque concret C3

Priorité : **OP03, OP08, OP12 et OP26**. La preuve S6 du plan indique que leurs producteurs sont absents sur le chemin matériel historique étudié. C1/C3 doit rechercher d'abord les fonctions spécialisées déjà présentes avant tout adaptateur : garde de précondition, graphe effect/requires, dépendances/inconnues, générateur/validation d'accès. Si une fonction spécialisée couvre déjà le besoin, elle sera enregistrée comme équivalent et non comptée comme appel OP.

### Besoins non raccordés / non prouvés détectés en C0

- Producteurs explicitement manquants sur le chemin historique : OP03, OP08, OP12, OP26.
- Appels existants sans contribution décisionnelle établie : OP18, OP28, OP29, OP30, OP31.
- OP14 : contrat d'admission générique présent, mais pas dans la liste `release` examinée ; usage décisionnel non démontré.
- Toutes les autres OP : calcul et routage de test disponibles, mais aucun usage runtime pertinent ne peut être affirmé avec les preuves C0 disponibles.

### Fonctions spécialisées équivalentes

Aucune équivalence ne peut être déclarée sur la seule base du plan. C1/C3 doit les rechercher dans le checkout runtime réel. Les candidats à examiner en premier sont les gardes/admissions existantes, la résolution de dépendances et les générateurs d'accès/chemins.

### Tests / preuves exécutés pendant C0

- Aucun test runtime ni benchmark relancé : C0 n'a modifié aucun chemin d'exécution.
- Vérification GitHub : les fichiers `src/logos-engine/v6-operations.ts`, `v6-native-authority.ts`, `v6-target-binding.ts`, `v6-composition-engine.ts`, `docs/migration/v6-delivery-roadmap.md` et `docs/migration/lot1-composition-return-lineage.md` sont absents de la branche publique accessible servant au checkout courant.
- Le plan persistant rapporte 126 cas de référence couvrant les 31 OP et 31 cas `analysis-OP01` à `analysis-OP31`, mais ces tests n'ont pas été relancés durant C0.

### Performance C0

Statut : **baseline/protocole définis ; benchmark non requis pour C0**.

- Critère : médiane de session complète strictement sous +10 % pour chaque jeu de référence séparément.
- Jeux de référence indiqués par le plan : STCK et SMLP.
- Baseline cumulative prévue : commit 0.67 `8462204…` ; elle doit être retrouvée dans le checkout runtime réel avant toute mesure C1.
- La branche GitHub actuelle `8f8b179…` ne contient pas le runtime v6 et ne peut donc pas servir de baseline de performance équivalente.

## Feuille de route actualisée

| Lot | État | Prochaine preuve concrète |
| --- | --- | --- |
| C0 | **terminé (audit documentaire borné)** | conserver ce registre et réconcilier avec le checkout runtime dès qu'il est accessible |
| C1 | **prochaine étape** | instrumenter légèrement OP18/OP28→OP29/30/31, besoin/non-besoin/cache/consommation, puis mesurer le surcoût |
| C2 | prêt après C1 | qualifier les cinq appels existants jusqu'à la décision suivante |
| C3 | prêt après C1 | rechercher fonctions spécialisées puis raccorder seulement les besoins prouvés OP03/04/08/09/11/12/14/26 |
| C4 | préparé | scénarios regroupements/objectifs OP01/02/05/10/15/25 |
| C5 | préparé | scénarios information/exploration OP06/07/13/20/21/22/23 |
| C6 | préparé | scénarios blocage/reprise/variantes OP16/17/19/24/27 |
| C7 | en attente | consolidation fonctionnelle et comparaison coût vs prédécesseur + baseline initiale |

## Prochaine étape concrète

**C1 : retrouver le checkout runtime contenant `src/logos-engine/v6-*`, puis ajouter une instrumentation légère autour de `execute`, du pont SRC, de `release/acquire` et de `postAnalysis` sans changer les décisions.** Premier rejeu : OP18/OP28 puis OP29→OP30→OP31, avec cas besoin présent, besoin absent et dépendance/révision invalidée.

## C1 — préparation du contrat de trace

Statut : **préparé ; intégration runtime non commencée**.

### Périmètre réellement couvert

Le contrat d'instrumentation est maintenant défini dans `docs/migration/op01-op31-c1-trace-contract.md`.

Il couvre :
- signal de besoin émis avant routage ;
- exécution, réutilisation cache, non-requis et blocage ;
- consommation réelle et effet sémantique ;
- identités épisode/époque/observation/révision ;
- invalidation sur observation, époque, focus, objectif/stratégie et révision ;
- sauvegarde/restauration ;
- bornes de trace et coûts à mesurer ;
- scénarios S-C1-1 à S-C1-5 ;
- chaîne témoin OP18/OP28 → OP29 → OP30 → OP31.

### Nouvelle vérification de provenance

Le dépôt privé `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan` expose bien une ligne V6/V7 : son `main` visible est le commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, message « Merge the V7 declarative prototype onto the V6 publication line ».

Ce commit correspond aussi au snapshot source cité par S2 pour les fixtures de parité, mais il ne contient pas aux chemins attendus les fichiers TypeScript `src/logos-engine/v6-operations.ts`, `v6-native-authority.ts`, `v6-target-binding.ts` et `v6-composition-engine.ts`. Le checkout de préparation du plan `8462204…` reste donc un checkout distinct non retrouvé dans les dépôts GitHub accessibles.

Cette divergence est conservée explicitement : le commit `786dcf51…` ne remplace pas silencieusement la baseline `8462204…`.

### OP qualifiées à ce stade

Aucune nouvelle OP n'est promue en « usage démontré ». C1 n'a pas encore observé de runtime instrumenté.

Les cinq OP prioritaires restent :
- OP18 et OP28 : appel runtime explicite selon les preuves C0 ;
- OP29, OP30 et OP31 : appel postAnalysis explicite selon les preuves C0 ;
- consommation et contribution : toujours à démontrer.

### Besoins démontrés / producteurs / consommateurs

Le contrat C1 fixe maintenant les producteurs et consommateurs à prouver, sans les déclarer existants :
- OP18 : question ouverte → admission/release → expérience ;
- OP28 : bundle admis → release → actions libérées ;
- OP29 : attentes + retour du même événement → modèle/garde/décideur ;
- OP30 : mises à jour étayées + bonne révision → propriétaire autorisé ;
- OP31 : assessment d'objectif → maintien/fin/suspension/réorientation.

### Appels utiles / appels sans effet démontré

Aucun appel nouveau n'a été ajouté.
Les appels C0 existants restent « sans contribution établie » tant que les événements `consumption` et leur effet décisionnel ne sont pas observés.

### Besoins non raccordés

Inchangés :
- OP03, OP08, OP12, OP26 : producteurs historiquement manquants à rechercher en priorité ;
- aucune fonction spécialisée équivalente n'est déclarée sans lecture du checkout runtime réel.

### Tests exécutés

- aucun test runtime ;
- aucune campagne de jeux ;
- aucune mesure de session ;
- vérification de présence des dépôts/branches et de la provenance V6/V7 via GitHub ;
- vérification que le checkout TypeScript attendu reste absent des chemins accessibles.

### Performance

Statut : **C1 préparé, coût non mesurable avant intégration runtime**.

Le protocole C1 est fixé : STCK et SMLP séparément, instrumentation off/on, diagnostic détaillé séparé, seuil médian de session complète strictement inférieur à +10 % par jeu. Une mesure concurrente devra être marquée non isolée.

### Feuille de route actualisée

| Lot | État | Prochaine preuve concrète |
| --- | --- | --- |
| C0 | **terminé** | conserver le registre et la baseline documentaire |
| C1 | **préparé, intégration runtime non commencée** | appliquer le contrat au checkout `src/logos-engine/v6-*`, exécuter S-C1-1 à S-C1-5 et mesurer le coût |
| C2 | **prêt après instrumentation C1** | démontrer consommation/contribution OP18/28/29/30/31 |
| C3 | **préparé prioritaire** | rechercher équivalents spécialisés OP03/08/12/26, puis raccorder les besoins prouvés |
| C4 | préparé | OP01/02/05/10/15/25 |
| C5 | préparé | OP06/07/13/20/21/22/23 |
| C6 | préparé | OP16/17/19/24/27 |
| C7 | en attente | consolidation fonctionnelle + coût prédécesseur et baseline C0 |

### Prochaine étape concrète

Retrouver ou publier dans le checkout de travail le runtime TypeScript correspondant au plan, puis appliquer sans adaptation sémantique le contrat C1 autour de `execute`, du pont SRC, de `release/acquire` et de `postAnalysis`.


## C1/C2 — preuves V6 donneuses ajoutées

Un relevé séparé est maintenant conservé dans `docs/migration/op01-op31-v6-donor-evidence.md`.

### OP qualifiées davantage

Ces preuves concernent le **runtime Python V6 donneur**, pas encore le port TypeScript :

- **OP18** : producteur spécialisé réel identifié dans `AlternatingGraphAccess.propose()`. Il produit question ouverte, plan, actions, préconditions, preuves, composition et `bundle_template.operation_key=OP18`; `admit()` revalide le contexte avant exécution.
- **OP28 / OP18 / OP14** : `operation_admission()` montre que la release physique est liée au résultat effectif de l'OP, pas à sa seule invocation.
- **OP30** : consommateur réel identifié. `composition.py::persist()` écrit les mises à jour retenues dans la mémoire avec valeur, preuve et révision.
- **OP29** et **OP31** : aucun consommateur spécialisé n'a été trouvé dans le cœur `composition.py` examiné ; statut toujours « consommateur décisionnel non établi », sans conclure à une absence globale.

### Besoins / producteurs / consommateurs démontrés

Sur le donneur Python V6 :
- besoin OP18 : question instrumentale d'accès graphe mesuré ;
- producteur : `AlternatingGraphAccess.propose()` ;
- consommateur de résultat physique : `operation_admission()` puis garde de release ;
- effet : `src_release()` ne publie l'action set que si la release a été autorisée ;
- consommateur OP30 : `persist()`, écriture de connaissance avec preuve/révision.

### Appels utiles et appels sans effet démontré

- OP18 : une chaîne utile donneuse existe jusqu'à la garde de release.
- OP30 : consommation de persistance démontrée dans le donneur, mais contribution à une décision future encore à prouver.
- OP29/OP31 : calcul présent ; effet décisionnel non démontré.
- Aucun nouvel appel n'a été ajouté dans sra-playground.

### Fonctions spécialisées équivalentes potentielles

Le donneur V6 expose des stratégies et accès spécialisés qui peuvent recouvrir des besoins C3, notamment `strategy.py`, `alternating_graph_questions.py` et `alternating_graph_access.py`.
Aucune équivalence OP03/08/12/26 n'est encore déclarée sans comparaison de contrat complète.

### Tests

Aucun test runtime sra-playground n'a encore été exécuté.
La progression supplémentaire vient d'une lecture directe du snapshot V6 publié `786dcf51…`.

### Performance

Inchangée : aucun chemin runtime sra-playground modifié. C1 reste **préparé, coût à mesurer après intégration**.

### Prochaine étape concrète

Poursuivre C1 sur le port TypeScript dès que le checkout `src/logos-engine/v6-*` est disponible. Les points d'instrumentation sont maintenant précisément dérivés du donneur : producteur avant bundle, exécution dans apply/execute, admission, release, puis consommation/persistance.


## C3 — recouvrement spécialisé OP03/OP08/OP12/OP26

Le détail est enregistré dans `docs/migration/op01-op31-c3-specialized-overlap.md`.

### Périmètre réellement couvert

Lecture ciblée du donneur Python V6 :
- `composition.py::validate_bundle()` ;
- `target_tree.py::extend_target()/bind()` ;
- `goal_access_adapter.py` ;
- `passage_options.py` ;
- `cell_placement_access.py` ;
- `alternating_graph_access.py`.

### OP qualifiées

- **OP03** : recouvrement partiel. La garde physique `validate_bundle()` vérifie les préconditions courantes, mais transforme une donnée absente en refus booléen au lieu de conserver `unknown`. Elle ne remplace donc pas OP03 pour le raisonnement tri-état.
- **OP08** : le target tree sait prolonger des cibles déclarées et vérifier les conditions de leurs enfants, mais aucun producteur générique effect→requires n'est démontré.
- **OP12** : les accès spécialisés préservent une incertitude `unknown_then_observe`, scellent le préfixe et déclenchent une acquisition avant continuation. Le parcours générique de dépendances reste distinct.
- **OP26** : plusieurs familles produisent puis revalident elles-mêmes leur accès juste avant exécution. Dans ces familles, rajouter OP26 comme seconde admission serait potentiellement redondant ; le besoin générique ne devient pertinent que pour un vrai domaine multi-accès.

### Besoins démontrés

- garde physique de préconditions : démontrée ;
- suspension/reprise sur effet d'accès inconnu : démontrée dans une famille spécialisée ;
- admission d'accès liée à époque/observation/action/surface : démontrée dans plusieurs familles ;
- recherche générique de prédécesseurs : non démontrée ;
- parcours générique des dépendances inconnues : non démontré ;
- filtre commun de plusieurs accès hétérogènes : non démontré.

### Producteurs / consommateurs

Producteurs spécialisés identifiés :
- target tree ;
- goal access ;
- passage options ;
- cell placement ;
- alternating graph access.

Consommateurs :
- admission/release locale des familles ;
- target tree pour continuité de cible et acquisition de contrôle.

### Appels utiles / sans effet démontré

Aucun appel OP03/08/12/26 n'a été ajouté.
Le donneur indique au contraire qu'un raccordement naïf pourrait dupliquer des gardes existantes.

### Fonctions spécialisées équivalentes

- OP03 : équivalent seulement pour la **garde physique booléenne**, pas pour le verdict tri-état.
- OP08 : recouvrement familial, pas équivalence générique.
- OP12 : équivalent familial pour l'inconnu d'accès, pas pour une chaîne arbitraire de dépendances.
- OP26 : équivalent spécialisé d'admission dans plusieurs familles ; sélection générique multi-accès non démontrée.

### Tests

Aucun test exécuté : lecture de code uniquement, sans modification runtime.

### Performance

Aucun coût ajouté. Statut C3 : **analyse de recouvrement avancée, intégration fonctionnelle non commencée**.

### Feuille de route actualisée

| Lot | État | Prochaine preuve concrète |
| --- | --- | --- |
| C0 | **terminé** | registre conservé |
| C1 | **préparé** | instrumentation du port TypeScript dès publication |
| C2 | **partiellement qualifié sur donneur** | retrouver lecteurs OP29/OP31 et prouver décision suivante |
| C3 | **recouvrement spécialisé qualifié pour 03/08/12/26** | chercher un besoin runtime non couvert avant tout raccordement |
| C4 | préparé | producteurs/consommateurs objectifs et regroupements |
| C5 | préparé | questions et informations réellement décisionnelles |
| C6 | préparé | blocages/reprises/variantes avec preuves |
| C7 | en attente | consolidation + performances |

### Prochaine étape concrète

Continuer C2 sur le donneur V6 : rechercher les consommateurs réels d'OP29 et OP31 et, pour OP30, une lecture ultérieure de la connaissance persistée afin de distinguer « persistance » de « contribution à une décision ».


## C2 — consommation donneuse qualifiée

Le détail est enregistré dans `docs/migration/op01-op31-c2-donor-consumption.md`.

### Périmètre réellement couvert

Lecture du cœur V6 donneur :
- `operations.py` ;
- `composition.py` ;
- `src_bridge.py` ;
- `composition_cases.py` ;
- `composition_benchmark.py`.

### OP qualifiées

- **OP18** : calcul, appel, consommation et contribution à la garde physique de release démontrés dans le donneur.
- **OP28** : calcul, appel, consommation et contribution à la garde physique de release démontrés dans le donneur.
- **OP29** : calcul + résultat exposé dans le rapport, mais aucun consommateur décisionnel interne démontré.
- **OP30** : résultat consommé par `persist()` et écrit en mémoire avec preuve/révision. Contribution à une décision future non démontrée.
- **OP31** : calcul + résultat exposé dans le rapport, mais aucun propriétaire d'objectif consommateur démontré.

### Besoins / producteurs / consommateurs

- OP18 : producteurs spécialisés réels → `src_apply()` → `operation_admission()` → garde release.
- OP28 : bundle admis → OP28 → `operation_admission()` → garde release.
- OP29 : expected/observed → résultat tri-état → rapport ; lecteur décisionnel manquant.
- OP30 : updates étayées/révision courante → OP30 → `persist()` → mémoire.
- OP31 : assessments → résultat → rapport ; lecteur objectif manquant.

### Appels utiles / appels sans effet démontré

- OP18/OP28 : effet de garde démontré.
- OP30 : effet d'écriture démontré, effet décisionnel futur non.
- OP29/OP31 : actuellement `information_only` dans le cœur examiné, sauf preuve d'un consommateur externe.

### Besoin non raccordé / dette de preuve détectée

Le benchmark V6 commente qu'il relit « un contrat et une mise à jour OP30 » après reopen, mais son code ne relit que `composition_contract`. La clé de connaissance OP30 n'est pas vérifiée après réouverture.

Dette C2 explicite :
- tester la survie de `knowledge:B:color` après reopen/restauration ;
- montrer ensuite une lecture décisionnelle, ou conserver la disposition « persistance seulement ».

### Tests exécutés

Aucun test relancé dans ce chantier.
Les constats viennent de la lecture directe du code et des cas/benchmarks existants.

### Performance

Aucun changement runtime sra-playground ; aucune nouvelle mesure requise.
Statut C2 : **qualification donneuse avancée, coût du port à confirmer après intégration**.

### Feuille de route actualisée

| Lot | État | Prochaine preuve concrète |
| --- | --- | --- |
| C0 | **terminé** | registre conservé |
| C1 | **préparé** | instrumenter le port TypeScript dès disponibilité |
| C2 | **qualifié sur donneur pour 18/28 ; partiel 29/30/31** | trouver lecteur OP29/31 ; prouver restauration + lecture future OP30 |
| C3 | **recouvrement spécialisé qualifié** | chercher besoins réellement non couverts avant raccordement |
| C4 | préparé | OP01/02/05/10/15/25 |
| C5 | préparé | OP06/07/13/20/21/22/23 |
| C6 | préparé | OP16/17/19/24/27 |
| C7 | en attente | consolidation + performances |

### Prochaine étape concrète

Poursuivre C2 en recherchant dans le donneur V6 :
1. un consommateur externe du rapport OP29 ;
2. un propriétaire d'objectif consommant OP31 ;
3. une lecture de `knowledge:<composition>:<property>` écrite par OP30.
Si aucun lecteur n'existe, documenter explicitement ces opérations comme sorties informationnelles/persistées sans contribution décisionnelle démontrée.


## C4 — regroupements et objectifs donneurs

Le détail est enregistré dans `docs/migration/op01-op31-c4-donor-objectives.md`.

### Périmètre réellement couvert

OP01, OP02, OP05, OP10, OP15 et OP25, avec comparaison au target tree,
aux stratégies spécialisées et au contexte borné du moteur de composition.

### OP qualifiées

- **OP01** : calcul de regroupement correct ; aucun consommateur runtime identifié.
- **OP02** : équivalence prudente avec statut `incomplete` si post-state incomplet ; aucun consommateur identifié.
- **OP05** : ambiguïtés calculables ; alternatives déjà conservées dans plusieurs mécanismes spécialisés.
- **OP10** : objectifs finaux déjà structurés par le target tree/racine ; OP10 ressemble davantage à une vue analytique qu'à un besoin runtime prouvé.
- **OP15** : recouvrement substantiel avec les enfants/intermédiaires du target tree, qui conservent davantage de provenance et de continuité.
- **OP25** : filtre faible des candidats non réfutés ; le target tree possède déjà une sélection/priorité plus riche dans ses familles.

### Besoins démontrés

- conservation d'alternatives spécialisées : oui ;
- cible principale liée et revalidée : oui ;
- ouverture bornée d'un enfant/intermédiaire : oui ;
- sélection spécialisée de cible : oui ;
- besoin d'un regroupement générique OP01/02/05 ou d'un filtre OP25 commun : non démontré.

### Producteurs / consommateurs

Producteur-propriétaire principal observé : `CompositionTargetTree`.
Consommateurs : bind/revalidation de cible et stratégies spécialisées.
Aucun consommateur direct des résultats OP01/02/05/10/15/25 n'est démontré dans le cœur examiné.

### Appels utiles / sans effet démontré

Aucun nouvel appel ajouté.
Ces six OP restent des calculs disponibles mais non activés sans besoin concret.

### Fonctions spécialisées équivalentes

- OP10 : target tree couvre déjà la notion de racine/objectifs dans ses familles.
- OP15 : target tree couvre les enfants intermédiaires avec preuve et continuité.
- OP25 : target tree couvre sélection/priorité dans ses familles.
- OP01/02/05 : seulement recouvrements partiels ; pas d'équivalence déclarée.

### Tests

Aucun test relancé. Lecture de code seulement.

### Performance

Aucun runtime modifié ; coût inchangé.
Statut C4 : **audit donneur avancé, aucun raccordement nécessaire démontré à ce stade**.

### Feuille de route actualisée

| Lot | État | Prochaine preuve concrète |
| --- | --- | --- |
| C0 | **terminé** | registre conservé |
| C1 | **préparé** | instrumenter port TypeScript dès disponibilité |
| C2 | **partiel avancé** | lecteurs OP29/31 + restauration/lecture OP30 |
| C3 | **recouvrement qualifié** | raccorder seulement un besoin non couvert |
| C4 | **audit donneur qualifié** | rechercher un vrai consommateur générique avant tout appel |
| C5 | **prochaine famille utile** | qualifier information/exploration OP06/07/13/20/21/22/23 |
| C6 | préparé | OP16/17/19/24/27 |
| C7 | en attente | consolidation + performances |

### Prochaine étape concrète

Poursuivre avec C5 sur les mécanismes d'information et d'exploration déjà présents dans le donneur V6, en vérifiant si une information obtenue modifie réellement la suite plutôt que de seulement enrichir une trace.


## C5 — information et exploration donneuses

Le détail est enregistré dans `docs/migration/op01-op31-c5-donor-information.md`.

### Périmètre réellement couvert

OP06, OP07, OP13, OP20, OP21, OP22, OP23 avec lecture de :
- `common_mechanisms.py` ;
- `ObservedFrontier` ;
- `composition_curiosity.py` ;
- `TemporalQuestions` ;
- `CompositionTargetTree` ;
- `strategy.py`.

### OP qualifiées

- **OP06** : besoin réel couvert par la réfutation spécialisée de règles empiriques ; contre-exemple → statut refuted → predictive_use_allowed=False.
- **OP07** : besoin réel couvert par `ObservedFrontier`, qui choisit une question ou un accès et produit OP18/OP28 sous bornes.
- **OP13** : portée d'effet déjà conservée dans les règles et effets mesurés ; cette portée contrôle le droit de prédiction.
- **OP20** : aucun besoin générique « utilité objet inconnue » démontré ; les questions sont ciblées par une décision concrète.
- **OP21** : idem pour les espaces ; exploration orientée question, pas visite systématique.
- **OP22** : recouvrement spécialisé partiel via expériences de contrôle/contraste et récepteurs attendus.
- **OP23** : questions temporelles réelles, mais predictive_use_allowed=False ; aucune prévision autonome générale démontrée.

### Chaîne décisionnelle démontrée

Question mesurable → élection d'un information goal → OP18 → observation indépendante → reconcile → hypothèses matched/contradicted/unknown → règle maintenue ou réfutée → frontier/stratégie choisit la suite.

### Performance

Aucun changement runtime ; aucun coût ajouté.

## C6 — blocages, reprises et variantes donneuses

Le détail est enregistré dans `docs/migration/op01-op31-c6-donor-recovery.md`.

### OP qualifiées

- **OP16** : aucun producteur de deadlock global prouvé ; `frontier_exhausted` reste un échec local de recherche bornée.
- **OP17** : return fork + preservation couvrent partiellement la reprise, mais pas une structure générique `authorized/preserve_verified`.
- **OP19** : le donneur possède des préfixes conditionnels bornés et arrêt au premier effet non mesuré, mais ne prouve pas que les pas sont « forced ».
- **OP24** : plusieurs générateurs spécialisés proposent des routes/détours observés ; filtre générique non démontré.
- **OP27** : préservation forte disponible, mais générateur générique de permutations non identifié.

### Principe confirmé

Impossibilité prouvée, information manquante et recherche bornée sans résultat restent trois statuts distincts.

### Performance

Aucun changement runtime ; aucun coût ajouté.

## Feuille de route actualisée après C5/C6

| Lot | État | Prochaine preuve concrète |
| --- | --- | --- |
| C0 | **terminé** | registre conservé |
| C1 | **préparé** | instrumenter port TypeScript dès disponibilité |
| C2 | **qualifié sur donneur pour 18/28 ; partiel 29/30/31** | lecteurs OP29/31 + restauration/lecture future OP30 |
| C3 | **recouvrement spécialisé qualifié** | raccorder seulement un besoin non couvert |
| C4 | **audit donneur qualifié** | consommateur générique requis avant activation |
| C5 | **audit donneur qualifié** | conserver boucle informationnelle spécialisée |
| C6 | **audit donneur qualifié** | ne pas confondre recherche bornée et impossibilité |
| C7 | **prochaine étape documentaire** | consolider les 31 dispositions et lister les preuves encore indispensables au port TypeScript |

### Prochaine étape concrète

Produire C7 provisoire : une matrice finale des 31 OP avec disposition, niveau de preuve, fonction spécialisée éventuelle, dette exacte et statut performance. C7 ne sera pas déclaré complètement clos tant que C1 n'aura pas instrumenté le port TypeScript et que les performances consolidées n'auront pas été mesurées.


## C3 — complément OP04/09/11/14

Le détail est enregistré dans `docs/migration/op01-op31-c3-specialized-overlap-complement.md`.

- **OP04** : recouvrement fort par le target tree, mais aucun consommateur générique transversal démontré.
- **OP09** : aucun équivalent ; le donneur ne confond pas alternatives connues et domaine complet. OP09 reste invalide sans `alternatives_complete=True`.
- **OP11** : recouvrement familial par parent/enfant/routes/conditions du target tree ; réseau générique de déblocage non démontré.
- **OP14** : consommation réelle dans `operation_admission()` et contribution à la garde de release démontrées ; la couche `common_preservation.py` reste l'autorité plus forte pour les témoins, révisions et inconnues.

C3 possède maintenant une disposition explicite pour ses huit OP.


## C7 — consolidation provisoire

La matrice consolidée des 31 OP est enregistrée dans
`docs/migration/op01-op31-c7-provisional-consolidation.md`.

### Périmètre réellement couvert

Les 31 opérations disposent maintenant d'une disposition explicite issue du
plan et du donneur Python V6 :
- contribution décisionnelle démontrée ;
- recouvrement spécialisé ;
- calcul disponible mais usage non démontré ;
- producteur manquant ;
- résultat exposé sans consommateur ;
- dette de preuve précise.

### OP qualifiées / dispositions finales provisoires

Contribution donneuse démontrée :
- OP14 : garde physique + préservation spécialisée ;
- OP18 : garde de release d'expérience ;
- OP28 : garde de release de réalisation ;
- OP30 : consommation jusqu'à écriture mémoire, mais décision future ouverte.

Résultat sans contribution décisionnelle démontrée :
- OP29 ;
- OP31.

Recouvrements spécialisés substantiels :
- OP03/04/06/07/08/11/12/13/15/17/22/24/26.

Besoins génériques non démontrés ou producteurs manquants :
- OP01/02/05/09/10/16/19/20/21/23/25/27 selon le détail C7.

### Besoins non raccordés prioritaires

- lecteur décisionnel OP29 ;
- restauration + lecture future OP30 ;
- propriétaire d'objectif OP31 ;
- tri-état générique OP03 hors familles si nécessaire ;
- deadlock global prouvé OP16 ;
- preuve de pas forcé OP19 ;
- cycle autonome prédictif OP23 ;
- générateur de permutations OP27.

### Tests

Aucun test runtime sra-playground exécuté : le port TypeScript du plan reste absent.
Les preuves actuelles sont des lectures directes du donneur V6 et des contrats existants.

### Performance

Statut :
**audit fonctionnel donneur très avancé ; intégration du port TypeScript et coût consolidé à confirmer.**

C7 n'est pas clos tant que :
- C1 n'a pas instrumenté le port réel ;
- toute modification C2-C6 n'a pas été mesurée ;
- STCK et SMLP n'ont pas été comparés séparément au prédécesseur et à la baseline stable.

### Feuille de route actualisée

| Lot | État | Suite |
| --- | --- | --- |
| C0 | **terminé** | registre stable |
| C1 | **préparé, bloqué uniquement par absence du port TS** | instrumentation et scénarios S-C1-1..5 |
| C2 | **audit donneur avancé** | OP29/30/31 dettes ciblées |
| C3 | **audit donneur complet** | aucun raccordement sans besoin non couvert |
| C4 | **audit donneur complet** | aucun appel sans consommateur |
| C5 | **audit donneur complet** | préserver boucle informationnelle existante |
| C6 | **audit donneur complet** | préserver inconnue vs impossibilité |
| C7 | **consolidation provisoire complète** | réconciliation port TS + performance finale |

### Prochaine étape concrète

Le prochain travail à valeur maximale est désormais C1 sur le checkout TypeScript
`src/logos-engine/v6-*`. En attendant sa disponibilité, les seules dettes utiles
à approfondir dans le donneur sont OP29/30/31 ; les autres familles ont désormais
une disposition explicite et ne justifient pas d'ajout artificiel.


## C2 — dettes donneuses OP29/30/31 resserrées

Le détail est enregistré dans `docs/migration/op01-op31-c2-residual-debts.md`.

Après recherche ciblée dans les fichiers V6 liés à mémoire, résultats, objectifs,
retours et décisions :

- **OP29** : disposition donneuse = `information_only`.
- **OP30** : disposition donneuse = `persisted_only`.
- **OP31** : disposition donneuse = `information_only`.

Aucun lecteur de `knowledge:<composition>:<property>` n'a été trouvé dans les
fichiers V6 inspectés. Le benchmark existant ne relit pas non plus cette clé
après reopen malgré son commentaire.

C2 donneur est donc désormais stabilisé ainsi :
- OP18 : garde de release démontrée ;
- OP28 : garde de release démontrée ;
- OP29 : information_only ;
- OP30 : persisted_only ;
- OP31 : information_only.

Le port TypeScript devra être audité sans présumer qu'il conserve exactement
ces dispositions.


## C1 — carte d'implantation TypeScript prête

Le document `docs/migration/op01-op31-c1-typescript-implementation-map.md`
traduit désormais le contrat C1 en points d'implantation fichier par fichier :

- `v6-operations.ts` : mesure du calcul pur, sans création de besoin ;
- `v6-composition-engine.ts` : appel, admission, persistance ;
- `v6-native-authority.ts` : transport du besoin, garde release/acquire ;
- `v6-target-binding.ts` : postAnalysis OP29/30/31 ;
- nouveau trace sink minimal suggéré, sans décision ni balayage global ;
- cache/invalidation ;
- tests S-C1-1 à S-C1-5 ;
- protocole performance STCK/SMLP.

Le premier patch C1 est explicitement contraint à **zéro changement de décision** :
aucune nouvelle OP, aucune nouvelle garde, aucun changement de priorité ou
d'écriture existante.

### Statut courant

- C0 : terminé.
- C1 : contrat + carte d'implantation prêts ; intégration toujours en attente du checkout TypeScript.
- C2 : dispositions donneuses stabilisées : OP18/28 garde, OP29 information_only, OP30 persisted_only, OP31 information_only.
- C3-C6 : audits donneurs complets.
- C7 : consolidation provisoire complète, performance finale non mesurée.

### Dernier commit sauvegardé

`beb1fc2feca35f2e71b5c010a701f4740e81f3f9`

### Prochaine étape concrète

Dès apparition du checkout `src/logos-engine/v6-*`, appliquer la carte C1 dans
l'ordre : trace sink → execute → operationAdmission → persist → producteurs
OP18/28 → postAnalysis OP29/30/31 → tests S-C1-1..5 → benchmark.


## C1/C2 — implémentation locale réelle et sauvegarde GitHub

Checkout local actif : `/mnt/data/sra-playground-local`.

### Runtime Logos ajouté

- `src/logos-engine/v6-operation-trace.ts`
  - trace bornée, neutre vis-à-vis des décisions ;
  - événements besoin / opération / consommation ;
  - modes `executed/cache_reused/not_required/blocked` ;
  - identité de cache dépendante de l'époque, observation et révisions.
- `src/logos-engine/v6-operations.ts`
  - port TypeScript des calculs OP01 à OP31 depuis le donneur V6 publié ;
  - conservation de `unknown`, `incomplete`, limites de recherche et preuves fournies.
- `src/logos-engine/v6-composition-engine.ts`
  - validation des bundles ;
  - admission physique seulement pour OP14/OP18/OP28 ;
  - résultat réel consommé avant autorisation de release ;
  - opérations d'analyse sans autorité physique.
- `src/logos-engine/v6-target-binding.ts`
  - postAnalysis OP29/30/31 ;
  - OP29 = `information_only` ;
  - OP30 = `persisted_only`, révision courante, déduplication et restauration ;
  - OP31 = `information_only` ;
  - absence de données => `blocked/not_required`, sans appel artificiel.

### Tests locaux exécutés

Typecheck strict des fichiers `src/logos-engine/*.ts` : **OK**.

Suite locale :

`node --experimental-strip-types --test tests/v6-operation-trace.test.ts tests/v6-operations.test.ts tests/v6-composition-engine.test.ts tests/v6-target-binding.test.ts`

Résultat : **17/17 tests passent**.

Couverture démontrée :
- besoin → appel → consommation ;
- besoin absent / appel bloqué ;
- cache invalidé sur révision ;
- trace bornée ;
- OP03 unknown ;
- OP09 domaine complet ;
- OP18/OP28 ;
- OP29 confirmé/réfuté/inconnu ;
- OP30 révision, persistance, restauration, déduplication ;
- OP31 unknown ;
- bundle stale / préservation ;
- admission basée sur le résultat réel ;
- analyse sans autorité physique.

### Performance C1

Micro-mesure isolée locale, 21 × 20 000 itérations :
- OP18 seul : médiane ~0,047 µs/op ;
- OP18 + événement trace : médiane ~3,389 µs/op ;
- surcoût absolu ~3,342 µs/op.

Cette mesure **n'est pas un benchmark de session complète**. Elle ne permet pas de conclure sur le seuil de +10 % STCK/SMLP.

Statut performance :
**intégration fonctionnelle du noyau C1/C2 terminée ; coût session STCK/SMLP à confirmer.**

### Commits locaux

- `e462ded` — noyau opérations + trace ;
- `c1f2e30` — admission / release ;
- `0e40a9d` — postAnalysis + OP30 durable ;
- `11271f8` — preuve locale documentée.

### Sauvegardes GitHub

- `974974d5d0c0ba2f32c97b088b81dd818313f117` — trace core ;
- `d6de284704012fcce212595d8ab449a0d9aa2ce1` — OP01–OP31 ;
- `56fd7a1d7c6c48adb8cd5685ea8dc8c78088bc7b` — tests trace ;
- `b20007d4c6fcdd980fb012095253c59456c163fc` — tests opérations ;
- `c7f76c8ed6441e3804ee37932de68949937f7787` — composition/admission ;
- `e746f136e74483ac4f59d61e750056be1c14c4d2` — tests admission ;
- `93dcc33aa498e6ed4ca493d9c6740fbcd22c3e0a` — postAnalysis/knowledge ;
- `98bea0873f99d7e844e1fe12d38bae0aa6d3b60a` — tests postAnalysis.

### Feuille de route actualisée

| Lot | État | Prochaine étape |
| --- | --- | --- |
| C0 | **terminé** | registre stable |
| C1 | **noyau instrumenté et testé localement** | produire le signal de besoin dans l'autorité/producteurs réels et mesurer une session |
| C2 | **18/28/29/30/31 codés selon disposition qualifiée** | brancher les producteurs réels sans modifier la décision |
| C3 | audit donneur complet | aucun raccordement sans besoin non couvert |
| C4 | audit donneur complet | aucun appel sans consommateur |
| C5 | audit donneur complet | préserver boucle informationnelle |
| C6 | audit donneur complet | préserver inconnue vs impossibilité |
| C7 | consolidation provisoire | benchmark consolidé après intégration runtime réel |

### Prochaine étape concrète

Implémenter `v6-native-authority.ts` localement pour :
1. émettre le signal de besoin **avant** OP18/OP28 ;
2. distinguer besoin présent, absent et bloqué ;
3. transporter le même `needId` jusqu'à `executeBundleOperation` ;
4. ne modifier aucune sélection ni priorité.


## C1 — besoin produit avant release

Ajout : `src/logos-engine/v6-native-authority.ts`.

Le besoin est désormais évalué avant OP18/OP28 :
- OP18 sans question ouverte => `not_required`, aucun calcul ;
- OP18 avec question ouverte => événement `need`, même `needId` jusqu'à appel et consommation ;
- OP28 bundle absent / non admis / sans actions => `blocked`, aucun calcul ;
- OP28 admis => calcul puis admission par résultat.

Typecheck strict : **OK**.

Suite complète locale : **21/21 tests passent**.

Nouveaux commits GitHub :
- `6fc40e6532e93cf61538992498395524c76ba194` — native authority ;
- `dc4925a444bac4e97201b7fec87e28debf768b0d` — tests need-to-release.

Commit local correspondant :
- `1c5bcce` — `feat: emit operation needs before native release`.
- `eb4be05` — suivi local.

### Statut C1 actualisé

Le noyau C1 couvre maintenant réellement :
- besoin présent ;
- besoin absent ;
- information bloquante ;
- appel utile ;
- consommation garde ;
- invalidation de révision ;
- restauration OP30 ;
- déduplication.

Prochaine étape : brancher un cache d'opérations réel dans l'autorité pour démontrer `executed` vs `cache_reused` et invalidation précise, puis qualifier son coût.


## C1 — cache réel et invalidation précise

Ajout : `src/logos-engine/v6-operation-cache.ts`.

Preuves fonctionnelles locales :
- même identité exacte => `executed` puis `cache_reused` ;
- nouvelle observation/révision => nouvelle exécution ;
- cache borné avec éviction ;
- garde de release revalidée même sur cache hit.

Typecheck strict : **OK**.
Suite complète : **24/24 tests passent**.

Commit local :
- `8754f91` — cache pur indexé par dépendances ;
- `c401975` — suivi local.

Sauvegardes GitHub :
- `514688f2ed66d2dac6be65559f715e8e86269cba` — cache ;
- `904e7828a42a664acc43356a79d1b08f47908ae2` — composition engine cache-aware ;
- `ff711ac9f60c99ee41db6c89975a5409bea6e161` — native authority cache identity ;
- `af4c2952989134bff67f12b1ac40fa17ffc11d7a` — tests cache.

Micro-mesure isolée cache, 501 échantillons :
- cache miss médian ~12,188 µs/release ;
- cache hit médian ~8,743 µs/release.

Cette mesure reste interne au noyau Logos. Elle ne remplace pas STCK/SMLP.

### Statut C1

Les preuves fonctionnelles ciblées C1 sont maintenant présentes sur le noyau Logos :
besoin, appel, non-appel, blocage, cache hit, invalidation, consommation, restauration et déduplication.

Statut performance officiel :
**intégration fonctionnelle C1 terminée sur le noyau Logos, coût session complète à confirmer.**


## C2 — chaîne intégrée release → postAnalysis

Ajout : `src/logos-engine/v6-operation-cycle.ts`.

Chaîne désormais couverte dans le noyau Logos local :

**besoin OP18 → exécution → admission/release → retour observé → OP29 → OP30 → OP31**

Le même `needId` traverse toute la chaîne.

Dispositions conservées :
- OP29 = `information_only` ;
- OP30 = `persisted_only` ;
- OP31 = `information_only`.

Cas négatifs :
- aucun retour => aucun postAnalysis ;
- release refusée => aucun postAnalysis.

Typecheck strict : **OK**.
Suite complète locale : **27/27 tests passent**.

Commit local :
- `357ad91` — cycle intégré ;
- `1d3989b` — preuve documentée.

Sauvegardes GitHub :
- `ea4e49296b345c48ea93ed13123d3678a0a45a39` — cycle ;
- `acfac799d2000a983f685fbd41fbc4e915e1b4e9` — tests cycle.

Mesure isolée du cycle, 501 échantillons :
- non tracé médian ~8,262 µs ;
- tracé médian ~34,883 µs ;
- surcoût absolu ~26,621 µs.

Cette mesure n'est pas une session STCK/SMLP. Statut officiel :
**intégration fonctionnelle C1/C2 terminée sur le noyau Logos ; coût session complète à confirmer.**

### Feuille de route actualisée

| Lot | État | Prochaine étape |
| --- | --- | --- |
| C0 | terminé | registre stable |
| C1 | **fonctionnel sur noyau Logos, 27 tests** | raccorder au runtime/browser réel et mesurer session |
| C2 | **chaîne 18/28→29/30/31 intégrée** | vérifier mêmes preuves sur scénarios runtime réels |
| C3 | audit donneur complet | raccorder seulement besoins non couverts |
| C4 | audit donneur complet | aucun appel sans consommateur |
| C5 | audit donneur complet | préserver boucle informationnelle |
| C6 | audit donneur complet | préserver inconnue vs impossibilité |
| C7 | consolidation provisoire | benchmark consolidé et scénarios runtime réels |


## Reprise canonique Site 109 — 2026-11-12

Nouvelle baseline commune : `recovery/site109-reconstruction-20261112` au SHA de reprise
`658b89cfe77887eb720c95f0e6e6f8595beffdbd`.

Source de récupération OP01–OP31 :
`op01-op31-c0-c7-audit` au SHA
`07a6ea06e12746deea3bc1a2de031f63a4f9c93a`.

La comparaison GitHub montre que la branche source OP est déjà entièrement incluse
dans la baseline canonique : aucun changement runtime OP n'est à reporter.

Checkout sparse local de contrôle :
`/mnt/data/sra-playground-op01-site109`.

Preuve d'identité :
les 16 fichiers utilisés pour le noyau/tests OP ont été vérifiés par
`git hash-object` contre leurs blob SHA GitHub de la baseline ; tous correspondent.

Tests exécutés depuis cette baseline vérifiée :
- `tsc --noEmit` : OK ;
- `node --experimental-strip-types --test tests/v6-*.test.ts` : **27/27**.

Composants encore manquants et non retrouvés dans les branches de récupération connues :
- `scripts/measure-native-loop-costs.mjs` ;
- `tests/helpers/v6-live-game-campaign.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- `docs/migration/v6-delivery-roadmap.md` ;
- `docs/migration/v6-entry-point-progress.json`.

Statut performance :
**fonctionnellement qualifié, performance officielle à confirmer**.

Détail de récupération :
`docs/recovery/op01-op31-recovery-status.md`.

Prochaine étape :
reprendre C1/C2 sur runtime réel dès restauration d'un worker/harness qualifié ;
sinon ne pas créer d'appels OP artificiels. C7 restera ouvert pour les sessions
STCK/SMLP séparées et le seuil global strictement < +10 % par jeu.
