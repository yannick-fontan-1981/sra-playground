# C7 provisoire — consolidation OP01 à OP31

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Ce document consolide les dispositions obtenues sur :
- le plan C0 ;
- le donneur Python V6 publié au commit
  `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` ;
- les recouvrements spécialisés C2 à C6.

Il **ne clôt pas encore C7**, car le port TypeScript `src/logos-engine/v6-*`
n'a pas été retrouvé/instrumenté et les performances consolidées STCK/SMLP ne
sont pas mesurées.

## Matrice consolidée

| OP | Lot | Disposition actuelle | Preuve / équivalent principal | Dette exacte |
| --- | --- | --- | --- | --- |
| OP01 | C4 | calcul disponible, usage runtime non démontré | regroupement canonique | trouver un consommateur qui réduit réellement un travail |
| OP02 | C4 | calcul prudent, usage runtime non démontré | équivalence seulement si post-state complet | trouver un décideur de chemins réellement consommateur |
| OP03 | C3 | recouvrement partiel spécialisé | validate_bundle garde booléenne | préserver vrai/faux/unknown pour le plan si besoin réel |
| OP04 | C3 | recouvrement familial fort | target tree parent/enfant/routes | usage générique transversal non démontré |
| OP05 | C4 | recouvrement structurel partiel | alternatives spécialisées | besoin d'ambiguïté trans-familles non démontré |
| OP06 | C5 | besoin couvert par mécanisme spécialisé | règles empiriques + contre-exemples | ne pas dupliquer la réfutation avec OP06 |
| OP07 | C5 | besoin couvert par mécanisme spécialisé | ObservedFrontier | port TypeScript à vérifier/instrumenter |
| OP08 | C3 | recouvrement familial | target tree / accès spécialisés | producteur effect→requires générique non démontré |
| OP09 | C3 | calcul valide, aucun équivalent | exige alternatives_complete | ne jamais inférer la complétude depuis quelques solutions |
| OP10 | C4 | vue analytique potentielle | target tree/racine | consommateur explicite requis avant activation |
| OP11 | C3 | recouvrement familial | target tree | réseau générique de déblocage non démontré |
| OP12 | C3 | recouvrement spécialisé substantiel | unknown_then_observe / acquire_missing_control | parcours générique depends_on encore distinct |
| OP13 | C5 | recouvrement spécialisé fort | scope des règles/effets | vue transversale seulement si consommée |
| OP14 | C3 | usage consommé dans le donneur | operation_admission + common_preservation | port TS à vérifier ; OP seule ne prouve pas la sûreté |
| OP15 | C4 | recouvrement spécialisé substantiel | enfants du target tree | ne pas dupliquer le propriétaire de hiérarchie |
| OP16 | C6 | producteur manquant | frontier_exhausted reste local | deadlock global prouvé non disponible |
| OP17 | C6 | recouvrement partiel | return_fork + preservation | structure recovery authorized/preserve_verified non démontrée |
| OP18 | C2 | usage consommé et contribution démontrée dans donneur | producteurs spécialisés → admission → release | reproduire la preuve sur port TS |
| OP19 | C6 | discipline proche, pas équivalence | préfixes conditionnels bornés | preuve « forced » absente |
| OP20 | C5 | besoin générique non démontré | questions entité ciblées | ne pas tester tout objet inconnu |
| OP21 | C5 | besoin générique non démontré | frontier orienté question | ne pas explorer tout espace inconnu |
| OP22 | C5 | recouvrement spécialisé partiel | control/contrast experiments | registre générique remote_effects non démontré |
| OP23 | C5 | question temporelle démontrée, prédiction autonome non | TemporalQuestions | preuve de cycle + droit prédictif manquants |
| OP24 | C6 | recouvrement spécialisé par familles | access/frontier/return routes | domaine commun de chemins non démontré |
| OP25 | C4 | filtre faible, probablement redondant par famille | target tree sélection/priorité | besoin de domaine multi-objectifs commun non démontré |
| OP26 | C3 | équivalent spécialisé d'admission dans plusieurs familles | goal/passage/cell/graph access | filtre multi-accès générique non démontré |
| OP27 | C6 | préservation disponible, générateur absent | common_preservation | producteur de permutations non démontré |
| OP28 | C2 | usage consommé et contribution démontrée dans donneur | operation_admission → release | vérifier redondance/admission dans port TS |
| OP29 | C2 | calcul + résultat exposé, contribution non démontrée | composition_analysis/report | identifier lecteur décisionnel ou classer information_only |
| OP30 | C2 | consommation/persistance démontrée | persist() écrit knowledge:* | tester reopen/restauration + lecture décisionnelle future |
| OP31 | C2 | calcul + résultat exposé, contribution non démontrée | composition_analysis/report | identifier propriétaire objectif ou classer information_only |

## Bilan par niveau de preuve

### Contribution décisionnelle démontrée dans le donneur
- OP14 : garde physique, avec préservation spécialisée.
- OP18 : garde de release d'une expérimentation.
- OP28 : garde de release d'un bundle de réalisation.
- OP30 : consommation jusqu'à l'écriture de connaissance ; décision future non encore démontrée.

### Besoin couvert par fonction spécialisée
- OP06, OP07, OP13.
- OP03, OP04, OP08, OP11, OP12, OP15, OP17, OP22, OP24, OP26 : recouvrements partiels ou familiaux.
- OP10, OP25 : propriétaire d'objectif spécialisé plus riche que le filtre générique.

### Besoin générique non démontré ou producteur absent
- OP01, OP02, OP05, OP09, OP16, OP19, OP20, OP21, OP23, OP27.
- Cela ne signifie pas « OP inutile » ; cela signifie qu'aucun besoin actuel ne justifie encore son raccordement.

### Appel/résultat sans contribution démontrée
- OP29, OP31.
- OP30 au-delà de la persistance vers une décision future.

## Besoins réellement manquants détectés

1. **Tri-état de précondition générique** si un planificateur doit distinguer
   réfutation et information absente hors des familles spécialisées.
2. **Graphe effect/requires transversal** seulement si plusieurs familles doivent
   partager leurs dépendances.
3. **Domaine complet d'alternatives** pour OP09 ; aucune source actuelle ne
   justifie cette complétude.
4. **Deadlock global prouvé** pour OP16 ; frontier_exhausted ne suffit pas.
5. **Forced-step proof producer** pour OP19.
6. **Cycle autonome avec preuve et autorité prédictive** pour OP23.
7. **Permutation generator** pour OP27.
8. **Lecteur décisionnel OP29**.
9. **Lecture/restauration et contribution future OP30**.
10. **Propriétaire d'objectif consommant OP31**.

## Tests restant indispensables

### C1 port TypeScript
- besoin présent ;
- besoin absent ;
- information insuffisante ;
- dépendance/révision changée ;
- sauvegarde/restauration ;
- cache réutilisé vs recalcul.

### C2
- OP18/28 : même chaîne que donneur jusqu'à release ;
- OP29 : lecteur ou disposition information_only ;
- OP30 : persistance après reopen/restauration + lecture ultérieure ;
- OP31 : effet sur maintien/fin/suspension/réorientation ou information_only.

### C3-C6
Pour chaque raccordement futur :
- cas positif ;
- cas sans besoin ;
- inconnue préservée ;
- invalidation précise ;
- fonction spécialisée vérifiée avant ajout d'OP.

## Performance C7

Statut : **non mesuré, C7 non clos**.

Baseline logique du chantier :
`8462204043aa368faa7df280d796bb706eb53b38`.

Le checkout exact n'est pas présent dans les dépôts GitHub visibles.
Il ne doit pas être remplacé silencieusement par `786dcf51…`, qui est un
snapshot Python V6 donneur différent.

Quand le port TypeScript sera disponible :
1. mesurer le prédécesseur immédiat ;
2. mesurer la baseline stable initiale ;
3. STCK et SMLP séparément ;
4. instrumentation off/on ;
5. diagnostic détaillé séparé ;
6. médiane session complète strictement sous +10 % pour chaque jeu ;
7. mesures concurrentes marquées non isolées.

Verdict actuel :
**audit fonctionnel donneur très avancé ; intégration du port TypeScript et coût consolidé à confirmer.**

## Critère de clôture finale

C7 ne pourra être déclaré terminé que lorsque :
- les 31 dispositions auront été réconciliées avec le port TypeScript réel ;
- C1 aura produit les traces de besoin/appel/cache/consommation ;
- les dettes C2 critiques auront une preuve ou une disposition finale explicite ;
- toute modification runtime C2-C6 aura son coût qualifié ;
- la version consolidée respectera ou documentera explicitement le seuil de performance.
