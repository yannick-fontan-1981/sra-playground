# SS07 L2 gagné à froid par SIC en 118 actions

Le compteur officiel du moteur passe de zéro à un au coup 118. SIC part directement du L2, sans partie d’exemple, préfixe, remise à zéro ni intervention du banc. Le rejeu indépendant retrouve les 118 images de retour et le même score. SS07 est le sixième jeu distinct de Custom 4 dont SIC gagne un L2, entrée directe et campagne confondues. [Mesures](mesures-acces-indique-v86.json)

## Reproduire la comparaison

Avec le code de la balise `sic-source100-other-traversal-v86` et le moteur Custom 4 au commit `f0a1ff437`, lancer ces deux parties dans des fichiers de sortie neufs. Le moteur et le candidat sont des checkouts locaux dont les chemins sont donnés par `$moteur` et `$candidat`. Les commandes s’exécutent dans le checkout du candidat sous Node 24.

```powershell
$env:SIC_STUDY_RECORD_COMMANDS = '1'
$env:SIC_STUDY_WORKERS = '4'
$packs = Join-Path $candidat 'docs/diagnostics/sic-plan-arbitration'
$env:SIC_STUDY_RECOVERY_PACK = Join-Path $packs 'placements-v77.json'
node scripts/compare-source100.mjs $candidat $moteur temoin.jsonl SS07 2 2 1200 0/1
$env:SIC_STUDY_RECOVERY_PACK = Join-Path $packs 'acces-indique-v82.json'
node scripts/compare-source100.mjs $candidat $moteur candidat.jsonl SS07 2 2 1200 0/1
node scripts/verify-frozen-level-scores.mjs $moteur score.json candidat.jsonl
```

Pour contrôler aussi les poses, les activations et la traversée du premier sujet, exécuter `node scripts/measure-mobile-plan-returns.mjs $moteur candidat.jsonl positions.json` depuis la révision contenant ce rapport.

## Quelle décision manquait ?

Après avoir placé un sujet et pris le contrôle du suivant, v81 essayait d’approcher le deuxième repère. Il pouvait observer qu’un objet suivait le sujet et qu’une marque apparaissait. Il lui manquait le lien entre **déplacer cet objet** et **rendre possible une arrivée utile**, puis la possibilité de compléter le trajet du second avec une case déjà traversée par le premier. Une marche en boucle, même longue, ne vérifie pas cette composition.

| Décision | Observation ou décision autonome sur la partie gagnante |
| --- | --- |
| 16 à 18 | Le premier sujet recouvre un repère au coup 16. SIC clique au coup 17. La commande suivante déplace le second sujet pendant que le premier reste en place. |
| 22 | Première commande différente entre les configurations. Le témoin choisit ACTION3, une direction encore à tester. Le candidat choisit ACTION4. Son reçu désigne l’indication dont il cherche à comprendre la production et cite une observation antérieure. |
| 26 et 29 | Quand le sujet s’éloigne, un objet voisin prend la place qu’il quitte. Ces déplacements fournissent une hypothèse de traction. |
| 56 | SIC essaie d’employer une indication. La position attendue n’est pas atteinte. Le reçu conserve la réfutation locale. |
| 65 | Première commande différente de v85. SIC a relié la traction à deux exemples géométriques d’une indication. Il trouve un trajet complet de 54 actions après avoir examiné 283 états. Le témoin v85, au même endroit, poursuit sa recherche locale. |
| 71 à 112 | Huit activations. L’indication occupe la destination prévue avant chacune. Trois activations utilisent le sens inverse proposé par le modèle. |
| 115 | Le second sujet entre sur la case que son propre parcours n’avait pas attestée. Le reçu cite l’image de la décision 15, où le premier sujet l’avait occupée. Le contrôle indépendant retrouve cette occupation, puis l’arrivée du second. |
| 118 | Le moteur accorde le point. Sur les 53 premiers retours du plan, le sujet et le mécanisme occupent les cases prévues. Le dernier retour porte le score. Sur les 101 images de décision suivant la sélection, le premier sujet reste sur son repère. |

## Ce que l’auteur déclare et ce que SIC apprend

Les deux packs utilisent le même schéma SIC, le seuil de deux issues, la profondeur de 88 et le plafond de 1 000 états. L’auteur choisit une préférence d’expérimentation. Le vocabulaire précédent savait exprimer un placement suivi d’un relais. La nouvelle valeur `indicated_access` permet de chercher un geste qui fera apparaître une arrivée intéressante, puis de composer cette préparation avec les déplacements. Elle est également testée sur une autre disposition synthétique où un déplacement du mécanisme ouvre une traversée et où l’activation utilise ACTION7. [Pack témoin](placements-v77.json) · [Pack candidat](acces-indique-v82.json) · [Tests synthétiques](../../../tests/sic-mobile-indication.test.ts)

SIC choisit le sujet, le clic, le moteur à tester, le mécanisme, l’indication, le sens de déplacement, les emplacements et la suite. Les apparitions observées orientent l’exploration. Une géométrie cohérente permet de proposer une arrivée future, y compris en sens inverse. À l’exécution, chaque activation exige que la marque soit réellement visible à la destination. Un emplacement parcouru par le partenaire garde sa référence et son statut d’hypothèse pour le sujet courant jusqu’au déplacement effectif. [Exploration](../../../src/sic/seek-indicated-access.ts) · [Calcul du trajet](../../../src/sic/plan-mobile-indication.ts) · [Mémoire du relais](../../../src/sic/paired-landmark-placement.ts)

## Victoires conservées

Les cinq campagnes complètes reproduisent chaque commande et chaque image de v81, L1 inclus. Les L2 sont gagnés en 32 actions sur SS01, 46 sur SS02, 97 sur SS03, 143 sur SS04 et 73 sur SS05. Les cinq scores ont été rejoués sur un moteur indépendant.

Les 100 L1 sources gagnent à budget identique de 60 actions et reproduisent tous la trajectoire de v81. Le moteur source a rejoué les 100 scores. CWSE L2 gagne à froid en 59 actions et KLOT L4 en 37, avec les mêmes trajectoires que v76. Le contrôle TypeScript et les 501 tests SIC et de rigidité sélectionnés passent.

## Vérification sur un jeu tenu à part

SS09 L2 termine sans victoire à la limite de temps actif, après 279 actions. Le même pack consulte les mêmes mécanismes que sur SS07. Il n’engage aucune expérience d’arrivée indiquée. Les 254 commandes et images du préfixe comparable à v81 sont identiques. Cette évaluation établit la limite actuelle de déclenchement. La présence d’un premier placement utile et d’un relais vérifié est encore une condition d’entrée.

SS08 L2 termine à la même limite en 340 actions. SIC propose dix déplacements pour préparer un placement, mais aucun ne confirme le contact avec le repère. Il n’entre donc pas dans la phase d’exploitation de l’indication. Les 262 commandes et images comparables à v81 sont identiques. Les scores de SS06, SS08 et SS09 ont tous été rejoués indépendamment.

## Quel placement chercher ensuite sur SS06 ?

En autonomie sur SS06 L2, v86 choisit un clic et vérifie le changement de sujet au coup 3. Il joue 369 actions avant la limite de temps. Aucune proposition de placement préparé ni victoire. Les 296 premières commandes et images coïncident avec la partie v81.

Le banc part d’un même état public juste avant le clic que SIC a choisi. Il varie les déplacements du premier sujet, vérifie 37 placements suivis du même relais, puis fait jouer au second les mêmes 195 suites, longues d’une à cinq actions. La comparaison porte sur 250 paires de préparations de durée égale. Un placement change au moins un retour dans 75 de ces paires. Les suites d’une ou deux commandes donnent toujours la même position ou le même état officiel. Au troisième geste, 75 comparaisons séparent une fin de partie d’une continuation. Au quatrième, 140 séparent deux positions du second sujet. Aucun de ces essais ne gagne le niveau. Les décomptes sont des comparaisons entre paires et suites, et plusieurs recouvrent un même phénomène. [Expérience reproductible](../../../scripts/compare-parked-control-capacities.mjs)

Un exemple met en évidence deux effets opposés. Juste avant le geste décisif, le second sujet est à la même position dans les deux branches et la partie est encore en cours. Avec le premier placement, le second peut avancer d’une case, mais son activation depuis l’autre site testé termine la partie. Avec l’autre placement, cette même avance est bloquée et cette même activation laisse la partie en cours. Chaque paire utilise un préfixe et une commande finale identiques. Le choix du placement dépend donc de ce que SIC veut permettre ensuite.

Quand deux placements paraissent équivalents à court terme, SIC doit pouvoir conserver un geste du second comme expérience, prolonger la préparation de ce geste et vérifier **quelle possibilité du second change**. Sur cette cible, arrêter l’expérience après deux gestes manquerait tous les contrastes mesurés.

## Comparaison au même budget

Essais à froid sur le moteur `f0a1ff437`, avec un maximum de 1 200 actions et 514 286 ms de temps actif par niveau. Chaque révision est figée avant son essai. Le développement des révisions successives a été informé par SS07. SS09 entier est gardé à part pour la mesure du transfert.

| Code et stratégie | SS07 L2 | Ce que l’essai isole |
| --- | --- | --- |
| v81, puis v86 avec `paired_arrival` | Défaite en 253 | Mêmes commandes et mêmes images jusqu’à la fin. |
| v82, première intégration | Essai invalide | Un champ facultatif non sérialisable a interrompu la partie. |
| v83 avec `indicated_access` | Défaite en 447 | Le candidat provoque des expériences, plusieurs arrivées supposées sont réfutées. |
| v84 puis v85 | Défaite en 447 | Trajectoire identique à v83. Avec le modèle de traction puis l’inverse conjecturé, il manque encore une case pour relier le second repère. La recherche d’un changement d’apparence du sol après le premier placement ne la fournit pas. |
| v86 avec `indicated_access` | **Victoire en 118** | Le passage observé du premier sujet fournit la case manquante. Les 64 premières actions et images sont identiques à v85. |

**Apport des sources.** Sur 108 épisodes sources, le sondage dénombre 7 confirmations sur 80 tests distincts quand l’indication vise un lieu déjà traversé et 1 sur 251 pour un lieu jamais traversé. Cela motive une préférence d’exploration. La composition complète du relais avec la traction et l’activation a été construite pendant le diagnostic SS07. Ce jeu mesure une résolution autonome. Le jeu réservé mesure le transfert de cette composition. [Étude et dénominateurs](placements-conserves-v81.md)

**Rôle du banc.** Le banc peut revenir au même état pour comparer deux hypothèses. À la décision 65, il confirme qu’en donnant au modèle la traversée déjà observée par le premier sujet, les 54 actions prédites s’exécutent jusqu’au score. La victoire publiée provient d’une autre partie, démarrée au début du L2 avec le seul candidat figé. [Contrôle du score](../../../scripts/verify-frozen-level-scores.mjs) · [Contrôle des huit indications, des poses et de la référence de traversée](../../../scripts/measure-mobile-plan-returns.mjs)
