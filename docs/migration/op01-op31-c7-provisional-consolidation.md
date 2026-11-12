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
| OP29 | C2 | information_only dans le donneur publié | composition_analysis/report sans lecteur spécialisé trouvé | vérifier si le port TS possède un consommateur réel ; sinon conserver information_only |
| OP30 | C2 | persisted_only dans le donneur publié | persist() écrit knowledge:* ; aucun lecteur trouvé | vérifier reopen/restauration et éventuel lecteur dans le port TS ; sinon conserver persisted_only |
| OP31 | C2 | information_only dans le donneur publié | composition_analysis/report sans propriétaire objectif trouvé | vérifier si le port TS possède un consommateur réel ; sinon conserver information_only |

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

### Dispositions informationnelles/persistées du donneur
- OP29 : `information_only`.
- OP30 : `persisted_only`.
- OP31 : `information_only`.

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


## Mise à jour après implémentation locale C1/C2

Le chantier n'est plus seulement documentaire sur C1/C2. Un noyau TypeScript
Logos existe maintenant sous `src/logos-engine/` avec :

- OP01 à OP31 ;
- trace besoin/appel/consommation ;
- admission physique OP14/18/28 ;
- production du besoin avant OP18/28 ;
- postAnalysis OP29/30/31 ;
- OP30 durable avec restauration/déduplication ;
- cache pur borné par dépendances ;
- cycle intégré release → retour → postAnalysis.

Suite locale : **27/27 tests passent**, typecheck strict OK.

### Preuve de non-régression structurelle

Comparaison GitHub entre la base de branche
`8f8b179718d06a51dc8818deb68c977cd5e1e820` et le head
`c084c6c0eb8b42ac8daa78cf90265526d168c3fc` :

- aucun fichier existant de `src/runtime/*` modifié ;
- aucun jeu modifié ;
- aucune UI modifiée ;
- uniquement nouveaux fichiers `src/logos-engine/*`, tests et documents.

Ainsi, les décisions du runtime browser existant restent inchangées tant que
le nouveau noyau Logos n'est pas raccordé à l'agent web.

### Statut C1 révisé

Fonctionnellement qualifié sur le noyau Logos local pour :
- besoin présent ;
- besoin absent ;
- blocage ;
- appel exécuté ;
- cache réutilisé ;
- invalidation par révision ;
- consommation garde ;
- restauration OP30 ;
- déduplication.

Performance :
- mesures micro isolées disponibles ;
- **session complète STCK/SMLP non mesurée** ;
- verdict : **intégration fonctionnelle terminée, coût à confirmer**.

### Statut C2 révisé

Chaîne intégrée testée :

**OP18 → release → retour → OP29 → OP30 → OP31**

avec dispositions :
- OP18 : garde de release ;
- OP29 : `information_only` ;
- OP30 : `persisted_only` ;
- OP31 : `information_only`.

Aucun postAnalysis n'est exécuté si la release est refusée ou si aucun retour
n'est disponible.

### C7 reste provisoire

C7 ne peut toujours pas être clôturé car :
1. le noyau Logos n'est pas encore raccordé au runtime/browser SRA réel ;
2. STCK et SMLP ne sont pas mesurés en session complète ;
3. C3-C6 restent audits donneurs tant qu'aucun besoin runtime réel non couvert
   n'impose un raccordement.
