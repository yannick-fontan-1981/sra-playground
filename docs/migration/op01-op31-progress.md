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
