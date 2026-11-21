# SS06 L2 gagné à froid en 54 actions

SIC a choisi les 54 commandes depuis l’entrée directe du niveau 2. Au dernier coup, le compteur officiel de niveaux réussis augmente d’une unité. Le rejeu indépendant retrouve les images publiques des 54 transitions. SS06 rejoint SS01, SS02, SS03, SS04, SS05 et SS07 parmi les jeux Custom 4 dont SIC a gagné le L2 à froid ou en campagne.

## 1. Repérer la décision manquante

Au coup 3, le mouvement d’un sujet et l’immobilité de l’autre confirment le changement de contrôle après un clic choisi par SIC. Au coup 21, SIC mesure le déplacement d’un objet qu’il prenait pour une destination. Au coup 30, un déplacement du sujet actif fait apparaître une marque près du mécanisme de l’autre sujet. Celui-ci et son mécanisme sont restés en place. La géométrie observée permet de proposer une même relation entre sujet, mécanisme et arrivée pour les deux régions.

Le témoin v92 trouve déjà les 14 mouvements de préparation du sujet A. Sa recherche pour B échoue même en portant le plafond à 10 000 nœuds dans le diagnostic. Une seule case du trajet manque à sa carte. Sa texture diffère du sol ordinaire et SIC n’y a vu personne marcher. Le banc a vérifié que B pouvait pourtant y entrer. Les deux destinations et les positions initiales des deux mécanismes donnent, indépendamment, la même translation entre les régions. Par cette translation, la case manquante chez B correspond à la case occupée par A.

## 2. Choisir une expérience qui change la décision

Le pack témoin déclare `prepare_joint_arrivals` et le candidat déclare `transfer_registered_footing`. La seconde stratégie autorise le planificateur à envisager un pas sur la case homologue de celle occupée par le partenaire lorsque les deux paires de repères donnent la même translation. La case entre à titre d’hypothèse dans la recherche courante. Seul le retour public d’un mouvement en fait une visite. Une transition contredite à placements identiques est écartée au recalcul. Sur un premier parcours synthétique, SIC s’abstient si les deux translations divergent et révise son choix si le pas échoue. Sur un second, les repères se correspondent verticalement et l’autre sujet est actif. La même règle propose un déplacement horizontal, dont le retour confirme l’entrée sur la case cachée. Le témoin s’abstient sur les deux parcours.

L’auteur déclare la stratégie, le seuil d’information et le budget de recherche. SIC identifie les sujets, choisit les cibles des clics, vérifie le moteur de déplacement, reconnaît les mécanismes, déduit la translation, choisit le pas et surveille les deux placements. L’ancien langage permettait déjà de déclarer une préférence et des limites. Il manquait au planificateur l’opération qui transforme une occupation observée chez un sujet en possibilité locale à vérifier chez l’autre. Cette opération pourrait aussi servir sur deux tableaux d’interrupteurs de même disposition quand un marqueur cache le sol du second tableau. Cet exemple est une hypothèse de transfert.

Les 30 premières commandes et images de SS06 sont identiques. **Au coup 31**, depuis l’image `20034a2f6bf1c232`, le témoin joue `ACTION1` et le candidat joue `ACTION2`. Le reçu du candidat contient la position occupée chez A, la case prévue chez B, la translation et les observations distinctes qui justifient les repères. Le coup 31 engage le trajet. **Au coup 34, B entre réellement sur la case postulée.**

## 3. Composer les préparations et vérifier l’effet

| Coups | Décision autonome et retour public |
|---|---|
| 31 à 38 | SIC déplace B et son mécanisme jusqu’à la disposition prévue. A et son mécanisme restent en place. |
| 39 | La première arrivée apparaît sur son repère. SIC clique sur A pour préparer la seconde. |
| 40 à 53 | SIC pilote A et déplace son mécanisme. Le placement de B est conservé pendant les 14 mouvements. |
| 54 | Les deux marques sont effectivement sur les deux destinations. SIC choisit l’activation commune et le moteur crédite le L2. |

Le banc est un outil de diagnostic séparé qui repart d’une même situation et essaie plusieurs suites de commandes publiques. Il a exploré 172 dispositions pour B et 78 pour A. Il a trouvé deux préparations de B et une de A. Dans les dix comparaisons, les quatre essais qui préparent les deux sujets gagnent en 45 ou 46 commandes. Les six témoins avec zéro ou une préparation marquent zéro. Les programmes du banc restent dans le banc. Le pilote autonome part du début, observe sa propre marque et construit sa propre suite de 54 commandes.

## 4. Mesurer le transfert

Le diagnostic SS06 a orienté la conception du dernier changement. Son score mesure l’autonomie sur ce cas de développement. SS09 entier a été gardé à part pour évaluer le même pack figé. Les résultats par condition figurent dans le tableau de qualification ci-dessous.

Sur 105 épisodes sources, 294 des 1 699 expériences évaluables avec une commande d’activation déplacent au moins deux corps distincts. Parmi 18 prédictions prospectives de deux arrivées sur des marques, cinq se réalisent. Une commande directionnelle rivale explique aussi ces cinq retours. Dans un audit distinct de 103 épisodes sources, deux paires de repères fournissent une translation sur 171 images. Aucun déplacement enregistré n’y réunit toutes les conditions du test d’appui homologue entre deux sujets à mouvement déjà observé. Les sources étayent la composition d’effets. La preuve mécanique de cette nouvelle utilisation de la translation vient du coup 34 sur SS06. Son efficacité sur une autre famille de jeux reste à mesurer.

### Qualification sur le moteur figé

| Condition | Résultat officiel du candidat |
|---|---|
| SS01 L2 | 44 coups à froid. En campagne, 36 au L1 puis 32 au L2. |
| SS02 à SS05 en campagne | L2 gagnés en 46, 97, 143 et 73 coups respectivement. Le L1 a été joué par SIC dans les quatre parties. |
| SS06 L2 à froid | 54 coups. À plafond de 1 200, le pack témoin s’arrête au temps après 298 coups. À plafond de 54, le candidat reproduit toute sa trajectoire gagnante et le témoin marque zéro. |
| SS07 L2 à froid | 117 coups. |
| SS08 L2 à froid | 181 coups, zéro point. En campagne, le L1 s’arrête après 207 coups. |
| SS09, jeu réservé | À froid, zéro point après 209 coups au L2. En campagne, le L1 s’arrête après 193 coups. |
| SS10 et SS11 L2 à froid | Zéro point après 318 et 197 coups respectivement. |
| 100 jeux sources, entrée au L1 | 100 victoires rejouées. Les 100 trajectoires gardent les mêmes commandes et images qu’en v91. |
| Sources supérieures | CWSE L2 gagne en 59 coups et KLOT L4 en 37. Les deux trajectoires sont identiques à celles du témoin v86. |

Le vérificateur a rejoué les 14 parties Custom 4 du candidat. Les sept jeux gagnés sont des jeux distincts. Les deux entrées gagnantes de SS01 comptent pour un seul jeu. Les budgets d’actions et de temps étaient fixés avant les manches. Le nombre d’actions jouées à expiration du temps dépend du débit de calcul. La comparaison supplémentaire à 54 actions permet de relire une véritable différence de décision à nombre de commandes égal.

La vérification TypeScript passe et les **513 tests** de la suite SIC et du contrôle natif associé réussissent sur le code figé, y compris les deux parcours synthétiques.

### Ce que le résultat de SS08 désigne pour la suite

Le candidat et la version v91 donnent les mêmes 135 premières commandes et images sur SS08 L2. Le nouveau plan d’arrivées conjointes n’y est jamais proposé. Au coup 45, le changement de contrôle est vérifié. Aux coups 48 à 102, SIC revient 40 fois à la vérification des commandes directionnelles et 15 fois à l’exploration des entrées publiques.

Depuis le préfixe public de 43 coups, le banc a fait varier le placement du premier sujet avant de cliquer sur le second. Il a vérifié 29 placements et essayé les mêmes 195 suites depuis chacun. Parmi les 139 paires de préparations de même longueur, **26 changent le résultat d’au moins une suite**. Dans le contraste le plus court, deux préparations de deux mouvements laissent le second sujet au même endroit. La même commande déplace sa silhouette de 2 ou de 17 pixels suivant la préparation. Le rectangle suivi conserve les mêmes dimensions, 3 × 2 pixels. Le premier sujet demeure en place dans les deux branches. Aucun de ces essais n’a obtenu de point.

J’ai ensuite testé si l’alignement avec le partenaire suffit à prédire une arrivée près de lui. En écartant les positions de l’exemple initial, 15 placements permettent de suivre les mêmes silhouettes à dimensions constantes. Sur les trois cas d’alignement prévus par ce modèle, aucun n’arrive à la position annoncée. Parmi les douze autres, seuls trois reproduisent le déplacement court de référence. Le contraste initial est reproductible, mais sa condition causale reste à isoler.

Cette mesure désigne un problème différent pour le chantier suivant. SIC doit apprendre quand **une préparation change la portée d’un geste connu**, puis choisir le placement qui donne accès à un lieu utile. Sur SS08, les deux préparations et la commande de comparaison proviennent encore du banc. La prochaine épreuve autonome consistera à produire cette comparaison en partie et à réutiliser la portée mesurée.

[Mesures compactes et empreintes des rejeux](mesures-arrivees-conjointes-v93.json)

## Reproduction

Le candidat est figé à `8621f32c4` sous la balise `sic-source100-registered-footing-v93`. Le moteur du catalogue Custom 4 est celui de `f0a1ff437`. Les deux configurations emploient la même version du pilote, une profondeur de 88 et 1 000 nœuds. Le lot principal autorise 1 200 commandes et 514 286 ms de temps actif par niveau. Pour comparer les décisions au même nombre de gestes, régler aussi le plafond à 54 dans les deux manches.

```powershell
$env:SIC_STUDY_RECORD_COMMANDS='1'
$env:SIC_STUDY_CURSOR_OFFERS='1'
$packs=Join-Path $candidat 'docs/diagnostics/sic-plan-arbitration'
$env:SIC_STUDY_RECOVERY_PACK=Join-Path $packs 'arrivees-conjointes-v92.json'
node scripts/compare-source100.mjs $candidat $moteur temoin.jsonl SS06 2 2 1200 0/1
$env:SIC_STUDY_RECOVERY_PACK=Join-Path $packs 'appui-homologue-v93.json'
node scripts/compare-source100.mjs $candidat $moteur candidat.jsonl SS06 2 2 1200 0/1
node scripts/verify-frozen-level-scores.mjs $moteur score.json candidat.jsonl
```

Pour reproduire le banc, générer la géométrie avec `scripts/measure-parked-indications.mjs` sur la bande témoin v90, comme indiqué dans le [rapport v91](placements-conditionnels-v91.md). Passer le fichier de géométrie, la bande v91 et le moteur à `scripts/compare-joint-indication-preparations.mjs` dans l’ordre indiqué en tête du script.

[Pack candidat](appui-homologue-v93.json) · [Pack témoin](arrivees-conjointes-v92.json) · [Décision et reçu](../../../src/sic/joint-indicated-arrivals.ts)
