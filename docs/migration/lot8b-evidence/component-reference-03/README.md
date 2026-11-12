# Référence originale du composant BranchRouting

La tentative **03** a exécuté le composant Python original immuable sur **37 rasters publics synthétiques**, **20 cas de géométrie** et **12 scénarios comprenant 83 opérations**. Elle a terminé en 1,57 seconde dans une enveloppe de 60 secondes. Les **1 786 fichiers originaux** sont vérifiés par empreinte opaque avant et après. Le résultat complet est conservé dans `tests/fixtures/v6-branch-routing-reference.json`, avec les états source et toutes les propositions, gardes, réponses et liaisons.

Cette preuve concerne le composant générique. Aucun jeu, trace de jeu, moteur natif, résultat natif ou dispatch n’est utilisé pour produire les réponses attendues. Aucun résultat officiel de niveau réel n’est revendiqué. Les valeurs de score et d’époque du corpus sont des interventions synthétiques déclarées.

## Provenance et limites prospectives

L’exporteur `scripts/export-v6-branch-routing-reference.py` importe seulement trois modules de la référence V6 `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` :

- `common_branch_routing.py` pour les cinq helpers et les six méthodes du propriétaire.
- `common_multiscale_constraints.py` pour `digest`, `projection` et `rows_digest`.
- `geometric_observer.py` pour mesurer les composants de rasters construits par rectangles, capuchons et cavités ouvertes.

Le domaine est limité à des rasters de 32 × 32 au maximum, trois barres, une limite tangentielle de 16 et 4 096 candidats cartésiens par appel. Le corpus réel utilise 26 × 28 ou sa transposition. Aucun comportement source n’est remplacé. Les fonctions effectivement appelées sont inventoriées dans la fixture. Le générateur capture aussi son empreinte propre et celles des trois modules importés.

Les attentes proviennent de l’exécution originale, sans entrée dérivée du port natif. Les tuples deviennent des tableaux JSON ; les ensembles deviennent des tableaux triés. La classe originale ne possède pas d’API `state` ou `restore` : l’adaptateur explicite reconstruit ses attributs détachés avec leurs types Python, sans changer leur valeur. Le marqueur de format ajouté est `native.branch_routing.v1`.

Les scènes froides apprennent quatre commandes à partir de quatre retours raster construits et nommés. Les autres scènes partent soit d’un instantané réellement produit par ces scènes originales, soit d’un **contre-factuel retenu explicitement déclaré**. Les trois contre-factuels ne modifient que `motion` pour examiner cinq vecteurs distincts, un déplacement non unitaire ou deux clés donnant le même vecteur. Ils ne constituent pas de nouvelles acquisitions physiques.

## Couverture acquise

| Périmètre | Cas du corpus |
| --- | --- |
| Géométrie | Orientation normale, miroir, transposition, cavité sans phase correcte, cavité unique, plusieurs candidats, sélection ambiguë. |
| Source hors phase | Un capuchon et son carré à `y = 7`, unité 2, donnent le rang source 3 par division entière Python. |
| Mesure de pose | Identité unique, distance égale donnant une ambiguïté, absence de couleur sélectionnée, projection négative vide et projection partiellement hors champ mais uniforme. |
| Propagation | Branches visibles ; sortie hors champ conservée comme obligation conditionnelle. |
| Digests | Projection NumPy négative et tronquée ; tri Unicode des commandes U+E000 et U+10000 et digest Python complet de la proposition. |
| Chaîne froide simple | Quatre calibrations, mouvement appris, test de propagation sans hausse de score, fin locale et nouvelle époque. |
| Chaîne à trois barres | Choix parmi des positions à coût égal, sélection par le premier point de la liste d’inputs, liaison complète, mouvement de deux pas et garde du deuxième pas. |
| Retour contraire | Le déplacement attendu vers le nord reçoit un déplacement mesuré vers le sud ; la loi de commande est révisée et la proposition suivante retourne en calibration. |
| Réponses incomplètes | Déplacement diagonal non acquis comme loi axiale ; contributeur absent ; aucun succès inventé. |
| Frontières et mémoire | Gardes de niveau, score, contrôle, référence d’observation et pose ; frontières officielles d’état/époque/score ; retour sur hausse de score avant événement ordinaire ; restauration et renouvellement des champs d’époque. |
| Commandes et budget | `remaining = 0`, commande de propagation absente ou multiple ; exactement quatre vecteurs distincts ; clé de mouvement unique. |

L’état froid conserve seulement les quatre attributs source `epoch`, `motion`, `passed`, `events`, plus le marqueur JSON. Une nouvelle époque renouvelle `model`, `current`, `verified`, `seen`, `refs`, `finished`, mais conserve `motion`, `passed` et `events`.

## Tentatives conservées

L’[index des tentatives](attempt-index.json) relie chaque reçu, ses journaux complets compressés et les octets exacts des exporteurs ou fixtures historiques.

1. **Tentative 01 : échec d’une assertion du générateur**, avant écriture de la fixture finale. La scène imaginée pour sélectionner une barre faisait intercepter une branche par la dernière barre ; l’original proposait un mouvement. Le code original n’a pas été changé. Le reçu échoué et l’exporteur exact sont conservés dans `component-reference-01`.
2. **Tentative 02 : réussite**, 35 frames, 20 géométries, 12 scénarios et 83 opérations. La scène indépendante a été corrigée. Ses octets sont conservés dans `component-reference-02/reference.json`, ainsi que son exporteur exact.
3. **Tentative 03 : réussite courante**, même nombre de cas et opérations, 37 frames. Un véritable retour axial contraire remplace le cas diagonal qui ne révisait pas la loi de commande ; le cas de projection tronquée conserve un fragment sélectionné uniforme afin de démontrer l’acceptation effective de cette situation par le helper original.

Les résultats préparatoires n’établissent pas la parité de l’appelant original complet, le raccordement au registre, une acquisition sélectionnée exactement une fois dans la boucle commune, une victoire réelle ou un coût accepté. Les adaptations natives d’interruption, de délai et de borne restent à qualifier séparément. **LKEY reste fermé**, sans lecture sémantique de ses données ni exécution de son jeu ou de son oracle.
