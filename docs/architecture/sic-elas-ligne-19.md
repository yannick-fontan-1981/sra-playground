# ELAS, ligne 19 — accès à une composition métrique

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`.
Ligne 19 du catalogue, `metric_composition / metric_composition_access`,
ELAS N1/T1, ACTION6. Reproduire le départ de N1 avec les paramètres de
l'inventaire SIC et reconstituer les places, rapports d'échelle et
placements admissibles à partir des observations publiques.

- Identifier la pièce choisie, le premier déplacement autorisé, la
  différence entre une hypothèse de commande et une direction acquise,
  la comparaison au retour et le choix suivant.
- Dans au moins une seconde situation mesurée, contrôler que la même
  articulation sélectionne un autre placement ou une autre pièce. Au
  même épisode, présenter une sélection non confirmée ou une cible de
  portée différente à une commande inchangée. Relever le refus ou la
  reprise avant d'attribuer un effet au trajet.
- Vérifier le niveau atteint par le rejeu et séparer le gain officiel
  du témoin intermédiaire. Si le gel remplit déjà le contrat, publier
  uniquement la caractérisation et les tests. Borner la qualification
  au nombre d'occurrences du catalogue effectivement retrouvées.

## Ce que le moteur mesure

`measuredMetricScene` relève les bords des rectangles connexes de la
grille, les couleurs visibles, la bordure de sélection et un motif
extérieur de référence. `metricTargetCandidates` calcule les rapports
entre la largeur ou la hauteur d'une case et la dimension des
rectangles de référence. Il retient les rapports présents sur les
deux axes. Une échelle unique doit projeter les extrémités du motif
sur des bords réels de la grille. `enumerateMetricTargetDomain`
convertit chaque placement admissible en exigences de couleur par
case. La famille vérifie qu'il existe assez d'occurrences pour ces
exigences, puis compare le coût des suites disponibles. La distance
sert aussi d'estimation dans la recherche en nombre de lignes et de
colonnes. Les pas restent conditionnels au modèle de support des
cases irrégulières et à l'occurrence exposée au sommet.

Le besoin est une configuration métrique complète. Le ticket libère un
préfixe de composition, jusqu'à la première géométrie de commande
encore à mesurer le cas échéant. `MetricComposition.before` revalide
la grille, le motif cible, les sommets visibles, la sélection et la
portée. `after` compare la sélection ou l'état visible attendu à
l'observation. `record` conserve le reçu et ajuste le contrôle à partir
des transferts confirmés. L'avancement officiel a son propre cas de
retour.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L59)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L45)
· [Mesure et domaine](../../src/logos-engine/v6-metric-composition.ts?plain=1#L43)
· [Composition](../../src/logos-engine/v6-metric-composition.ts?plain=1#L138)
· [Garde](../../src/logos-engine/v6-metric-composition.ts?plain=1#L171)
· [Acquisition](../../src/logos-engine/v6-metric-composition.ts?plain=1#L126)

## Deux placements du vrai service

| Contexte | Placement et ticket | Retour et reprise |
|---|---|---|
| N1/T1–T2 | Le placement retenu est ancré en (14,10), à l'échelle 2:1. Il demande 8 sur la case 8, 9 sur la case 9 et 11 sur la case 17. La pièce 11 se trouve en case 24, à portée du clic ACTION6 (28,25). Le préfixe de coût 2 associe ce clic à ACTION1 vers la case 17. À T1, la géométrie d'ACTION1 est encore une hypothèse de contrôle. | T1 confirme la sélection de l'occurrence `visible:24`. La garde autorise T2 dans ce contexte et le jeu marque N1. Ce retour de frontière enregistre le gain officiel. |
| N2/T3–T4 | Le même calcul retient (8,6) à l'échelle 3:1. Il ajoute la couleur 14 en case 16 au motif des cases 8, 9 et 17. Le plan conditionnel a un coût initial de 9. ACTION6 (19,28) sélectionne la case 30 et ACTION1 vise la case 23. | T3 confirme la sélection. T4 confirme le transfert, dont le coin supérieur gauche passe de (17,25) à (17,21). Le reçu de T4 alimente le contrôle et figure dans les références du plan de T5. |
| N2/T5–T11 | ACTION1 poursuit vers la case 16. Le modèle attend à nouveau des sommets visibles et une sélection précises. | T5 confirme les sommets visibles et la sélection prévue, mais change la référence de cible remesurée et scelle le préfixe. Le service réconcilie et repropose, avec ACTION4 à T6, puis un nouveau préfixe à T7. Après une autre divergence à T10, T11 marque N2. Le service repart en N3 dans `contextual_compartments`. |

La composition réutilise le domaine métrique, les transitions de pile
et les mesures de commande sur deux configurations publiques
distinctes. À T5, la couleur 9 cesse d'être visible dans la grille.
La mesure du motif extérieur filtre ses couleurs selon celles qui
restent visibles dans la grille. Le motif extrait perd donc le 9
alors que ses pixels extérieurs sont identiques. Le reçu global
`matched:false` combine ce changement de référence avec un transfert
dont la mesure visible correspond à la prévision. Le reçu de
`record` conserve `expected_visible_matched:true` et
`unknown_underlay_revealed:false`. À T6, le plan utilise la nouvelle
référence et ses exigences ne contiennent plus le 9.

## Même commande, autre pièce

Dans une seconde partie officielle partant de N1, cliquer en (17,13)
sélectionne la pièce 8 en case 8. Le motif, la grille et la couleur
visible de chaque case restent ceux du scénario nominal après son
premier clic. Le retour alternatif soumis isolément à `after` invalide
la prévision de sélection et scelle le préfixe nominal. Avec ce raster,
la garde du même ticket ACTION1 renvoie `metric_premise_changed`.
Le refus est un test isolé du moteur. Si l'on envoie directement ce
même ACTION1 au jeu alternatif, la pièce 8 se déplace en case 1, la
pièce 11 reste en case 24 et aucun niveau n'est marqué.

## Portée et reproduction

Le départ du gel reproduit les onze occurrences répertoriées, de T1
à T11. La comparaison de 16 gestes avec le rejeu du moteur
`8ce7ee35` concorde sur les commandes, propriétaires, types et
retours. La métadonnée `palette` diffère entre les révisions. Les
preuves portent sur deux niveaux complétés dans le budget d'inventaire.
L'archive de migration v45 continue en `metric_composition` après
le deuxième point marqué. Le parcours du gel change de famille à
T12. Les décisions de cette ancienne continuation ne créditent pas
la ligne 19 du catalogue actuel.
[Archive v45](../../docs/migration/native-campaigns-v45/elas-three-levels.json)

Dans un checkout avec Node 24 et les actifs du jeu préparés :

```powershell
node --test tests/sic-elas-line-19.test.ts
node --test tests/v6-coupling-metric.test.ts
```

`SIC_ELAS_GAME_ROOT` peut désigner un autre checkout préparé avec les
actifs sous `public/`. `SIC_ELAS_ENGINE_ROOT` désigne un checkout du
moteur à tester, ici le gel. La branche ajoute uniquement le dossier
et les tests. La qualification indépendante reste ouverte.

La caractérisation passe 2/2 sur le jeu officiel et les contrats
couplage/métrique 133/133. Branche ouverte à 23:10:11, critères à
23:10:40, premier préfixe du gel disponible à 23:11:14 et verdict
local à 23:15:03 (UTC−3).
