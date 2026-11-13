# Diagnostic borné de l'observateur public

Ce protocole est écrit avant la mesure. Il examine un coût structurel déjà présent dans V63 ; il n'attribue pas à ce mécanisme toute la différence historique V62/V63.

## Entrées et proposition

Le diagnostic lit uniquement la trace publique STCK déjà archivée, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b`, et sélectionne les observations reçues **après les actions 5, 6, 7 et 8**. Aucun moteur, état privé, spécification ou oracle de jeu n'est lu.

`measureNativeObservation` construit actuellement la signature de chaque composant en appelant `v6Digest`, donc le canonicaliseur JSON générique, sur quatre champs internes : aire, masque normalisé, palette et échelle. `geometricComponents` construit ces valeurs après `validateRows` ; ce sont des entiers bornés et des tableaux ne contenant que des paires d'entiers. Le candidat du diagnostic sérialise ces quatre clés ASCII dans l'ordre canonique exact : `area`, `normalized_mask`, `palette_value`, `scale`. Le SHA-256, l'assemblage des entités, leurs identités, leurs ambiguïtés et le reste de l'observation restent identiques.

Le candidat demeure dans `scripts/profile-native-observer-costs.mjs`. Aucun code de production ni API publique de canonicalisation n'est modifié par ce diagnostic. Avant la mesure, le script vérifie que le fichier observateur est toujours octet pour octet celui du commit V63 `1193377f1d574451740a7409a4102833ef868310`.

La palette conserve explicitement `assertPortableNumber` : `validateRows` accepte le zéro négatif JavaScript, mais l'ancienne canonicalisation le refuse. Le candidat doit conserver ce refus. Aire, échelle et coordonnées normalisées sont des entiers non négatifs construits par l'algorithme. Les rejets de palette −0, 256, NaN et de raster irrégulier sont comparés hors chronométrage.

## Vérification et mesure

Les quatre observations publiques, puis tous les cas du fichier de référence original `tests/fixtures/v6-observer-reference.json`, doivent produire exactement les mêmes octets de description, signatures et observations. Les cas de référence doivent aussi conserver leurs sorties attendues. Ces vérifications précèdent la fenêtre chronométrée.

Une seule exécution est prévue. Pour chacun des quatre paquets :

- Trois tours d'échauffement de chaque méthode.
- Vingt tours mesurés de chaque méthode ; l'ordre des méthodes est inversé un tour sur deux.
- Méthodes : composantes géométriques ; sérialisation générique ; sérialisation fermée ; signatures génériques ; signatures fermées ; observation complète de production ; observation complète candidate.
- Vérification des sorties après les intervalles chronométrés, à chaque tour.

Les méthodes de signature isolées reçoivent les composantes courantes déjà calculées ; les deux observations complètes recalculent la géométrie à chaque appel. Les médianes et extrêmes sont conservés. Aucun seuil de livraison, intervalle de confiance ou gain général de service n'est déduit de ces composantes chaudes. Les autres travaux lourds du projet sont suspendus pendant cette courte fenêtre ; l'hôte partagé reste non isolé.

Le reçu conserve les dates, l'environnement, chaque mesure et les empreintes du script, de ce protocole et des entrées exécutables avant/après. Il est écrit une seule fois, en gzip vérifié sans perte. Aucun second essai n'est choisi pour améliorer un résultat.

## Décision après diagnostic

Si le gain est significatif et toutes les égalités passent, proposer un helper privé limité aux composantes fraîchement construites. Préserver `v6Canonical`, `v6Digest`, les validations de raster et de révision. La modification de production exigera ensuite les contrats de l'observateur, la validation du chemin commun et les mesures de budget inchangées.
