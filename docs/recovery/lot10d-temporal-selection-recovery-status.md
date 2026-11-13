# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-13

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Tête canonique parallèle observée après ce jalon : `81f56ce74a3413d3835bd4b30b9c3fd14570aabc`

La divergence parallèle n'est pas une intégration. Aucune parité complète avec Site 109 / native 0.68 n'est revendiquée.

## Nature de la reconstruction

L'ancienne branche historique ne contenait aucun delta 10D récupérable. Le code actuel est une reconstruction qualifiée à partir de contrats et donneurs GitHub durables.

Les sources historiques utiles ont été retrouvées dans le dépôt V5 privé au commit :

`212d8d426f07eea2b6797c2bb647545767488a96`

Le code privé n'est pas republié. Les invariants récupérés sont décrits dans les documents publics du lot.

## Couche reconstruite

Les briques présentes sont maintenant :

1. sélection Source fail-closed ;
2. mémoire liée à l'observation ;
3. identité et idempotence des retours ;
4. état descriptif restaurable ;
5. reçu Source/DRM ;
6. adaptateur de consommation ;
7. bridge traçable Logos V6 ;
8. port runtime passif ;
9. audit des gates d'éligibilité ACT ;
10. binding attribué d'un candidat `AgentAction` préparé ;
11. permis ACT ordinaire lié à une lease de concentration validée ;
12. consommation ACT ordinaire, transition de lease et révocation terminale ;
13. `ActionBoundary` durable jusqu'au dispatch enregistré et à l'observation acquise ;
14. qualification causale de l'observation, consommation unique et projection d'un checkpoint repris.

Derniers fichiers ajoutés :

- `src/runtime/v6-temporal-causal-resume.ts`
- `tests/v6-temporal-causal-resume.test.ts`
- `docs/recovery/lot10d-temporal-causal-resume.md`

## Chaîne publique qualifiée

La chaîne reconstruite atteint désormais :

`TemporalSelection -> intent préparé -> binding action -> audit ACT -> permis -> consommation ACT -> checkpoint suspendu -> tentative durable -> transport -> dispatch durable -> observation causale -> ActionObserved -> lease OBSERVED -> checkpoint ACTIVE`

Le worker public n'utilise pas encore cette chaîne par défaut.

## Reprise causale reconstruite

Le nouveau composant reçoit :

- le journal durable `ActionBoundary` ;
- l'identité du dispatch ;
- le checkpoint suspendu ;
- le permis ;
- le reçu ACT consommé ;
- l'autorité courante de reprise.

Il exige une tentative et un dispatch durables exacts.

Il revalide :

- les empreintes du permis, de la lease, du reçu ACT et du dispatch ;
- la lignée checkpoint / intent / permis / reçu ACT / action ;
- Source, workflow et instance ;
- run, timeline, frame suspendue et révision ;
- snapshot sémantique pré-action ;
- responsabilité et intent responsable ;
- liaison courante du retour observé ;
- identité et chronologie de l'observation acquise ;
- dispatch, reçu ACT et transition de lease canoniques.

Une divergence produit un refus avant consommation de l'observation.

## Reçu causal atomique

Une reprise qualifiée crée ensemble :

1. un reçu d'observation acquise ;
2. un reçu `ActionObserved` ;
3. une transition de lease `released -> observed` ;
4. un checkpoint repris ;
5. un reçu global de reprise causale.

Le checkpoint repris :

- passe à `active` ;
- avance sa séquence d'une unité ;
- pointe vers la nouvelle frame ;
- lie le raw input acquis au binding de frame attendu ;
- ajoute l'observation aux références consommées ;
- efface la lignée d'action en attente ;
- conserve les identités du dispatch, de l'événement, de l'intent et du permis dans les reçus causaux.

Cette projection reprend les invariants du scheduler historique sans prétendre recréer sa sérialisation exacte.

## Consommation unique

Le journal causal est borné et fail-closed :

- capacité par défaut : 128 ;
- maximum configurable : 1024 ;
- une seule reprise par dispatch ;
- une seule reprise par checkpoint suspendu ;
- une seule consommation par observation acquise ;
- une seule consommation par événement environnemental ;
- aucune éviction silencieuse ;
- restauration avec validation de toutes les empreintes.

Rejouer exactement la même chaîne retourne le reçu existant :

- `reused: true` ;
- aucun second checkpoint émis ;
- aucune seconde consommation ;
- aucun second `ActionObserved`.

## Résultat inconnu maintenu hors succès

Une tentative durable sans dispatch durable reste :

- `outcomeStatus: unknown` ;
- `redeliveryPermitted: false` ;
- `reconciliationRequired: true` ;
- `observationConsumed: false` ;
- `checkpointResumed: false`.

La reprise causale ne fabrique donc jamais une observation ni un succès lorsqu'une preuve durable du résultat externe manque.

La réconciliation externe d'un résultat `unknown` reste ouverte et doit rester séparée de la reprise normale.

## Séparation avec l'exécution suivante du workflow

La couche produit un checkpoint repris `active`, mais n'exécute pas encore l'interpréteur scheduler après cette reprise.

Elle ne :

- choisit aucun nouveau candidat ;
- ne produit aucune nouvelle action ;
- ne conserve aucun payload `AgentAction` ;
- ne réautorise pas ACT ;
- ne redéclenche pas le transport ;
- ne transforme pas automatiquement l'observation en nouvel état TemporalSelection.

Le worker public reste :

`reconstruction-pending-perception`

Le port continue à retourner `undefined`. Le statut global reste donc :

`action_withheld`

jusqu'à qualification du bridge de continuation et du consommateur runtime final.

## Qualification GitHub CI

Commit de code, tests et workflow qualifié :

`f87d41a5dd76fbdab07618537746c9b61d9c7280`

Run GitHub Actions :

`43426455317`

Résultat :

- **255 tests** ;
- **255 réussis** ;
- **0 échec** ;
- 0 annulé ;
- 0 ignoré ;
- 0 todo ;
- typecheck TypeScript strict réussi ;
- checkout GitHub normal ;
- aucune migration automatique ;
- aucune permission d'écriture du workflow de qualification.

Le jalon ajoute au précédent total de 240 :

- 15 tests fonctionnels de reprise causale ;
- le typecheck strict de `v6-temporal-causal-resume.ts` ;
- les régressions worker, runtime V6, Logos et TemporalSelection.

`npm ci` signale toujours deux vulnérabilités de sévérité élevée dans les dépendances de la baseline. Aucune correction forcée n'a été appliquée dans ce lot, car elle toucherait un périmètre partagé qui exige une qualification séparée.

## Limites générales restantes

Ne sont toujours pas reconstruits ou qualifiés :

- la politique historique de sélection TemporalSelection ;
- l'ancien state machine Site 109 ;
- le producteur public des domaines et candidats ;
- le producteur historique exact du mapping `selectedRef -> AgentAction` ;
- la réconciliation externe d'une tentative `unknown` ;
- la preuve externe qu'un effet incertain a ou n'a pas eu lieu ;
- la consommation du checkpoint repris par le véritable scheduler ;
- la continuation du workflow après reprise ;
- la création du nouvel état TemporalSelection depuis l'observation causale ;
- le consommateur runtime final ;
- les séries pré-déclarées ;
- l'acquisition différée de concentration ;
- la position dans le runtime commun ;
- le registre des entrées ;
- une contribution en partie réelle ;
- les runners et corpus officiels STCK/SMLP.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation entre jeux ;
- une phase interne peut dépasser +10 % si le global du même jeu reste sous le seuil.

## Prochaine étape

Reconstruire le bridge de continuation après reprise :

`reçu causal -> checkpoint ACTIVE -> nouvelle observation temporelle -> continuation du workflow`

La prochaine qualification devra :

1. consommer le reçu causal une seule fois ;
2. créer une identité de nouvelle observation liée au dispatch ;
3. éviter toute réutilisation automatique des preuves devenues périmées ;
4. conserver dispatch, événement, intent, permis et reçu ACT comme lignée ;
5. raccorder la nouvelle observation au `TemporalObservationState` ;
6. séparer la reprise du checkpoint de l'exécution ultérieure du workflow ;
7. empêcher une seconde continuation depuis le même reçu ;
8. maintenir une tentative `unknown` hors de cette chaîne ;
9. laisser le worker public inactif tant que le producteur public et le consommateur runtime final ne sont pas qualifiés.
