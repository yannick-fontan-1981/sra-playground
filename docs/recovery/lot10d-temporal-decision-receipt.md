# Lot 10D — reçu de décision Source/DRM

Date : 2026-11-12

## But

Remplacer le `selectedRef` externe brut par un reçu de décision attribué à une Source et à un domaine DRM précis.

Fichier :

`src/logos-engine/v6-temporal-decision-receipt.ts`

Tests :

`tests/v6-temporal-decision-receipt.test.ts`

L'adaptateur `v6-temporal-selection-adapter.ts` exige désormais ce reçu.

## Sources durables

Le contrat reprend les invariants de :

- `reference/sra/212d8d426f07/agents/yf_arc3_v5/runtime/compiled_selection_tree.py`
- `reference/sra/212d8d426f07/agents/yf_arc3_v5/scheduler/contribution_contract.py`

Le donneur V5 conserve notamment :

- `src_source_hash` ;
- les `drm_source_hashes` ;
- le domaine canonique des alternatives ;
- la référence sélectionnée ou le refus ;
- l'identité/révision du retour et son producteur.

## Contenu du reçu

Le reçu reconstruit transporte :

- version de schéma ;
- workflow Source ;
- source hash ;
- liste non vide et sans doublon des DRM source hashes ;
- identité épisode / époque / observation / révision ;
- domaine canonique complet des alternatives ;
- `selectedRef` ou `null` ;
- références de preuves ;
- empreinte déterministe du payload ;
- `actAuthorized: false`.

## Empreinte

`decisionFingerprint` utilise FNV-1a 32 bits sur une représentation canonique du payload.

Cette empreinte sert à détecter une altération accidentelle ou une divergence d'identité dans le transport.

**Ce n'est pas une signature cryptographique, un MAC ni une racine de confiance.**

La confiance provient toujours de la concordance avec :

- l'autorité Source courante ;
- le source hash ;
- l'observation/révision courante ;
- le domaine exact des alternatives.

## Adaptateur renforcé

L'adaptateur n'accepte plus :

`{ selectedRef }`

Il exige :

`{ decisionReceipt }`

Avant toute projection, il vérifie :

- version du reçu ;
- identité Source ;
- observation ;
- domaine ;
- selectedRef ;
- empreinte.

Une décision refusée reste fail-closed.

Un retour candidat ne peut être consommé que s'il est déjà qualifié et relié aux preuves du candidat sélectionné.

Aucune décision ni consommation ne produit ACT.

## Qualification GitHub CI

Workflow :

`.github/workflows/lot10d-temporal-recovery.yml`

Run :

- ID : `43337775418`
- head qualifié : `dc40029d8fa846295424ba2695e4a3e274abea27`
- conclusion : **success**

Suite exécutée :

- six fichiers de tests TemporalSelection ;
- six sources Temporal soumises au typecheck strict.

Résultat des tests :

- **52 tests**
- **52 réussis**
- **0 échec**

Le job `Typecheck reconstructed TemporalSelection sources` a également terminé en **success**.

Ces durées sont des durées de tests CI et ne constituent pas une mesure officielle de performance de l'agent.

## Limites

Le reçu prouve la cohérence du transport avec le contexte fourni ; il ne prouve pas que la politique qui a produit `selectedRef` est la politique historique de Site 109.

La politique historique reste absente.

Le reçu n'autorise pas non plus une action : l'autorité ACT reste un contrat distinct.

## Prochaine étape

Raccorder le reçu et l'état minimal au **noyau Logos V6 existant** sous forme d'un bridge purement décisionnel :

`besoin → domaine Source → reçu externe vérifié → projection → consommation de preuve`

sans encore libérer de commande de jeu.

Ce bridge devra produire une trace bornée compatible avec les contrats `OperationTraceSink` existants.
