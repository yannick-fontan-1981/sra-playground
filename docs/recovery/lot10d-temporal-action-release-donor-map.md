# Lot 10D — donneurs durables du permis ACT et de la frontière d'envoi

Date : 2026-11-12

Branche de reconstruction :

`recovery/lot10d-temporal-selection-rebased-20261112`

## Portée

Ce document qualifie les invariants historiques récupérables pour la chaîne :

`prepared ActionIntent -> ActionReleasePermit -> ACT -> ActionBoundary`

Il ne publie pas les sources privées complètes et ne revendique pas une identité de code avec Site 109. Il fixe seulement les chemins, le commit, les blobs et les invariants nécessaires à la reconstruction publique.

Le donneur amont est le dépôt privé :

`yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`

Commit épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

## Sources qualifiées

| Source amont | Blob Git | Invariant récupéré |
| --- | --- | --- |
| `agents/yf_arc3_v5/action_authority/contracts.py` | `6384f5f790beda7525e3554c3ec38c08d92bbbca` | projection jointe de priorité, utilité, intent, action, candidat, objectif, engagement, prémisses, effets attendus et falsificateurs |
| `agents/yf_arc3_v5/logos/operations.py` | `2c713bb31dc4d8ec8f1774be87018832c3a91eb6` | schémas historiques `ActionIntent`, `ConcentrationLease` et `ActionReleasePermit` |
| `agents/yf_arc3_v5/operators/runtime.py` | `17a46b4ea93fd635cd6f075a837c44cf9d24fbbe` | revalidation ACT, transition de lease vers `RELEASED`, production d'un `ActOutput` sans transport environnemental |
| `agents/yf_arc3_v5/scheduler/runtime.py` | `258324dcb643bc1d76d4d02766e9ff6b50fbc879` | revalidation du checkpoint, de Source, de la révision, du snapshot, de l'intent, du permis, de la responsabilité et de la lease avant transport |
| `agents/yf_arc3_v5/runtime/boundary.py` | `03b49289a5611b81b74024d179ecfd727e0301f4` | frontière d'envoi exactement une fois, tentative durable avant transport, refus de redélivrer un résultat incertain, reprise causale exacte |
| `agents/yf_arc3_v5/runtime/contracts.py` | `8d4200b32217aea168433cc3c49aa895f8340394` | contrats transport-only de la frontière environnementale unique |
| `agents/yf_arc3_v5/agent.py` | `1bfc3cd49420101b79fc9691cf8d84e90fe4eb2c` | le bridge public n'expose qu'une action déjà autorisée et revérifie le contexte avant dispatch |

## Schéma historique récupéré

### `ActionReleasePermit`

Les champs durables attestés sont :

- `action_intent_id` ;
- `viability_assessment_id` ;
- `commitment_decision_id` ;
- `available_action_ref` ;
- `pre_action_snapshot_digest` ;
- `valid_through_state_revision` ;
- une `concentration_lease` ;
- des champs optionnels pour une série pré-déclarée ;
- un indicateur optionnel d'acquisition différée de la concentration.

Le permis refuse dès sa construction :

- une fenêtre de validité antérieure à sa propre révision ;
- une lease qui n'est ni acquise ni validée ;
- une lease liée à un autre intent ;
- une lease liée à une autre timeline ;
- une lease dont la révision contractuelle diffère de celle du permis.

### `ConcentrationLease`

La lease est un focus opérationnel borné, pas une seconde pile de raisonnement. Elle transporte notamment :

- le jeu, le niveau et la session ;
- la frame et la révision contractuelle ;
- l'objectif ou l'étape d'information active ;
- les décisions DRM et SRC ;
- l'action permise et l'intent correspondant ;
- les prémisses, le principe générique, l'effet attendu et les falsificateurs ;
- les contraintes de préservation ;
- une borne d'expiration ;
- éventuellement une liste finie d'intents d'extension.

Pour le chemin ordinaire reconstruit dans ce jalon, seule une lease `VALIDATED` est admise. Les variantes série, lease acquise mais non encore validée et acquisition différée restent hors portée.

## Séparation des autorités

Le donneur établit quatre frontières distinctes :

1. le binding prépare une action candidate et sa cible ;
2. le permis lie l'intent, l'action disponible, le commitment, la viability, le snapshot et une lease validée ;
3. ACT revalide les preuves et fait passer la lease à `RELEASED` ;
4. `ActionBoundary` revérifie le checkpoint suspendu avant tout transport.

Un permis n'est donc pas :

- un payload `AgentAction` livré au worker ;
- une preuve qu'ACT a été exécuté ;
- une autorisation d'envoyer immédiatement l'action au jeu ;
- une observation de l'effet ;
- un droit de redélivrer une tentative dont le résultat est incertain.

## Revalidation ACT historique

Avant de produire `ActOutput`, le runtime historique exige notamment :

- les supports non retirés ;
- la continuité de la responsabilité ;
- les consommations de buts encore courantes ;
- le binding de continuation parent ;
- la cohérence du transport des contributions ;
- la présence de la lease dans son contexte d'exécution canonique ;
- une session, une timeline, une frame et une révision exactes ;
- l'intent dans le domaine de la lease ;
- l'action autorisée par la lease ;
- une lease non expirée ;
- le même intent, commitment et `available_action_ref` dans le permis ;
- le même workflow et la même timeline.

Le résultat ACT transporte seulement :

- `action_ref` ;
- `action_intent_id` ;
- `action_release_permit_id`.

Le transport environnemental reste dans `ActionBoundary`.

## Frontière d'envoi exactement une fois

Avant le premier appel au transport, `ActionBoundary` :

- relit l'intent et le permis exacts depuis le checkpoint suspendu ;
- construit un digest de requête couvrant adaptateur, workflow, timeline, frame, intent, permis et contexte monde ;
- appelle `require_current_dispatch` ;
- persiste une tentative avant l'appel externe.

Conséquences :

- une tentative existante sans preuve de dispatch est classée `unknown` ;
- sa redélivrance est interdite jusqu'à réconciliation externe ;
- un dispatch déjà enregistré est réutilisé sans nouvel envoi ;
- la réponse doit conserver les identités de dispatch, intent et permis ;
- la reprise causale transporte intent, permis, événement d'environnement, snapshot et observation acquise.

La consommation exactement une fois appartient donc à une étape séparée du permis reconstruit ici.

## Mapping public V6 du présent jalon

Le contrat public reconstruit utilise uniquement les identités déjà disponibles dans le runtime navigateur :

- `sessionId` ;
- `sequence` ;
- `TemporalObservationIdentity` ;
- `observationRevision` ;
- l'empreinte de l'`AgentObservation` publique ;
- `availableActionIds` ;
- le binding candidat / cible / `AgentAction` déjà qualifié ;
- le résultat `eligible` de l'audit ACT.

Le mapping est volontairement explicite :

- `observationRevision` représente la borne de révision publique de cette reconstruction ;
- l'empreinte de l'observation publique représente le snapshot pré-action ;
- `available-action:<session>:<sequence>:<id>` représente l'identité locale de disponibilité ;
- les références de viability, commitment, DRM, SRC, principe, prémisses et falsificateurs doivent déjà appartenir aux preuves qualifiées de l'audit ou de l'intent.

Ce mapping n'est pas présenté comme la sérialisation historique originale.

## Limites du jalon

Le jalon courant reconstruit seulement un permis ordinaire à action unique :

- lease validée ;
- action courante disponible ;
- snapshot et révision exacts ;
- preuves causales conservées ;
- empreintes déterministes ;
- `actAuthorized: true` pour franchir la future frontière ACT ;
- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `environmentDispatchAuthorized: false`.

Restent séparés :

- l'exécution ACT et la transition vers `RELEASED` ;
- le journal de consommation unique ;
- le consumer final du permis ;
- la frontière d'envoi et sa récupération après résultat incertain ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- la campagne comportementale réelle ;
- la mesure officielle STCK/SMLP.
