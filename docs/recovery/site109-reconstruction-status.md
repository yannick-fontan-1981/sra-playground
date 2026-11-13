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
- ce SHA n'est pas résolu dans le dépôt GitHub public actuellement accessible

## Base GitHub choisie

La branche `recovery/site109-reconstruction-20261112` part de
`op01-op31-c0-c7-audit`, qui est la branche GitHub visible la plus riche en :

- documentation C0–C7 ;
- implémentations OP01–OP31 reconstruites ;
- traces et contrats de vérification ;
- éléments de composition V6 déjà reconstitués.

Elle ne contient toutefois pas encore le runtime V6 complet de Site 109.

## Éléments encore manquants avant de revendiquer une baseline 0.68 restaurée

Au minimum, les éléments historiquement utilisés par les lots doivent être
récupérés ou reconstruits et requalifiés :

- `docs/migration/v6-delivery-roadmap.md` ;
- `docs/migration/v6-entry-point-progress.json` ;
- les intégrations natives des entrées déjà publiées jusqu'à 70/76 ;
- les preuves fonctionnelles, campagnes, restauration et coûts nécessaires pour
  certifier la nouvelle baseline.

## Progression Lot 5 — 5A / 5B / 5C

Intégration qualifiée depuis `recovery/lot5-site109-rebase-20261112` :

- 5A : complétion et transport d'observations liées ;
- 5B : acquisition adressée, guards, réponse/réfutation, rétention à la
  frontière, revalidation `FieldStock`, stock typé, obligations de
  préservation, proposition bornée et bundle OP18 ;
- 5C : continuité/persistance du parent observé dans son périmètre reconstruit.

État vérifié :

- la connaissance retenue reste un `prior` et n'est jamais applicable
  automatiquement à un nouvel objet ou contexte ;
- `FieldStock.create()` doit revalider la scène courante avant toute
  consommation ;
- le runtime refuse `beforeStock`, `afterStock`, `recordStock` et
  `proposeStock` sans stock courant revalidé ;
- les réponses incompatibles, les changements de matériau non sélectionné et
  les réécritures contradictoires réfutent explicitement l'hypothèse ;
- le plan `typed_field_stock` produit un bundle OP18 consommé par l'autorité
  native existante, sans nouvelle opération ni appel artificiel ;
- GitHub Actions `43341200851` : `tsc --noEmit` réussi, **52/52 tests Lot 5**,
  **255/255 régressions globales** ;
- preuve détaillée : `docs/recovery/lot5-5b-integration-qualification.md`.

### Propriétaire commun de campagne et retour 5B corrélé

La tranche `recovery/lot5b-common-campaign-owner-20261112` raccorde maintenant
FieldStock/OP18 et l'action publique unique/OP28 au worker reconstruit :

- `v6-public-observation-measurement.ts` mesure uniquement les pixels, actions,
  état et progression publics ;
- `V6CommonCampaignDecisionPort` collecte les propositions spécialisées via le
  caller neutre ;
- OP18 ou OP28 ne sont autorisées qu'après sélection d'une proposition unique ;
- plusieurs propositions restent ambiguës, sans appel OP ni action cachée ;
- le propriétaire conserve proposition, bundle, action, observation et
  `needId` ;
- l'observation suivante est routée au propriétaire sélectionné avec le même
  `needId`, puis passivement aux autres propriétaires ;
- FieldStock consomme le retour avec `afterStock()` et `recordStock()` avant la
  frontière ;
- un retour inchangé enregistre l'échec du premier locus et déplace la décision
  ACTION6 suivante de `{x: 22, y: 20}` vers `{x: 21, y: 20}` ;
- le worker par défaut utilise ce propriétaire commun, libère l'action publique
  simple unique via OP28 et n'invente jamais les coordonnées d'ACTION6 ;
- aucun `prior` FieldStock n'est injecté par défaut.

Qualification finale après réconciliation avec le canonique `6304bec8` :

- run GitHub Actions : `43346937074` ;
- commit qualifié : `4c5060f8ab3523c3ed4cb85ead8441397d985c7c` ;
- Node `22.18.0` ;
- `npm ci` réussi ;
- `npm run typecheck` réussi ;
- régression TypeScript complète : **280/280 tests réussis**.

Preuve détaillée :
`docs/recovery/lot5b-common-campaign-owner-20261112.md`.

Limites conservées :

- l'acquisition initiale complète du prior FieldStock depuis une campagne
  navigateur reste absente ;
- Region n'est pas encore un producteur du propriétaire commun sans candidat
  public qualifié ;
- `main.ts` ne crée pas encore le worker agent ni une campagne SRA live ;
- snapshot/restauration complet du propriétaire commun encore absent ;
- performance officielle STCK/SMLP encore à mesurer.

Statut Lot 5 :

**5B, son propriétaire commun, OP18/OP28 différés, le retour corrélé et l'effet
sur la décision suivante sont fonctionnellement qualifiés sur le runtime V6
reconstruit ; raccord produit live, acquisition initiale et performance
officielle restent à confirmer.**

## Progression Lot 6C — dispatch et effets de présentation

État vérifié :

- le dispatch produit conserve ACTION6 et ses coordonnées ;
- les effets de présentation sont maintenant délégués aux ports partagés ;
- la validité de génération, le jeu sélectionné, l'animation, le timing, le
  feedback et la libération du busy state restent sous un propriétaire unique ;
- les changements qualifiés sont documentés dans
  `docs/recovery/lot6c-presentation-effects-integration-status.md` ;
- ces ports de présentation ne constituent pas encore un hôte de campagne agent
  live.

## Progression Lot 9 — reprise 9B

Branches intégrées/préparées :

- `recovery/lot9b-region-intervention-restart-20261112` ;
- `recovery/lot9b-region-reconstruction-v2-20261112` ;
- `recovery/lot9b-region-owner-integration-20261112` ;
- `recovery/lot9b-neutral-caller-20261112`.

État vérifié :

- l'ancienne branche `lot9b-github-recovery-20261112` ne contient pas le runtime
  Region historique ;
- le noyau V6 reconstruit a passé **27/27 tests ciblés** ;
- le coeur Region reconstruit, explicitement distinct de l'ancien 0.69, passe
  **13/13 tests** ;
- la frontière owner Region, acquisition sélectionnée/passive, déduplication et
  restauration porte le total Region + owner à **19/19 tests** ;
- le caller commun neutre ne départage jamais plusieurs propositions :
  0 → none, 1 → selected, >1 → ambiguous ;
- `v6-region-caller-adapter.ts` relie Region au caller sans modifier le coeur
  Region ;
- caller neutre + intégration Region passent **12/12 tests** ;
- le transport worker public est reconstruit dans
  `src/runtime/v6-agent-worker-core.ts` et `src/runtime/v6-agent-worker.ts` ;
- son port par défaut est désormais le propriétaire commun OP18/OP28 qualifié,
  qui conserve l'ambiguïté et ne reçoit aucun prior FieldStock implicite ;
- la couche `observation publique → delta visible` est reconstruite dans
  `v6-public-observation-delta.ts` et `v6-region-public-evidence.ts`, sans
  déduction de `methodRef` à partir de la ressemblance visuelle ;
- le helper de campagne générique borné conserve ACTION6, borne les pas, valide
  session/séquence et propage les erreurs worker sans dispatch caché ;
- le protocole ABBA de coût est reconstruit : A1/B1/B2/A2, 8 warmups,
  32 sessions mesurées, 24 + 400 actions, seuil global strict <10 % par jeu,
  phases internes informatives et aucun retry caché ;
- `native-loop-session-adapter.mjs` exige explicitement A/STCK, A/SMLP,
  B/STCK et B/SMLP ;
- l'audit STCK/SMLP montre que le corpus public V1 ne peut pas choisir ACTION6
  en état non terminal lorsque ACTION5 reste disponible ;
- un sélecteur candidat ACTION6 strictement public
  `region-public-action6-probe-v1` est reconstruit mais n'est pas encore qualifié
  sur les vrais frames natifs ;
- le hook B est raccordé au chemin
  `regionPublicEffectEvidence → bindRegionMethod → RegionInterventionOwner.acquire`,
  avec post-action mesuré et sans inférence de `methodRef` ;
- l'exécution réelle Pyodide/`custom-games.zip`, la preuve que le corpus exerce
  réellement ACTION6/Region, les `sourceRef` A/B et les mesures officielles
  restent à qualifier ;
- aucun compteur historique 70/76 ou candidat 71/76 n'est promu au statut de la
  reconstruction actuelle.

Statut Lot 9 :

**noyau V6, coeur Region, owner, caller neutre, transport worker, delta public,
helper de campagne, protocole ABBA, adaptateur runSession, contrats explicites
des quatre runners et binding du hook Region sont reconstruits dans leurs
périmètres ; candidat Region public live, corpus natif et performance officielle
restent à confirmer.**

## Branches de récupération conservées

Ne pas supprimer ni écraser :

- `recovery/lot5-canonical-buffer` ;
- `recovery/lot6c-product-dispatch` ;
- `lot9b-github-recovery-20261112` ;
- `lot10d-temporal-selection-github-20261112` ;
- `op01-op31-c0-c7-audit`.

Chaque lot doit comparer sa branche à cette branche canonique de reconstruction
et porter seulement les éléments dont l'identité et les preuves peuvent être
établies.

## Règle d'intégration

1. récupérer une capacité ou un composant depuis une branche connue ;
2. identifier son origine et son contrat ;
3. intégrer sur une branche de lot dérivée de cette reconstruction ;
4. exécuter tests et contrôles pertinents ;
5. committer et pousser ;
6. ouvrir/intégrer vers la branche canonique de reconstruction ;
7. mettre à jour ce document et la feuille de route ;
8. ne publier un nouveau Site qu'après avoir une baseline GitHub durable et
   qualifiée.

## Critère de sortie de reconstruction

La reconstruction peut devenir la nouvelle baseline canonique seulement lorsque :

- le runtime navigateur/worker est complet ;
- les 70/76 entrées historiquement publiées sont présentes ou explicitement
  réévaluées ;
- les tests fonctionnels requis passent ;
- les campagnes de référence sont reproductibles ;
- le harness de performance est restauré ;
- STCK et SMLP respectent le protocole de coût retenu ;
- la version publiée du Site est reliée à un SHA GitHub durable.

Jusque-là, la branche est viable pour travailler, tester, intégrer et
reconstruire, mais pas pour revendiquer une équivalence exacte à Site 109.
