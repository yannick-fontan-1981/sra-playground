# Lot 10D - contrat de permis ACT ordinaire

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

## Objet

Ce jalon reconstruit un permis ACT distinct pour le chemin ordinaire à action unique :

`TemporalSelection acceptée -> intent préparé -> binding candidat/action -> audit ACT éligible -> lease validée -> permis ACT`

Le permis autorise uniquement le franchissement d'une future frontière ACT. Il ne contient pas le payload `AgentAction`, ne marque pas l'action comme libérée et n'autorise aucun envoi vers l'environnement.

## Provenance durable

Le schéma historique utile a été retrouvé dans le dépôt V5 privé au commit épinglé :

`212d8d426f07eea2b6797c2bb647545767488a96`

La carte publique des donneurs, de leurs blobs Git et des invariants récupérés est conservée dans :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

Les donneurs établissent la séparation suivante :

1. un `ActionIntent` prépare une action ;
2. un `ActionReleasePermit` lie cet intent à une action disponible, un snapshot, une révision et une lease ;
3. ACT revalide le contexte et fait passer la lease à `RELEASED` ;
4. `ActionBoundary` revérifie le checkpoint avant le transport environnemental.

La reconstruction publique conserve cette séparation. Elle ne revendique pas une sérialisation octet pour octet identique à l'ancien runtime.

## Fichiers

Code :

`src/runtime/v6-temporal-action-release-permit.ts`

Tests :

`tests/v6-temporal-action-release-permit.test.ts`

Carte des donneurs :

`docs/recovery/lot10d-temporal-action-release-donor-map.md`

## Schémas publics

### Lease

Version :

`sra.temporal_concentration_lease.v1`

Le reçu de lease lie :

- l'identité Source ;
- la session, la séquence et l'empreinte de l'observation publique ;
- l'identité temporelle ;
- la frame et la révision contractuelle ;
- l'intent et le binding d'action ;
- le candidat d'action et son identifiant public ;
- l'identité courante de disponibilité de cette action ;
- les décisions DRM et SRC ;
- la raison d'acquisition ;
- le principe générique ;
- l'effet attendu ;
- les prémisses et falsificateurs ;
- les preuves qualifiées ;
- la borne d'expiration ;
- une empreinte déterministe.

Le chemin courant exige une lease `validated`.

### Permis

Version :

`sra.temporal_action_release_permit.v1`

Le reçu de permis lie :

- le workflow et le `sourceHash` ;
- la session et la séquence ;
- l'empreinte de l'observation publique ;
- l'identité et la révision temporelles ;
- la borne de validité ;
- l'intent, le binding, le candidat sélectionné et la décision ;
- le candidat d'action, la cible et l'identifiant public de l'action ;
- l'identité de disponibilité courante ;
- le snapshot pré-action ;
- l'évaluation de viability et la décision de commitment ;
- la lease validée ;
- les preuves agrégées ;
- une empreinte déterministe.

## Entrées exigées

`createTemporalActionReleasePermitReceipt(...)` reçoit :

1. une projection TemporalSelection acceptée ;
2. le witness exact de l'intent préparé ;
3. l'`AgentObservation` publique courante ;
4. le reçu de binding candidat/cible/action déjà qualifié ;
5. un audit ACT au statut `eligible` ;
6. les références d'autorité du permis et de la lease.

Le composant ne sélectionne aucun candidat et ne fabrique aucune preuve.

## Validation

La création et la relecture du permis vérifient notamment :

- sélection, intent, décision et observation identiques ;
- binding d'action encore valide ;
- audit ACT exactement `eligible` ;
- absence de payload ou d'autorité ACT dans l'audit préalable ;
- effet attendu déjà présent dans l'intent gelé ;
- références de viability, commitment, DRM, SRC, principe, prémisses et falsificateurs déjà présentes dans les preuves qualifiées ;
- domaines de références non vides, uniques et bornés ;
- action toujours présente dans `availableActionIds` ;
- identité exacte de disponibilité de l'action ;
- session, séquence, image publique et identité temporelle exactes ;
- snapshot pré-action égal à l'empreinte publique courante ;
- permis non périmé à sa création ;
- lease non périmée ;
- permis ne dépassant pas la borne d'expiration de la lease ;
- empreinte de lease intacte ;
- empreinte de permis intacte.

L'ordre des ensembles de preuves est canonicalisé pour l'empreinte, mais les doublons sont refusés avant canonicalisation.

## Identité de disponibilité

La reconstruction locale utilise :

`available-action:<sessionId>:<sequence>:<actionId>`

Cette identité ne prétend pas être l'encodage historique original. Elle rend toutefois explicites la session, la séquence et l'action publique qui étaient disponibles au moment de la création du permis.

## Sortie

Une projection réussie conserve :

- `actionPermitPresent: true` ;
- `releaseEligible: true` ;
- `actAuthorized: true` ;
- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `environmentDispatchAuthorized: false`.

Ici, `actAuthorized: true` signifie seulement que le reçu est admissible à une future exécution ACT distincte. Cela ne signifie ni que cette exécution a eu lieu, ni que l'action peut être envoyée au jeu.

La projection ne contient ni `candidateAction` ni cible exécutable.

## Portée volontairement exclue

Ce jalon ne reconstruit pas encore :

- la transition de lease `VALIDATED -> RELEASED` ;
- la revalidation ACT complète au moment de la consommation ;
- le reçu de consommation unique du permis ;
- la révocation persistée ;
- le consommateur runtime final ;
- `ActionBoundary` et son journal de tentative avant transport ;
- la récupération après résultat de transport incertain ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- le producteur public du candidat d'action ;
- une exécution comportementale réelle.

Les champs de série restent vides et `concentrationAcquisitionDeferred` reste `false`.

## Effet sur le worker

Le worker public n'est pas modifié. Le port TemporalSelection passif continue à retourner `undefined`.

Le statut opérationnel reste donc :

`action_withheld`

Aucune action n'est envoyée à l'environnement par ce jalon.

## Qualification

Commit de code et de provenance qualifié :

`467562a1e939e1d8fdc2609d0f212e73df5aeb24`

Run GitHub Actions :

`43356644647`

Résultat :

- **202 tests** ;
- **202 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute 18 tests fonctionnels du permis et 3 contrôles anti-dérive de la carte des donneurs au précédent total de 181.

## Performance

La reconstruction est fonctionnellement qualifiée. La performance officielle reste à confirmer, car les runners et corpus STCK/SMLP ne sont pas encore restaurés.

Le critère reste :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu évalué séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du même jeu respecte le seuil.

## Prochaine étape

Reconstruire la consommation ACT distincte :

`permis courant -> revalidation ACT -> lease RELEASED -> reçu de consommation unique`

Puis reconstruire séparément :

`ActOutput -> ActionBoundary -> tentative durable -> transport exactement une fois -> acquisition -> réconciliation`

Le worker restera en `action_withheld` tant que cette chaîne n'est pas entièrement qualifiée.
