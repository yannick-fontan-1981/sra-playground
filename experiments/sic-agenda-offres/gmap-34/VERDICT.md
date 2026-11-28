# GMAP/34, qualification locale du gel

Préenregistrement `d9097a5b`, harnais testé `9c71cd820b59ef3456455b637a0a062abe1d03d0`. Les six préfixes natifs, le contraste public et 152 tests passent. Le catalogue `8ce7ee35` et le gel `d0e7527c` concordent sur 16 gestes. 4 min 54 s jusqu'au reçu. La passe agrégée a réussi au premier lancement. La suite de tests a été relancée après inclusion du générateur de corpus dans le checkout clairsemé.

| Point du parcours | Preuve et décision |
| --- | --- |
| N1/T1, `public_chart_navigation / chart_navigation / ACTION4` | Six nœuds au pas 6. L'ancre (23,28) est indiquée par quatre coins de valeur 0 et un centre 0, sur un bord 3. Son annotation 11 désigne le but homologue (41,28). L'arête du milieu porte 10 et reste bloquée sans preuve. Une seule offre admissible vise l'occurrence (29,22) d'annotation 10, via (29,28) puis (29,22). Le premier pas vers l'est est lié au ticket `OP18` par la garde du trajet courant. |
| Retour T1 et T2 | La scène change, l'inventaire reste vide et le score reste 0. Sous le modèle, seule (29,28) demeure comme hypothèse d'arrivée. Cette position et les références du retour alimentent la reprise au nord par ACTION1. T2 montre le gain de la valeur 10 associée à (29,22). |
| T3 à T5 | Le gain permet le trajet vers (41,28). Après ACTION2, la valeur 10 manque, et la disparition d'un bord permet une hypothèse d'accès locale sur (29,28) → (35,28). T4 emploie cette preuve puis laisse deux localisations compatibles sur retour de scène identique. Les deux trajets commencent à l'est, d'où ACTION4 à T5 et un niveau terminé officiellement. |
| Contre-épreuves sur le jeu | Retirer les quatre coins du seul producteur supprime la carte admise à T1. Sous un retour stationnaire construit, rester et arriver subsistent, aucun gain. Dans le vrai paquet de T2, maintenir ces deux positions fait abstenir la famille. La commande ACTION1 reste possible au titre de la frontière. Retirer la seule permission à T4 garde la carte et l'inventaire vides, suspend le trajet et donne ACTION3 de frontière. |
| Second contexte | N2 reconstruit son ancre et vise (32,19) en quatre pas, après remise à zéro de la position. Le corpus public indépendant réfute une arrivée sur une ancre contraire, et un inventaire vide bloque la suite avec la même scène et la même position. |

`ChartNavigation` consomme déjà les nœuds et arêtes mesurés, les trajets de `routeChart`, les retours et les hypothèses d'accès avant l'étape suivante. La livraison apporte des substitutions et des contrôles sur le gel. Sur POLA, ACTION4 teste une orientation. Ici, il teste l'application du premier pas d'un graphe, avec une arrivée conditionnelle. Tous deux utilisent le ticket natif, son autorisation et le retour scellé. Aucun fichier de production modifié.

[Commande de rejeu](README.md). Reçu local `artifacts/qualification-gmap-34/9c71cd82.json`, SHA-256 `a64a76314e14f54e77c984188abe1baf4b360cec761524c2202fd32a501c233f`.
