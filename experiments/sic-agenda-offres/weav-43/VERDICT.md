# WEAV/43, qualification locale du gel

Préenregistrement `67012fdd`, harnais vérifié `fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a`. Six préfixes natifs et 137 tests passent. Catalogue `8ce7ee35` et gel `d0e7527c` identiques sur 16 gestes attribués à cette entrée, zéro niveau terminé sous ce plafond. 14 min 01 s jusqu'au reçu. La passe agrégée a été relancée après correction d'une assertion sur l'absence du champ de plan dans le repli. Les décisions n'ont pas changé.

| Moment | Besoin et preuve |
| --- | --- |
| N1/T1 `public_occurrence_recall / coupled_prefix_reference / ACTION6(15,20)` | La miniature 3 × 3 est mesurée en (57,53) au pas de 2 px. Six contrôleurs. Le premier désaccord de couleurs entre les axes désigne la cellule (0,0) et le contrôleur de la première ligne à gauche, de valeur 14. Le ticket tente de sélectionner ce contrôleur. Le retour a le même raster, `matched:null`. Le moteur conserve une hypothèse de sélection, et aucun pas ni paire ne sont acquis. |
| N1/T2 ACTION1 et T3 | La cellule (0,0) passe de 0 à 14. Le retour acquiert le premier pas horizontal, la commande ACTION1 pour l'axe et la question rattachée à ce retour sur le contrôleur vertical en (20,15). T3 émet le clic de cette nouvelle question. |
| N1/T4–T5 | La commande verticale ACTION2 laisse le raster stationnaire. Le refus reste local à ce contrôleur, à cet indice et au croisement d'ACTION1. ACTION3 au T5 satisfait la propriété de la première intersection. La paire ACTION1/ACTION3 avec propriétaire d'axe 0 et valeur 14 est observée. |
| N1/T6–T7 | Le moteur resélectionne la première ligne, puis reprend à l'indice 1, en (1,0). La paire acquise et ses deux références sont consommées dans l'offre ACTION1. Sans la paire, sur la même vue avec les entrées déjà connues sur chaque axe, aucun plan croisé ne sort. Le moteur se replie sur ACTION6(28,61) d'objectif d'information. |
| Contre-épreuves | Retour stationnaire T1, même hypothèse et même essai au tour suivant. Retour construit stationnaire après le vrai T2, aucun pas et la même cellule est essayée par ACTION2. Retrait du seul pas appris à l'entrée du T3, le service repropose ACTION1 sur (0,0) au lieu de sélectionner le prochain contrôleur. Une référence altérée est refusée, y compris dans un contrôle isolé où l'empreinte de raster correspond déjà au raster modifié. |

Le titre du catalogue décrit la séquence à partir de la reprise. Le premier ticket est une sélection sous hypothèse. Le gel relie déjà la preuve locale d'apport, la mesure du croisement et la reprise du préfixe. Une paire apprise porte sur le croisement observé et sa réutilisation reste expérimentale. Aucun fichier de production modifié.

[Commande de rejeu](README.md). Reçu local `artifacts/qualification-weav-43/fab19fba.json`, SHA-256 `7689d18e0b7971bbf0b2418753ce1917f020ac45f0617297b772daa1f7de1d87`.
