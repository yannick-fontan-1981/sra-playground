# OP01–OP31 — transport FieldStock OP18 dans le produit navigateur

Date : 12 novembre 2026

## Références

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique de départ : `97e036fc6609a4822feffe0f834a120f831c1397`
- Canonique lot 9B réconciliée : `85d8c5e57a26ae3f02a0e89c49f5894dc571bf70`
- Merge de réconciliation : `70943d5715e7e44680ab307f0e8ddca27dd020aa`
- PR de réconciliation : `#54`
- Branche de travail : `op01-op31-browser-field-stock-20261112`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Suivi consolidé : `docs/migration/op01-op31-progress.md`
- Contrôleur produit précédent :
  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`

## Objectif

Cette tranche raccorde le propriétaire FieldStock OP18 au contrôleur Agent
navigateur unique déjà actif.

Le but n’est pas d’inventer un prior FieldStock ni d’ajouter une politique de
classement. Le but est de rendre transportable et consommable, dans le produit,
un stock qui a déjà été retenu puis revalidé honnêtement à partir des seuls
pixels publics.

La campagne active possède maintenant deux propriétaires :

- `FieldStockCallerOwnerAdapter` pour OP18 ;
- `PublicSingleActionCallerOwnerAdapter` pour le fallback OP28 strict.

Ils restent soumis au `CommonCampaignOwner` neutre :

- zéro proposition → `none` ;
- une proposition → validation et autorité Logos ;
- plusieurs propositions → `ambiguous` ;
- bundle refusé → `blocked`.

Aucun propriétaire ne reçoit de priorité implicite.

## Composant ajouté au host navigateur

### `BrowserFieldStockCampaignTransport`

Le transport est ajouté dans :

`src/runtime/v6-browser-common-campaign-host.ts`.

Il possède exactement le runtime FieldStock associé au propriétaire enregistré.
Il produit un `FieldStockCampaignContext` depuis :

- l’identifiant de session navigateur ;
- l’`AgentObservation` publique 64 × 64 ;
- les lignes de palette copiées depuis cette observation ;
- un budget borné ;
- les dépendances publiques FieldStock déjà qualifiées.

Il n’accède ni aux fixtures du jeu, ni à l’état Python interne, ni aux coordonnées
cachées, ni à un modèle oracle.

## Revalidation publique

Le transport suit le même contrat que le seam Worker :

1. mesurer l’observation publique sans matérialiser les entités coûteuses ;
2. détecter une frontière officielle à partir du niveau, du score public et de
   l’état terminal ;
3. convertir un stock actif traversant la frontière en prior compact ;
4. matérialiser les composantes visibles uniquement si un prior retenu attend
   une revalidation ;
5. appeler `ObservedAddressedMaterialRuntime.revalidate()` ;
6. n’exposer une proposition OP18 que si un stock courant revalidé existe.

Une scène compatible peut donc reconstruire un stock courant. Une scène
incompatible conserve le prior avec le statut
`retained_pending_revalidation`, sans le rendre applicable.

## Retour sélectionné et observation passive

Le host navigateur conserve l’ordre suivant :

1. action physique ;
2. conversion du retour public ;
3. acquisition par le propriétaire sélectionné avec le même `needId` ;
4. observation passive du même retour par les autres transports ;
5. notification produit ;
6. présentation.

Ainsi, un retour OP18 est d’abord consommé par
`FieldStockCallerOwnerAdapter.acquire()`, qui exécute `afterStock()` puis
`recordStock()`. Le retour peut modifier la proposition suivante avant qu’une
nouvelle décision soit demandée.

Un retour OP28 peut aussi traverser une frontière et déclencher la rétention ou
la revalidation passive de FieldStock. Cette observation passive ne peut ni
acquérir le `needId` sélectionné, ni prétendre que FieldStock avait choisi
l’action, ni proposer une deuxième action depuis le hook.

## Chaîne OP18 démontrée dans le navigateur

La preuve fonctionnelle qualifiée suit :

**stock courant revalidé → besoin typé insatisfait → proposition FieldStock →
bundle OP18 → autorité Logos → ACTION6 `(3,1)` → retour public → acquisition
avec le même `needId` → `afterStock()` → `recordStock()` → nouvelle proposition
ACTION6 `(4,1)`.**

Cette preuve utilise le vrai host navigateur et le vrai dispatch produit
contrôlé par les ports de test. Elle ne court-circuite ni le propriétaire commun,
ni l’autorité Logos, ni l’acquisition corrélée.

## Limite fondamentale conservée

Le runtime FieldStock créé par défaut démarre vide.

Cette tranche ne prétend donc pas qu’une session produit fraîche sait encore :

- découvrir seule le premier modèle adressé ;
- promouvoir une observation en prior initial ;
- restaurer un prior depuis une session précédente ;
- persister le stock entre deux activations Agent.

Sans prior explicite ou stock déjà revalidé :

- FieldStock ne propose rien ;
- ACTION6 seule ne reçoit aucune coordonnée inventée ;
- OP18 n’est pas appelée ;
- le fallback OP28 conserve ses règles historiques.

Disposition honnête :

**transport et consommation OP18 produit démontrés ; acquisition initiale et
persistance produit encore absentes.**

## Contrôleur produit

`BrowserAgentController` crée désormais par défaut :

`createFieldStockAndPublicSingleActionBrowserCampaignHost()`.

Il continue d’instancier uniquement le seam navigateur direct. Le Worker reste
qualifié mais n’est pas instancié par `main.ts`.

Les garanties précédentes restent inchangées :

- une seule campagne en vol ;
- aucune action locale ou par défaut ;
- arrêt sur `none`, `ambiguous`, `pending`, `blocked`, terminal, obsolescence,
  erreur ou limite ;
- acquisition avant décision suivante ;
- transfert Agent vers Manual après règlement du retour en vol ;
- limite dure de 64 actions.

## Tests ajoutés

`tests/v6-browser-field-stock-campaign-host.test.ts` vérifie :

1. ACTION6 OP18 `(3,1)` puis `(4,1)` après consommation du premier retour ;
2. conservation du même `needId` entre release et acquisition ;
3. revalidation d’un prior depuis la seule image publique courante ;
4. absence totale de coordonnées ACTION6 inventées avec un runtime vide ;
5. rétention prudente d’un stock traversant une frontière OP28 ;
6. absence de faux stock actif lorsque la nouvelle scène ne revalide pas le
   prior ;
7. utilisation du host combiné OP18 + OP28 par le contrôleur produit.

Les tests historiques continuent de vérifier la neutralité des propriétaires,
l’ambiguïté non classée, les retours périmés, les erreurs de transport et la
séparation Manual/Agent.

## Qualification fonctionnelle de la tranche

Première qualification du code FieldStock avant réconciliation concurrente :

- run GitHub Actions : `43354913250` ;
- job : `131654533095` ;
- commit qualifié : `bce3e89cbfd1cfc21245edf675d27870df524607` ;
- régression TypeScript complète : **330/330 réussis** ;
- typecheck et build : réussis.

## Qualification combinée canonique

La branche canonique a ensuite intégré le manifeste, les références A/B et le
harness ABBA Worker/Pyodide du lot 9B. Ces 17 fichiers ne chevauchaient aucun
fichier fonctionnel FieldStock. Ils ont été fusionnés dans la branche de travail
par la PR `#54`, puis l’état combiné a été entièrement requalifié.

Résultat final combiné :

- run GitHub Actions : `43355369134` ;
- job : `131656026153` ;
- commit qualifié : `70943d5715e7e44680ab307f0e8ddca27dd020aa` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **330/330 réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0` ;
- build Vite de production : réussi ;
- modules transformés : `53` ;
- galerie : `100` jeux, `636` prévisualisations et `4` atlas natifs ;
- rapport de câblage : `logos-product-wiring-present` ;
- fichiers source inspectés par la garde : `23`.

Les cinq tests propres au transport navigateur FieldStock sont inclus dans cette
régression combinée et réussissent. `npm ci` signale toujours deux
vulnérabilités de dépendances de sévérité haute préexistantes. Cette tranche ne
les introduit ni ne les corrige.

## Performance

Le critère C7 reste strictement inférieur à +10 % de médiane par jeu, avec STCK
et SMLP évalués séparément.

Le transport FieldStock est chargé avec le produit, mais ne matérialise les
composantes visibles que lorsqu’un prior attend une revalidation. Les tests et
le build ne remplacent pas une mesure de session complète.

Le harness ABBA officiel non isolé est désormais présent dans l’état combiné,
mais cette tranche n’exécute pas les quatre mesures R5 et ne revendique aucun
résultat de coût.

Verdict :

**fonctionnellement qualifié ; coût officiel C7 à confirmer.**

## Dispositions OP affectées

- **OP18** : transport produit, release, action, retour, acquisition et effet sur
  la proposition suivante démontrés avec un stock revalidé injecté ; acquisition
  initiale autonome toujours absente.
- **OP28** : fallback produit strict inchangé ; ses retours peuvent maintenant
  informer passivement FieldStock après l’acquisition OP28.
- **OP29/OP30** : restent consommées par le cycle spécialisé
  `afterStock()` / `recordStock()` ; aucun appel générique redondant ajouté.
- **OP31** : toujours sans propriétaire d’objectif produit démontré.
- **Autres OP** : aucune activation artificielle.

## Prochaine étape

La prochaine dette n’est plus le transport OP18. Elle est l’acquisition initiale
honnête et la continuité du propriétaire :

1. identifier un événement public suffisant pour retenir le premier prior
   adressé sans oracle ;
2. prouver la promotion par plusieurs observations et réponses corrélées ;
3. injecter le prior dans le runtime produit uniquement après cette preuve ;
4. ajouter snapshot/restauration de la campagne, du prior et de l’action en
   attente ;
5. vérifier qu’une réactivation Agent ne perd ni ne double-consomme le retour ;
6. compléter ensuite le contrat physique Region ;
7. identifier un propriétaire d’objectif réel avant toute activation OP31 ;
8. exécuter enfin les quatre runners C7.

Aucune publication Site n’appartient à cette tranche. GitHub reste la source
canonique durable.
