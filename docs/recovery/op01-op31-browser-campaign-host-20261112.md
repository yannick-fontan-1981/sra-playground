# OP01–OP31 — hôte produit/browser de campagne commune

Date : 12 novembre 2026

Branche de travail :
`op01-op31-browser-campaign-host-20261112`

Baseline canonique de départ :
`recovery/site109-reconstruction-20261112` au commit
`8cc510e0a0d09704eb508b3aa2216b4d63482af4`.

Plan stable :
`docs/migration/op01-op31-verification-plan.md`.

Suivi consolidé :
`docs/migration/op01-op31-progress.md`.

## Objectif

Cette étape raccorde le propriétaire commun de campagne à la frontière publique
du produit navigateur sans activer artificiellement un agent dans l’interface.

La chaîne qualifiée est :

**GameObservation publique → AgentObservation → contextes des propriétaires →
CommonCampaignOwner → autorité Logos → AgentProductDispatch →
BrowserGameRuntime → retour public → acquisition corrélée au même needId →
présentation → décision suivante.**

Le nouvel hôte ne devient ni un producteur symbolique ni un arbitre. Il ne
classe pas les propositions, ne fabrique pas de bundle, ne complète pas les
coordonnées manquantes et ne libère aucune action par lui-même.

## Composant ajouté

### `src/runtime/v6-browser-common-campaign-host.ts`

`BrowserCommonCampaignHost` possède uniquement la couture entre :

- les observations publiques du jeu navigateur ;
- `BrowserAgentObservationStream` ;
- les contextes explicitement fournis par chaque propriétaire ;
- `CommonCampaignOwner` ;
- `dispatchProductAction()` ;
- l’acquisition du retour physique ;
- le port de présentation existant.

Il exige une correspondance exacte entre les propriétaires enregistrés dans la
campagne et leurs transports navigateur. Un propriétaire sans transport, un
transport sans propriétaire ou un doublon est refusé à la construction.

## Séquence d’une campagne

### 1. Démarrage de session

`begin()` :

1. annule une éventuelle décision encore en attente dans l’ancienne session ;
2. crée un flux d’observations pour un seul jeu et un seul `sessionId` ;
3. convertit la première `GameObservation` visible en `AgentObservation` ;
4. conserve la paire exacte jeu/agent comme état courant.

Le flux attribue des révisions monotones seulement après une conversion
publique réussie.

### 2. Préparation

`run()` refuse de produire un besoin lorsque :

- le produit est occupé, en chargement ou en échec ;
- l’observation n’appartient pas au jeu sélectionné ;
- l’objet d’observation fourni n’est pas l’observation courante exacte de
  l’hôte ;
- aucune session n’a été commencée.

Cette identité d’objet est volontaire : une copie structurellement égale mais
ancienne ne peut pas déclencher une nouvelle décision.

Lorsque le produit est prêt, l’hôte construit un contexte par propriétaire et
appelle `CommonCampaignOwner.prepare()`. Les statuts restent inchangés :

- `none` : aucune proposition et aucune OP ;
- `ambiguous` : plusieurs propositions, aucune OP et aucun classement ;
- `pending` : une action précédente attend toujours son retour ;
- `blocked` : Logos a refusé la release ;
- `action` : une action a été autorisée par la campagne.

### 3. Dispatch physique

Une action autorisée traverse le contrat produit existant :

- la disponibilité publique est revalidée ;
- la génération de sélection est figée ;
- `busy` reste détenu par le dispatch ;
- ACTION6 conserve exactement `x` et `y`, y compris la valeur zéro ;
- le temps du dispatch s’arrête avant la présentation ;
- une réponse d’un autre jeu ou d’une génération obsolète n’est pas présentée.

L’hôte ne duplique pas ces règles. Il délègue à `dispatchProductAction()`.

### 4. Acquisition avant présentation

Dans le port `present` du dispatch, l’ordre est obligatoire :

1. convertir la réponse physique en observation agent suivante ;
2. construire le payload de retour du propriétaire sélectionné ;
3. appeler `CommonCampaignOwner.acquire()` avec le même `sessionId`, le même
   propriétaire, la même proposition et le même `needId` ;
4. mettre à jour l’observation courante de l’hôte ;
5. seulement ensuite présenter le résultat à l’interface.

Une nouvelle décision symbolique ne peut donc pas être demandée entre le retour
du jeu et sa consommation par le propriétaire sélectionné.

### 5. Annulation et obsolescence

Si l’action échoue, si la réponse devient obsolète avant acquisition ou si une
nouvelle session remplace l’ancienne, le besoin non réglé est annulé.

Le remplacement de session invalide aussi une réponse en vol même lorsque le
numéro de génération externe n’a pas changé. L’ancienne réponse ne peut ni être
acquise ni être présentée dans la nouvelle session.

Après une acquisition réussie, une erreur de présentation ne réouvre pas le
besoin : le retour physique a déjà été consommé par le propriétaire. La couche
visuelle ne possède pas l’autorité pour annuler ce fait.

## Premier hôte borné OP28

`createPublicSingleActionBrowserCampaignHost()` instancie le premier contrat
utilisable sans perception privée :

- un seul propriétaire, le fallback public OP28 ;
- exactement une action simple publique distincte hors RESET ;
- aucune ACTION6 sans coordonnées ;
- plusieurs actions publiques restent sans proposition ;
- retour corrélé au propriétaire exact.

Cette fabrique démontre la couture produit. Elle ne constitue pas un
planificateur général et n’est pas présentée comme le SRA complet.

## Tests ajoutés

`tests/v6-browser-common-campaign-host.test.ts` vérifie :

- conservation du même `needId` de la release au retour ;
- acquisition avant présentation ;
- impossibilité de dispatcher deux fois pendant une attente ;
- révision agent monotone après le retour ;
- décision suivante construite depuis l’observation acquise ;
- ACTION6 avec coordonnées `{ x: 0, y: 9 }` intactes ;
- absence de besoin lorsque le produit n’est pas prêt ;
- refus d’une copie d’observation périmée ;
- ambiguïté multi-propriétaires sans dispatch ;
- annulation d’un besoin sur génération obsolète ;
- annulation sur erreur de transport ;
- invalidation d’une réponse provenant d’une session remplacée ;
- couverture exacte propriétaire/transport.

## Qualification

Qualification GitHub Actions :

- run : `43348635198` ;
- job : `131633987557` ;
- commit qualifié : `8a73045e594bac9892f8846564b76c367c5fcccd` ;
- baseline canonique incluse :
  `8cc510e0a0d09704eb508b3aa2216b4d63482af4` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **300/300 tests réussis** ;
- rapport de câblage produit : `logos-product-wiring-present`.

Le rapport de câblage voit désormais explicitement
`src/runtime/v6-browser-common-campaign-host.ts` en plus des seams runtime déjà
présents.

`npm ci` signale deux vulnérabilités de dépendances de sévérité haute déjà
présentes dans l’arbre. Elles ne sont pas introduites ni corrigées par cette
tranche fonctionnelle.

## Performance

Le plan conserve le critère suivant : pour chaque jeu de référence, la médiane
de session complète doit augmenter de strictement moins de 10 %, avec STCK et
SMLP évalués séparément.

Cette tranche ajoute une classe de bibliothèque mais ne l’instancie pas dans
`main.ts` et ne l’exécute dans aucune session utilisateur. Elle ne modifie donc
pas le chemin de jeu actif actuel. Un micro-benchmark isolé de la classe ne
remplacerait pas la mesure requise sur les sessions complètes.

Verdict : **intégration fonctionnelle du seam terminée, coût d’activation à
confirmer**.

La mesure officielle devra être faite après raccordement d’un contrôleur Agent
réel et des contextes spécialisés, sur A/STCK, A/SMLP, B/STCK et B/SMLP selon le
manifeste C7.

## Ce qui n’est volontairement pas activé

- `main.ts` ne crée pas encore `BrowserCommonCampaignHost` ;
- les clics du mode Manual restent des actions humaines directes ;
- l’onglet Agent ne prétend pas encore exécuter la campagne commune ;
- aucune boucle automatique n’enchaîne les décisions ;
- aucune observation privée du moteur n’est ajoutée ;
- FieldStock n’a pas encore de constructeur de contexte produit depuis chaque
  observation navigateur ;
- Region n’a toujours pas de contrat physique complet
  `AgentAction + CompositionBundle + état + identity` ;
- aucun propriétaire d’objectif OP31 n’est raccordé ;
- les décisions communes en attente n’ont pas encore de snapshot/restauration ;
- les états produit non représentables par le protocole agent restent refusés
  plutôt que convertis silencieusement ;
- aucune publication Site n’est effectuée.

## Dispositions OP

- **OP18** : inchangée, chaîne FieldStock démontrée en bibliothèque jusqu’à la
  décision suivante ; le transport navigateur générique est maintenant prêt,
  mais le constructeur de contexte produit FieldStock manque encore.
- **OP28** : seam produit/browser complet démontré pour le fallback public
  strict, de l’observation jusqu’au retour acquis avant présentation.
- **OP29/OP30** : consommateurs spécialisés inchangés ; aucun appel générique
  redondant ajouté.
- **OP31** : toujours sans propriétaire d’objectif produit démontré.
- **Autres OP** : aucune activation artificielle.

## Prochaine étape

Construire un contrôleur explicite de mode Agent, séparé du chemin Manual :

1. créer une session d’hôte après le chargement d’un jeu ;
2. produire les contextes uniquement pour les propriétaires réellement
   applicables ;
3. exécuter au plus une campagne à la fois ;
4. arrêter proprement sur `none`, `ambiguous`, `blocked`, terminal ou erreur ;
5. ne jamais transformer l’absence de proposition en action par défaut ;
6. ajouter le constructeur de contexte produit FieldStock ;
7. qualifier ensuite les sessions complètes et leur coût avant activation
   publique.

GitHub reste la source canonique. Aucune publication Site n’est autorisée avant
intégration durable du contrôleur, qualification et vérification GitHub ↔ Site.
