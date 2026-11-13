# Reconstruction canonique SRA Playground — 2026-11-12

## Statut

Cette branche est la base canonique de **reconstruction** du runtime perdu du Site 109.

Elle ne doit pas être présentée comme une copie exacte de Site 109 / native 0.68 tant que les preuves de parité ne sont pas rétablies.

## Référence historique à restaurer

- Site : 109
- moteur natif historique : 0.68
- compteur historique : 70/76 entrées
- SHA Site historique connu : `d90ce5b64fffa53cca201e2a6a49450fd123f299`
- ce SHA n'est pas résolu dans le dépôt GitHub public actuellement accessible

## Base GitHub choisie

La branche `recovery/site109-reconstruction-20261112` part de `op01-op31-c0-c7-audit`, qui est la branche GitHub visible la plus riche en :
- documentation C0–C7 ;
- implémentations OP01–OP31 reconstruites ;
- traces et contrats de vérification ;
- éléments de composition V6 déjà reconstitués.

Elle ne contient toutefois pas encore le runtime V6 complet de Site 109.

## Éléments encore manquants avant de revendiquer une baseline 0.68 restaurée

Au minimum, les éléments historiquement utilisés par les lots doivent être récupérés ou reconstruits et requalifiés :
- `docs/migration/v6-delivery-roadmap.md`
- `docs/migration/v6-entry-point-progress.json`
- les intégrations natives des entrées déjà publiées jusqu'à 70/76
- les preuves fonctionnelles, campagnes, restauration et coûts nécessaires pour certifier la nouvelle baseline

## Progression Lot 5 — 5A / 5B / 5C

Intégration qualifiée depuis `recovery/lot5-site109-rebase-20261112` :
- 5A : complétion et transport d'observations liées ;
- 5B : acquisition adressée, guards, réponse/réfutation, rétention à la frontière, revalidation `FieldStock`, stock typé, obligations de préservation, proposition bornée et bundle OP18 ;
- 5C : continuité/persistance du parent observé dans son périmètre reconstruit.

État vérifié :
- la connaissance retenue reste un `prior` et n'est jamais applicable automatiquement à un nouvel objet ou contexte ;
- `FieldStock.create()` doit revalider la scène courante avant toute consommation ;
- le runtime refuse `beforeStock`, `afterStock`, `recordStock` et `proposeStock` sans stock courant revalidé ;
- les réponses incompatibles, les changements de matériau non sélectionné et les réécritures contradictoires réfutent explicitement l'hypothèse ;
- le plan `typed_field_stock` produit un bundle OP18 consommé par l'autorité native existante, sans nouvelle opération ni appel artificiel ;
- la compatibilité ESM du module Lot 6C `product-presentation-effects.ts` est corrigée uniquement par l'ajout des extensions `.ts`, sans changement de comportement ;
- GitHub Actions `43341200851` : `tsc --noEmit` réussi, **52/52 tests Lot 5**, **255/255 régressions globales** ;
- preuve détaillée : `docs/recovery/lot5-5b-integration-qualification.md`.

Statut Lot 5 :
**5B fonctionnellement qualifié sur le runtime V6 reconstruit ; performance officielle STCK/SMLP à confirmer.**

## Progression Lot 9 - reprise 9B

Branches intégrées/préparées :
- `recovery/lot9b-region-intervention-restart-20261112`
- `recovery/lot9b-region-reconstruction-v2-20261112`
- `recovery/lot9b-region-owner-integration-20261112`
- `recovery/lot9b-neutral-caller-20261112`

État vérifié :
- l'ancienne branche `lot9b-github-recovery-20261112` ne contient pas le runtime Region historique ;
- le noyau V6 reconstruit (operations, composition, authority, target-binding, cache, cycle, trace) a passé **27/27 tests ciblés** ;
- le coeur Region reconstruit, explicitement distinct de l'ancien 0.69, passe **13/13 tests** ;
- la frontière owner Region pour acquisition sélectionnée/passive, déduplication et restauration porte le total Region + owner à **19/19 tests** ;
- un caller commun neutre est reconstruit dans `src/logos-engine/v6-neutral-common-caller.ts` ;
- ce caller ne départage jamais plusieurs propositions : 0 -> none, 1 -> selected, >1 -> ambiguous ;
- l'adaptateur `src/logos-engine/v6-region-caller-adapter.ts` relie Region au caller sans modifier le coeur Region ;
- caller neutre + intégration Region passent **12/12 tests** ;
- total unique ciblé observé pour noyau V6 + Region + owner + caller + worker + delta public + campagne générique + protocole coût : **108/108 tests réussis** ;
- le dispatch produit/UI reste distinct du caller agent ;
- le transport worker public est reconstruit dans `src/runtime/v6-agent-worker-core.ts` + `src/runtime/v6-agent-worker.ts` et passe **14/14 tests** ; son port par défaut reste `reconstruction-pending-perception` et ne produit aucune action inventée ;
- la couche `observation publique -> delta visible` est reconstruite dans `src/logos-engine/v6-public-observation-delta.ts` et `src/logos-engine/v6-region-public-evidence.ts` ; elle passe **12/12 tests** et ne déduit jamais de `methodRef` à partir de la ressemblance visuelle ;
- le helper de campagne générique et borné est reconstruit dans `tests/helpers/v6-live-game-campaign.ts` et passe **7/7 tests** ; il conserve ACTION6, borne les pas, valide session/séquence et propage les erreurs worker sans dispatch caché ;
- le protocole ABBA de coût est reconstruit dans `scripts/measure-native-loop-costs.mjs` et passe **8/8 tests** : A1/B1/B2/A2, 8 warmups, 32 sessions mesurées, 24 + 400 actions, seuil global strict <10 % par jeu, phases >10 % conservées mais non bloquantes, aucun retry caché ;
- l'adaptateur `scripts/native-loop-session-adapter.mjs` est reconstruit et passe **9/9 tests** ; il exige explicitement A/STCK, A/SMLP, B/STCK et B/SMLP, sans chronométrage, corpus ou fallback implicite ;
- la production justifiée du `methodRef` et le branchement produit du worker vers les contextes owners restent absents ; l'audit source STCK/SMLP prouve désormais que le corpus public V1 ne peut jamais choisir ACTION6 en état non terminal car ACTION5 reste toujours disponible ; un sélecteur candidat ACTION6 strictement public (`region-public-action6-probe-v1`) est reconstruit et passe 4/4 tests autonomes, mais il n'est pas encore qualifié sur les vrais frames natifs ; les quatre identités de runners A/STCK, A/SMLP, B/STCK et B/SMLP sont reconstruites et routées explicitement au niveau du contrat `game_bridge` ; le hook B est maintenant raccordé au vrai chemin `regionPublicEffectEvidence → bindRegionMethod → RegionInterventionOwner.acquire`, avec post-action mesuré et sans inférence de `methodRef` ; les tests correspondants sont écrits mais leur exécution locale reste à confirmer dans un checkout complet ; l'exécution réelle Pyodide/`custom-games.zip`, la preuve que le corpus exerce réellement ACTION6/Region et les `sourceRef` A/B restent à qualifier ; aucune mesure officielle de coût n'a encore été exécutée ;
- aucun compteur historique 70/76 ou candidat 71/76 n'est promu au statut de la reconstruction actuelle.

Statut Lot 9 :
**noyau V6, coeur Region, owner, caller neutre, transport worker, delta public, helper de campagne, protocole ABBA, adaptateur runSession, contrats explicites des quatre runners A/B × STCK/SMLP et binding réel du hook Region reconstruits dans leurs périmètres ; exécution des nouveaux tests dans un checkout complet, exécution native réelle des runners, corpus exerçant réellement ACTION6/Region et performance officielle à confirmer.**

## Branches de récupération conservées

Ne pas supprimer ni écraser :
- `recovery/lot5-canonical-buffer`
- `recovery/lot6c-product-dispatch`
- `lot9b-github-recovery-20261112`
- `lot10d-temporal-selection-github-20261112`
- `op01-op31-c0-c7-audit`

Chaque lot doit comparer sa branche à cette branche canonique de reconstruction et porter seulement les éléments dont l'identité et les preuves peuvent être établies.

## Règle d'intégration

1. récupérer une capacité ou un composant depuis une branche connue ;
2. identifier son origine et son contrat ;
3. intégrer sur une branche de lot dérivée de cette reconstruction ;
4. exécuter tests et contrôles pertinents ;
5. committer et pousser ;
6. ouvrir/intégrer vers la branche canonique de reconstruction ;
7. mettre à jour ce document et la feuille de route ;
8. ne publier un nouveau Site qu'après avoir une baseline GitHub durable et qualifiée.

## Critère de sortie de reconstruction

La reconstruction peut devenir la nouvelle baseline canonique seulement lorsque :
- le runtime navigateur/worker est complet ;
- les 70/76 entrées historiquement publiées sont présentes ou explicitement réévaluées ;
- les tests fonctionnels requis passent ;
- les campagnes de référence sont reproductibles ;
- le harness de performance est restauré ;
- STCK et SMLP respectent le protocole de coût retenu ;
- la version publiée du Site est reliée à un SHA GitHub durable.

Jusque-là, la branche est viable pour travailler, tester, intégrer et reconstruire, mais pas pour revendiquer une équivalence exacte à Site 109.
