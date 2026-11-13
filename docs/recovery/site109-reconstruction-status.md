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
`op01-op31-c0-c7-audit`, la branche GitHub visible la plus riche en :

- documentation C0–C7 ;
- implémentations OP01–OP31 reconstruites ;
- traces et contrats de vérification ;
- éléments de composition V6 déjà reconstitués.

Elle ne contient toutefois pas encore le runtime V6 complet de Site 109.

## Éléments encore manquants avant de revendiquer une baseline 0.68 restaurée

Au minimum :

- `docs/migration/v6-delivery-roadmap.md` ;
- `docs/migration/v6-entry-point-progress.json` ;
- les intégrations natives des entrées historiquement publiées jusqu’à 70/76 ;
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
- `FieldStock.create()` doit revalider la scène courante ;
- le runtime refuse `beforeStock`, `afterStock`, `recordStock` et
  `proposeStock` sans stock courant revalidé ;
- les réponses incompatibles et réécritures contradictoires réfutent
  explicitement l’hypothèse ;
- le plan `typed_field_stock` produit un bundle OP18 consommé par l’autorité
  native existante, sans opération artificielle ;
- GitHub Actions `43341200851` : typecheck réussi, **52/52 tests Lot 5** et
  **255/255 régressions globales** ;
- preuve : `docs/recovery/lot5-5b-integration-qualification.md`.

### Propriétaire commun OP18/OP28 raccordé au Worker

Le noyau `CommonCampaignOwner`, qualifié séparément avec **286/286 tests**, est
maintenant utilisé par le Worker V6 reconstruit.

Composants principaux :

- `src/runtime/v6-public-observation-measurement.ts` ;
- `src/runtime/v6-common-campaign-decision-port.ts` ;
- `src/runtime/v6-agent-worker-core.ts` ;
- `src/runtime/v6-agent-worker.ts` ;
- owners canoniques FieldStock/OP18 et action publique unique/OP28.

Chaîne vérifiée :

1. l’observation publique 64×64 est copiée et validée ;
2. le retour de l’action précédente est acquis avec le même `needId` ;
3. une frontière officielle est traitée ;
4. un prior FieldStock est revalidé seulement si nécessaire ;
5. les propositions sont collectées sans classement ;
6. zéro proposition reste `none` ;
7. plusieurs propositions restent `ambiguous` ;
8. une proposition unique peut être libérée par OP18 ou OP28 ;
9. l’observation suivante est consommée avant la décision suivante.

Le hook `AgentDecisionPort.observe()` garantit aussi que :

- une observation `WIN` règle le dernier retour puis arrête la campagne sans
  demander une nouvelle action ;
- un budget de décision nul règle le retour puis s’arrête ;
- une erreur d’observation empêche toute décision.

Effet OP18 démontré : ACTION6 vers `(3,1)`, déplacement observé et enregistré,
puis ACTION6 suivante vers `(4,1)`.

Prudence conservée :

- aucun prior FieldStock n’est injecté par défaut ;
- ACTION6 seule ne produit aucune coordonnée inventée ;
- aucune OP n’est appelée lorsque le domaine est vide ou ambigu ;
- Region n’est pas ajouté sans candidat public complet et qualifié.

Qualification finale après réconciliation avec le canonique `8cc510e0` :

- run GitHub Actions : `43348904523` ;
- job : `131634904435` ;
- commit qualifié : `08a04a9da59b0f385d080acf6091d4acdcf800c6` ;
- Node `22.18.0` ;
- `npm ci` réussi ;
- `npm run typecheck` réussi ;
- régression TypeScript complète : **304/304 tests réussis** ;
- aucun échec, annulation, test ignoré ou TODO.

Preuves :

- `docs/recovery/op01-op31-common-campaign-owner-20261112.md` ;
- `docs/recovery/op01-op31-worker-common-campaign-20261112.md`.

Limites :

- `main.ts` ne crée pas encore une campagne SRA live autour du Worker ;
- le produit ne dispatch pas encore une décision Worker vers
  `BrowserGameRuntime` puis son retour au même Worker ;
- l’acquisition initiale du prior FieldStock depuis une vraie campagne reste
  absente ;
- Region commun, acquisition passive et snapshot/restauration restent ouverts ;
- performance officielle STCK/SMLP encore à mesurer.

Statut Lot 5 :

**5B, OP18/OP28, le propriétaire commun et son raccord Worker sont
fonctionnellement qualifiés ; produit live, acquisition initiale, restauration
et performance officielle restent à confirmer.**

## Progression Lot 9 — reprise 9B

Branches intégrées/préparées :

- `recovery/lot9b-region-intervention-restart-20261112` ;
- `recovery/lot9b-region-reconstruction-v2-20261112` ;
- `recovery/lot9b-region-owner-integration-20261112` ;
- `recovery/lot9b-neutral-caller-20261112`.

État vérifié :

- l’ancienne branche `lot9b-github-recovery-20261112` ne contient pas le runtime
  Region historique ;
- noyau V6 reconstruit : **27/27 tests ciblés** ;
- cœur Region reconstruit : **13/13 tests** ;
- Region + owner : **19/19 tests** ;
- caller neutre + intégration Region : **12/12 tests** ;
- le caller ne départage jamais plusieurs propositions ;
- `v6-region-caller-adapter.ts` relie Region sans modifier son cœur ;
- le transport Worker public est reconstruit ; son port par défaut est désormais
  la campagne commune OP18/OP28, sans prior FieldStock implicite ;
- la couche `observation publique → delta visible` ne déduit jamais de
  `methodRef` par ressemblance ;
- le helper de campagne borné conserve ACTION6, valide session/séquence et
  propage les erreurs sans dispatch caché ;
- le protocole ABBA reconstruit impose A1/B1/B2/A2, 8 warmups, 32 sessions,
  24 + 400 actions, seuil global strict <10 % par jeu et aucun retry caché ;
- l’adaptateur de session exige A/STCK, A/SMLP, B/STCK et B/SMLP ;
- le hook B est raccordé à
  `regionPublicEffectEvidence → bindRegionMethod → RegionInterventionOwner.acquire`
  sans inférence de `methodRef` ;
- la qualification native du vrai `custom-games.zip` a réussi : suite ciblée
  Lot 9B **29/29** ;
- probe SMLP ACTION6 utile : **9 pixels modifiés** à `x=32,y=26` ;
- probe STCK ACTION6 non utile : **0 pixel modifié** à `x=6,y=56` ;
- l’audit du corpus public STCK V1 montre qu’ACTION5 reste disponible en état
  non terminal, empêchant le sélecteur public strict de choisir honnêtement
  ACTION6 ;
- aucun compteur historique 70/76 ou candidat 71/76 n’est promu au statut de la
  reconstruction actuelle.

Region n’est pas encore inscrit dans le port Worker commun : il lui manque un
candidat public complet
`AgentAction + CompositionBundle + état symbolique + identity` qualifié. Aucun
bundle ou `methodRef` artificiel n’est ajouté.

Statut Lot 9 :

**noyau V6, Region, owner, caller, transport Worker, delta public, campagne,
protocole ABBA et probe natif SMLP ACTION6 sont qualifiés dans leurs périmètres ;
STCK reste sans chemin ACTION6 public utile et la performance officielle reste
à confirmer.**

## Branches de récupération conservées

Ne pas supprimer ni écraser :

- `recovery/lot5-canonical-buffer` ;
- `recovery/lot6c-product-dispatch` ;
- `lot9b-github-recovery-20261112` ;
- `lot10d-temporal-selection-github-20261112` ;
- `op01-op31-c0-c7-audit`.

Chaque lot doit comparer sa branche à cette branche canonique et porter seulement
les éléments dont l’identité et les preuves peuvent être établies.

## Règle d’intégration

1. récupérer une capacité ou un composant depuis une branche connue ;
2. identifier son origine et son contrat ;
3. intégrer sur une branche dérivée de cette reconstruction ;
4. exécuter tests et contrôles ;
5. committer et pousser ;
6. intégrer vers la branche canonique ;
7. mettre à jour ce document et la feuille de route ;
8. ne publier un Site qu’après avoir une baseline GitHub durable et qualifiée.

## Critère de sortie de reconstruction

La reconstruction peut devenir la nouvelle baseline canonique seulement lorsque :

- le runtime navigateur/Worker est complet ;
- les 70/76 entrées historiques sont présentes ou explicitement réévaluées ;
- les tests fonctionnels requis passent ;
- les campagnes de référence sont reproductibles ;
- le harness de performance est restauré ;
- STCK et SMLP respectent le protocole de coût ;
- la version Site publiée est reliée à un SHA GitHub durable.

Jusque-là, la branche est viable pour travailler, tester, intégrer et
reconstruire, mais pas pour revendiquer une équivalence exacte à Site 109.
