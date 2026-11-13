# Lot 9C1 — qualification fonctionnelle de `joint_channels`

Date : 13 novembre 2026 (America/Recife)

Branche : `recovery/lot9c1-bounded-joint-channels-20261113`

Base canonique : `d7ba12eef7063cf86dfa55f43879c29bc1dfa87d`

## Verdict

**Le contrat borné 9C1 est qualifié fonctionnellement.**

Cette qualification porte sur un premier mécanisme explicite de jointure de canaux. Elle ne revendique ni parité avec une ancienne implémentation `joint_channels`, ni efficacité sur ARC, ni qualification de performance.

## Contrat qualifié

Une proposition jointe :

- exige au moins deux canaux explicites et distincts ;
- exige la même `jointRef`, la même action et la même révision publique ;
- exige un contrat natif identique pour l’action, le bundle, l’état symbolique et l’identité d’observation ;
- ne classe et ne priorise aucun canal ;
- ne produit aucune action pour un seul canal, une révision périmée ou des contributions incompatibles ;
- reste ambiguë lorsqu’un propriétaire indépendant propose simultanément ;
- distribue le retour sélectionné une seule fois à chacun des canaux contributeurs.

Les états observables sont : `none`, `incomplete`, `incompatible` et `joint`.

## Chaîne causale vérifiée

`contributions explicites → compatibilité exacte → proposition unique → OP28 → CommonCampaignOwner → V6CommonCampaignDecisionPort → action`

Le test causal retire l’un des deux contextes de canal et constate que l’action disparaît. Les tests vérifient également le refus d’une action différente, d’une révision périmée et d’une fusion avec un propriétaire indépendant rival.

## Intégration

Fichiers principaux :

- `src/logos-engine/v6-joint-channel-action.ts` ;
- `src/logos-engine/v6-joint-channel-owner.ts` ;
- `src/runtime/v6-common-campaign-decision-port.ts` ;
- `tests/v6-joint-channel-owner.test.ts` ;
- `docs/recovery/lot9c1-bounded-joint-channel-contract.md`.

L’intégration produit est facultative. Aucun canal n’est installé par défaut, donc le comportement historique du port commun reste inchangé sans configuration explicite.

## Qualification GitHub Actions

Premier candidat qualifié :

- workflow : `Lot 9C1 bounded joint channels` ;
- run : `43360124299` ;
- job : `131671361673` ;
- commit : `351840fce1400135610e404d4205b51bc47c5acd` ;
- build de production et typecheck : **réussis** ;
- tests causaux ciblés : **8/8 réussis** ;
- suite TypeScript complète : **344/344 réussis** ;
- échecs, annulations et tests ignorés : **0**.

## Compteur, performance et publication

- aucun point d’entrée n’est déclaré restauré par ce lot ;
- le compteur des 76 points d’entrée reste inchangé ;
- aucune mesure de coût officielle n’est revendiquée ;
- aucune publication Site n’est incluse.

## Étape suivante

Le lot 9C2 doit raccorder au moins deux producteurs symboliques réels, apportant des informations distinctes et non redondantes, puis démontrer leur effet causal sur un corpus public. La performance sera mesurée seulement après cette qualification fonctionnelle, avec le seuil global strict de moins de +10 % par jeu.
