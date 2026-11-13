# Correction du coût 3A : filiation et contrats conservés

## Périmètre

Cette correction part de la **publication 65**, commit `24c15cc5c147a8e2d639a6e0e3fe25bc632537f0`, moteur `0.37.0`. Elle réduit trois travaux de représentation et de copie sur des chemins existants. Elle n'ajoute aucune entrée au registre, aucune branche de planification et aucun propriétaire de connaissance.

Les originaux agent restent ceux du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`. Les transformations ci-dessous distinguent la logique reprise de V5/V6 des choix propres au transport TypeScript.

| Transformation | Producteur et consommateur natifs | Filiation et portée |
| --- | --- | --- |
| Réutilisation des copies publiques immuables | `NativeV6Runtime.snapshot()` → `V6AgentService.snapshot()` → réponse du worker | Optimisation du transport natif ; aucune nouvelle logique de raisonnement Python revendiquée |
| Composants géométriques avec moins d'allocations | `geometricComponents()` → observations, correspondances et mesures des familles | Contrat de `agents/yf_arc3_v6/laya_proto/geometric_observer.py::components`, consommé par `neutral_observer.py::measure` ; extension native existante de connectivité 8 conservée |
| Comptage exact des motifs périodiques | `enumerateSupportPeriodicCellGrids()` → mesures initiales d'inventaire et arrivées configurées | Reprise de l'encodage exact de `agents/yf_arc3_v5/capabilities/frame.py::_enumerate_periodic_cell_grids` et `_count_encoded_cell_patterns` |

Ce document qualifie les contrats et les limites. Les résultats de coût, le delta formel de tests et la campagne de non-régression sont établis par leurs reçus séparés. Une réduction d'allocations démontrée dans le code ne vaut pas clôture du budget de performance.

## 1. Copies publiques du service

### Travail retiré

Le runtime conserve déjà une proposition profondément figée pendant son préfixe et des entrées de trace profondément figées. Son snapshot construit une nouvelle liste en partageant ces valeurs internes immuables. Dans la publication 65, le service recopiait pourtant l'ensemble de la proposition et des 128 dernières entrées à chaque réponse.

La correction dans [v6-agent-service.ts](../../src/runtime/v6-agent-service.ts) réemploie leurs **copies publiques détachées**. Le cache privé est un `WeakMap` dont les clés sont les objets du backend et les valeurs leurs clones profondément figés. Un `WeakSet` conserve seulement les preuves d'immutabilité déjà établies.

### Admission et repli

La réutilisation exige une vérification récursive de tout le sous-arbre : chaque objet est figé, possède un prototype ordinaire admis, et ses propriétés propres sont des données. Les tableaux ordinaires et les objets à prototype nul sont admis ; les accesseurs, les symboles, les cycles et les objets non ordinaires ne le sont pas. Un simple `Object.freeze()` de la racine ne suffit pas.

`Date`, `Map` et `Set` conservent un état interne mutable même si leur objet est figé. Ils restent donc exclus du cache. Dès que la proposition ou une entrée de trace ne satisfait pas le contrat, **le snapshot entier reprend la copie complète antérieure**, avec `structuredClone`, puis le gel. Le repli conserve notamment les alias de valeurs mutables entre la proposition et les entrées de trace.

La projection publique commence par la même capture que précédemment : `{ ...value, trace: value.trace.slice(-128) }`. Un accesseur racine `proposal` est donc observé une seule fois dans cette projection. L'examen des descripteurs des sous-arbres ne déclenche pas leurs getters.

### Isolation et qualification de l'identité

Chaque réponse garde une racine et une liste de trace fraîches. Le service ne partage aucun objet réutilisé avec le runtime : il partage seulement ses propres clones déjà détachés et profondément figés. Les scalaires courants, les compteurs, le temps actif et les identités de graphe sont recopiés et validés pour chaque réponse. Le worker continue à exécuter `postMessage` sur la réponse complète, ce qui conserve une copie indépendante côté consommateur.

L'identité JavaScript des clones immuables peut être conservée entre deux réponses du service. Un alias direct entre une proposition et une entrée de trace désignant le même objet source figé est également conservé par le `WeakMap` commun. Les alias internes entre des sous-arbres distincts peuvent être détachés. Cette qualification porte sur les références d'objets diagnostiques ; elle ne modifie ni leurs valeurs, ni les identités métier explicites, ni la commande, ni le ticket d'action.

La validation du snapshot reste exécutée à chaque réponse. La vérification des tickets continue à lire l'identité courante du graphe et du programme avant toute acquisition. Aucun résultat d'admission ou d'autorisation n'est mis en cache.

### Durée de vie et preuves

Les deux caches sont remplacés à l'initialisation d'une nouvelle session. Leur propriété faible ne prolonge pas, à elle seule, la durée de vie des clés détenues par le backend. La **limite de 128 concerne la liste de trace publique** ; elle n'est pas présentée comme un quota absolu d'entrées du `WeakMap`, dont les clés peuvent aussi rester vivantes dans d'autres objets du backend. Ce changement n'établit pas à lui seul une stabilité mémoire de plusieurs heures.

[v6-service-snapshot-reuse.test.ts](../../tests/v6-service-snapshot-reuse.test.ts) vérifie les copies détachées, les mutations refusées, les branches mutables et superficiellement figées, les getters, les objets à état interne mutable, la troncature de trace, les changements de graphe, les anciens tickets, la nouvelle session et l'isolation après transport. [v6-native-snapshot-identity.test.ts](../../tests/v6-native-snapshot-identity.test.ts) conserve le contrat d'autorité courant et la séparation entre les objets du runtime et ceux du service.

## 2. Mesure géométrique

### Sources et changement de représentation

La source de la décomposition V6 est [geometric_observer.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/geometric_observer.py), fonction `components`. [neutral_observer.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/neutral_observer.py), fonction `measure`, consomme ses formes normalisées et ses descripteurs. Le module natif contient également le port V5 de `capabilities/components.py` ; cette correction ne modifie pas `detectV5Components`.

Dans [v6-native-observer.ts](../../src/logos-engine/v6-native-observer.ts), le parcours géométrique utilise maintenant deux listes privées constantes d'offsets, au lieu de reconstruire quatre ou huit paires voisines pour chaque pixel. Les pixels visités sont temporairement conservés par leur indice linéaire ; leurs coordonnées relatives sont reconstruites lors de la fabrication du masque final.

### Invariants conservés

- Parcours des origines dans le même ordre ligne puis colonne.
- Même ordre des voisins en connectivité 4 et 8, même pile LIFO et marquage de `seen` à l'insertion.
- Mêmes tests de bornes et de visite avant les lectures du raster.
- Même ordre des composants et mêmes identifiants `component-N`.
- Mêmes boîtes, aires, masques triés et indicateurs rectangulaires.
- Même PGCD des segments horizontaux et verticaux, puis mêmes formes normalisées.
- Même validation de matrice rectangulaire et même limite de **65 536 pixels**.

Dans ce domaine, l'indice est un entier exact compris entre 0 et 65 535 ; le modulo et la division entière reconstruisent les coordonnées précédemment mémorisées. La couleur d'origine ne subit aucune coercition supplémentaire. Le cas `-0` reste admis par la validation géométrique puis refusé, comme auparavant, par la validation numérique de la signature portable.

Il n'y a **aucun cache de raster, de composant ou de résultat**. Toute nouvelle mesure parcourt les pixels courants. Les signatures génériques, les correspondances, les transitions et leurs règles d'ambiguïté conservent leur contrat.

[v6-native-observer.test.ts](../../tests/v6-native-observer.test.ts) conserve les attentes Python V5/V6, les masques et signatures, le raster maximal, les refus de palette et le getter remplaçant une valeur après validation. Le cas ajouté distingue les diagonales en connectivité 4/8, l'ordre des composants et une colonne étroite.

## 3. Encodage exact des motifs périodiques V5

### Filiation

L'original [frame.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/frame.py), dans `_enumerate_periodic_cell_grids`, encode la palette, attribue un identifiant exact à chaque fragment horizontal distinct, puis assemble les identifiants sur une largeur fixe en octets. `_count_encoded_cell_patterns` compte les fenêtres verticales de ces séquences. Les axes et les réseaux exacts proviennent de `_periodic_axes` et de [tile_lattice.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/tile_lattice.py).

Le port [v6-periodic-cell-grids.ts](../../src/logos-engine/v6-periodic-cell-grids.ts) conservait les règles de sélection, mais matérialisait chaque cellule en tableaux puis en JSON pour chaque paire d'axes. La correction reprend le comptage encodé de la source. Les consommateurs restent [v6-inventory-initial.ts](../../src/logos-engine/v6-inventory-initial.ts) et [v6-configured-arrivals.ts](../../src/logos-engine/v6-configured-arrivals.ts).

### Exactitude et domaine

La palette entière courante est triée et indexée. Les fragments horizontaux sont identifiés dans l'ordre des axes et des origines de colonne. Une chaîne JavaScript utilise ici uniquement des unités de code de 0 à 255 pour représenter les octets. La largeur de chaque identifiant augmente lorsque le nombre de fragments dépasse la capacité d'un octet. L'encodage suit l'ordre little-endian de la source.

Pour une paire d'axes donnée, les cellules ont des dimensions fixes. Deux fenêtres encodées sont égales si et seulement si leurs valeurs de palette sont égales dans le même ordre. Aucun digest avec collision possible ne sert à classer les candidats. Le parcours reste `top`, puis colonne, et conserve l'ordre d'insertion des classes de motifs.

Les comptages alimentent les mêmes critères : répétitions, types distincts, cohérence des séparateurs, priorité des candidats, réglage conditionné par les actions, quantum de translation, borne du nombre de candidats et drapeau de troncature. La projection native reste limitée aux champs de géométrie déjà exposés ; elle ne revendique pas la matérialisation complète des cellules, des cellules tronquées ou de leurs identifiants détaillés Python.

L'accélération accepte des matrices ordinaires, denses, rectangulaires, à valeurs entières de palette publique. L'admission examine les descripteurs sans appeler les accesseurs de pixels. Des propriétés supplémentaires, des sous-classes, des hooks `slice`/`map` ou `toJSON`, des symboles et d'autres formes non ordinaires conduisent au chemin JSON antérieur. Ce repli conserve les appels observables de découpage du contrat existant.

### Mémoire locale et différence avec la source

Les tables d'encodage sont **locales à un appel d'énumération**. Elles ne sont pas persistées et ne sont pas réutilisées sur la seule identité d'un tableau. Une modification des pixels entre deux appels provoque une nouvelle mesure.

La source Python possède par ailleurs des caches bornés : résultats de grilles, axes, motifs encodés et réutilisation positive conditionnelle sur les petits rasters. **Ces caches inter-appels ne sont pas ajoutés par cette correction.** Le transfert concerne l'encodage exact et son comptage. La mémoire locale remplace les tableaux de cellules répétitifs ; elle ne devient ni connaissance acquise ni hypothèse de grille.

### Références de contrat

[export-v6-periodic-pattern-reference.py](../../scripts/export-v6-periodic-pattern-reference.py) charge exclusivement les originaux agent et des matrices de palette contrôlées. Il vérifie les empreintes des fichiers `frame.py`, `tile_lattice.py` et `contracts.py` contre le manifeste, puis les vérifie de nouveau après l'export. Aucun hôte, source, spécification ou solution de jeu n'entre dans cette génération.

La [fixture](../../tests/fixtures/v6-periodic-pattern-reference.json.gz) contient **huit cas**, soit quatre familles de matrices dans les deux modes d'évidence : nombreux fragments, valeurs de palette aux frontières d'octets, mêmes multiensembles avec ordre de cellule différent, et répétitions bordées. Le cas le plus large contient **2 781 fragments horizontaux distincts**, ce qui vérifie le passage à des identifiants sur plusieurs octets.

[v6-periodic-pattern-counts.test.ts](../../tests/v6-periodic-pattern-counts.test.ts) compare exactement la projection de sortie à ces attentes Python, vérifie à nouveau les empreintes, change des pixels entre deux mesures et couvre les hooks de découpage, les accesseurs stables et les sous-classes de lignes. Les détails Python volontairement omis de la projection native sont retirés explicitement par l'exporteur ; ils ne sont pas assimilés à des champs transférés.

## 4. État métier et critère de clôture

Ces changements conservent les producteurs et consommateurs existants. Ils ne modifient pas les propriétaires des événements, l'ordre d'acquisition, les checkpoints, les choix de commande ou les règles de reprise. La réutilisation du service concerne la représentation d'un diagnostic déjà figé ; l'encodage périodique concerne une mesure locale actuelle ; le parcours géométrique ne conserve aucun résultat entre appels.

Les gardes, les refus, WHY/ACT, les tickets et les transitions officielles restent nécessaires. Aucun nom de jeu, numéro de niveau, rôle de couleur fixé ou parcours préparé n'entre dans les décisions de production.

La clôture du coût demande une comparaison sur les critères annoncés, avec les mêmes retours publics, des sources gelées et le seuil conservé. Le [bilan historique 0.37](lot3a-evidence/performance/results.md), y compris ses quatre dépassements, reste conservé. Cette filiation ne remplace ni cette mesure officielle, ni les preuves de non-régression, et ne transforme pas la migration partielle V5/V6 en parité générale.
