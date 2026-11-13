# OP01–OP31 : raccord navigateur de la continuité de session

Date : 13 novembre 2026

## Références

- dépôt : `yannick-fontan-1981/sra-playground` ;
- branche canonique cible : `recovery/site109-reconstruction-20261112` ;
- branche de travail : `op01-op31-browser-session-resume-20261113` ;
- base canonique réconciliée : `97ba156fd0ffb8359cb84514c91f1504d84e928c` ;
- arbre source réconcilié avant finalisation :
  `9bc69001ac697f8a6f6cc50911b8de4696ce32f8` ;
- commit déclencheur de la qualification : `3f7b90fd2a929b029b2f535872e9567842fe815b` ;
- run GitHub Actions : `43431242149` ;
- job : `131904989533` ;
- preuve structurée :
  `docs/recovery/op01-op31-browser-session-resume-qualified.json`.

## Objectif

Le noyau précédent savait capturer puis restaurer la campagne commune,
FieldStock, le `needId`, les décisions réglées et la déduplication. Cette
tranche raccorde ce noyau au seam produit navigateur sans donner au checkpoint
une autorité de décision supplémentaire.

L'objectif causal est double :

1. arrêter une campagne à une frontière réglée, recréer un host frais puis
   poursuivre la même session sans perdre son état ;
2. lorsqu'une action physique a déjà été envoyée mais que son retour n'a pas
   encore été acquis, consommer l'observation revenue avec le même `needId`
   sans rejouer l'action et sans présenter deux fois le même retour.

## Architecture raccordée

### Contrat de checkpoint navigateur

`src/runtime/v6-browser-campaign-checkpoint.ts` définit un format versionné
qui lie explicitement :

- l'état atomique de la campagne commune et de ses participants ;
- le `sessionId` produit ;
- le code du jeu ;
- la prochaine séquence publique ;
- l'identité déterministe de l'observation ;
- les observations jeu et Agent correspondantes ;
- l'éventuel retour physique en attente ;
- la préparation sélectionnée, son propriétaire, sa proposition et son
  `needId`.

La restauration refuse une autre version, un autre jeu, une rupture de séquence,
une observation Agent qui ne correspond pas au frame public, ou une attente qui
ne correspond plus à l'unique besoin conservé par la campagne.

### Host produit

`BrowserCommonCampaignHost` possède maintenant le
`CommonCampaignCheckpointCoordinator`. Il accepte deux frontières :

- **frontière réglée** : aucun besoin physique n'est en attente ;
- **frontière envoyée** : le besoin est encore en attente, mais l'appel physique
  à `ports.action()` a réellement commencé et son identité est conservée.

Une proposition préparée mais jamais envoyée n'est pas checkpointable. Cette
distinction empêche de restaurer une intention comme si elle avait déjà produit
un effet dans le jeu.

Au retour d'une frontière envoyée :

- si l'observation publique n'a pas changé, le host reste `pending` ;
- si elle a changé, le host reconstruit la prochaine observation Agent ;
- il acquiert le retour avec le même `needId` ;
- il appelle ensuite les observateurs passifs FieldStock ;
- il ne rappelle pas `ports.action()` ;
- il ne rappelle pas la présentation, car l'observation est déjà celle du
  produit vivant ;
- il renvoie le statut explicite `resumed` avant toute décision suivante.

### FieldStock

Le coordinateur restaure ensemble :

- l'état exact de `ObservedAddressedMaterialRuntime` ;
- le contexte public courant du transport FieldStock ;
- la campagne et sa déduplication.

Le runtime et son transport restent deux participants distincts, avec des
identités et un ordre déterministes. Les statuts diagnostiques transitoires du
transport ne sont pas revendiqués comme connaissance durable.

### Contrôleur Agent

`BrowserAgentController` conserve un checkpoint lorsqu'il s'arrête à une
frontière sûre : `manual`, `none`, `ambiguous`, `pending`, `blocked`
ou limite d'actions.

À la prochaine activation il :

1. crée un nouveau host ;
2. tente de restaurer le checkpoint avant toute décision ;
3. conserve le même `sessionId` et le compteur d'actions ;
4. refuse un checkpoint réglé si l'observation vivante a changé ;
5. repart dans une nouvelle session si la restauration est refusée ;
6. ne compte pas `resumed` comme une nouvelle action physique.

Un remplacement de jeu, un terminal, une erreur ou `dispose()` invalide le
checkpoint détenu en mémoire.

## Chaînes démontrées

### Session réglée

`observation initiale → action OP28 → acquisition → arrêt none → checkpoint →
host frais → restauration → même session → aucune action supplémentaire`

La preuve vérifie que le compteur reste à une action et que la seconde activation
ne rappelle pas le transport physique.

### Retour déjà envoyé

`préparation OP28 → needId → ports.action appelé → snapshot envoyé → host frais
→ observation vivante avancée → même needId acquis → zéro replay → zéro seconde
présentation`

La variante où l'observation vivante n'a pas encore avancé reste explicitement
`pending` et n'exécute aucune action.

### Checkpoint obsolète

`checkpoint réglé → frame vivant différent → refus → host frais → nouvelle
session`

Le refus est observable par le callback du contrôleur et ne transforme jamais
l'ancien état en connaissance applicable au nouveau frame.

## Qualification

Environnement :

- runner : GitHub Actions Ubuntu ;
- Node : `v22.18.0` ;
- base canonique incluse : `97ba156fd0ffb8359cb84514c91f1504d84e928c`.

Résultats ciblés :

- tests : **25** ;
- réussis : **25** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0`.

Régression complète :

- tests TypeScript : **396/396** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0`.

Build :

- production : réussi ;
- modules Vite transformés : `66` ;
- galerie : `100` jeux, `636`
  prévisualisations, `4` atlas natifs.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant ce
lot, restent signalées par `npm ci`.

## Disposition C1

Qualifié dans cette tranche :

- ownership du coordinateur par le host produit ;
- format navigateur versionné et validé ;
- restauration dans un host frais avant nouvelle décision ;
- continuité d'une session réglée entre deux activations du contrôleur ;
- conservation du `sessionId` et du compteur d'actions ;
- rejet d'un checkpoint obsolète ;
- conservation d'un retour réellement envoyé ;
- acquisition du même `needId` sans double action ni double présentation ;
- restauration conjointe de FieldStock et de son contexte public.

Disposition :

**le checkpoint est raccordé au host et au contrôleur dans les contrats produit
TypeScript. Une frontière réglée peut reprendre avec un host frais. Le host peut
aussi acquérir un retour déjà physiquement envoyé sans rejouer l'action.**

## Frontière de preuve

Cette tranche ne revendique pas encore :

- une désactivation/réactivation exécutée dans Chrome ;
- un stockage durable dans IndexedDB, localStorage ou un service externe ;
- la conservation lors de `pagehide`, d'un crash ou d'un nouveau processus ;
- une capture automatique par le contrôleur pendant que son appel physique est
  encore en vol : la preuve de cette frontière est portée directement par le
  host ;
- la reprise d'une observation avancée arbitraire sans besoin physique corrélé ;
- une qualification de surcharge de performance ;
- une publication Site.

Le checkpoint du contrôleur reste actuellement en mémoire. `dispose()` le
supprime volontairement. La preuve est donc une qualification des contrats
produit et de leur causalité, pas encore une preuve de persistance navigateur
inter-processus.

## Performance

Les opérations de snapshot et restauration ne sont pas appelées dans chaque tour
de décision. Elles n'appartiennent pas à l'ancienne preuve C7 Region et aucune
mesure de surcharge n'est revendiquée dans cette tranche.

## Publication

Aucune publication Site n'est effectuée. Le code et les preuves restent sur
GitHub jusqu'à une tranche visible explicitement qualifiée depuis le canonique.

## Étape suivante

1. définir une politique de stockage durable et d'expiration du checkpoint ;
2. associer le checkpoint à l'identité du jeu et à la génération produit ;
3. conserver une frontière sûre lors de `pagehide` sans annuler le besoin
   physiquement envoyé ;
4. exécuter une vraie désactivation/réactivation dans Chrome contre Pyodide ;
5. vérifier dans cette fixture l'absence de double ACTION6, double acquisition,
   double présentation et perte de `needId` ;
6. mesurer séparément le coût de la continuité active avant toute revendication
   de performance.
