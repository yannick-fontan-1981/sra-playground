# C4 — regroupements et objectifs dans le donneur V6

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Source examinée : runtime Python V6 publié au commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Objectif : qualifier OP01, OP02, OP05, OP10, OP15 et OP25 sans ajouter
d'appels artificiels.

## OP01 — Inventorier

Calcul générique :
- regroupe les compositions par signature canonique de
  `kind/requires/effect/things/properties/relations/context`.

Constat runtime :
- aucun consommateur spécialisé de ces groupes n'a été identifié dans le cœur
  examiné ;
- `CompositionEngine.prepare()` construit déjà un
  `composition_context` borné aux `relevant_compositions`, mais ne fusionne
  pas leurs identités.

Disposition :
**calcul disponible ; besoin runtime de regroupement non démontré**.

Ne pas brancher OP01 tant qu'un sélecteur ou un index ne consomme pas réellement
ses groupes pour réduire un travail ou un domaine.

## OP02 — Équivalence

Calcul générique :
- groupe des chemins uniquement si `post_state_complete is True` ;
- inclut `post_state` et `constraints_verified` dans la signature ;
- si l'état final n'est pas complet, le statut devient `incomplete` et le
  chemin garde une identité `unproved_equivalence:<id>`.

Constat runtime :
- aucune sélection de chemin fondée sur OP02 n'a été identifiée dans les
  composants examinés ;
- les accès spécialisés conservent au contraire leurs propres identités,
  preuves, révisions, surfaces et gardes.

Disposition :
**bonne sémantique de calcul, mais aucun besoin de déduplication décisionnelle démontré**.

Une équivalence spécialisée ne doit pas supprimer les preuves propres aux accès.

## OP05 — Ambiguïtés

Calcul générique :
- groupe les compositions par effet déclaré ;
- ne retourne que les groupes de taille > 1.

Limite :
- même effet déclaré ne signifie pas même mécanisme, coût, preuve ou cause.

Constat runtime :
- aucun consommateur identifié qui utilise OP05 pour conserver des alternatives
  ou demander une observation discriminante ;
- le target tree et les stratégies spécialisées conservent déjà explicitement
  des `alternatives` dans plusieurs familles.

Disposition :
**recouvrement structurel partiel ; usage OP05 non démontré**.

Si les alternatives spécialisées satisfont déjà le besoin, OP05 serait
redondante. Si une ambiguïté trans-familles apparaît, un consommateur générique
pourrait être justifié.

## OP10 — Finaux

Calcul générique :
- retourne les compositions référencées par les goals marqués `terminal`.

Mécanisme spécialisé observé :
- `CompositionTargetTree` possède une racine explicite, des goals déclarés et
  des familles ;
- `bind()` refuse un objectif principal non lié à cette racine ;
- les propositions sont liées à `G_official_completion` dans plusieurs
  producteurs spécialisés.

Disposition :
**la notion d'objectif final est déjà structurée dans le target tree donneur**.

Aucun besoin n'est démontré pour recalculer OP10 à chaque décision.
OP10 peut rester une vue analytique si un consommateur explicite en a besoin.

## OP15 — Intermédiaire

Calcul générique :
- goals non terminaux ;
- non complétés ;
- toutes leurs conditions satisfaites par les faits.

Mécanisme spécialisé observé :
- `CompositionTargetTree.extend_target()` ouvre un enfant borné d'un parent
  justifié ;
- `bind()` exige une cible retenue/revalidée et les `child.requires` ;
- la sélection conserve alternatives, preuves, portée et limite de candidats.

Différence importante :
- OP15 filtre des goals déjà déclarés selon leurs conditions ;
- le target tree choisit un enfant dans une hiérarchie/famille avec davantage
  de provenance et de continuité.

Disposition :
**recouvrement spécialisé substantiel, pas équivalence générique**.

Ne pas ajouter OP15 si le target tree est déjà le propriétaire de la hiérarchie
dans la famille concernée.

## OP25 — Choisir une cible

Calcul générique :
- retourne les compositions avec `candidate_objective` vrai ;
- exclut uniquement `feasibility == refuted`.

Limite :
- « non réfuté » n'est pas « faisable prouvé » ;
- l'OP ne classe pas les candidats et ne justifie pas une priorité.

Mécanismes spécialisés observés :
- `CompositionTargetTree.extend_target()` construit un domaine borné de
  candidats, garde les alternatives et choisit selon des priorités déclarées
  (`protected_access`, `qualified_joint`, résiduel, candidat lié) ;
- `bind()` maintient/revalide la cible retenue et peut la retirer sur
  réfutation ;
- `strategy.py` orchestre des fournisseurs spécialisés et des information goals.

Disposition :
**la sélection de cible spécialisée existe déjà ; OP25 serait au mieux un filtre
amont très faible**.

Un raccordement OP25 n'est justifié que si un domaine commun de compositions
candidates doit être filtré avant un décideur distinct. Il ne doit pas
remplacer la politique de priorité du propriétaire d'objectif.

## Synthèse C4 donneuse

| OP | Calcul correct | Mécanisme spécialisé | Consommation OP démontrée | Disposition |
| --- | --- | --- | --- | --- |
| OP01 | oui | contexte borné, sans fusion | non | besoin non démontré |
| OP02 | oui, avec incomplete | accès gardent identités propres | non | besoin non démontré |
| OP05 | oui | alternatives spécialisées existent | non | recouvrement partiel |
| OP10 | oui | target tree/racine explicite | non | vue analytique potentielle |
| OP15 | oui | enfants du target tree | non | recouvrement substantiel |
| OP25 | oui | sélection/priorité target tree | non | filtre faible, probablement redondant par famille |

## Besoins encore ouverts

- regroupement transversal réellement consommé pour éviter un travail répété ;
- équivalence de chemins avec état final complet et preuves comparables ;
- ambiguïté trans-familles nécessitant une question discriminante ;
- vue analytique des objectifs finaux si un consommateur la demande ;
- domaine multi-objectifs commun à plusieurs propriétaires spécialisés.

Aucun de ces besoins n'est créé artificiellement pour activer les OP.
