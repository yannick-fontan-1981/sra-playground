# P05 — protocole du corpus de développement

## Décision évaluée et périmètre

P05 est évalué sur **l’acquisition justifiée de l’effet d’une commande dans son contexte**. Une acquisition doit décrire ce qui a changé, identifier son receveur, citer les retours qui établissent le lien avec la commande et conserver les conditions qui limitent son réemploi.

Le point de départ est le commit `20433007224accc36e3d7976696d9ee7a783a227`. Le [bilan P09 précédent](sic-apres-98-compositions-generees.md) établissait la composition d’effets déjà déclarés au composeur. Ce lot ajoute une frontière où ces effets doivent provenir de mesures publiques avant leur consommation par P09.

Le corpus appartient à un **laboratoire fini, déterministe et sans bruit**. Les positions, la sélection, le contexte, la réserve et un compteur distant sont déjà des observations publiques structurées. Ce protocole n’évalue ni leur extraction depuis des pixels, ni la découverte autonome de nouveaux contextes, ni un parcours complet du worker natif SIC. Une réussite du laboratoire, une acquisition vérifiée et une victoire native ont des compteurs distincts.

Le candidat est un nouveau registre d’acquisitions à cette frontière. Les fichiers de production existants ne sont pas modifiés pour cette campagne. Une qualification de ce registre ne constitue donc pas, à elle seule, une qualification de son intégration dans tous les appelants natifs.

## Quotas et séparation des séries

Le pilote comprend **80 situations**, soit dix par famille. La campagne de développement comprend **8 000 situations résolubles**, soit mille par famille. Les quotas sont remplis après certification indépendante et déduplication ; les résultats du candidat ne servent pas à accepter ou rejeter un tirage.

| Famille | Décision observable attendue | Quota pilote | Quota développement |
| --- | --- | ---: | ---: |
| 1. Déplacement inconnu | Mesurer l’axe, le sens et le pas d’une commande opaque. | 10 | 1 000 |
| 2. Receveur sélectionné | Relier une même transformation au sujet sélectionné après changement de sélection. | 10 | 1 000 |
| 3. Terrain et appui | Distinguer une commande effective d’un retour stationnaire sous obstacle ou sans appui. | 10 | 1 000 |
| 4. Phase et délai | Mesurer l’effet dans une phase compatible et attendre son retour dans la borne publique. | 10 | 1 000 |
| 5. Ressource et épuisement | Mesurer le coût et borner l’usage lorsque la réserve change à géométrie identique. | 10 | 1 000 |
| 6. Effet local et changement distant | Départager l’effet causal et le changement spontané par des contrôles temporels. | 10 | 1 000 |
| 7. Preuve transférée | Confirmer, réfuter ou restreindre un rappel à partir d’une mesure nouvelle. | 10 | 1 000 |
| 8. Commandes initialement équivalentes | Atteindre un contexte discriminant et choisir une commande selon l’effet demandé. | 10 | 1 000 |
| **Total** | | **80** | **8 000** |

Les **96 contrôles de contraste**, ainsi que **deux témoins d’effets scalaires sans déplacement**, restent hors quota positif. Ils sont construits par [`scripts/sic-p05-contrasts.mjs`](../../scripts/sic-p05-contrasts.mjs) :

- 32 paires indiscernables sous leur plafond, soit 64 mondes, avec un témoin de divergence ultérieure ;
- 32 situations stationnaires, accompagnées de contre-épreuves de contexte ;
- 32 rappels périmés sans mesure nouvelle ;
- deux effets scalaires : réserve seule et changement distant seul.

Une paire indiscernable compte comme un contraste, et non comme deux cas positifs. Ces séries conservent séparément l’indiscernabilité dans la borne, les retours stationnaires, les preuves périmées et les abstentions justifiées. Un retour stationnaire peut néanmoins établir une consommation de réserve ou un effet distant : l’absence de déplacement ne signifie pas absence de tout effet.

Les **2 000 situations de l’opérateur indépendant** ne sont ni générées ni consultées par cette campagne. Le code ne possède pas de graine réservée ni de commutateur ouvrant cette réserve. **SS08–SS25 restent également sous scellés** et ne sont pas utilisés pour sélectionner, développer ou qualifier le candidat.

## Frontière publique et données d’évaluation

La séparation est portée par le schéma `sic-p05-lab-v1` de [`scripts/sic-p05-laboratory.mjs`](../../scripts/sic-p05-laboratory.mjs).

| Élément | Accessible au candidat | Conservé côté évaluation |
| --- | --- | --- |
| Commandes | Noms opaques et disponibilité publique. | Effets associés à chaque commande. |
| Contextes | Catalogue des préparations accessibles, sélection, positions et attributs affichés. | Table des lois applicables dans ces contextes. |
| Temps | Horloge des retours et borne commune `maxLatency`. | Délai effectivement tiré pour une loi. |
| Réserve et compteur distant | Valeurs observées après chaque geste. | Coût de commande et dérive spontanée du compteur. |
| Mémoire transférée | Anciennes affirmations et références de preuve, explicitement anciennes. | Verdict de vérité et limites du transfert dans la nouvelle situation. |
| Métadonnées de corpus | Aucune famille, graine, loi privée ou solution n’entre dans le registre. | Famille, identité de cas, signature, certificat et résultats comparés. |

`publicProjection(spec)` est la projection remise à l’expérience publique. Les lois cachées restent dans `privateSpec`. Le candidat ne reçoit pas le certificat de l’oracle, ses états internes, ses résultats attendus ou un parcours témoin.

Les observations ont la forme suivante :

```ts
{
  ref, epoch, tick, selected,
  subjects: [{ id, position: [x, y] }],
  context: { terrain, supported, blocked, phase, ... },
  reserve, remote
}
```

Un retour possède `id`, `kind`, `command`, `before`, `after` et `elapsed`. `kind` distingue `prepare`, `command` et `wait`. `PREPARE` coûte un geste, remet le contexte public choisi, la géométrie, la sélection, la réserve et le compteur à leur état initial ; il réinitialise l’horloge et annule les effets en attente.

Dans un épisode, une intervention peut produire un déplacement, consommer immédiatement une ressource et produire un effet distant. Un effet de délai zéro est visible dans le retour de la commande. Un effet de délai (d) apparaît après (d) attentes supplémentaires. La borne publique commune est de trois attentes dans le générateur de développement ; elle ne révèle pas le délai effectivement tiré.

La phase représente ici une condition publique de préparation. Ce modèle ne prétend pas couvrir toutes les dynamiques d’une phase cachée, d’une file persistante ou d’un état irréversible entre les épisodes.

## Expériences communes et budgets

Chaque bras dispose d’un plafond identique de **96 gestes**. Les préparations, commandes, attentes et essais sans déplacement sont tous comptés. Aucun retour de l’autre bras n’est ajouté gratuitement à son historique.

La politique publique `publicExperiment(publicSpec)` effectue, pour chaque contexte accessible :

1. Une préparation suivie d’un épisode composé uniquement d’attentes.
2. Pour chaque commande disponible, une nouvelle préparation, une commande, puis les attentes nécessaires pour couvrir la borne publique de délai.

Le contrôle et l’intervention sont comparés aux mêmes instants. La politique dépend uniquement du catalogue public, de l’alphabet des commandes et de la borne de délai. Elle ne dépend pas de la famille, de la vérité cachée ou du succès de l’un des deux bras.

Cette politique est volontairement commune afin d’isoler **P05**, l’acquisition et la justification de l’effet. Elle ne mesure pas un gain de sélection expérimentale sous P04. Les deux bras conservent leurs propres états et historiques, même lorsque les gestes sont identiques.

Les coûts publiés distinguent les gestes effectivement exécutés, le moment de la première acquisition et la borne suffisante certifiée par l’oracle. **La longueur de cette politique n’est pas présentée comme un minimum.** Un rejet pour dépassement de cette borne ne prouve pas qu’aucune politique plus courte n’existe.

Après l’acquisition, le choix de la famille 8 est rejoué dans un monde indépendant : une préparation, la commande choisie et trois attentes, soit cinq gestes d’évaluation supplémentaires. La composition P09 possède son propre plafond de seize gestes. Ces coûts de consommation sont publiés séparément du plafond de 96 gestes de l’acquisition.

## Oracle indépendant

[`scripts/sic-p05-oracle.mjs`](../../scripts/sic-p05-oracle.mjs) ne contient aucun import du générateur, du simulateur, du candidat ou de son adaptateur. Il implémente séparément les transitions, la politique publique et les vérifications de preuve.

Les principales fonctions sont :

| Fonction | Rôle |
| --- | --- |
| `validateP05OracleContract` | Vérifier que la situation respecte le domaine fini annoncé. |
| `p05OraclePolicy` | Construire une politique à partir des seuls éléments publics. |
| `createOracleWorld` | Rejouer les lois avec une implémentation indépendante. |
| `certifyP05` | Établir une politique suffisante sous le plafond et vérifier que ses mesures ont une portée exprimable. |
| `observedP05OracleOutcomes` | Extraire ce que les retours réellement disponibles permettent de mesurer. |
| `verifyP05Claim` | Vérifier simultanément la vérité de l’effet, sa portée et les preuves effectivement reçues. |

La certification est un certificat d’existence dans le contrat public du laboratoire. La politique exhaustive couvre les réponses possibles en testant chaque combinaison accessible et en attendant l’horizon public. Elle n’a pas besoin de connaître la bonne commande avant son essai.

Une affirmation vraie par hasard est refusée lorsque son retour décisif, son contrôle temporel ou les observations nécessaires à la borne de délai manquent. La portée est vérifiée dans tous les contextes publics qui satisfont les conditions revendiquées. Les résultats ne constituent pas une preuve de garde universelle sur des contextes non observés.

## Candidat et preuves acquises

[`src/sic/p05-acquisition.ts`](../../src/sic/p05-acquisition.ts) expose `P05AcquisitionLedger`, `createP05Learner`, `p05Conditions`, `p05ConditionsHold` et l’outil d’ablation.

Une acquisition contient notamment :

```ts
{
  effectId,
  effectKind: 'translation' | 'resource' | 'remote' | 'combined',
  command,
  receiver,
  delta: [dx, dy],
  delay, resourceCost, remoteDelta,
  conditions: [{ field: 'context.terrain', equals: 'surface-a' }, ...],
  supportingReturnIds,
  limitingReturnIds,
  status: 'restricted',
  transferStatus // si un rappel ancien était présent
}
```

Les différences de positions et de compteurs sont comparées au contrôle `WAIT`. Le premier retour qui établit le changement causal est placé en tête des preuves afin de rendre l’ablation explicite. Les observations antérieures et les contrôles qui justifient le délai restent cités.

Le registre conserve les conditions exactes observées. Il ne transforme pas un succès sur un terrain en permission générale, et ne déclare pas une commande inactive à partir d’un seul échec sous obstacle. Le receveur `selected` exige plusieurs sélections effectivement confirmées ; chaque affirmation conserve la sélection mesurée dans sa portée.

Un rappel ancien demeure une hypothèse à revalider. `transferStatus` distingue confirmation, réfutation et restriction après une mesure courante. Les anciennes références ne deviennent pas des preuves du nouvel épisode.

## Comparaison avec le sous-système figé

[`src/sic/p05-frozen-adapter.ts`](../../src/sic/p05-frozen-adapter.ts) importe réellement `rememberMotion` et `controlledStrokes` depuis [`src/sic/controlled-parts.ts`](../../src/sic/controlled-parts.ts), sans modifier ces fonctions.

Le module de référence provient du commit de départ ; son blob Git est `35bf4e14f1d632d6e4e732846670ecfe1f940160`. Il apprend et choisit des vecteurs de déplacement par rôle et commande. Cette frontière ne publie pas un contrat complet réunissant contexte, délai, consommation, effet distant et preuves de contrôle.

L’adaptateur expose donc séparément :

- `vectors()` : les vecteurs retenus par le sélecteur existant ;
- `observedEffects()` : tous les déplacements non nuls enregistrés, avec leurs références de retour instrumentées ;
- `diagnostics().recordedDisplacements` : les histogrammes complets ;
- `claims()` : aucune acquisition complète inventée pour compléter l’API absente.

Le rapport doit conserver les mesures de vecteurs reconnus, de vecteurs corrects ou incorrects dans leur contexte et d’acquisitions complètement qualifiées. L’absence d’un contrat complet à cette frontière **ne mesure pas une absence globale de capacités de SIC** : d’autres familles du moteur possèdent leurs propres apprentissages et contrastes.

Les différences de qualification, les attributions erronées, les abstentions et le premier écart sont rapportés à ce périmètre. Une amélioration de la qualification n’est pas appelée gain de victoire native ou amélioration mesurée du worker complet.

[`scripts/sic-p05-compare.mjs`](../../scripts/sic-p05-compare.mjs) produit les verdicts par situation ; [`scripts/sic-p05-campaign.mjs`](../../scripts/sic-p05-campaign.mjs) les agrège. Le principal contraste quantitatif sur une capacité effectivement exposée par le figé est `rawMotionAcquisitionGainSituations` : situations complètement acquises par le candidat où le registre figé n’a pas enregistré tous les déplacements attendus. `newQualificationSituations` décrit séparément les situations disposant du nouveau contrat complet. Ces deux compteurs ne sont pas interchangeables.

`firstAcquisitionGesture` mesure le geste où apparaît la première acquisition ; `acquisitionEvidenceCompleteGesture` conserve le rang du dernier retour cité par les preuves et limitations. Les retours publics des deux bras sont également comparés au rejeu indépendant, avec leurs empreintes.

## Déduplication comportementale

`behaviorSignature(spec)` calcule les réponses observables de tous les épisodes accessibles jusqu’à l’horizon, puis cherche une représentation canonique sous des permutations **globales et cohérentes** des commandes, des sujets et des noms de terrain. Les contextes sont normalisés indépendamment de leur ordre d’énumération.

La signature exclut l’identité du cas, la famille, les noms de commandes, les noms d’objets, la traduction absolue de la géométrie et les paramètres privés sans effet observable dans ce contrat. L’histoire narrative d’un transfert ne permet pas de compter une seconde fois le même comportement physique.

La déduplication s’applique globalement aux huit familles. Les variantes produites par `renameAndPermute` sont des contrôles d’invariance, pas de nouvelles situations positives. L’agrégation des fragments de campagne doit vérifier les signatures et la couverture des quotas avant de qualifier le corpus complet.

Cette normalisation porte sur le laboratoire annoncé, où `PREPARE` rend les contextes accessibles et où les effets sont des impulsions bornées. Elle n’est pas une procédure générale d’isomorphisme pour tous les jeux natifs.

## Ablation informationnelle

Sur une acquisition qualifiée, `ablateP05Return(history, returnId)` retire **le seul nœud d’observation du retour qui établit le lien commande–effet**. Toutes les sérialisations de ce même nœud sont retirées, y compris sa copie éventuelle dans le `before` du retour suivant.

Les commandes, leur ordre, leur coût, les identifiants et les horloges restent disponibles. Les métadonnées `beforeRef`, `epoch` et `tick` remplacent le contenu du nœud absent lorsqu’elles sont nécessaires à la continuité. Les autres observations restent strictement identiques. Une observation absente vaut `null`, jamais une position immobile ou un compteur nul.

Le contrôle vérifie que l’acquisition correspondante ne conserve pas une preuve inexistante. Une observation ultérieure demeure accessible, mais peut laisser l’instant d’apparition sous-déterminé. Une nouvelle expérience complète peut permettre une réacquisition ; elle doit alors citer les nouveaux retours et conserver son coût. Les acquisitions d’autres épisodes ne sont pas effacées pour forcer l’échec.

Les tests vérifient explicitement l’absence de toute copie résiduelle du nœud retiré et l’égalité de toutes les autres valeurs publiques.

## Consommation par P09

[`scripts/sic-p05-p09-bridge.mjs`](../../scripts/sic-p05-p09-bridge.mjs) appelle le vrai `composePlan` de [`src/sic/effect-composer.ts`](../../src/sic/effect-composer.ts).

La mécanique de composition demande d’occuper et de maintenir un appui pendant une préparation de relais, une charge, un chargement et une livraison. L’effet P05 mesuré permet d’atteindre l’appui. Le composeur reçoit l’acquisition publique et ses conditions ; il ne reçoit ni les lois privées ni l’exécuteur physique.

Le plan est construit avant le rejeu. Les consommateurs du choix F8 et du pont P09 sélectionnent leurs offres à partir des seules acquisitions publiques, des conditions et des références de preuve disponibles. Aucun verdict de l’oracle ne peut nettoyer leurs offres avant le choix. L’exécuteur indépendant ne reçoit ensuite que les commandes publiques et renvoie les observations. La qualification de l’acquisition consommée est vérifiée après cette décision pour compter le résultat. Une offre fausse doit pouvoir être choisie puis réfutée par le rejeu. Le reçu conserve l’effet utilisé, les preuves consommées, les gardes, les retours et le premier écart éventuel.

La chaîne attendue est : **retour public → acquisition P05 → condition du plan P09 → commande réellement rejouée → effet observé dans la composition**. Une acquisition sans preuve disponible ne doit pas être utilisée gratuitement. Ce contrôle produit un résultat de composition générée, pas une victoire native ; le compteur natif reste séparé et n’est pas augmenté par ce pont.

## Graines et reproduction

La graine maîtresse de développement est **`26112805`**. `developmentSeeds` dérive une graine par famille selon `(seed + numéroDeFamille × 1009) >>> 0`. Ces graines sont publiques. Elles ne désignent aucune partie de la réserve indépendante.

| Famille | Graine de développement |
| --- | ---: |
| 1 | 26113814 |
| 2 | 26114823 |
| 3 | 26115832 |
| 4 | 26116841 |
| 5 | 26117850 |
| 6 | 26118859 |
| 7 | 26119868 |
| 8 | 26120877 |

Depuis la racine du dépôt, avec Node 24, le pilote utilise :

```sh
node scripts/sic-p05-campaign.mjs --per-family 10 --seed 26112805 --out artifacts/sic-p05-pilot
```

La campagne complète utilise :

```sh
node scripts/sic-p05-campaign.mjs --per-family 1000 --seed 26112805 --out artifacts/sic-p05-development
```

Un fragment d’une seule famille peut être produit ainsi :

```sh
node scripts/sic-p05-campaign.mjs --per-family 1000 --seed 26112805 --families 1 --out artifacts/shards/family-1
```

Après production des huit fragments, l’agrégation utilise :

```sh
node scripts/sic-p05-campaign.mjs --aggregate artifacts/shards --out artifacts/sic-p05-development
```

Le SHA effectivement testé, les empreintes, les quotas réalisés, les coûts et les résultats par famille doivent être pris dans les reçus produits par la campagne. Ce protocole n’anticipe aucun résultat de campagne ni aucun SHA final.

Les tests ciblés du lot sont :

```sh
node --test tests/sic-p05-acquisition.test.ts tests/sic-p05-comparison.test.mjs tests/sic-p05-oracle.test.mjs tests/sic-p05-p09-bridge.test.mjs tests/sic-p05-contrasts.test.mjs
```

Une vérification globale peut nécessiter des dépendances volontairement absentes d’un checkout sparse. Elle ne justifie pas d’ouvrir SS08–SS25. La qualification native et le contrôle de continuité sont des étapes distinctes d’une éventuelle intégration ultérieure.

## Publication des résultats et transmission

Le bilan doit publier le SHA évalué, la branche, les graines, les quotas réellement certifiés, la commande de reproduction, la ventilation des contrôles, les résultats par famille et le premier écart. Il doit distinguer les cas résolubles, les acquisitions du candidat, les capacités effectivement exposées par le figé, les compositions P09 rejouées et les victoires natives.

La transmission demandée à **SIC SYNC** et à **l’opérateur indépendant** reste une opération séparée. Tant que leurs canaux n’ont pas été identifiés, conserver un bilan et un handoff prêts à transmettre sans déclarer un envoi, une réception ou une validation indépendante inexistants. Le paquet peut contenir les données de développement, les commandes et les empreintes ; il n’exige aucun accès aux 2 000 cas réservés ni à SS08–SS25.
