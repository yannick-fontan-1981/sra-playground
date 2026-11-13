# OP01–OP31 — contrôleur Agent explicite du produit navigateur

Date : 12 novembre 2026

Dépôt : `yannick-fontan-1981/sra-playground`

Branche canonique cible :
`recovery/site109-reconstruction-20261112`

Baseline canonique de départ :
`4bf27669ce8f2945aa7672f134ffe1cefcac35ae`

Branche de travail :
`op01-op31-browser-agent-controller-20261112`

Plan stable :
`docs/migration/op01-op31-verification-plan.md`

Suivi consolidé :
`docs/migration/op01-op31-progress.md`

## Objectif

Cette tranche active dans le produit un contrôleur Agent explicite, unique et
borné au-dessus du seam navigateur déjà qualifié.

Elle ferme la dette suivante des tranches précédentes : deux seams capables de
porter la campagne commune existaient, le seam navigateur direct et le seam
Worker, mais aucun composant produit ne possédait explicitement la session.
Les deux ne devaient pas être activés simultanément.

Le choix de cette tranche est volontairement strict :

- le produit navigateur instancie uniquement `BrowserAgentController` ;
- ce contrôleur utilise uniquement `BrowserCommonCampaignHost` ;
- le Worker commun reste disponible pour les autres runtimes et ses tests ;
- `main.ts` n’instancie pas le seam Worker ;
- une seule campagne peut être en vol pour une session produit ;
- le contrôleur ne choisit jamais une action lui-même.

## Chaîne active

Lorsque l’utilisateur sélectionne explicitement **SRA Agent**, la chaîne active
est :

**GameObservation publique → BrowserAgentController →
BrowserCommonCampaignHost → contextes des propriétaires →
CommonCampaignOwner → autorité Logos → dispatch produit →
BrowserGameRuntime → retour public → acquisition corrélée au même needId →
présentation → décision suivante.**

Le mode Manual conserve son chemin historique direct. Les clics, touches,
réinitialisations et changements de niveau humains ne traversent pas le
contrôleur Agent.

## Composant ajouté

### `src/runtime/v6-browser-agent-controller.ts`

`BrowserAgentController` possède la durée de vie d’une session Agent navigateur.
Il expose un état observable :

- `idle` ;
- `running` ;
- `stopping` ;
- `stopped` ;
- `error` ;
- `disposed`.

Il conserve également :

- l’identifiant de session ;
- le dernier statut de campagne ;
- la cause d’arrêt ;
- le nombre d’actions physiquement dispatchées ;
- un seul `Promise` de campagne en vol.

La constante publique de statut annonce exactement le périmètre actif :

```text
available: true
name: SRA
status: bounded-browser-common-campaign
seam: browser-common-campaign
```

Elle ne présente pas ce fallback borné comme le SRA général.

## Contrat de démarrage

`activate()` refuse de créer une campagne lorsque :

- l’observation est terminale ;
- le produit est occupé, en chargement ou en échec ;
- le jeu sélectionné ne correspond pas ;
- l’objet `GameObservation` n’est pas l’observation courante exacte ;
- le contrôleur a déjà été détruit.

Une observation structurellement égale mais copiée ne peut donc pas redémarrer
une décision sur une révision ancienne.

Lorsque la campagne existe déjà, une seconde activation réutilise le même cycle
au lieu d’instancier un deuxième propriétaire.

## Contrat de boucle

Le contrôleur appelle le host pour obtenir une décision déjà autorisée. Il ne
fabrique ni proposition, ni bundle, ni coordonnées, ni priorité.

Après chaque retour il s’arrête immédiatement sur :

- `none` : aucun producteur n’a fourni une proposition complète ;
- `ambiguous` : plusieurs propriétaires proposent et aucun classement n’est
  autorisé ;
- `blocked` : Logos a refusé la release ;
- `pending` : une action précédente attend encore son retour ;
- observation terminale ;
- produit ou génération périmés ;
- erreur ;
- limite dure d’actions.

La limite par défaut est de **64 actions**. Elle empêche une observation restant
artificiellement mono-action de créer une boucle illimitée.

L’absence de proposition ne déclenche jamais de première action disponible, de
RESET, de déplacement exploratoire ou d’autre fallback.

## Passage Agent → Manual

Le retour au mode Manual est gracieux.

Si aucune action n’est en vol, le host est immédiatement libéré. Si une action
a déjà été envoyée au jeu, le contrôleur laisse cette action :

1. recevoir sa réponse physique ;
2. corréler le retour au `needId` ;
3. acquérir le retour dans le propriétaire sélectionné ;
4. présenter l’observation ;
5. libérer ensuite la propriété Agent.

Le mode Manual ne reprend donc jamais entre le retour physique et son
acquisition symbolique.

Un remplacement de jeu ou de session possède une priorité supérieure à une
simple demande Manual. Le changement de génération rend le vieux retour
obsolète et empêche son entrée dans le nouveau jeu.

## Destruction de page

`pagehide` détruit d’abord le contrôleur, puis le runtime jeu.

Si l’annulation d’une action en vol fait remonter une erreur, le résultat final
reste `disposed`. Une erreur de transport provoquée par la fermeture ne peut pas
réétiqueter la session détruite en `error` ni déclencher un nouveau traitement.

## Raccord dans `main.ts`

Le panneau Agent n’est plus une simple annonce « coming next » :

- le bouton est présenté comme **Bounded** ;
- le panneau publie l’état courant du contrôleur ;
- les raisons d’arrêt sont lisibles ;
- l’interface précise qu’aucune action de secours n’est inventée ;
- le bouton « Return to Manual » demande le transfert gracieux ;
- l’onglet Agent est désactivé tant qu’aucune observation saine n’est chargée.

Les ports Agent réutilisent les propriétaires existants du produit :

- `productReadinessState()` ;
- `BrowserGameRuntime.action()` ;
- `presentProductObservation()` via `present(..., false)` ;
- `selectionGeneration` ;
- la propriété `busy` ;
- le traitement d’erreur existant.

Le contrôleur ne duplique donc ni la validation des actions publiques, ni la
présentation, ni les règles d’obsolescence, ni les coordonnées ACTION6.

## Périmètre réellement actif

Le host créé par défaut enregistre deux propriétaires :

- FieldStock/OP18 ;
- l’action publique simple unique/OP28.

Le runtime FieldStock est neuf et vide à chaque création par défaut. Son
inscription ne lui donne donc aucun pouvoir :

- aucun prior → aucun composant mesuré pour FieldStock ;
- aucune revalidation → aucune proposition OP18 ;
- ACTION6 seule → `none`, sans coordonnées inventées ;
- une action simple unique → OP28 comme avant ;
- plusieurs propositions complètes → `ambiguous` sans classement.

Lorsqu’un prior est explicitement fourni à une fabrique contrôlée, le transport
browser le revalide depuis les pixels publics avant OP18. Cette capacité est
qualifiée, mais le produit ne découvre pas encore le prior initial.

Le produit dispose donc d’une vraie boucle Agent et d’un transport OP18 prudent,
sans prétendre encore une acquisition ou planification générale.

## Tests ajoutés

### Contrôleur

`tests/v6-browser-agent-controller.test.ts` vérifie :

- seam navigateur unique déclaré ;
- absence de politique d’action par défaut ;
- action OP28 stricte puis arrêt sur l’observation suivante non univoque ;
- une seule campagne en vol ;
- réutilisation de la même promesse lors d’une activation concurrente ;
- retour Manual gracieux après acquisition ;
- aucun dispatch pour `ambiguous` ou `blocked` ;
- aucune création de host sur observation terminale ou périmée ;
- limite dure d’actions ;
- erreur explicite et rapportée une seule fois ;
- conservation de l’état `disposed` lorsqu’une annulation en vol rejette.

### Intégration produit

`tests/main-browser-agent-controller-integration.test.ts` vérifie :

- instanciation du contrôleur navigateur dans `main.ts` ;
- absence d’instanciation du seam Worker ;
- propriété Agent et transfert Manual ;
- remplacement propre lors d’un changement de jeu ;
- réutilisation du runtime, de la présentation et de la génération produits ;
- message public borné ;
- absence de fallback caché.

### FieldStock par défaut

`tests/v6-browser-agent-controller-field-stock-default.test.ts` vérifie la
fabrique combinée et l’arrêt `none` sans dispatch lorsque seule ACTION6 est
disponible mais qu’aucun prior FieldStock n’existe.

## Qualification

Qualification historique du contrôleur : run `43351836350`, job
`131644500100`, **325/325 tests** et build réussis.

Qualification actuelle avec le transport FieldStock enregistré par défaut :

- run : `43353708964` ;
- job : `131650593632` ;
- commit : `400d9bcc1062130508d27e62f1508f82011d2ea7` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck : réussi ;
- régression complète : **332/332 tests réussis** ;
- build Vite : réussi ;
- 100 jeux, 636 prévisualisations et 4 atlas générés.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées. Cette tranche ne les introduit ni ne les corrige.

## Performance

Le critère reste : pour chaque jeu de référence, la médiane de session complète
doit augmenter de strictement moins de 10 %. STCK et SMLP sont évalués
séparément ; un jeu ne compense pas l’autre.

Cette tranche active du code supplémentaire uniquement lorsque l’utilisateur
sélectionne le mode Agent. Le mode Manual ne traverse aucune campagne Agent,
mais le contrôleur est chargé et instancié avec la page. La réussite des tests et
du build ne remplace donc pas la mesure de session complète.

Verdict :

**activation fonctionnelle qualifiée ; coût officiel C7 à confirmer.**

Les quatre runners A/STCK, A/SMLP, B/STCK et B/SMLP restent nécessaires avant
de déclarer le seuil garanti.

## Dispositions OP affectées

- **OP28** : activation produit réelle conservée sous le contrat mono-action
  strict.
- **OP18** : propriétaire et transport navigateur enregistrés ; revalidation,
  ACTION6 et retour qualifiés lorsqu’un prior réel est fourni ; acquisition
  initiale absente du produit.
- **OP29/OP30** : consommation spécialisée et frontière post-acquisition
  conservées sans appel générique redondant.
- **OP31** : toujours sans propriétaire d’objectif produit.
- **Autres OP** : aucune activation artificielle.

## Limites ouvertes

- aucun mécanisme produit n’acquiert encore le prior FieldStock initial ;
- le runtime FieldStock par défaut reste vide ;
- Region ne possède pas encore le contrat physique commun complet ;
- les acquisitions passives multi-propriétaires ne sont pas orchestrées ;
- les sessions et connaissances Agent ne disposent pas encore d’une sauvegarde
  et restauration produit ;
- aucun propriétaire OP31 n’est raccordé ;
- la performance officielle C7 reste ouverte ;
- aucune publication Site n’est effectuée.

## Prochaine étape

La prochaine tranche doit acquérir le prior initial à partir d’un besoin public
réel, puis utiliser le transport déjà qualifié :

1. détecter les témoins publics d’un champ adressé ;
2. produire un prior local avec provenance et limites ;
3. le conserver comme hypothèse non applicable ;
4. laisser la scène courante le revalider ;
5. démontrer OP18 jusqu’à la décision suivante en campagne réelle ;
6. poursuivre ensuite Region, restauration, OP31 et C7.

GitHub reste la source canonique. Toute publication Site future devra pointer
vers un commit canonique intégré et vérifié.
