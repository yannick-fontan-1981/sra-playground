# OP01–OP31 : noyau de continuité de session

Date : 13 novembre 2026

## Références

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique cible : `recovery/site109-reconstruction-20261112` ;
- base canonique : `81f56ce74a3413d3835bd4b30b9c3fd14570aabc` ;
- branche de travail : `op01-op31-session-continuity-20261113` ;
- candidat qualifié : `0bb35cd44c9ebfa86a94345cb5167d5861d1e52f` ;
- run GitHub Actions : `43426558286` ;
- job : `131889275186` ;
- plan stable : `docs/migration/op01-op31-verification-plan.md` ;
- suivi consolidé : `docs/migration/op01-op31-progress.md` ;
- preuve structurée :
  `docs/recovery/op01-op31-session-continuity-core-qualified.json`.

## Objectif

La campagne commune conservait déjà le retour physique en attente pendant une
activation, et `NeutralCommonCaller` savait préserver sa déduplication. En
revanche, il n’existait pas de contrat atomique capable de capturer puis restaurer
ensemble :

- la campagne commune ;
- le `needId` physique en attente ;
- les décisions déjà réglées ;
- la déduplication des retours ;
- les états explicitement possédés par les producteurs ;
- le modèle, le prior et le stock FieldStock.

Cette tranche construit et qualifie ce noyau sans raccorder encore la persistance
au cycle de vie DOM du contrôleur navigateur.

## Architecture ajoutée

### Snapshot de la campagne commune

`CommonCampaignOwner` expose maintenant un snapshot versionné comprenant :

- l’ordre exact des propriétaires ;
- le snapshot du `NeutralCommonCaller` ;
- toutes les campagnes en attente ;
- toutes les décisions récemment réglées ;
- pour chaque attente : `sessionId`, `needId`, sélection, proposition, payload
  Logos et action physique exacte.

La restauration refuse :

- une version inconnue ;
- un autre ensemble ou ordre de propriétaires ;
- des sessions ou `needId` dupliqués ;
- une proposition appartenant à un propriétaire absent ;
- une identité sélectionnée incohérente ;
- une action différente de celle du payload ;
- un payload appartenant à une autre session ;
- un dépassement des bornes de rétention.

### Codec exact FieldStock

`field-stock-snapshot.ts` sérialise explicitement les structures qui ne sont pas
préservées correctement par un JSON naïf :

- `Map` des demandes, minimums et lignées ;
- `Set` des types mobiles et échecs ;
- règles observées et preuves ;
- templates de classes ;
- ordre des types, requêtes, zones et interfaces ;
- bornes, action, scène, événements et état d’invalidation ;
- modèle adressé, échantillons, indicateur, calibration, prior et stock actif.

La restauration produit des copies détachées. Modifier l’état restauré ne modifie
pas l’état source.

### Coordinateur atomique

`CommonCampaignCheckpointCoordinator` capture la campagne et une liste ordonnée
de participants explicites. La restauration est transactionnelle :

1. validation de la version et de l’identité des participants ;
2. sauvegarde de l’état courant ;
3. restauration de la campagne ;
4. restauration de chaque participant ;
5. rollback de la campagne et de tous les participants si une restauration
   échoue.

Le coordinateur ne choisit aucune action et ne crée aucune proposition. Il ne
fait que préserver des identités et connaissances déjà établies.

### Participant FieldStock

`ObservedAddressedMaterialCheckpointParticipant` raccorde l’état public de
`ObservedAddressedMaterialRuntime` au coordinateur. Les caches mémoïsés privés et
transitoires du runtime ne sont volontairement pas sérialisés. La cible prévue
est une restauration dans un runtime frais, afin de ne pas transporter des
résultats calculés pour une ancienne instance.

## Chaîne démontrée

La preuve centrale exécute :

```text
observation publique
→ proposition OP28 simple
→ création d’un needId
→ action physique en attente
→ snapshot campagne + FieldStock
→ nouvelle campagne et nouveau runtime
→ restauration
→ même needId toujours en attente
→ acquisition du retour une seule fois
→ deuxième acquisition classée duplicate
→ nouveau snapshot après règlement
→ deuxième restauration
→ duplicate toujours supprimé
```

Le `needId`, le propriétaire, la proposition et l’action restent identiques après
restauration.

## Tests ciblés

Les quatre nouveaux contrats sont :

1. codec FieldStock exact avec conservation des `Map`, `Set` et connaissances ;
2. retour physique en attente restauré avec le même `needId` puis acquis une
   seule fois ;
3. rollback complet après le refus d’un participant ;
4. refus d’un autre ordre de participants avant toute mutation.

Avec les régressions directes de `CommonCampaignOwner` et
`NeutralCommonCaller`, la qualification ciblée donne :

- tests : **20** ;
- réussis : **20** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0`.

## Qualification complète

Environnement :

- runner : Ubuntu GitHub Actions ;
- Node : `22.18.0` ;
- Pyodide préparé par le build : Python navigateur `3.14.2`.

Résultats :

- `npm ci` : réussi ;
- régression TypeScript complète : **385/385 réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0` ;
- build de production : réussi ;
- modules Vite transformés : `62` ;
- galerie : `100` jeux, `636` prévisualisations, `4` atlas natifs.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant cette
tranche, restent signalées par `npm ci`.

## Disposition C1

La dette C1 est maintenant divisée précisément :

### Qualifié dans cette tranche

- snapshot versionné de la campagne commune ;
- conservation d’un `needId` et d’une action en attente ;
- conservation des décisions réglées et de la déduplication ;
- snapshot exact du modèle, prior, stock et preuves FieldStock ;
- restauration atomique avec rollback ;
- acquisition exactement une fois après reprise.

### Encore ouvert

- exposition du checkpoint par `BrowserCommonCampaignHost` ;
- ownership du checkpoint par `BrowserAgentController` ;
- désactivation puis réactivation Agent dans le navigateur réel ;
- vérification de l’observation courante avant reprise ;
- traitement d’une action déjà envoyée au jeu mais dont le retour n’est pas
  encore revenu ;
- politique durable de stockage, durée de vie et invalidation des checkpoints ;
- snapshots propres aux producteurs conjoints SMLP/STCK s’ils acquièrent à
  l’avenir un état interne au-delà de la déduplication commune.

Disposition :

**le noyau de checkpoint de la campagne et de FieldStock est qualifié, y compris
la continuité exacte du `needId` et l’acquisition unique. La continuité complète
du contrôleur produit entre deux activations navigateur n’est pas encore
revendiquée.**

## Frontière de performance

Cette tranche ajoute des opérations de snapshot explicites, mais aucun snapshot
n’est encore appelé dans la boucle produit active. Elle ne modifie donc pas la
preuve officielle C7 Region et ne qualifie pas le coût futur de la persistance
produit.

Aucun pourcentage de surcharge n’est revendiqué.

## Publication

Aucune publication Site n’est effectuée. Le changement reste GitHub-only jusqu’à
ce qu’un raccord produit visible soit qualifié et intégré sur la branche
canonique.

## Étape suivante

La prochaine tranche doit raccorder ce noyau au navigateur :

1. faire posséder le coordinateur par le host produit ;
2. exposer `snapshot()` et `restore()` sur le host sans dupliquer la politique ;
3. stocker un checkpoint seulement à une frontière sûre ;
4. recréer un host et un runtime frais lors de la réactivation Agent ;
5. restaurer avant toute nouvelle décision ;
6. vérifier l’identité de l’observation courante ;
7. reprendre un retour en attente sans rejouer l’action ;
8. prouver dans une fixture navigateur réelle qu’il n’existe ni perte de
   `needId`, ni double acquisition, ni double ACTION6.
