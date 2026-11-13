# Lot 10D - binding attribué d'un candidat d'action préparé

Date : 2026-11-12

## Objet

Cette étape reconstruit la frontière durable entre :

`TemporalSelection acceptée -> witness d'intent préparé -> cible explicite -> AgentAction candidate`

Elle ne reconstruit pas le permis ACT et ne libère aucune action.

## Donneurs durables

### Adaptateur public V5

`reference/sra/212d8d426f07/agents/yf_arc3_v5/agent.py`

Le donneur public ne choisit aucune action lorsque V5 ne possède pas d'action autorisée par Source. Une action en attente transporte notamment :

- `authority: source_action_release_permit` ;
- `action_intent_id` ;
- `source_hash` ;
- la référence d'action ;
- le contexte exact `run_id`, `timeline_id`, `frame_id`, `state_revision`.

Avant dispatch, l'adaptateur revalide le nom de l'action et ce contexte exact.

### Cycle d'action libérée

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/released_action_cycle.src`

La séquence durable reste :

`grounding -> operational wisdom -> release_action -> ACT`

L'opérateur ACT consomme un intent, un contexte, un résultat de release, la wisdom et les attentes de l'intent.

### Préparation des actions

`reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src`

Les workflows d'action retenue :

- sélectionnent une branche ;
- préparent une action par `prepare_interaction_probe` ;
- qualifient le grounding ;
- évaluent wisdom et release ;
- n'exécutent pas directement l'environnement.

### Registre architectural

`reference/sra/212d8d426f07/docs/architecture/resolving_architecture_overview.md`

Le registre exige une chaîne exacte :

`intent -> permit -> dispatch -> acquisition`

Il exige aussi le contrôle conjoint de l'intent, du permis, du dispatch, de l'acquisition, de l'ordre des observations, de la frame et de la timeline.

## Composant reconstruit

`src/runtime/v6-temporal-action-binding.ts`

Le reçu `sra.temporal_prepared_action_binding.v1` conserve :

- l'identité Source ;
- la session et la séquence publiques ;
- l'empreinte exacte de l'observation publique ;
- l'identité temporelle ;
- `selectedRef` et l'empreinte de décision ;
- l'intent, la frame, le witness et la famille d'action ;
- la référence du candidat d'action ;
- une cible explicite ;
- une `AgentAction` publique déjà préparée ;
- les attentes et preuves de grounding ;
- les preuves de l'action et de la cible ;
- une empreinte déterministe du binding ;
- `actAuthorized: false`.

## Règles

### Origine externe

Le composant ne déduit pas une action depuis `selectedRef`.

La cible et la `AgentAction` sont fournies explicitement par un producteur externe. Le binding vérifie leur cohérence et leur provenance.

### Cible

Pour `ACTION6`, la cible doit être un point exact avec les mêmes coordonnées que le payload public.

Pour une autre action, la cible doit nommer exactement le même identifiant d'action.

### Observation courante

Le binding est lié à :

- la session ;
- la séquence ;
- l'image publique ;
- les actions disponibles ;
- l'état et le niveau publics.

Il est refusé si l'observation change ou si l'action candidate n'est plus disponible.

### Preuves

Les preuves sélectionnées doivent survivre dans le grounding et dans l'enveloppe de binding.

Les domaines d'attentes, de grounding, d'action et de cible sont explicites, non vides, sans doublon et bornés.

### Aucune autorité ACT

Même après un binding valide, le résultat conserve :

- `actionCandidatePresent: true` ;
- `actionPermitPresent: false` ;
- `releaseEligible: false` ;
- `actionReleased: false` ;
- `actAuthorized: false`.

Le candidat peut donc être audité, mais pas exécuté.

## Tests

### Tests du binding

`tests/v6-temporal-action-binding.test.ts`

Les 16 tests couvrent :

- actions point et non-point ;
- refus TemporalSelection ;
- identité de décision, observation et frame ;
- replay inter-session ou inter-séquence ;
- changement de l'image publique ;
- validité et disponibilité de l'action ;
- cohérence cible/payload ;
- gel des attentes et preuves ;
- préservation des preuves sélectionnées ;
- domaines explicites et bornés ;
- détection d'altération ;
- canonicalisation de l'empreinte ;
- copie détachée ;
- absence de permis et d'ACT.

### Tests des donneurs

`tests/v6-temporal-action-donor-audit.test.ts`

Cinq tests verrouillent directement les invariants des donneurs durables.

## Qualification GitHub CI

Run qualifiant :

`43351773278`

Commit qualifié :

`169a3a958507f12d52b86c45668137101895e893`

Résultat :

- **181 tests** ;
- **181 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi.

Le premier passage avait déjà réussi les 181 tests mais avait détecté quatre erreurs de raffinement TypeScript. Elles ont été corrigées sans modification du comportement, puis la suite et le typecheck ont réussi ensemble.

## Limites

Cette étape ne prétend pas restaurer exactement le mapping historique de Site 109.

Restent absents :

- le producteur historique du candidat d'action ;
- le schéma historique complet de `ActionIntent` ;
- le `source_action_release_permit` complet ;
- sa consommation unique et sa révocation ;
- le consommateur final qui transforme le permis en dispatch runtime ;
- la preuve d'une contribution en partie réelle.

## Prochaine étape

Reconstruire, si les donneurs le permettent, un reçu distinct de permis ACT lié au binding préparé et au contexte courant.

Ce reçu devra être séparé du candidat d'action, consommable une seule fois, révocable et revalidé immédiatement avant dispatch.

Tant que ce contrat n'est pas qualifié, le worker doit continuer à retourner `undefined` et le statut doit rester `action_withheld`.
