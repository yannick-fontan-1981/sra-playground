# RSWP/55, qualification locale du gel

Préenregistrement `47ef461c`, harnais vérifié `f3051af812f4f7f74f0179a804a87753bffa5910`. Sept préfixes et 59 tests passent. Les 16 tickets du catalogue `8ce7ee35` et du gel `d0e7527c` concordent. 10 min 47 s du préenregistrement au reçu. Première passe agrégée réussie.

| Moment | Preuve et décision |
| --- | --- |
| N1/T1 `public_occurrence_recall / observed_composition_services / panel_service` | Le matériau 13 du panneau supérieur correspond à l'entrée 13 du récepteur en (28,16). Le motif lie ce site au contrôle (45,12). ACTION6 confirme la sélection de la ligne 0. Le retour change 32 pixels du panneau et aucun dans les trois zones de jeu. |
| T1 stationnaire construit et geste global 4 | Le retour construit contredit la sélection. La configuration est refusée dans ce contexte et le blocage est respecté. Sur le vrai parcours, retirer seulement `selection_observed` au geste 4 conserve le premier clic (45,17) et ramène le paquet de trois gestes à un seul. |
| N2, geste global 7 puis 8 | ACTION5 applique les trois configurations de réécriture sans changement de niveau ni de score. Les matériaux affichés passent de [15,12,13] à [12,13,15]. Chacune des zones change de 21 pixels. La nouvelle vue fait remesurer les trois correspondances locales et sélectionner les récepteurs au geste 8. Supprimer le seul journal `effects` conserve ce calcul et le même ticket. Retirer la pièce de valeur 12 en [28,20,30,22] du seul producteur, avec le panneau et les deux autres zones intacts, rend la correspondance supérieure indéterminée. Refus bloquant et aucun ticket de repli. |
| N3, geste global 15 puis 16 | ACTION5 applique la préparation de réceptions distantes. Les trois matériaux affichés restent [13,15,12]. Les zones changent chacune de 21 pixels. La remesure passe de la préparation distante à la réception locale. Retirer la pièce de valeur 13 en [28,53,30,55] suffit à bloquer le nouveau choix, même panneau et mêmes matériaux affichés. |

La ligne est étayée par la relation de zone remesurée sur le retour et consommée dans le choix suivant. Le geste de configuration T1 confirme la sélection du panneau. Les gestes d'application sont scellés et leur retour officiel peut être distinct de l'acquisition de géométrie locale. L'ablation du journal confirme que cette reprise vient de la nouvelle vue. Aucun fichier de production modifié.

[Commande de rejeu](README.md). Reçu `artifacts/qualification-rswp-55/f3051af8.json`, SHA-256 `d7b9414b6a4e9f7ce5094b95fe424aa654869d6a6427511db265ac0a04a4bdff`.
