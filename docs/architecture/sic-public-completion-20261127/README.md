# Réacquisition publique des rôles — UPST et CWSE

Les deux rejeux natifs démarrent au niveau 1, dans une seule session SIC par jeu, sur le même instantané. Les budgets archivés restent inchangés. Le contrôle global de continuité et le rejeu dans l’interface livrée restent à effectuer avant qualification finale.

## Source

- Commit local : `c70f8027e85e2f7f34fc2d5bd46e50832757b0c9`.
- Commit GitHub : `55fc7b488e8443b730de3bf17cdc9e4b2d1c6883`.
- Arbre commun vérifié : `f0e8e29cf6fa1fb33f38843849675e75321afd7d`.

## Résultats

| Jeu | Niveau | Commandes | Plafond | Score (ms) | Total (ms) | Plafond (ms) |
|---|---:|---:|---:|---:|---:|---:|
| UPST | 1 | 19 | 36 | 8126 | 8213 | 38000 |
| UPST | 2 | 4 | 9 | 2044 | 2163 | 11000 |
| UPST | 3 | 11 | 19 | 4963 | 5243 | 21000 |
| UPST | 4 | 7 | 12 | 3296 | 3419 | 14000 |
| UPST | 5 | 14 | 20 | 6430 | 6591 | 24000 |
| UPST | 6 | 17 | 22 | 8450 | 8620 | 19000 |
| CWSE | 1 | 4 | 80 | 1703 | 1938 | 90000 |
| CWSE | 2 | 5 | 80 | 1640 | 1802 | 90000 |
| CWSE | 3 | 40 | 80 | 14026 | 14255 | 90000 |
| CWSE | 4 | 31 | 80 | 12519 | 12796 | 90000 |
| CWSE | 5 | 36 | 80 | 18900 | 19362 | 90000 |
| CWSE | 6 | 79 | 80 | 56096 | 56847 | 90000 |

UPST : 6 niveaux gagnés, 72 commandes, 72 commandes avec autorité native et 72 acquisitions. CWSE : 6 niveaux gagnés, 195 commandes, 195 commandes avec autorité native et 195 acquisitions. CWSE utilise partout le budget de repli `no_level_reference` de 80 commandes / 90 secondes ; son niveau 6 termine à 79 commandes.

## Rôle, réutilisation et réfutation

Pour les compartiments, une ouverture observée et la croissance établissent d’abord un essai de rencontre atteignable, sans présumer sa réussite. Après acquisition du rôle terminal, un score obtenu par une autre famille ne suffit pas : une image de l’ancien contexte doit montrer l’ouverture et le participant identifié dans le compartiment de la référence stable. Cette preuve conserve les couleurs observées et leurs références, puis autorise leur réassociation dès la décision suivante.

Pour la réception directionnelle, le déplacement connu et les couleurs d’exposition permettent de projeter la commande réellement exécutée. Le transfert exige une image publique de l’ancien contexte qui concorde avec la pose, les pièces, le cadran et les récepteurs remplis. Une commande sans direction acquise, une association ambiguë ou un retour contradictoire ne promeut pas le rôle.

Le helper commun exige exactement une transition officielle et la portée de départ correcte. Il préserve les preuves indépendantes. Une notification répétée ne crée pas une seconde acquisition. Lorsqu’un nouveau niveau est affiché, son raster final et ses copies sont exclus des preuves terminales de l’ancien contexte.

## Validation et contenu

Les 27 tests ciblés et TypeScript passent. Deux variantes natives par rôle changent formes, couleurs, positions et commandes. Les négatifs couvrent absence, ambiguïté, contradiction, portée incorrecte, notification répétée et coïncidence du nouveau raster avec l’ancien terminal. La revue indépendante n’a identifié aucun bloqueur restant.

Les fichiers `*-native.jsonl.gz` et `*-native.levels.jsonl.gz` sont les sorties brutes du runner standard. Les captures `*-boundary-public-capture.json.gz` conservent les observations publiques et les états qui reproduisent la perte de portée à la frontière L2/L3. `public-completion-reacquisition.json` donne la réacquisition hors ligne et la première offre utile, avec empreintes des sources. Le manifeste contient les empreintes des flux compressés et décompressés, les budgets, les autorités et les acquisitions.

Les séries observées restent distinctes de la réussite fonctionnelle : aucune série multiple dans UPST ; une série de deux clics dans CWSE. Ce rapport ne remplace pas le contrôle global de continuité.
