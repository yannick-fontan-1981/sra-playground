# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-12

## Identité

- Lot : **10D / TemporalSelection**
- Branche : `recovery/lot10d-temporal-selection-rebased-20261112`
- Baseline de report : `recovery/site109-reconstruction-20261112` au commit `24fcdbb16c93de59489a6bb0392cc709b7a75d14`
- Tête canonique parallèle observée après ce jalon : `67602172665b79e2b282b37b63f80dc24feff3b0`

La divergence parallèle n'est pas une intégration. Aucune parité avec Site 109 / native 0.68 n'est revendiquée.

## Nature de la reconstruction

L'ancienne branche historique ne contenait aucun delta 10D récupérable. Le code actuel est une reconstruction qualifiée depuis des donneurs et contrats durables versionnés sur GitHub.

## Couche reconstruite

Les briques présentes sont :

1. sélection Source fail-closed ;
2. mémoire liée à l'observation ;
3. identité et idempotence des retours ;
4. état descriptif restaurable ;
5. reçu Source/DRM ;
6. adaptateur de consommation ;
7. bridge traçable Logos V6 ;
8. port runtime passif ;
9. audit des gates d'éligibilité ACT ;
10. binding attribué d'un candidat `AgentAction` préparé.

Derniers fichiers ajoutés :

- `src/runtime/v6-temporal-action-binding.ts`
- `tests/v6-temporal-action-binding.test.ts`
- `tests/v6-temporal-action-donor-audit.test.ts`
- `docs/recovery/lot10d-temporal-action-binding.md`

## Binding du candidat d'action

Le nouveau reçu lie explicitement :

- le workflow et le source hash ;
- la session et la séquence publiques ;
- l'empreinte exacte de l'observation publique ;
- l'identité temporelle ;
- le candidat TemporalSelection et l'empreinte de décision ;
- l'intent, la frame, le witness et la famille d'action ;
- une cible explicite ;
- une `AgentAction` publique déjà préparée ;
- les attentes, preuves de grounding, d'action et de cible ;
- une empreinte déterministe du binding.

Le composant ne transforme pas lui-même `selectedRef` en action. La cible et l'action candidate sont fournies par un producteur externe puis vérifiées.

Pour `ACTION6`, les coordonnées de la cible et du payload doivent être identiques. Pour les autres actions, l'identifiant de la cible doit correspondre à celui de l'action.

Le binding est refusé si :

- la sélection est refusée ;
- l'intent ne conserve pas la décision et l'observation ;
- la session, la séquence ou l'image publique diffèrent ;
- l'action n'est pas une `AgentAction` valide ;
- l'action n'est plus disponible ;
- la cible et le payload divergent ;
- les preuves sélectionnées sont perdues ;
- les domaines de preuves sont vides, dupliqués ou hors borne ;
- le payload du reçu a été altéré.

## Séparation ACT maintenue

Un binding valide expose un candidat d'action, mais conserve :

- `actionCandidatePresent: true` ;
- `actionPermitPresent: false` ;
- `releaseEligible: false` ;
- `actionReleased: false` ;
- `actAuthorized: false`.

Le port runtime continue donc à retourner `undefined` et reste en statut `action_withheld`.

Le worker public reste `reconstruction-pending-perception` et n'est pas remplacé.

## Donneurs durables verrouillés

Les tests documentaires contrôlent :

- `agent.py` et son autorité `source_action_release_permit` ;
- le contexte exact `run/timeline/frame/revision` avant dispatch ;
- l'ordre `grounding -> wisdom -> release -> ACT` ;
- les workflows qui préparent une action sans exécuter l'environnement ;
- la chaîne architecturale exacte `intent -> permit -> dispatch -> acquisition`.

## Qualification GitHub CI

Commit qualifié :

`169a3a958507f12d52b86c45668137101895e893`

Run GitHub Actions :

`43351773278`

Résultat :

- **181 tests** ;
- **181 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck TypeScript strict réussi.

Le jalon ajoute 16 tests fonctionnels du binding et 5 tests directs des donneurs au précédent total de 160.

## Limites restantes

Ne sont pas encore reconstruits :

- la politique historique de sélection ;
- l'ancien state machine Site 109 ;
- le producteur public des candidats ;
- le schéma historique complet de `ActionIntent` ;
- le producteur historique exact du mapping `selectedRef -> AgentAction` ;
- le reçu complet `source_action_release_permit` ;
- sa consommation unique et sa révocation ;
- le consommateur runtime final ;
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

Rechercher et reconstruire, uniquement avec preuve durable, le reçu distinct `source_action_release_permit` :

1. identité du permis et de son producteur ;
2. binding exact au candidat préparé ;
3. observation, frame, timeline et révision courantes ;
4. gates finales de release ;
5. consommation unique ;
6. révocation ;
7. consommateur runtime final.

Si la chaîne historique reste incomplète, le candidat d'action restera visible mais inexécutable. Toute nouvelle conception devra être explicitement distinguée d'une restitution de Site 109.
