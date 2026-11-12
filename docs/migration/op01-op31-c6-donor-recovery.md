# C6 — blocages, reprises et variantes dans le donneur V6

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

## OP16 — Blocages

OP16 ne doit accepter que des deadlocks fournis avec preuve et portée globale.

Le donneur spécialisé observé reste plus prudent :
- `ObservedFrontier.propose()` retourne `frontier_exhausted` lorsque aucune
  entrée non testée ni accès observé n'est disponible sous les bornes courantes ;
- ce statut ne devient jamais une impossibilité globale ;
- les règles réfutées rouvrent des questions de condition manquante plutôt que
  de déclarer un deadlock.

Disposition :
**aucun producteur de deadlock global prouvé identifié.**
OP16 ne doit pas être alimentée par `frontier_exhausted`.

## OP17 — Reprise

OP17 attend des reprises déjà `authorized` et `preserve_verified`.

Recouvrements spécialisés :
- `return_fork.closed_return_contrast()` détecte un retour public observé et
  choisit une continuation non essayée au dernier embranchement ;
- le résultat conserve preuve, accès observé et falsificateur ;
- `common_preservation.py` lie séparément les obligations de préservation,
  exige une révision autorisée si la condition change et peut sceller le préfixe.

Qualification :
**recouvrement partiel, pas équivalence OP17.**

Le donneur sait reprendre après un retour observé et préserver des obligations,
mais aucune structure générique `recovery {authorized,preserve_verified}` n'est
démontrée.

## OP19 — Pas forcés

OP19 exige une séquence de pas chacun accompagnés d'une preuve et de contraintes
vérifiées, et s'arrête au premier pas non prouvé.

Mécanismes spécialisés :
- `GoalAccessAdapter` borne le préfixe à 16 ;
- chaque commande doit rester disponible ;
- tout effet non mesuré doit être le dernier pas ;
- `terminal_composition.check_access_before/after` revalide chaque pas ;
- une divergence, un changement de viewport ou un effet distant inattendu scelle
  immédiatement le préfixe.

Qualification :
**même discipline d'arrêt, mais pas de preuve de “forced”.**

Le donneur sait exécuter un préfixe conditionnel prouvé, pas démontrer que chaque
pas est obligatoire. OP19 reste donc non raccordée.

## OP24 — Détours

OP24 filtre des chemins fournis qui atteignent le post-state désiré avec
contraintes vérifiées.

Mécanismes spécialisés :
- `terminal_composition.propose_access()` explore des accès sur surfaces
  observées, évite les prémisses réfutées et borne le préfixe ;
- plusieurs approches concurrentes provoquent
  `competing_scoring_approaches` plutôt qu'un choix arbitraire ;
- `return_fork` peut proposer une autre continuation après un retour observé ;
- `ObservedFrontier._access()` recherche un chemin observé vers une question
  ouverte.

Qualification :
**équivalent spécialisé pour certains détours observés, pas filtre générique OP24.**

Ces mécanismes génèrent et gardent leurs propres routes. Ajouter OP24 ensuite
serait redondant sauf si plusieurs générateurs hétérogènes alimentent réellement
un domaine commun de chemins.

## OP27 — Permutations

OP27 exige :
- cible exacte ;
- contraintes vérifiées ;
- préservation de toutes les références protégées.

Le donneur possède une couche de préservation forte :
- obligations liées à l'observation et à l'époque ;
- témoins visibles/occlus ;
- modifications seulement via révision autorisée ;
- garde finale qui scelle sur changement ou inconnu.

Mais aucun générateur générique de `permutations` n'a été identifié dans les
sources C6 examinées.

Qualification :
**préservation disponible, producteur de permutations non démontré.**
Ne pas fabriquer des permutations uniquement pour activer OP27.

## Synthèse C6

| OP | Besoin | Recouvrement spécialisé | Disposition |
| --- | --- | --- | --- |
| OP16 | deadlock global prouvé | aucun ; frontier_exhausted reste local | producteur manquant |
| OP17 | reprise autorisée/préservée | return fork + preservation | partiel, pas équivalence |
| OP19 | préfixe forcé prouvé | préfixes conditionnels bornés | discipline proche, “forced” non prouvé |
| OP24 | détour admissible | accès/frontier/return alternatifs | spécialisé par famille |
| OP27 | permutation préservée | préservation forte, générateur absent | besoin non raccordé |

## Principe C6 confirmé

Trois statuts doivent rester distincts :
1. impossibilité prouvée ;
2. information ou condition manquante ;
3. recherche bornée sans résultat.

Le donneur respecte cette distinction. Le port TypeScript devra la conserver.

## Performance

Aucun runtime sra-playground modifié.
Si des variantes sont raccordées plus tard, le coût du **générateur** devra être
mesuré avec celui du filtre OP. Les recherches restent bornées et interruptibles.
