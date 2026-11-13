# Reconstruction canonique SRA Playground — 2026-11-12

## Statut

Cette branche est la base canonique de **reconstruction** du runtime perdu du
Site 109.

Elle ne doit pas être présentée comme une copie exacte de Site 109 / native 0.68
tant que les preuves de parité ne sont pas rétablies.

## Référence historique à restaurer

- Site : 109
- moteur natif historique : 0.68
- compteur historique : 70/76 entrées
- SHA Site historique connu : `d90ce5b64fffa53cca201e2a6a49450fd123f299`
- ce SHA n’est pas résolu dans le dépôt GitHub public actuellement accessible

## Base GitHub choisie

La branche `recovery/site109-reconstruction-20261112` part de
`op01-op31-c0-c7-audit`, qui est la branche GitHub visible la plus riche en :

- documentation C0–C7 ;
- implémentations OP01–OP31 reconstruites ;
- traces et contrats de vérification ;
- éléments de composition V6 déjà reconstitués.

Elle ne contient toutefois pas encore le runtime V6 complet de Site 109.

## Éléments encore manquants avant de revendiquer une baseline 0.68 restaurée

Au minimum :

- `docs/migration/v6-delivery-roadmap.md` ;
- `docs/migration/v6-entry-point-progress.json` ;
- les intégrations natives des entrées déjà publiées jusqu’à 70/76 ;
- les preuves fonctionnelles, campagnes, restauration et coûts nécessaires pour
  certifier une nouvelle baseline.

## Progression Lot 5 — 5A / 5B / 5C

Intégration qualifiée depuis `recovery/lot5-site109-rebase-20261112` :

- 5A : complétion et transport d’observations liées ;
- 5B : acquisition adressée, guards, réponse/réfutation, rétention à la
  frontière, revalidation `FieldStock`, stock typé, obligations de
  préservation, proposition bornée et bundle OP18 ;
- 5C : continuité/persistance du parent observé dans son périmètre reconstruit.

État vérifié :

- la connaissance retenue reste un `prior` et n’est jamais applicable
  automatiquement à un nouvel objet ou contexte ;
- `FieldStock.create()` doit revalider la scène courante avant toute
  consommation ;
- le runtime refuse `beforeStock`, `afterStock`, `recordStock` et
  `proposeStock` sans stock courant revalidé ;
- les réponses incompatibles, changements de matériau non sélectionné et
  réécritures contradictoires réfutent explicitement l’hypothèse ;
- le plan `typed_field_stock` produit un bundle OP18 consommé par l’autorité
  native existante, sans nouvelle opération ni appel artificiel ;
- la compatibilité ESM du module Lot 6C `product-presentation-effects.ts` est
  corrigée uniquement par l’ajout des extensions `.ts`, sans changement de
  comportement ;
- GitHub Actions `43341200851` : typecheck réussi, **52/52 tests Lot 5** et
  **255/255 régressions globales** ;
- preuve : `docs/recovery/lot5-5b-integration-qualification.md`.

## Propriétaire commun OP18/OP28

Le produit navigateur possède maintenant un contrôleur Agent unique et borné.
Il instancie le seam browser direct ; le Worker commun reste qualifié mais n’est
pas instancié par `main.ts`.

### Chaîne produit active

`BrowserAgentController` possède une seule session, une limite de 64 actions et
un transfert Agent → Manual gracieux après règlement d’un retour déjà en vol.
Il s’arrête sans fallback sur `none`, `ambiguous`, `pending`, `blocked`, terminal,
obsolescence, erreur ou limite.

Le mode Manual conserve son dispatch historique et ne traverse aucune campagne
Agent.

### OP28

Le propriétaire public strict reste actif lorsque l’observation expose une seule
action simple complète. La chaîne traverse autorité Logos, dispatch physique,
retour corrélé au même `needId`, acquisition et présentation.

### FieldStock / OP18 dans le browser

`BrowserFieldStockOwnerTransport` est maintenant enregistré avec OP28 dans
l’hôte par défaut.

Il reste inerte lorsque le runtime est vide. Un prior explicitement fourni doit
être revalidé uniquement depuis la scène publique 64×64 avant toute proposition
OP18. Un stock provenant d’une autre session est rétrogradé en prior et ne peut
pas contourner cette revalidation.

Le retour sélectionné est consommé par `afterStock()` et `recordStock()` avant
la frontière locale et avant la présentation.

Scénario qualifié : prior public revalidé, ACTION6 vers `(22,20)`, réécriture
conjointe observée, puis rétention correcte lors d’une frontière officielle.

Le produit ne possède toutefois encore aucun mécanisme d’acquisition initiale
du prior. Le runtime créé par défaut est donc vide et ACTION6 seule produit
`none` sans coordonnées inventées.

### Qualification combinée

- run GitHub Actions : `43353708964` ;
- job : `131650593632` ;
- commit qualifié : `400d9bcc1062130508d27e62f1508f82011d2ea7` ;
- Node `22.18.0` ;
- typecheck réussi ;
- **332/332 tests réussis** ;
- build Vite réussi ;
- 100 jeux, 636 prévisualisations et 4 atlas générés.

Preuves :

- `docs/recovery/op01-op31-common-campaign-owner-20261112.md` ;
- `docs/recovery/op01-op31-browser-campaign-host-20261112.md` ;
- `docs/recovery/op01-op31-worker-common-campaign-20261112.md` ;
- `docs/recovery/op01-op31-browser-agent-controller-20261112.md` ;
- `docs/recovery/op01-op31-browser-field-stock-context-20261112.md`.

Limites :

- acquisition initiale du prior FieldStock absente ;
- Region commun, acquisition passive et snapshot/restauration ouverts ;
- OP31 sans propriétaire d’objectif produit ;
- performance officielle STCK/SMLP encore à mesurer.

Statut Lot 5 :

**5B, le propriétaire commun, le contrôleur browser, OP28 active et le transport
FieldStock/OP18 depuis un prior fourni sont fonctionnellement qualifiés ;
acquisition initiale, restauration et performance officielle restent à
confirmer.**

## Progression Lot 9 — reprise 9B

Branches intégrées/préparées :

- `recovery/lot9b-region-intervention-restart-20261112` ;
- `recovery/lot9b-region-reconstruction-v2-20261112` ;
- `recovery/lot9b-region-owner-integration-20261112` ;
- `recovery/lot9b-neutral-caller-20261112` ;
- `recovery/lot9b-stck-public-stack-probe-20261112`.

État vérifié :

- l’ancienne branche `lot9b-github-recovery-20261112` ne contient pas le runtime
  Region historique ;
- le noyau V6 reconstruit a passé **27/27 tests ciblés** ;
- le cœur Region reconstruit, explicitement distinct de l’ancien 0.69, passe
  **13/13 tests** ;
- Region + owner passent **19/19 tests** ;
- caller neutre + intégration Region passent **12/12 tests** ;
- le caller ne départage jamais plusieurs propositions : 0 → `none`, 1 →
  `selected`, plus de 1 → `ambiguous` ;
- `v6-region-caller-adapter.ts` relie Region sans modifier son cœur ;
- le transport Worker public est reconstruit dans
  `src/runtime/v6-agent-worker-core.ts` et `src/runtime/v6-agent-worker.ts` ; son
  port par défaut est maintenant la campagne commune OP18/OP28 et n’injecte
  aucun prior FieldStock ;
- la couche `observation publique → delta visible` est reconstruite dans
  `v6-public-observation-delta.ts` et `v6-region-public-evidence.ts` sans déduire
  de `methodRef` par ressemblance visuelle ;
- le helper de campagne générique est borné, conserve ACTION6, valide
  session/séquence et propage les erreurs sans dispatch caché ;
- le protocole ABBA reconstruit impose A1/B1/B2/A2, 8 warmups, 32 sessions,
  24 + 400 actions, seuil global strict inférieur à 10 % par jeu et aucun retry
  caché ;
- `native-loop-session-adapter.mjs` exige explicitement A/STCK, A/SMLP, B/STCK
  et B/SMLP ;
- le hook B suit le vrai chemin
  `regionPublicEffectEvidence → bindRegionMethod → RegionInterventionOwner.acquire`
  sans inférence de `methodRef` ;
- les quatre identités de runners A/STCK, A/SMLP, B/STCK et B/SMLP sont
  reconstruites et routées explicitement ;
- le corpus public générique V1 reste impropre à Region, car ACTION5 est toujours
  prioritaire sur ACTION6 ;
- le corpus spécialisé public `native-region-action6-corpus-v1` est maintenant
  reconstruit et qualifié sur le vrai `custom-games.zip`, seed 0 ;
- STCK détecte publiquement le shop actif, retire une carte visible à `(4,52)`
  puis alterne retrait/ajout ; chaque action du protocole produit un delta utile
  compris entre **64 et 211 pixels** ;
- SMLP détecte publiquement une porte et clique `(32,26)` ; chaque action produit
  exactement **9 pixels** de delta ;
- A et B utilisent les mêmes jeux, seed, corpus, séquences et volumes ; seul B
  active le vrai hook Region ;
- les `methodRef` de qualification sont des identités singleton explicites et ne
  prétendent aucune équivalence entre interventions ;
- le protocole fonctionnel complet a exécuté **40 invocations**, **8 warmups**,
  **24 actions de warmup**, **32 sessions mesurées** et **400 actions mesurées** ;
- les séquences A/B sont déterministes et identiques par jeu/type/index de
  session ;
- côté B, STCK a acquis **86/86** retours utiles et SMLP **126/126** ;
- GitHub Actions `43351088067`, job `131642041309`, SHA
  `0b0e34c76f63b8c29251e297a2973d4ada80de4c` : **36/36 tests réussis**, probe
  natif réussi et protocole fonctionnel complet réussi ;
- preuve : `docs/recovery/lot9b-region-action6-corpus-qualification.md` et
  `docs/recovery/lot9b-region-action6-corpus-report.json` ;
- les temps CPython obtenus sur le runner GitHub partagé sont conservés comme
  diagnostics non officiels uniquement ; ils ne constituent ni une acceptation
  ni un échec du seuil de 10 % ;
- aucune mesure officielle isolée Worker/Pyodide n’a encore été exécutée ;
- aucun compteur historique 70/76 ou candidat 71/76 n’est promu au statut de la
  reconstruction actuelle.

Region n’est pas encore inscrit dans les hôtes communs : il lui manque encore
un candidat produit complet
`AgentAction + CompositionBundle + état symbolique + identity` qualifié. Aucun
bundle ou `methodRef` de réutilisation artificiel n’est ajouté.

Pièces restantes avant ABBA officiel :

1. qualifier les quatre runners via le vrai Worker navigateur/Pyodide ;
2. figer les `sourceRef` A et B ;
3. créer le manifeste officiel reliant corpus, sources et timing scope ;
4. réserver un environnement de mesure isolé ;
5. répéter A1/B1/B2/A2 et appliquer le seuil strict séparément à STCK et SMLP.

Statut Lot 9 :

**noyau V6, Region, owner, caller, transport Worker, delta public, campagne,
protocole ABBA, quatre runners explicites et corpus Region ACTION6 sont
fonctionnellement qualifiés sur le protocole complet et les moteurs réels du
ZIP ; transport benchmark Worker/Pyodide, identités source et performance
officielle restent à confirmer.**

## Branches de récupération conservées

Ne pas supprimer ni écraser :

- `recovery/lot5-canonical-buffer` ;
- `recovery/lot6c-product-dispatch` ;
- `lot9b-github-recovery-20261112` ;
- `lot10d-temporal-selection-github-20261112` ;
- `op01-op31-c0-c7-audit`.

Chaque lot doit comparer sa branche à cette branche canonique de reconstruction
et porter seulement les éléments dont l’identité et les preuves peuvent être
établies.

## Règle d’intégration

1. récupérer une capacité ou un composant depuis une branche connue ;
2. identifier son origine et son contrat ;
3. intégrer sur une branche de lot dérivée de cette reconstruction ;
4. exécuter tests et contrôles pertinents ;
5. committer et pousser ;
6. ouvrir/intégrer vers la branche canonique de reconstruction ;
7. mettre à jour ce document et la feuille de route ;
8. ne publier un nouveau Site qu’après avoir une baseline GitHub durable et
   qualifiée.

## Critère de sortie de reconstruction

La reconstruction peut devenir la nouvelle baseline canonique seulement lorsque :

- le runtime navigateur/Worker est complet ;
- les 70/76 entrées historiquement publiées sont présentes ou explicitement
  réévaluées ;
- les tests fonctionnels requis passent ;
- les campagnes de référence sont reproductibles ;
- le harness de performance est restauré ;
- STCK et SMLP respectent le protocole de coût retenu ;
- la version publiée du Site est reliée à un SHA GitHub durable.

Jusque-là, la branche est viable pour travailler, tester, intégrer et
reconstruire, mais pas pour revendiquer une équivalence exacte à Site 109.
