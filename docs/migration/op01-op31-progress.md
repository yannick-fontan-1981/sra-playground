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