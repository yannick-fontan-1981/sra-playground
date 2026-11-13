# OP01–OP31 — acquisition initiale adressée depuis un retour public ACTION6

Date : 13 novembre 2026

## Références

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique de départ :
  `e3fa1901452423a714d3a47d5a469dbf112c55b0`
- Canonique C7 réconcilié :
  `d09fcc23e2dc594b9fa0bff0dab5072808c91464`
- Branche de travail :
  `op01-op31-browser-addressed-acquisition-20261113`
- Commit fonctionnel de la tranche :
  `99c1d23353dbfec3e98c3770fee362b757ec2701`
- Merge de réconciliation C7 qualifié :
  `23694816d35f4f050e43a8660be45a063b6ee5d9`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Suivi consolidé : `docs/migration/op01-op31-progress.md`
- Tranche précédente :
  `docs/recovery/op01-op31-browser-field-stock-transport-20261112.md`
- Qualification officielle C7 :
  `docs/recovery/op01-op31-official-readiness-status.md`
- Preuve officielle Region :
  `docs/recovery/lot9b-official-abba-performance-qualified.json`

## Objectif

La tranche précédente a rendu OP18 transportable et consommable dans le produit
lorsqu’un stock adressé courant avait déjà été retenu puis revalidé. Elle ne
produisait cependant pas le premier modèle adressé.

La présente tranche raccorde la chaîne publique suivante :

**ACTION6 déjà autorisée par un propriétaire explicite → retour physique public
corrélé → mesure d’entités publiques → correspondance résiduelle stricte →
acquisition d’un modèle adressé local → réponses supplémentaires → bornes
calibrées → frontière officielle → prior compact retenu.**

Cette chaîne est volontairement passive. Elle ne choisit pas ACTION6, ne crée
pas ses coordonnées et ne gagne aucune autorité de décision.

## Limite exacte de qualification

La qualification acquise est :

> Un retour ACTION6 déjà produit et autorisé par un propriétaire explicite peut
> fournir une preuve publique suffisante pour acquérir puis calibrer le premier
> modèle adressé, avant de le retenir comme prior à une frontière officielle.

Elle ne démontre pas encore :

- un propriétaire produit capable de justifier lui-même la première ACTION6 ;
- une politique d’exploration ;
- une restauration entre deux activations Agent ;
- une persistance durable du modèle, du prior ou du stock ;
- une utilisation autonome de ce prior dans une campagne produit fraîche.

## Mesure publique d’entités

`src/runtime/v6-public-observation-measurement.ts` complète les composantes
publiques avec :

- une `signature` déterministe ;
- une `position` publique ;
- la palette ;
- la boîte englobante ;
- le masque local ;
- le caractère rectangulaire.

La signature dépend uniquement de :

- la valeur de palette publique ;
- la largeur et la hauteur du composant ;
- son masque local.

Elle ne dépend ni de la position absolue, ni d’un identifiant interne du jeu, ni
d’une fixture, ni d’un oracle.

Les composantes ne sont pas matérialisées sur le chemin courant OP28 simple.
Elles sont produites seulement :

1. lorsqu’un prior FieldStock attend une revalidation ;
2. lorsqu’un retour ACTION6 explicite doit être évalué pour une acquisition
   adressée.

## Correspondance résiduelle stricte

`src/runtime/v6-public-addressed-field-learning.ts` ajoute la correspondance
publique requise par `fitAddressedField()`.

Pour chaque signature :

1. les occurrences exactement stationnaires sont retirées ;
2. le résidu avant et le résidu après sont calculés ;
3. une correspondance mobile est produite uniquement avec exactement une
   occurrence ancienne et une occurrence nouvelle ;
4. tout cas un-vers-plusieurs, plusieurs-vers-un ou plusieurs-vers-plusieurs
   reste `unresolved`.

Aucune distance minimale, proximité ou heuristique de meilleur candidat n’est
utilisée.

Le déplacement d’un petit objet peut modifier la silhouette du grand composant
de fond. Cette variation reste explicitement non résolue. Elle ne contamine pas
la signature du mobile et n’est pas transformée artificiellement en
correspondance.

## Conditions de `fitAddressedField()`

L’acquisition initiale reste soumise aux gardes historiques :

- une seule correspondance mobile résiduelle ;
- un exemplaire stationnaire de même signature ;
- le mobile doit être rectangulaire ;
- une seule cible de même silhouette et palette différente ;
- cette cible doit être centrée dans une seule enceinte ;
- le point ACTION6 doit appartenir au corps déplacé ;
- toute ambiguïté produit `null`.

La tranche ne relâche aucune de ces conditions.

## Runtime adressé

`ObservedAddressedMaterialRuntime.observeAddressedReturn()` traite seulement :

- une commande `ACTION6` exacte ;
- deux coordonnées entières publiques dans `[0, 63]` ;
- un retour dans le même niveau, le même compteur de niveaux terminés et le même
  état officiel ;
- un runtime encore vide ou possédant déjà un modèle local actif.

Il refuse de remplacer :

- un prior retenu ;
- un stock revalidé ;
- une connaissance déjà possédée par le cycle FieldStock.

### Premier retour utile

Sans modèle existant :

1. `fitAddressedField()` est appelé ;
2. le modèle acquis est installé localement ;
3. le même retour est immédiatement enregistré par
   `recordAddressedFieldResponse()` ;
4. la première borne inférieure et le premier échantillon sont conservés.

### Retours suivants

Avec un modèle actif :

- un déplacement aligné vers l’ancre demandée relève la borne inférieure et met
  à jour la position ;
- une réponse stationnaire au-delà de la borne acceptée enregistre une borne
  supérieure ;
- un mouvement vers une autre ancre réfute et efface le modèle ;
- une correspondance ambiguë reste non résolue sans mutation.

### Frontière officielle

À une frontière officielle, le modèle local est converti en prior compact
seulement lorsque les preuves sont suffisantes.

La preuve de cette tranche contient :

- deux réponses alignées ;
- une borne inférieure de distance ;
- une borne supérieure obtenue par une réponse stationnaire ;
- un exemplaire stationnaire de même classe ;
- une cible centrée qualifiée.

Le prior retenu porte donc `alignment_supported: true` sans le déduire d’un seul
exemple.

## Intégration au host navigateur

`BrowserFieldStockCampaignTransport.observeAcquiredReturn()` conserve l’ordre
commun déjà qualifié :

1. action physique ;
2. conversion du retour public ;
3. acquisition par le propriétaire sélectionné avec le même `needId` ;
4. observation passive FieldStock ;
5. notification produit ;
6. présentation.

L’apprentissage adressé intervient uniquement à l’étape 4.

Il ne peut donc pas :

- acquérir le `needId` du propriétaire sélectionné ;
- prétendre avoir autorisé l’action ;
- émettre une deuxième action ;
- modifier la décision déjà prise ;
- apprendre avant que le propriétaire sélectionné ait consommé son retour.

## Preuve fonctionnelle

### Identité publique

La scène de test contient :

- un mobile rectangulaire ;
- un exemplaire stationnaire de même signature ;
- une cible de même silhouette et palette différente ;
- une enceinte centrée autour de la cible.

Après déplacement du mobile, la correspondance utile reste unique. Les
changements du grand fond public restent non résolus et distincts.

### Acquisition et calibration

La chaîne qualifiée est :

1. ACTION6 vers `(2,1)` déplace le mobile de `(1,1)` vers `(2,1)` ;
2. le modèle initial est acquis ;
3. l’échantillon 1 fixe `lowerSquared = 1` ;
4. ACTION6 vers `(3,1)` produit un second déplacement aligné ;
5. un deuxième témoin aligné est enregistré ;
6. ACTION6 vers `(7,1)` ne déplace pas le mobile ;
7. la réponse stationnaire fixe `upperSquared = 16` ;
8. la frontière de niveau convertit le modèle en prior ;
9. le prior conserve les bornes et `alignment_supported = true`.

### Ordre dans le produit

Le test du vrai `BrowserCommonCampaignHost` utilise un propriétaire ACTION6
explicite distinct de FieldStock.

La preuve vérifie :

- ce propriétaire est sélectionné ;
- il acquiert exactement une fois son propre retour ;
- FieldStock apprend passivement seulement après cette acquisition ;
- la présentation se produit ensuite ;
- le runtime passe de `empty` à `active_local_model` ;
- aucune action ou coordonnée n’est produite par FieldStock.

## Fichiers de la tranche

### Ajoutés

- `src/runtime/v6-public-addressed-field-learning.ts` ;
- `tests/v6-public-addressed-field-learning.test.ts`.

### Modifiés

- `src/runtime/v6-public-observation-measurement.ts` ;
- `src/runtime/observed-addressed-material-runtime.ts` ;
- `src/runtime/v6-browser-common-campaign-host.ts`.

## Qualification combinée

La branche a été réconciliée avec le canonique contenant la qualification C7
Region avant la qualification finale.

- merge de réconciliation :
  `23694816d35f4f050e43a8660be45a063b6ee5d9` ;
- run GitHub Actions : `43358235167` ;
- job : `131665294852` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **336/336 réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0` ;
- build de production : réussi ;
- modules transformés : `56` ;
- galerie : `100` jeux, `636` prévisualisations et `4` atlas natifs ;
- rapport de câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `24`.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées par `npm ci`.

## Performance et C7

C7 reste **officiellement qualifié** pour le protocole natif Region STCK/SMLP
restauré. Cette tranche ne modifie ni la preuve, ni le corpus, ni les runners,
ni le verdict existant.

La preuve officielle durable rapporte :

- **STCK : médiane A 54,5 ms, médiane B 58,4 ms, +7,155963 % — PASS** ;
- **SMLP : médiane A 123,95 ms, médiane B 118,15 ms, −4,679306 % — PASS** ;
- seuil strict : augmentation médiane inférieure à `+10 %` par jeu ;
- ordre ABBA : `A1 → B1 → B2 → A2` ;
- 40 invocations, 32 sessions mesurées et 400 actions mesurées ;
- aucun échantillon supprimé et aucun retry caché.

La qualification C7 porte sur le hook Region natif mesuré par ce protocole. Elle
ne constitue ni une mesure du nouveau chemin d’acquisition adressée, ni une
preuve de parité totale des 76 points d’entrée V6.

Le nouveau chemin n’ajoute pas de mesure d’entités au parcours OP28 simple. Son
coût est limité aux retours ACTION6 explicitement évalués et aux revalidations
de prior. Un benchmark ciblé devra être exécuté lorsqu’un vrai propriétaire
produit activera effectivement cette acquisition.

Verdict :

- **C7 Region STCK/SMLP reste clos et qualifié** ;
- **coût ciblé de l’acquisition adressée non mesuré séparément** ;
- cette absence ne réouvre pas C7 pour son périmètre déjà qualifié.

## Dispositions OP

- **OP18** : la chaîne produit peut désormais recevoir un prior issu d’un modèle
  acquis et calibré depuis des retours ACTION6 publics explicites ; il manque
  toujours un propriétaire produit qui justifie la première ACTION6.
- **OP28** : contrat strict inchangé ; ACTION6 sans coordonnées reste sans
  proposition.
- **OP29/OP30** : cycle spécialisé de réponse, apprentissage et rétention
  préservé.
- **OP31** : aucun propriétaire d’objectif produit démontré.
- **Autres OP** : aucune activation artificielle.

## Limites ouvertes

- aucun propriétaire produit ne génère encore la première ACTION6 adressée ;
- aucune persistance du modèle, du prior ou du stock entre activations Agent ;
- aucun snapshot/restauration du `needId` ou de l’action en attente ;
- Region n’est pas encore propriétaire physique du contrôleur produit ;
- aucun propriétaire OP31 ;
- registre canonique des 76 points d’entrée V6 toujours absent ;
- coût ciblé du nouveau chemin d’acquisition non mesuré séparément ;
- aucune publication Site.

## Prochaine étape

1. identifier un besoin produit réel justifiant une première ACTION6 avec des
   coordonnées entièrement dérivées de l’observation publique ;
2. enregistrer ce producteur comme propriétaire neutre, sans priorité sur OP18
   ou OP28 ;
3. démontrer que ses retours alimentent la chaîne d’acquisition ici qualifiée ;
4. ajouter snapshot et restauration atomiques du modèle, du prior, du stock, de
   la campagne et du retour en attente ;
5. vérifier une réactivation sans perte ni double consommation ;
6. ajouter un benchmark ciblé du chemin adressé lorsque celui-ci devient
   effectivement actif ;
7. compléter ensuite le propriétaire physique Region et le lot 9C
   `joint_channels` ;
8. identifier un propriétaire d’objectif réel avant OP31.

Aucune publication Site n’appartient à cette tranche. GitHub reste la source
canonique durable.
