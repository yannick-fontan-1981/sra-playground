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
- `scripts/measure-native-loop-costs.mjs`
- `tests/helpers/v6-live-game-campaign.ts`
- `src/runtime/v6-agent-worker.ts`
- `docs/migration/v6-delivery-roadmap.md`
- `docs/migration/v6-entry-point-progress.json`
- les intégrations natives des entrées déjà publiées jusqu'à 70/76
- les preuves fonctionnelles, campagnes, restauration et coûts nécessaires pour certifier la nouvelle baseline

## Progression Lot 9 — reprise 9B

Branche de reprise :
`recovery/lot9b-region-intervention-restart-20261112`

État vérifié :
- l'ancienne branche `lot9b-github-recovery-20261112` ne contient que des documents et garde-fous de récupération ; aucun runtime Region historique n'y est récupéré ;
- le noyau V6 reconstruit présent sur la baseline (operations, composition, authority, target-binding, cache, cycle, trace) a été exercé sur un checkout local matérialisé depuis GitHub : **27/27 tests ciblés passent** après compilation TypeScript ;
- la tentative directe `node --test *.ts` a échoué avant exécution des tests à cause du Node local 22.16, inférieur au minimum repo >=22.18 ; cet échec est environnemental ;
- aucun chemin `region_intervention`, `chart_navigation`, `joint_channels` ou `yf_arc3_v6` n'est présent dans l'arbre canonique inspecté ;
- le donneur exact Region n'est donc pas reconstructible actuellement avec identité historique ;
- aucun compteur historique 70/76 ou candidat 71/76 n'est promu au statut de la reconstruction actuelle.

Statut Lot 9 :
**noyau V6 reconstruit fonctionnellement qualifié dans le périmètre ciblé ; Region non récupéré ; performance officielle à confirmer.**

La suite sûre est de récupérer une source/corpus Region exact et durable, ou de définir explicitement une nouvelle reconstruction comportementale distincte de l'ancien code avant toute qualification Region.

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
