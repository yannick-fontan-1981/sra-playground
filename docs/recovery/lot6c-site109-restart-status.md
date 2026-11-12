# Lot 6C — reprise depuis la baseline canonique GitHub

Baseline canonique de reconstruction :
`recovery/site109-reconstruction-20261112`

Ancienne branche de récupération examinée :
`recovery/lot6c-product-dispatch`

Nouvelle branche de travail :
`recovery/lot6c-site109-restart-20261112`

## Comparaison initiale

La branche historique Lot 6C était 9 commits devant et 49 commits derrière la baseline canonique, avec un ancêtre commun ancien. Elle n'a donc pas été fusionnée.

Diff utile observé depuis la baseline :
- `src/agent-product-dispatch.ts` ajouté ;
- `src/main.ts` modifié ;
- `tests/agent-product-dispatch.test.ts` ajouté ;
- `tests/main-product-dispatch-integration.test.ts` ajouté ;
- deux anciens documents de récupération ajoutés.

## Classification

### Récupérable avec preuve

- `src/agent-product-dispatch.ts`
  - blob source historique : `83aa528f5e1db94d5ce198cafb27377393ed44a6`
  - comportement couvert par les contrats synthétiques récupérés.
- `tests/agent-product-dispatch.test.ts`
  - blob source historique : `e6740bfe5189e62d095d8ad8688c1841b51313b2`
  - 7 contrats : readiness, refus terminal/indisponible, ACTION6, timing hors présentation, ordre présentation/busy, génération obsolète avant présentation, génération obsolète pendant présentation.
- `tests/main-product-dispatch-integration.test.ts`
  - blob source historique : `2a199fd5f7310f34bb2080aa6874ef0d66402e16`
  - garde structurelle du raccordement produit.
- raccordement ciblé de `src/main.ts`
  - la baseline contenait encore le même `main.ts` source public que l'ancêtre utilisé par la branche de récupération ;
  - le portage est donc appliqué par transformation ciblée, pas par remplacement complet du fichier.

### Déjà présent dans la baseline

- le `src/main.ts` de base et son flux manuel historique ;
- `BrowserGameRuntime` et les contrats navigateur publics correspondants ;
- la structure de sélection de jeu, présentation et gestion d'erreur utilisée comme point d'ancrage.

### Manquant

- le runtime V6 complet historique de Site 109 ;
- le harness officiel de performance ;
- les campagnes historiques 6C complètes ;
- la preuve cryptographique reliant cette reconstruction au SHA Site historique `d90ce5b64fffa53cca201e2a6a49450fd123f299`.

### Documenté mais non reconstructible exactement

- les anciens documents `docs/migration/lot6c-recovery.md` et `docs/migration/lot6c-recovery-roadmap.md` décrivaient une reconstruction antérieure depuis une baseline différente ;
- ils ne sont pas portés tels quels afin de ne pas laisser entendre une parité Site 109 ou une ascendance Git inexistante ;
- les preuves historiques 8/8 worker/source-host/compiled-host restent des références historiques jusqu'à requalification sur la nouvelle baseline.

## Qualification actuelle

- 7/7 contrats fonctionnels du module dispatch passent localement sur un checkout neuf ;
- typecheck isolé du module : PASS ;
- le `main.ts` poussé sur cette branche contient le raccordement au module partagé et conserve `busy` jusqu'à la fin du chemin dispatch ;
- performance officielle : à confirmer, harness officiel non restauré.

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.
