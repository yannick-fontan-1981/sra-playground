# Ligne 41 · distinguer une pose de motif d’un changement de la ligne d’état

**TICT apporte le placement physique qui manquait sur SP80.** Au premier geste de N1, `ACTION6(31,28)` fait apparaître un motif au centre mesuré. Un autre motif apparaît ensuite dans la cellule voisine. Au geste suivant, le service consomme les deux identités et confirme sa première prédiction de placement. Le gel possède déjà ce comportement. Le choix remplaçable entre les deux cellules à égalité de SP80 appartient à `bb4a99b5`. [Critères et ticket SP80](sic-sp80-lignes-4-41.md) · [Tests TICT](../../tests/sic-cell-placement-positive-41.test.ts)

## Sources et périmètre

La campagne v38 documente six niveaux officiels de TICT en 55 gestes. L’archive publique v46 conserve l’observation initiale puis les 55 commandes et leurs paquets. Le test utilise son préfixe de 16 gestes, avec les options d’inventaire depuis N1, sans curiosité ciblée, budgets 6 × 600, limite globale de 16. Les trois recaptures locales, chacune depuis un nouveau processus de jeu, avec `8ce7ee35`, `d0e7527c` et `bb4a99b5` donnent les mêmes 16 commandes, plans, gardes et résultats. Les 17 observations du gel concordent avec l’archive sur les trames finales, les séquences d’images, les entrées disponibles, le niveau, le score, l’état et l’index du geste. Les 16 tickets portent `public_occurrence_recall / cell_patch_composition / cell_patch_placement`. La jointure des préfixes donne 16 occurrences TICT et 5 SP80, soit 21 des 45 de la matrice. Les 24 autres restent hors de cette vérification. Les essais contrôlés de la famille fournissaient déjà une acquisition sur scène construite. [Rapport TICT v38](../migration/v38-cell-placement.md) · [Campagne des 55 gestes](../migration/native-campaigns-v38/tict-six-levels.json) · [Archive publique v46](../migration/native-campaigns-v46/tict-public-trace.json.gz) · [Test de scène contrôlée](../../tests/v6-cell-placement-integration.test.ts)

## Même ticket, quatre portées de preuve

À T1, le service part à froid dans les trois premiers cas. La même garde admet le centre (31,28), cellule (1,1) du champ 3 × 3, mesuré à l’origine (9,6) avec des plages de 14 × 14 et un pas de 16. La prédiction initiale vaut `null`. Les variations modifient seulement le paquet renvoyé à ce ticket. Le quatrième cas conserve le modèle acquis et le ticket réellement prédictif de T2.

| Retour | Mesure et reçu du propriétaire | Décision suivante |
|---|---|---|
| TICT T1 physique, cinq images | Aux images 0 et 1, seule la cellule (1,1) est passée du vide à un motif non uniforme. Aux images 2 à 4, ce motif demeure et une autre cellule (1,2) est passée du vide à un motif différent. `recordPacket` enregistre les indices [0,2], les deux identités, la géométrie, l’époque et les références des observations avant et après. Le retour T1 reste sans prédiction vérifiée. | T2, `ACTION6(15,12)`, mode `prepare_visible_line_under_observed_local_and_remote_additions`. La recherche prédit le motif propre en (0,0). Le retour physique confirme cette prédiction. T3 teste (47,44) puis la frontière officielle ouvre N2. |
| TICT T1 construit, deux pixels hors champ | Le paquet présente la trame d’avant avec (4,63) et (5,63) modifiés. Les coordonnées et la valeur d’arrivée reproduisent la variation SP80 sur le plateau propre de TICT. La grille de cellules demeure identique. Le propriétaire date le retour, `matched = null`, sans acquérir de modèle ni refuser la configuration. | La nouvelle sonde reprend (31,28), avec la seule référence courante, sans prédiction ni recherche de ligne. |
| TICT T1 physique réduit à sa dernière image | L’image finale contient les deux motifs, mais leur ordre est absent. La couche des paquets ne produit aucun événement de rôle. | T2 choisit (15,12), exactement le point nominal. Son motif attendu et sa recherche sont nuls, son unique référence est celle de l’image courante. C’est une nouvelle sonde. |
| TICT T2 construit, deux pixels hors champ après le vrai T1 | Le ticket admis prédit le motif propre en (0,0). La cellule reste vide. `cellPlacementAfter` renvoie faux. `record` marque le modèle du champ et de l’époque `refuted`, avec la référence de ce retour. | T3 reprend (15,12) en mode exploratoire, motif attendu et recherche nuls. La réfutation reste consultable dans le plan. |

**Verdict local.** Sur le ticket froid, le moteur suspend l’attribution d’une pose si la preuve locale datée manque. Sur le ticket prédictif testé, un retour limité à la ligne d’état réfute la prédiction. La poursuite d’une exploration à point constant reste observable. Aucun correctif moteur ne découle de ces contre-épreuves. Le choix des deux offres SP80 à état identique, le retour positif TICT et l’absence d’acquisition sur SP80 peuvent désormais être soumis ensemble aux deux validateurs pour **un seul numéro**. [Admission et réception](../../src/logos-engine/v6-cell-placement.ts) · [Géométrie et différences locales](../../src/logos-engine/v6-cell-patch-observation.ts) · [Raccord au service](../../src/logos-engine/v6-shared-series.ts)

## Rejouer

Depuis la branche de ce lot sous Node 24, la première commande utilise l’archive livrée par le dépôt. `SIC_SP80_GAME_ROOT` peut désigner tout checkout qui contient les archives Python et Pyodide. Il sert aussi à TICT. Pour vérifier le gel, définir `SIC_SP80_ENGINE_ROOT` sur sa racine puis relancer la suite.

~~~powershell
node --test tests/sic-cell-placement-positive-41.test.ts
$env:SIC_SP80_GAME_ROOT = (Get-Location).Path
node --test tests/sic-cell-placement-positive-41.test.ts tests/sic-sp80-two-lines.test.ts
~~~

Les quatre tests passent sur le moteur du gel et sur le moteur `bb4a99b5`. Le parcours nominal du second a aussi été joué dans le jeu public. Le 27 novembre 2026 (UTC−3), début des mesures à 21 h 44 min 55 s, premier retour de campagne à 21 h 45 min 26 s, verdict local à 21 h 48 min 18 s, soit 3 min 23 s. Le lot ajoute seulement cette fiche et la suite TICT.
