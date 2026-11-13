# Lot 10D - TemporalSelection - statut de reconstruction GitHub

Date : 2026-11-12

## Identité du lot

Lot : **10D / TemporalSelection**

Branche de travail qualifiée :

`recovery/lot10d-temporal-selection-rebased-20261112`

Baseline canonique utilisée pour le report :

- branche : `recovery/site109-reconstruction-20261112`
- commit : `24fcdbb16c93de59489a6bb0392cc709b7a75d14`

La branche canonique observée après ce jalon avait avancé jusqu'à :

`8cc510e0a0d09704eb508b3aa2216b4d63482af4`

Cette divergence parallèle n'est pas une intégration. Une nouvelle réconciliation reste obligatoire avant tout port canonique.

## Nature de la reconstruction

L'ancienne branche historique `lot10d-temporal-selection-github-20261112` ne contenait aucun delta 10D récupérable. Le code actuel est une reconstruction qualifiée depuis des preuves GitHub durables, pas une copie certifiée de Site 109.

Aucune parité Site 109 / native 0.68 n'est revendiquée.

## Couche TemporalSelection reconstruite

Les briques suivantes sont présentes :

1. contrat Source / sélection fail-closed ;
2. contrat de réutilisation mémoire liée à l'observation courante ;
3. contrat d'identité et d'idempotence des retours ;
4. état minimal descriptif et restaurable ;
5. reçu de décision Source/DRM avec provenance ;
6. adaptateur de consommation d'une décision externe ;
7. bridge traçable vers le noyau Logos V6 ;
8. port runtime passif compatible avec `AgentDecisionPort` ;
9. audit distinct des gates d'éligibilité à la release ACT.

Derniers fichiers ajoutés :

- `src/runtime/v6-temporal-act-release-audit.ts`
- `tests/v6-temporal-act-release-audit.test.ts`
- `docs/recovery/lot10d-temporal-act-release-audit.md`

## Résultat de l'audit ACT

Les donneurs V5 durables établissent que la sélection ne libère jamais directement une action.

### Chaîne durable observée

`selected branch -> prepared ActionIntent -> action grounding -> operational wisdom -> release_action -> ACT`

Les sources principales sont :

- `reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/release_action.src`
- `reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/released_action_cycle.src`
- `reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src`
- `reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/continue_after_information_probe.src`

Les gates récupérables avec preuve sont :

- sélection acceptée et liée au même `selectedRef` ;
- même décision, observation et frame courante ;
- intent, witness d'action, famille et attentes explicitement identifiés ;
- preuves de grounding préservant les preuves de sélection ;
- action courante disponible ;
- grounding valide ;
- commitment `commit` ;
- viability `viable` ou `conditional` ;
- engagement expérimental courant ;
- preuves de contrôle courantes ;
- contrat mémoire valide ;
- continuité et influence parentales revalidées ;
- absence de replay fatal observé ;
- endpoint `not_applicable` ou `clear`.

Les refus et reports restent explicites :

- `revise`, `reject`, viability `blocked`, replay fatal et contact hostile bloquent ;
- `defer`, viability `undetermined` et sécurité non résolue reportent.

## Contrat d'audit ajouté

`auditTemporalActRelease(...)` reçoit :

- une projection TemporalSelection déjà qualifiée ;
- un witness d'intent déjà préparé ;
- les faits explicites des gates de release.

Il retourne :

- `eligible` ;
- `blocked` ;
- `deferred`.

Même si toutes les gates passent, le résultat conserve :

- `actionPayloadPresent: false` ;
- `actionReleased: false` ;
- `actAuthorized: false`.

`eligible` signifie uniquement que les gates connues sont satisfaites. Ce n'est pas un `ActionReleasePermit` et ce n'est pas une permission physique d'agir.

## Ce qui n'a pas été inventé

Les donneurs accessibles ne suffisent pas encore à reconstruire exactement :

- le schéma historique complet de `ActionIntent` ;
- la conversion `selectedRef -> cible -> AgentAction` ;
- les coordonnées ou paramètres exacts d'une action TemporalSelection ;
- l'encodage historique de `ActionReleasePermit` ;
- le producteur runtime de chaque preuve de release ;
- le consommateur final et la position exacte dans l'ancien runtime Site 109.

Le port runtime reste donc en mode :

`action_withheld`

et retourne toujours `undefined`.

## Worker public

Le port passif et l'audit ACT sont qualifiés par injection. Ils ne remplacent pas le port public par défaut :

`PendingPerceptionDecisionPort`

Le worker public conserve la révision :

`reconstruction-pending-perception`

et ne fabrique aucune action.

## Qualification GitHub CI

Commit de code qualifié :

`a474b6c1862879f79272bd44cdf05b8235fe7c54`

Run GitHub Actions :

`43348069627`

Résultat :

- **160 tests** ;
- **160 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck strict réussi sur le sink, TemporalSelection, le worker, le port passif et l'audit ACT.

Le présent jalon ajoute **15 tests** au précédent total de 145.

Les tests couvrent notamment :

- binding sélection / décision / observation ;
- domaines d'attentes et de preuves ;
- disponibilité et grounding ;
- commitment et viability ;
- preuves courantes de contrôle, mémoire et parent ;
- replay fatal et endpoint ;
- distinction `blocked` / `deferred` / `eligible` ;
- absence de payload d'action et d'autorité ACT.

## Limites fonctionnelles restantes

Ne sont toujours pas reconstruits :

- la politique historique de choix TemporalSelection ;
- l'ancien state machine Site 109 ;
- le producteur public justifié des domaines/candidats ;
- le schéma historique complet de l'intent ;
- la liaison exacte candidat -> cible -> `AgentAction` ;
- le permis ACT historique et sa consommation unique ;
- `src/logos-engine/v6-native-runtime.ts` ;
- la position finale dans le runtime commun ;
- le registre reconstruit des entrées ;
- une contribution démontrée dans une partie réelle ;
- les quatre runners natifs officiels A/B x STCK/SMLP.

## Performance

Le protocole ABBA et son calcul sont présents sur la baseline canonique, mais les runners et le corpus officiels ne sont pas restaurés.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Critère conservé :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- chaque jeu séparément ;
- aucune compensation ;
- une phase interne peut dépasser +10 % si le global du même jeu respecte le seuil.

## Prochaine étape

Chercher un donneur durable de la liaison exacte :

`prepared ActionIntent -> AgentAction publique -> ActionReleasePermit -> consommateur runtime`

Si ce donneur est retrouvé, reconstruire séparément :

1. le contrat d'intent d'action attribué ;
2. la liaison vers une action actuellement disponible ;
3. un permis ACT lié à l'observation et à la révision ;
4. la consommation unique et la révocation ;
5. la trace du consommateur runtime.

S'il reste absent, conserver `action_withheld` et documenter le manque. Toute nouvelle liaison devra être présentée comme un nouveau contrat explicitement spécifié et qualifié, jamais comme une restitution supposée de Site 109.
