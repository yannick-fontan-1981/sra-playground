# P07 — banc reproductible de création d’accès

## Périmètre et source figée

Branche isolée : `feat/sic-p07-access-20261128`, créée depuis
`20433007224accc36e3d7976696d9ee7a783a227`.
Les règles `AGENTS.md` et le bilan
[`sic-apres-98-compositions-generees.md`](sic-apres-98-compositions-generees.md)
ont été lus avant la conception.

Le livrable comprend un générateur, un interpréteur exécuté, un oracle indépendant,
un comparateur, un candidat de politique conditionnelle et un contrôle P09 → P07.
Le bras figé importe réellement `src/sic/effect-composer.ts` et vérifie son blob Git
`f54a624abaaa89e4d5363f41869017f4e7f99b35` avant toute comparaison.
Ce module historique reste inchangé.

La comparaison porte sur **le composeur commun figé dans un adaptateur déclaratif
d’accès**, face au composant `src/sic/access-policy.ts` capable de brancher selon les
observations. Elle ne mesure pas le moteur SIC natif complet. Les effets des
commandes sont fournis comme modèles déclaratifs publics, comme dans le banc P09 ;
l’acquisition P05 de ces effets n’est pas qualifiée ici. Aucun branchement n’utilise
le code de famille, la graine, l’identité du jeu, la palette ou une route oracle.

Les 2 000 situations de l’opérateur indépendant ne sont ni générées, ni lues, ni
assimilées aux 8 000 situations de développement. SS08–SS25 ne sont pas utilisés.
Aucun jeu natif n’est exécuté par ce banc. Les victoires natives restent donc
explicitement à zéro, avec le statut « non évalué ».

## Décision et preuve

P07 doit établir un accès effectivement joué : un sujet franchit une arête
physique ou une observation nouvelle est obtenue. La satisfaction d’un prédicat
annoncé sans déplacement ou observation réel ne suffit pas.

Chaque commande — déplacement, sélection, contact, interaction, construction,
observation ou attente — coûte un geste. Un blocage coûte aussi un geste et fait
décroître les minuteurs. Le plafond commun est de **64 gestes** et de **24 000
états de recherche**. Chaque branche d’une politique doit tenir dans ce plafond.
Les compteurs de recherche du composeur historique et du candidat sont publiés ;
le candidat borne également le nombre d’états découverts.

Les gardes sont évalués avant la commande. Les minuteurs décroissent ensuite ;
les conditions `throughout` et les invariants sont vérifiés à cet instant, puis
les effets s’appliquent. Les conditions des effets conditionnels lisent l’état
précédent. Les invariants sont vérifiés avant, pendant et après le geste.

Un événement de franchissement doit correspondre à un changement réel de la
variable de position, entre les deux extrémités déclarées. Une observation nouvelle
doit faire passer son témoin de 0 à 1. La victoire du simulateur est un événement
distinct, enregistré seulement lorsqu’il est émis par le scénario exécuté.

## Huit familles et quotas

Le pilote contient 80 situations, soit 10 par famille. Le développement contient
8 000 situations certifiées, soit exactement 1 000 par famille.

| Code | Décision exercée | Contrastes inclus |
| --- | --- | --- |
| F1 | Contournement et autre entrée | Blocage direct, passage dirigé, impasse, entrée alternative |
| F2 | Déplacement de vue et rattachement | Cible et leurre, coordonnées changées, observation explicite |
| F3 | Passage ouvert par contact | Contact puis interaction ; ordre inverse qui condamne l’ouverture |
| F4 | Appui maintenu par un autre mobile | Sélections, relais entre trois mobiles, relâchement, appui récupérable |
| F5 | Fenêtre temporaire | Coût d’aller, observation, retour, marge et détour qui expire |
| F6 | Création d’itinéraire | Support construit, obstacle déplacé, passage consommable, construction piégeante |
| F7 | Localisations ou routes plausibles | Deux hypothèses, préfixe commun ou observation avant tout mouvement irréversible |
| F8 | Reprise après changement | Cible déplacée, retour contraire, appui perdu, suffixe conservé réellement traversé |

La famille F2 fournit trois ancres publiques ordonnées et deux sujets. Le candidat
ne reçoit ni l’affectation privée de la cible, ni les coordonnées de la future vue.
Il planifie l’obtention de l’observation ; après réception seulement, il rattache
la cible par la transformation géométrique des ancres. L’oracle vérifie le
rattachement indépendamment. Ce contrôle ne mesure pas la détection perceptive
native des ancres.

Pour F7 et F8, toutes les hypothèses compatibles sont données aux deux bras, sans
sélecteur du monde réellement joué. Une même action est exigée jusqu’à divergence
des observations. Toutes les hypothèses sont rejouées. La réussite d’une situation
exige la réussite de chacune d’elles.

## Indépendance de l’oracle

`scripts/p07-access/oracle.mjs` n’importe que `node:crypto`. Il ne partage aucun
code exécutable de transition, de recherche ou de réussite avec le candidat, le
générateur ou le simulateur. Il interprète le même schéma de données et recherche
une politique AND/OR bornée. Chaque certificat est ensuite rejoué dans chaque
hypothèse. Le comparateur exige que le certificat corresponde à l’empreinte du
scénario exact.

Les tests adversariaux couvrent les preuves fictives, les retours falsifiés,
l’invariant temporairement perdu puis restauré, le leurre de caméra, les choix
omniscients impossibles sans observation et le coût des commandes bloquées. Les
tests différentiels vérifient aussi toutes les actions alternatives à chaque
préfixe d’un certificat dans les huit familles.

## Déduplication et invariance

La signature est dérivée d’un graphe des routes, variables, conditions, effets,
sélections, ressources, observations et invariants. Les identifiants sont des
références du graphe, pas des étiquettes de déduplication. Les catégories de rôle
restent des catégories sémantiques fixes du protocole.

La graine, les noms, l’ordre des commandes, les coordonnées, les rotations,
les palettes et l’annotation de victoire officielle ne créent pas de nouvelles
situations. Le champ descriptif `structure` n’est pas utilisé comme preuve
d’unicité. Le raffinement du graphe est conservateur : une collision peut rejeter
une variation, jamais la faire compter deux fois. Les signatures sont contrôlées
aussi entre les huit lots lors de l’agrégation.

Une transformation de présentation est exécutée pour chaque situation, en dehors
du quota des 8 000. Elle combine rotation, translation, palette et changement des
noms et de l’ordre des commandes. La stabilité de la signature, des accès et des
rejeux est requise. Les éventuelles différences de coût entre plans équivalents
sont comptées séparément.

## Comparaison et ablations

Le figé et le candidat utilisent le même modèle public, les mêmes hypothèses,
actions, plafonds et invariants. Le figé produit une séquence conformante ; le
candidat peut choisir une continuation selon le retour public. Le comparateur
enregistre les accès vérifiés, franchissements, observations nouvelles, événements
de victoire du simulateur, gestes et premier écart de commande, de retour ou de
rattachement.

Un gain d’accès signifie que le candidat réussit toutes les hypothèses d’une
situation que le figé ne réussit pas toutes. Un trajet plus court signifie que
les deux réussissent et que le pire coût du candidat est inférieur. Le coût
agrégé de tous les rejeux est conservé séparément : une abstention du figé à zéro
geste ne constitue pas une économie de résolution.

Pour chaque situation gagnée ou raccourcie, les dépendances consommées sont
retirées au moment de leur première utilisation réelle. Le préfixe joué, les
autres acquis et le budget restant sont conservés.

- Appui ou ouverture : seule la variable correspondante change. Un mobile qui
  relâche un appui reste sur une case réelle, avec ses possibilités de retour.
- Preuve de route : seule la commande dont la preuve est consommée est retirée
  du modèle du candidat. Le monde physique reste inchangé.

Le candidat peut trouver une autre voie ou reconstruire l’appui. Le bilan
distingue donc perte d’accès, accès conservé, décision changée et coût
supplémentaire. L’oracle certifie séparément le contrefactuel sous le budget
restant. Ces ablations établissent le rôle de la dépendance consommée ; elles ne
suffisent pas seules à attribuer tout gain comparatif à une unique cause.
Les contrefactuels impossibles ne sont jamais ajoutés au corpus résoluble.

## P09 demande P07 comme sous-but

Le vrai `composePlan` formule une demande d’accès avec un invariant et un plafond
réduit d’un geste pour réserver la reprise du parent. L’invariant conserve une
réserve que certains raccourcis consomment. Le trajet doit préserver cet invariant
à chaque transition ; la comparaison de décision contrainte/non contrainte utilise
le même budget réduit.

P07 remet un reçu après rejeu effectif. P09 le vérifie, revalide l’invariant et joue
une interaction parent distincte. Le trajet complet et ce dernier geste sont
certifiés et rejoués par `p09-audit.mjs`, qui dépend uniquement de l’oracle.
Un macro de plusieurs gestes n’est jamais compté comme un seul geste. La reprise
du parent ne fabrique aucun événement de victoire officielle.

## Reproduction

Node 24 suffit ; les commandes du banc n’installent aucune dépendance et ne lisent
aucun moteur SS08–SS25.

```bash
node --test tests/p07-*.test.mjs
node scripts/sic-p07-access-campaign.mjs --count 80 --seed 26112807 --out artifacts/p07-pilot
node scripts/sic-p07-access-campaign.mjs --count 8000 --seed 26112807 --out artifacts/p07-development
```

Pour chaque famille d’indice global `i` compris entre 0 et 7, la graine de
développement est `(26112807 ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0`.
Un lot isolé et la campagne monolithique produisent le même corpus par famille.

```bash
node scripts/sic-p07-access-campaign.mjs --count 1000 --family F7-uncertain-location --seed 26112807 --out artifacts/p07-f7
node scripts/sic-p07-access-aggregate.mjs --parts parts --count 8000 --out artifacts/p07-development
```

Le workflow `.github/workflows/sic-p07-access.yml` exécute d’abord le pilote,
puis huit lots de développement sur des runners indépendants, un cas à la fois
dans chaque lot. Tous les jobs utilisent le même SHA. L’agrégateur exige les
huit quotas complets, des sources identiques, des signatures distinctes et des
compteurs conformes aux traces.

Chaque livraison conserve `corpus.jsonl.gz`, `results.jsonl.gz`, `report.json`,
`report.md`, `manifest.json` et `source.sha`. Le corpus et les résultats ont des
empreintes SHA-256. Le rapport final précise le SHA qualifié, les graines,
les résultats par famille et les limites de la mesure.

## Remise et intégration

Le travail reste sur sa branche P07 isolée. Ce banc ne raccorde pas le nouveau
composant à l’arbitrage natif et ne publie pas le Site. Une intégration native
future devra suivre les contrôles de transfert et `test:sic-continuity` requis
par `AGENTS.md`, puis la chaîne GitHub → intégration → Site.

Le bilan pour SIC SYNC et le SHA pour l’opérateur indépendant sont préparés dans
le dépôt. Leur envoi externe exige une destination identifiable ; aucune adresse,
conversation ou issue n’est déduite du seul nom de ces destinataires.
