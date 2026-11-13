# Première tranche SIC V8 en shadow

Cette tranche part de `main` au commit `dbf3c956` avec le moteur natif 0.68. Elle met en œuvre le besoin `know_control_effect` défini dans la [spécification SIC V8](https://github.com/yannick-fontan-1981/sra-playground/blob/b23381aaddc65e152be68315fdecf662f74f34d0/docs/architecture/v8-human-configurable-intelligence.md).

| Cadre prouvé | Méthode proposée |
|---|---|
| Clic sur une commande identifiée | Comparer l’état avant et après le clic |
| Commande directionnelle sur un sujet identifiable | Suivre le même sujet après la commande |
| Transformation après sélection établie | Suivre le sujet sélectionné pendant la transformation |
| Expériences exclues et observation passive démontrée | Chercher la preuve dans un retour ordinaire |

Une expérience exige une commande disponible, un sujet observable, un effet isolable, un risque borné et l’absence d’une autre expérience en attente. Une contre-indication établie exclut la branche. Une inconnue conserve la branche en attente et suspend le fallback. Deux méthodes prouvées sans règle de départage restent ambiguës. L’identité du besoin dépend de la session, du niveau, de la commande et du sujet. Une nouvelle révision dans la même portée produit une nouvelle évaluation.

Le panneau lit la dernière observation stabilisée et les retours V6 qui correspondent à la session, au niveau et à la séquence. Pour un clic exécuté, V6 transmet les références avant et après, le point adressé et un résumé du changement sur le masque de la région mesurée. SIC vérifie ces références avec le retour natif avant de l’afficher. Il distingue un changement de couleur à forme et position identiques, un changement de pixels sur la région et une frontière de niveau. Un retour sans changement visible laisse ouverts les effets différés ou masqués.

Le résultat de la garde V6 et le changement mesuré sont affichés séparément. Le reçu décrit une commande passée. La matrice conserve ses inconnues sur la commande suivante jusqu’à l’arrivée de preuves causales et d’identité adaptées.

## Comparaison des retours dans une session

Le panneau compare jusqu’aux 32 derniers clics de la session. Il groupe les régions selon leur forme à l’échelle mesurée, leur couleur initiale et le point du clic relatif à la région. Il affiche les niveaux, les observations répétées, les écarts et les changements dont le résultat reste indéterminé. Les retours aux frontières et les clics sans région identifiée sont comptés séparément. La comparaison décrit la région cliquée sur le plateau final. Les changements ailleurs, les effets transitoires et le rôle de la région restent hors de cette mesure.

Sur STCK, les trois premiers niveaux ont été résolus en 35 actions. Pour une région de 37 pixels et un clic au point relatif (4, 2), la région garde les mêmes pixels dans 8 retours avec la couleur initiale 8, 5 retours avec la couleur 9 et 3 retours avec la couleur 10. Pour une région de 40 pixels, de couleur initiale 10 et cliquée au point relatif (3, 2), le retour du niveau 1 montre une recoloration vers 9 à forme et position identiques. Trois retours du niveau 3 changent les pixels sans correspondance exacte de la région. Les conditions visibles de ce groupe ne suffisent donc pas à prédire la recoloration.

L’onglet **Perceptions** liste les retours avant/après, avec un filtre par niveau. L’onglet **Information** regroupe les retours comparables et affiche les résultats par niveau. Chaque résultat ouvre un retour correspondant dans Perceptions. La variation entre les niveaux 1 et 3 est affichée en tête de la comparaison STCK. Les onglets sont utilisables à la souris et au clavier avec les flèches, Début et Fin.

Les prochaines perspectives, **Stratégies**, **Objectifs** et **Plans d’actions**, pourront utiliser la même navigation quand leurs données en lecture seule seront disponibles.

Le résumé natif est construit après la décision, hors de la mesure du temps actif. L’affichage est différé au prochain rendu du navigateur après la fin d’une opération. Les tests couvrent la matrice, la révision, la portée, le fallback, l’ambiguïté, les retours natifs et la parité du transport V6 jusqu’à un retour terminal.
