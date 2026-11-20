# SIC Fallback · observations de contrôle et de déplacement sur les sources

Les 100 jeux au premier niveau et 18 niveaux supérieurs ont été rejoués sur leur moteur. Les interventions partent de préfixes d’actions archivés. Pour chaque question, les positions et la commande proposées sont choisies à partir des observations antérieures du même épisode. Un retour exact désigne l’égalité des deux coordonnées du centre, y compris pour une pièce de largeur paire. Les niveaux supérieurs comprennent notamment GRAV, GARE, POLA, CWSE, CATR, GIGO et MOTO. Ces mesures portent sur des prédictions locales.

| Expérience sur un même état de départ | 100 jeux | 18 niveaux supérieurs |
|---|---:|---:|
| Deux déplacements prédits, deux commandes différentes, position ou apparence nouvelle pour la commande | 44 paires entièrement exactes sur 77 | 7 sur 23 |
| La commande sélectionnée amène une pièce à la position précédente d’une autre pièce, déplacée vers un site inédit pour cette relation | 15 arrivées exactes sur 48 prédictions | 1 sur 24 |
| Parmi les arrivées exactes, une autre commande disponible donne une arrivée différente | 15 | 1 |
| Parmi les arrivées exactes, une commande suivante produit un déplacement différent de cette même commande exécutée seule | 4 | 0 |

Les 15 arrivées se répartissent sur ESCT, GABA, REWI, VOIS et ZIPP. Celle des niveaux supérieurs provient de GRAV L3. Les tests de contrôle moteur comprennent trois réussites sur de nouvelles apparences dans CWSE L2. Les prédictions erronées font partie des dénominateurs. Une nouvelle case pour la relation entre deux pièces peut déjà avoir été visitée par le joueur.

Comparer deux préparations de même durée, suivies de la même commande, révèle également des dépendances à la configuration. Dans une autre série, 69 des 70 prévisions portant sur des images nouvelles et des positions identiques ou translatées ensemble sont exactes. L’unique essai où les positions sont translatées ensemble échoue. La projection d’une règle à une autre position reste donc une hypothèse à contrôler. Dans ESCT, des historiques différents produisent aussi des effets différents pour les mêmes positions visibles.

Le candidat expérimental peut proposer une disposition, annoncer une arrivée puis un usage, et interrompre la suite dès qu’une position observée invalide la prévision. Le contrôle en partie porte séparément sur la disposition effectivement atteinte, l’arrivée, l’usage et l’avantage de la préparation par rapport à sa suppression.

## Reproduction

`measure-source-pose-families.mjs` réduit les images sources à des familles de formes colorées et des positions. `propose-source-motor-controls.py` et `propose-source-spatial-cues.py` choisissent les questions, puis `test-source-motor-controls.mjs` et `test-source-spatial-cues.mjs` testent les commandes rivales depuis les préfixes exacts. `study-source-control-transfer.mjs`, `validate-transferred-control-layouts.mjs` et `measure-reach-after-control.mjs` vérifient les branches de même durée et leurs positions accessibles. Les résultats de ces interventions sources précèdent le gel du candidat.

