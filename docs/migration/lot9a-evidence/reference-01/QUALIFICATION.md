# Lot 9A : référence indépendante ChartNavigation

## Résultat et périmètre

Le corpus compare les sorties intégrales du Python original immuable à la géométrie, au propriétaire et au DRM/SRC natifs. Le premier passage natif a réussi **134 tests sur 134**, sans saut ni reprise, en **1,426847 s** de temps du processus de contrôle. Le journal Node annonce 1,298070 s.

Les observations sont construites indépendamment du port TypeScript. Les **29 rasters publics mesurent 64 × 64 dès leur construction**, avec une palette de 0 à 15. Aucun redimensionnement, jeu, trace de jeu, moteur de jeu ou réponse native n'alimente l'oracle. Les seules images invalides sont des cas négatifs de composant explicitement déclarés.

Cette preuve porte sur le composant et ses transitions contrôlées. Elle ne prouve pas, à elle seule, la sélection par le common réel, la façade publique, un worker, une campagne réelle ou les coûts officiels.

## Corpus et résultats observés

| Groupe | Nombre | Contenu |
|---|---:|---|
| Rasters enregistrés | 29 | Carte initiale, pièces contrôlées, images intermédiaires et contre-exemples |
| Géométrie et décodage | 30 | Rectangles, carte, inventaire, scène, routes, fractions V5, divulgation partielle et budget |
| Opérations du propriétaire | 80 | Propositions, gardes, retours, état complet, restauration et changements d'époque |
| Décisions DRM/SRC | 15 | Priorité, distance, action, ordre des entrées et conditions d'applicabilité |
| Séquences froides | 4 | Parcours principal, ancrage conditionnel, ancre contraire et directions incompatibles |

La chaîne principale part d'une carte sans inventaire, rejoint une dépendance, observe le gain périphérique du pigment 4, puis observe sa perte avec une image intermédiaire de frontière droite. Le source établit une permission **locale et conditionnelle**, puis propose la cible homologue. Aucun retour de cette chaîne n'augmente le score officiel.

La variante à scène identique conserve les hypothèses « resté » et « arrivé ». Une continuation est possible uniquement lorsque chaque localisation propose la même direction. Une annotation de frontière explicite peut ensuite distinguer les localisations ; un lien absent reste inconnu et ne réfute aucune position. Une autre séquence conserve une acquisition ambiguë sans occurrence attribuée et s'abstient devant des directions incompatibles.

La contre-ancre remplace la prédiction de déplacement par l'ancre publique observée et retire les permissions et visites incompatibles. Le changement d'époque conserve uniquement une interprétation portable, qui exige une nouvelle validation de la morphologie courante.

Les 14 champs d'état source sont comparés intégralement. Les tests conservent aussi tous les hashes, preuves, reçus SRC, routes, alternatives et statuts d'incertitude.

## Deux exécutions source en échec, artefact complet récupéré

Les deux reçus d'exécution conservent leur statut **`failed`** :

| Tentative | Durée | Cause de clôture |
|---|---:|---|
| 01 | 45,871842 s | Tous les cas étaient terminés, mais deux modules originaux avaient été importés tardivement ; l'inventaire initial ne pouvait donc pas égaler l'inventaire final. |
| 02 | 44,551508 s | Tous les cas, les contrôles de source et l'écriture du gzip étaient terminés. La création du reçu final a échoué en relativisant un chemin de sortie déjà relatif à une racine absolue. |

La correction de la tentative 02 vérifie les bytes de chaque module original contre le manifeste **avant son import**, y compris les imports tardifs. Elle vérifie de nouveau l'union des sources après le corpus. Aucun module original n'est modifié. Les deux imports tardifs sont `conscious_experiment_feedback.py` et `conscious_symbolic_memory.py`.

Il n'y a eu **aucune troisième exécution d'oracle**. La récupération séparée lit seulement les artefacts déjà écrits. Elle vérifie les 154 enregistrements bruts, leur égalité complète avec le gzip, la dérivation des quatre séquences, les révisions des observations, tous les hashes du manifeste, du générateur et des 723 fichiers sources consommés. Les bruts des tentatives 01 et 02 sont identiques octet pour octet. La récupération a duré 1,120900 s et ne modifie ni le corpus ni les deux reçus en échec.

L'ancien générateur de la tentative 01 a été reconstruit depuis le diff de correction et sauvegardé seulement après égalité stricte de son SHA avec le reçu original. `generator-attempt-01-reconstruction.json` indique explicitement qu'il s'agit d'une reconstruction vérifiée, et non d'une capture faite au moment du lancement.

## Bornes et provenance

- Source immuable : `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.
- Fixture : `reference.json.gz`, SHA `0770706db16249ac4ab1c7c8b9533d571f2fc2cdaeaf5dae2d990806e412cfe8`.
- Déclaration courante : SHA `35d495721efa864acfceaf7abd26e1588038a1babd12b59364d9022e861f0339`.
- Générateur évalué en tentative 02 : SHA `30bc414e1ab6c7be209d0c726f7a3df47f8208ea1c708f2cf2804fc9677182ef`.
- Cumul des deux oracles : **90,423350 s sur 120 s**, limite de deux lancements atteinte.
- Premier passage natif : **1,426847 s sur l'enveloppe de 90 s**, un lancement sur trois.
- Aucun verrou, aucune mesure officielle, aucun commit ou push effectué par le producteur de ce corpus.

Les révisions de la séquence principale sont 1, 2, 3 et 4 avec la session `chart:synthetic`. Les trois autres séquences commencent également à la révision 1 et progressent sans trou. Les dossiers `frames` contiennent les observations originales et les paquets publics avec `frame_rows` et `frame_packet`.

## Artefacts de contrôle

- `declaration.json`, `declaration-attempt-01.json`, `preflight-correction.json` et `oracle-correction-02.json` : portée et corrections déclarées.
- `attempt-01.json`, `attempt-02.json`, journaux de processus et bruts JSONL : conservation intégrale des deux échecs.
- `recovery-02.json` : récupération indépendante de l'exécution de l'oracle.
- `native-tests-01.json` et `native-tests-01.log` : résultat du premier passage natif.
- `tests/v6-chart-navigation.test.ts` : comparaisons source intégrales et contrats de conservation.

L'intégration commune doit démarrer à froid à partir de ces rasters et des retours déclarés. Les états contrefactuels explicitement marqués servent uniquement aux tests de composant et ne doivent pas être injectés pour fabriquer une acquisition commune.
