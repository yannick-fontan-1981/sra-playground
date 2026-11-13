# OP01–OP31 — contexte FieldStock de la campagne navigateur

Date : 12 novembre 2026

## Références

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Branche de travail : `recovery/op01-op31-browser-field-stock-context-20261112`
- Baseline canonique de départ : `510642125e1f5994b30e4f71b884a2278dcc91a8`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Suivi : `docs/migration/op01-op31-progress.md`
- Contrôleur produit :
  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`
- Qualification combinée précédente :
  `docs/recovery/op01-op31-browser-agent-controller-combined-qualification-20261112.md`

## Objet

Raccorder le propriétaire FieldStock/OP18 à la campagne navigateur déjà possédée
par le contrôleur Agent canonique, sans créer de connaissance adressée et sans
modifier la prudence du fallback OP28.

La chaîne qualifiée est :

**prior FieldStock réellement fourni → observation publique 64×64 → composants
visibles bornés → revalidation de la scène → contexte FieldStock → proposition
OP18 → ACTION6 autorisée → retour public → `afterStock()` / `recordStock()` →
frontière éventuelle → présentation.**

La chaîne n’est applicable que lorsqu’un prior existe déjà. Le runtime produit
par défaut reste vide : aucune cible, coordonnée, classe de matériau ou règle de
réécriture n’est inventée à partir d’une simple image.

## Composants

### `src/runtime/v6-browser-field-stock-campaign.ts`

`BrowserFieldStockOwnerTransport` traduit la frontière navigateur vers le
contrat existant `FieldStockCampaignContext`.

Il impose :

- aucune mesure de composants lorsque le runtime FieldStock est `empty` ou
  `refuted` ;
- aucune proposition OP18 sans prior ou stock courant revalidé ;
- mesure exclusivement fondée sur l’observation agent publique 64×64 ;
- matérialisation des composants monochromes 4-connexes uniquement lorsqu’un
  prior doit être revalidé ;
- refus d’une séquence qui recule ;
- un contexte lié exactement au `sessionId`, à l’observation et à la révision
  courants ;
- un budget borné, 16 étapes par défaut ;
- les dépendances publiques déterministes déjà utilisées par le Worker.

La fabrique
`createPublicAndFieldStockBrowserCampaignHost()` enregistre exactement deux
propriétaires :

1. FieldStock/OP18 ;
2. l’action publique simple unique/OP28.

Le `CommonCampaignOwner` reste neutre : si les deux propriétaires produisent
simultanément une proposition, le résultat est `ambiguous` et aucune opération
n’est appelée.

### `src/runtime/observed-addressed-material-runtime.ts`

`suspendStockForRevalidation()` rétrograde un stock actif en prior compact avant
son utilisation dans une nouvelle session navigateur.

Cette rétrogradation :

- ne représente pas une frontière officielle ;
- n’ajoute aucune preuve, aucun score et aucune règle ;
- supprime seulement l’applicabilité courante ;
- oblige la nouvelle scène visible à revalider le prior.

Ainsi, un stock construit dans une autre session ne peut jamais traverser la
frontière produit comme connaissance directement applicable.

### `src/runtime/v6-browser-common-campaign-host.ts`

Le transport propriétaire possède désormais un hook facultatif
`afterAcquire()`.

Pour le propriétaire sélectionné, l’ordre est :

1. conversion du retour physique ;
2. `CommonCampaignOwner.acquire()` ;
3. consommation spécialisée du retour par FieldStock ;
4. `afterAcquire()` pour la frontière et la rétention locales ;
5. notification produit ;
6. présentation.

Le hook ne peut ni dispatcher une action ni acquérir une autorité Logos. Il sert
uniquement à mettre à jour l’état local du propriétaire après la consommation
corrélée du retour.

## Absence de connaissance artificielle

Le contrôleur navigateur canonique utilise maintenant la fabrique combinée par
défaut. Cette fabrique crée un `ObservedAddressedMaterialRuntime` vide.

Conséquences :

- une observation exposant uniquement ACTION6 retourne `none` ;
- aucune coordonnée ACTION6 n’est produite ;
- aucun composant public n’est mesuré pour FieldStock ;
- OP18 n’est pas appelée ;
- une action simple publique unique continue d’utiliser OP28 exactement comme
  avant.

L’inscription d’un propriétaire ne vaut donc pas activation sémantique. Le
besoin, les données, la revalidation et le consommateur doivent tous exister.

## Prior injecté dans le test de qualification

Le scénario de qualification fournit explicitement un prior retenu contenant :

- ACTION6 ;
- les bornes de distance adressée ;
- trois classes de matériau déjà apprises ;
- une forme de zone officielle ;
- la qualification explicite
  `retained local hypothesis; new occurrence and field require revalidation`.

La scène publique contient :

- les trois témoins de classe visibles ;
- une demande visible de matériau de type 2 ;
- une zone officielle visible ;
- deux occurrences de type 1 en `(20,20)` et `(24,20)`.

La revalidation publique produit un stock courant. FieldStock propose alors
ACTION6 vers `(22,20)`. Le retour retire les deux occurrences sources et montre
un produit de type 2 en `(22,20)`.

Résultat :

- OP18 est appelée seulement après revalidation ;
- l’action est liée au bundle admis ;
- `recordStock()` enregistre une réécriture conjointe observée ;
- aucune identité de pixel conservée n’est revendiquée ;
- le runtime reste revalidé pour une décision future.

## Frontière après retour sélectionné

Un second scénario retourne le même effet lors d’une frontière officielle
terminale.

L’ordre vérifié est :

1. ACTION6 est exécutée ;
2. `afterStock()` observe la frontière ;
3. `recordStock()` enregistre le retour physique ;
4. la frontière retient ensuite le stock comme prior ;
5. le stock courant est supprimé ;
6. le produit présente l’observation seulement après cette transition.

Le retour n’est donc pas perdu lorsque la frontière ferme la scène, et la
connaissance retenue ne reste pas applicable sans revalidation ultérieure.

## Tests

`tests/v6-browser-field-stock-campaign.test.ts` vérifie :

- OP28 inchangée lorsque FieldStock est vide ;
- aucune ACTION6 sans connaissance retenue et revalidée ;
- revalidation d’un prior exclusivement depuis les pixels publics ;
- production OP18 et coordonnées ACTION6 mesurées ;
- consommation du retour par `afterStock()` / `recordStock()` ;
- apprentissage de la réécriture conjointe observée ;
- frontière appliquée après consommation du retour et avant présentation ;
- rétrogradation d’un stock actif d’une autre session ;
- échec de revalidation sur une scène incompatible.

`tests/v6-browser-agent-controller-field-stock-default.test.ts` vérifie :

- la fabrique combinée comme hôte par défaut du contrôleur canonique ;
- l’absence de l’ancienne fabrique OP28 seule dans ce contrôleur ;
- l’arrêt `none` sans dispatch lorsque seule ACTION6 est disponible et que le
  runtime FieldStock est vide.

## Qualification

### Qualification du transport

- run : `43353507694`
- job : `131649926998`
- commit qualifié : `33ab107c94633c1cfe218432ab92080b0ef363d9`
- `npm ci` : réussi
- `npm run typecheck` : réussi
- régression : **330/330 tests réussis**
- build Vite : réussi

Une première exécution, run `43353394051`, avait obtenu **329/330** : l’unique
échec provenait d’une assertion de diagnostic sur la mesure initiale après que
le transport avait légitimement remplacé son observation courante par le
retour. Aucun garde fonctionnel n’a été retiré ; l’assertion a été remplacée par
les états runtime stables réellement contractuels.

### Qualification avec le contrôleur par défaut

- run : `43353708964`
- job : `131650593632`
- commit qualifié : `400d9bcc1062130508d27e62f1508f82011d2ea7`
- Node : `22.18.0`
- `npm ci` : réussi
- `npm run typecheck` : réussi
- régression complète : **332/332 tests réussis**
- échecs, annulations, tests ignorés et TODO : `0`
- build Vite : réussi
- modules transformés : `49`
- catalogue : `100` jeux
- prévisualisations : `636`
- atlas natifs : `4`

Deux vulnérabilités de dépendances de sévérité haute déjà présentes restent
signalées par `npm ci`. Cette tranche ne les introduit ni ne les modifie.

## Dispositions OP

- **OP18** : contexte navigateur, revalidation publique, release, retour
  spécialisé et frontière post-acquisition qualifiés lorsqu’un prior réel est
  fourni ; acquisition initiale du prior encore absente du produit.
- **OP28** : fallback public strict conservé sans régression lorsque FieldStock
  est vide.
- **OP29/OP30** : consommation spécialisée FieldStock conservée ; aucun appel
  générique redondant ajouté.
- **OP31** : aucune contribution nouvelle ; toujours sans propriétaire
  d’objectif produit.
- **Autres OP** : aucune activation artificielle.

## Limites

- aucun mécanisme produit n’acquiert encore le prior initial FieldStock ;
- le runtime FieldStock du contrôleur par défaut est donc vide ;
- aucune persistance de ce runtime entre activations n’est revendiquée ;
- Region n’a toujours pas de candidat physique commun complet ;
- l’acquisition passive multi-propriétaires reste non orchestrée ;
- snapshot/restauration des campagnes et connaissances produit reste absent ;
- le coût officiel C7 sur A/STCK, A/SMLP, B/STCK et B/SMLP reste à mesurer ;
- aucune publication Site n’est effectuée.

## Statut

**Le propriétaire FieldStock possède maintenant un transport navigateur réel et
prudent. Un prior explicitement fourni est revalidé depuis l’observation
publique avant OP18, le retour est consommé avant la frontière et la
présentation, et un stock d’une autre session ne peut pas contourner la
revalidation.**

**L’acquisition initiale du prior reste la prochaine dette : le produit ne
prétend pas encore découvrir seul cette connaissance.**
