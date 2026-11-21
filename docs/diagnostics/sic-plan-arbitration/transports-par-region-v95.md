# SS08 L2 gagné à froid en 70 actions

SIC a choisi les 70 commandes depuis l’entrée du niveau 2, sans préfixe, démonstration ni remise à zéro. Le moteur officiel crédite le niveau au coup 70. Un vérificateur indépendant a rejoué les 70 commandes et vérifié chaque image. Le candidat figé gagne désormais le L2 sur huit jeux Custom 4 distincts.

## Ce qui change la décision

Le premier contraste sur SS08 était un déplacement de 2 ou de 17 pixels après deux préparations de même longueur. Le sujet de référence partait de la même case. L’alignement avec le partenaire expliquait mal l’arrivée sur d’autres placements. En suivant ce qui réapparaît à la case de départ, le banc a isolé une relation plus précise. Quand la commande provoque un déplacement lointain, le sujet prend la place de la première pièce admissible dans cette direction. Cette pièce prend la place du sujet. L’autre sujet peut également participer à un échange.

Sur 29 placements, trois ont servi à identifier les rôles et les directions. Les 104 commandes évaluables sur les 26 placements suivants donnent 42 échanges avec une pièce, sept avec le partenaire et 55 déplacements ordinaires. La prédiction de position est exacte dans les 104 cas. Les deux extrémités de l’échange sont vérifiées dans les 49 cas concernés. Dans les 32 essais à plusieurs cibles, c’est bien la première cible alignée qui échange sa place. Ces comparaisons partent d’un même emplacement du sujet dans le même niveau.

Le second mécanisme intervient sur le terrain. Un autre sujet peut pousser une pièce au bord de sa région. Si elle tombe sur une case auparavant impraticable, celle-ci change d’aspect et devient un appui. Les expériences du banc ont permis de composer ces deux effets. Depuis l’entrée du L2, son plan de 32 mouvements et sept clics gagne en **39 commandes**. Chaque mouvement a produit les deux positions prévues. Le programme de recherche du banc constitue un outil de diagnostic séparé du pilote.

## Les décisions autonomes de SIC

| Coup | Prédiction et vérification |
|---|---|
| 4 | Le clic déplace une marque entre deux silhouettes. SIC relève les deux couleurs qui permettent de suivre les sujets après la sélection. |
| 7 à 13 | Les déplacements publics vérifient successivement le contrôle des deux sujets. |
| 33 | Une commande produit un échange lointain. SIC reconnaît la pièce à l’ancienne place du sujet et le sujet à la place de cette pièce. |
| **35** | Après 34 commandes et images communes, les trois configurations voient la même image `85d4a54a3820b442`. Le témoin v93 joue `ACTION2`. Le pack qui planifie les transports en une fois clique. Le candidat joue **`ACTION3`** pour amener le futur pousseur sur une région plus proche de l’endroit à franchir. |
| 35 à 46 | Le candidat prépare les relais de contrôle et de position. Le reçu indique encore les capacités à tester, dont la possibilité de transformer une pièce en appui. |
| **47 à 50** | SIC sélectionne le pousseur, le positionne et prédit que la poussée créera un appui entre les deux régions. Au coup 50, la pièce quitte l’inventaire visible et la surface prévue apparaît. |
| **51** | SIC entre sur le nouvel appui. À partir du coup 52, les hypothèses mécaniques nécessaires à ce plan ont chacune un retour public. |
| 51 à 70 | SIC conduit les deux sujets aux deux repères. Sur ses 36 décisions de composition, 35 retours confirment la configuration prévue, puis la dernière commande obtient le score officiel. |

V94 pouvait déjà prédire correctement de nombreux mouvements. Dans une manche limitée à 95 commandes, il en vérifiait 38 et finissait par revenir au même placement. Le changement de v95 porte sur la recherche. Quand la région contenant les repères est inaccessible, le planificateur repère les bords où une pièce pourrait créer un passage. Si le pousseur ne peut atteindre ce bord à pied, il cherche un relais qui l’amène dans une région plus proche. Il recalcule la suite depuis le placement effectivement obtenu. Ce découpage permet de trouver la composition avec le même plafond de 1 000 configurations développées par recherche.

### L’expérience qui démontre la capacité gagnée

Le banc repart de l’image précédant la poussée du coup 50. Une préparation pousse la pièce vers la case prévue. Une autre préparation de trois mouvements dégage le passage autrement. Juste avant le geste de vérification, le pousseur est dans les deux cas au pixel `(39, 24)` et le partenaire au pixel `(21, 18)`. Ces coordonnées sont issues de la mesure.

| Préparation | Surface au pixel (36, 24) | Retour de la même commande `ACTION3` |
|---|---|---|
| Poussée choisie par SIC | Nouvel appui visible | Le pousseur entre sur la case, le partenaire reste en place. |
| Trois mouvements de contrôle | Surface initiale | Le pousseur reste hors de la case, le partenaire reste en place. |

La préparation témoin change aussi l’emplacement de la pièce. La mesure établit qu’une préparation rend la traversée possible depuis le même placement des deux sujets. L’image publique permet de localiser le changement de surface.

## Ce qui est configurable et ce qui est appris

L’auteur choisit dans le pack la stratégie `compose_transport_by_region` ainsi que les limites numériques de recherche. L’ancien langage permettait de comparer des préparations et de vérifier des placements. La primitive ajoutée représente la possibilité d’un échange réciproque et celle d’un changement de terrain dans le même plan. Elle permet de demander un relais de région avant d’exiger une route complète vers les deux repères. Un scénario synthétique vérifie ce choix sur une autre géométrie.

Le pilote identifie les sujets et le sens des commandes, choisit les clics, localise pièces, repères et rives, puis vérifie quel sujet échange, quel sujet pousse et quelle nouvelle surface supporte un déplacement. Les effets encore hypothétiques sont nommés dans le reçu. Une prédiction contredite invalide la transition pour la configuration concernée. La logique de décision utilise les observations publiques. Les identifiants de jeux, les coordonnées mesurées et les commandes du rejeu relèvent du diagnostic.

Les traces sources et le diagnostic de développement ont des apports distincts. Sur 103 épisodes sources, 838 commandes directionnelles sont évaluables. On observe 33 retours où deux formes échangent leurs places. Sur 18 prédictions prospectives de cible, 16 sont confirmées et une commande rivale reproduit 14 de ces confirmations. Ces observations donnent une base pour proposer un échange. Elles ne suffisent pas à établir la composition particulière qui ouvre SS08. SS08 a servi au développement. Le jeu réservé à l’évaluation de transfert est SS09, qui reste sans point.

## Qualification du candidat figé

Les trois variantes utilisent le moteur de catalogue `f0a1ff437` et le code du candidat `fc763a5cb`. Le lot principal a un plafond de 1 200 commandes et 514 286 ms de temps actif par niveau. Les packs conservent une profondeur de 88 et 1 000 nœuds. Une comparaison supplémentaire impose exactement 70 commandes dans les trois variantes.

| Pack appliqué à SS08 L2 | Résultat officiel à 70 commandes |
|---|---|
| `appui-homologue-v93.json` | Zéro point |
| `transports-composes-v94.json` | Zéro point. À budget complet, cette stratégie atteint la limite de temps après 322 commandes. |
| `transports-par-region-v95.json` | **Victoire en 70**. La trajectoire de la manche à budget complet est identique. |

| Tests avec v95 | Résultat vérifié |
|---|---|
| SS01, SS02, SS03, SS04, SS05 en campagne | L2 gagnés en **32, 46, 97, 143 et 73** coups. SIC joue tous les L1. |
| SS06, SS07, SS08 à froid | L2 gagnés en **54, 117 et 70** coups. |
| SS09 réservé, SS10 et SS11 à froid | Zéro point après respectivement 183, 313 et 256 coups. |
| 100 jeux sources au L1 | 100 victoires, 100 trajectoires identiques à v93 et rejouées dans le moteur source. |
| CWSE L2 et KLOT L4 à froid | Victoires en 59 et 37 coups, trajectoires identiques à v86. |
| Validation logicielle | TypeScript passe. Les 516 tests SIC et du contrôle natif associé passent. |

Une erreur de sérialisation de la première balise v94 avait interrompu des essais quand la reconnaissance du clic s’abstenait. V95 conserve uniquement les observations établies. La comparaison des trois packs et les onze parties de qualification ci-dessus ont été exécutées et vérifiées sur cette version corrigée.

## Prochaine décision manquante sur SS10

À partir du coup 138, une même transition d’approche se répète 86 fois et la transition inverse 84 fois durant la manche v95. Un clic essayé depuis cette image permet pourtant à l’autre sujet de répondre à la même commande. Une seule des 13 cibles de clic proposées par le banc a cet effet vérifié.

Depuis l’entrée du L2, le banc a aussi placé les deux sujets sur deux repères de même couleur. Il a testé les deux ordres de préparation et les deux affectations des sujets. Dans les quatre essais, un premier repère occupé laisse la case du passage inchangée. Lorsque les deux sont occupés, la case change d’aspect. Elle reprend son aspect initial dès qu’un sujet quitte son repère. L’étape décisive sur SS10 sera de prouver quelle disposition peut maintenir le passage ouvert pendant la traversée. Ces expériences mesurent le changement visuel du passage. Le score officiel de SS10 reste à zéro.

## Reproduction

La balise expérimentale est `sic-source100-staged-transport-v95`. Les paquets et les scripts de diagnostic utilisent respectivement les dossiers `docs/diagnostics/sic-plan-arbitration` et `scripts`. Les commandes PowerShell suivantes reproduisent les deux décisions et vérifient les scores. Chaque destination de bande doit être un nouveau fichier.

```powershell
$env:SIC_STUDY_RECORD_COMMANDS='1'
$env:SIC_STUDY_CURSOR_OFFERS='1'
$packs=Join-Path $candidat 'docs/diagnostics/sic-plan-arbitration'
$env:SIC_STUDY_RECOVERY_PACK=Join-Path $packs 'transports-composes-v94.json'
node scripts/compare-source100.mjs $candidat $moteur temoin70.jsonl SS08 2 2 70 0/1
$env:SIC_STUDY_RECOVERY_PACK=Join-Path $packs 'transports-par-region-v95.json'
node scripts/compare-source100.mjs $candidat $moteur candidat70.jsonl SS08 2 2 70 0/1
node scripts/verify-frozen-level-scores.mjs $moteur score-temoin.json temoin70.jsonl
node scripts/verify-frozen-level-scores.mjs $moteur score-candidat.json candidat70.jsonl
node scripts/compare-prepared-support-access.mjs $moteur candidat70.jsonl SS08 appui.json
```

Pour reproduire le banc, passer la bande froide SS08 de v91 à `derive-public-transport-scene.mjs` avec le moteur, le code et le fichier de scène en sortie. `search-composed-transport-example.py` produit un chemin à partir de la scène. `verify-composed-transport-example.mjs` exécute ce chemin depuis l’entrée officielle. Les contrastes sur les autres placements sont reproductibles avec `compare-parked-control-capacities.mjs`, puis `measure-cooperative-transports.mjs`. Les deux expériences sur SS10 emploient `compare-recurrent-placement-returns.mjs` puis `compare-occupied-switch-returns.mjs`.

[Mesures et certificats](mesures-transports-par-region-v95.json) · [Pack du candidat](transports-par-region-v95.json) · [Observation des transports](../../../src/sic/transport-observations.ts) · [Planification par régions](../../../src/sic/compose-transport.ts)
