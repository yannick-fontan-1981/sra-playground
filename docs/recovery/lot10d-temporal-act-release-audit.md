# Lot 10D - audit de l'autorite ACT et des gates de release

Date : 2026-11-12

## Objet

Cette etape audite les donneurs durables V5 qui separent :

1. selection declarative ;
2. preparation d'un intent d'action ;
3. grounding courant ;
4. wisdom / commitment ;
5. viability ;
6. release ;
7. execution physique.

Elle ne pretend pas reconstruire le schema historique complet de Site 109.

## Donneurs durables

### `src/core/release_action.src`

Chemin durable :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/release_action.src`

Le workflow recoit un `ActionIntent` deja construit. Il ne le deduit pas d'une selection.

Ordre des gates observe :

- `wisdom.decision == commit` ;
- viability `viable` ou `conditional` ;
- engagement experimental courant et consomme ;
- binding courant des preuves de controle ;
- contrat de reutilisation memoire valide ;
- continuite du parent revalidee ;
- influence causale du parent revalidee ;
- absence de replay fatal observe ;
- preservation de l'endpoint annonce.

Dispositions fail-closed :

- `revise`, `reject`, viability `blocked`, replay fatal et contact hostile bloquent ;
- `defer`, viability `undetermined` et securite non resolue deferent ;
- seul un endpoint `not_applicable` ou `clear` atteint la release.

### `src/core/released_action_cycle.src`

Chemin durable :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/released_action_cycle.src`

Ce workflow confirme la sequence :

`validate_action_grounding -> operational_wisdom -> release_action -> ACT`

L'operateur `ACT` consomme ensuite :

- l'intent ;
- le contexte ;
- le permis de release ;
- la wisdom ;
- les attentes declarees.

La selection seule n'est donc jamais une autorite ACT.

### `src/arc3/conditional_reasoning_tree.src`

Chemin durable :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src`

Les workflows `choose_retained_grid_interaction_action` et `choose_retained_grid_motion_action` montrent que :

- une branche structurelle est selectionnee ;
- une action exacte est preparee par `prepare_interaction_probe` ;
- l'intent prepare est grounde ;
- wisdom et release sont ensuite evaluees ;
- aucune action d'environnement n'est executee dans le workflow de choix ;
- le kernel de serie d'actions dispatchera plus tard l'action preparee.

Le meme donneur exige `requirement.current_action_is_available` et preserve le domaine complet des alternatives.

### `src/arc3/continue_after_information_probe.src`

Chemin durable :

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/continue_after_information_probe.src`

Ce workflow confirme :

- un retour est consomme au plus une fois ;
- une reentree ne libere jamais ACT ;
- un refus ou un retour parental ne devient pas une permission d'agir.

## Ce qui est reconstructible avec preuve

Les invariants suivants sont suffisamment explicites pour etre portes :

- selection acceptee obligatoire avant audit d'un intent ;
- liaison exacte selectedRef / decision fingerprint / observation ;
- intent, action witness, famille d'action et expectations explicitement nommes ;
- preuves de grounding preservant les preuves de la selection ;
- action courante explicitement disponible ;
- grounding valide ;
- commitment, viability et gates de controle/memoire/parent ;
- safety replay et endpoint ;
- distinction block / defer / eligible ;
- aucune action ni autorite ACT produite par l'audit.

## Ce qui reste non reconstructible exactement

Les donneurs accessibles ne donnent pas encore :

- le schema historique complet de `ActionIntent` ;
- la conversion exacte `selectedRef -> AgentAction` ;
- la cible ou les coordonnees exactes d'une action TemporalSelection ;
- l'encodage historique d'un `ActionReleasePermit` ;
- le producteur runtime de chaque preuve de release ;
- la position exacte du consommateur final dans l'ancien runtime Site 109.

Ces elements ne sont donc pas inventes.

## Composant ajoute

`src/runtime/v6-temporal-act-release-audit.ts`

Le composant recoit :

- une projection TemporalSelection deja qualifiee ;
- un witness d'intent deja prepare ;
- les faits explicites des gates de release.

Il retourne une disposition :

- `eligible` ;
- `blocked` ;
- `deferred`.

Meme lorsque toutes les gates passent, le resultat conserve :

- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `actAuthorized: false`.

`eligible` signifie uniquement que les gates durables connues sont satisfaites. Ce n'est pas encore un permis ACT.

## Tests

Fichier :

`tests/v6-temporal-act-release-audit.test.ts`

Le test couvre notamment :

- liaison selection / decision / observation ;
- domaines d'expectations et de preuves ;
- disponibilite courante ;
- grounding ;
- commitment ;
- viability ;
- engagement experimental ;
- controle et memoire ;
- continuite et influence parentales ;
- replay fatal ;
- endpoint ;
- absence de payload d'action.

## Prochaine etape

Rechercher un donneur durable de la liaison exacte :

`prepared intent -> AgentAction publique`

Si ce donneur est retrouve, construire un contrat d'intent d'action attribue et un permis ACT separe, puis les raccorder au port passif.

S'il reste absent, conserver le port en mode `action_withheld` et documenter le manque. Une nouvelle liaison ne pourra etre introduite que comme nouveau contrat explicitement specifie, jamais comme restitution supposee de Site 109.
