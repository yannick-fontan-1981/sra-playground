# Départager des lectures d’une même action

Sur les 2 985 transitions publiques des 100 sources, 410 commandes archivées permettent au moins une lecture morphologique déjà acquise. Pour 314 d’entre elles, dans 26 jeux, plusieurs lectures annoncent des arrivées concurrentes pour la même commande. Chaque prévision est émise à partir de l'image et de la mémoire disponibles avant la commande. Les états sont chronologiques et peuvent se répéter. L'effet mesuré est une arrivée géométrique de la forme annoncée.

| Critère de sélection | Réalisées | Contredites | Indéterminées | Frontière de niveau |
|---|---:|---:|---:|---:|
| Priorité du candidat v22 | 15 | 259 | 27 | 13 |
| Fiabilité des prévisions antérieures, puis sélectivité à l’action | 67 | 215 | 19 | 13 |
| Priorité supplémentaire aux sujets déjà vus en mouvement en l’absence de la marque | 68 | 215 | 18 | 13 |

La comparaison porte sur les interprétations de la commande réellement exécutée. Elle ne mesure pas l’intérêt de choisir cette commande. La deuxième ligne augmente le nombre d’arrivées correctement désignées dans quatorze jeux et le diminue dans MIND. Dans les 29 situations concurrentes des niveaux supérieurs, elle passe de cinq à sept. Pour KEYD, elle passe de zéro à une sur 35. Pour GABA, de zéro à douze sur 38. [Résultats par jeu](./sic-preview-competition-source.json)

La modification retenue compare les lectures concurrentes de la même action. Une prévision acquiert une confirmation ou une contradiction chaque fois qu’une nouvelle situation publique permet de contrôler son sujet, y compris quand une autre hypothèse a motivé le geste. Les observations recueillies avec une commande différente servent à estimer la fréquence des coïncidences. Le taux lissé est `(confirmations + 1) / (observations interprétables + 2)`. À fiabilité égale, une hypothèse qui discrimine les commandes est prioritaire. Un résultat non mesurable est exclu. Le choix entre deux commandes différentes reste un problème distinct.

Le vote est local à la campagne. La première acquisition sur une image reste immédiatement disponible. Le protocole utilisé pour choisir le critère est reproductible avec le dernier argument `competition` du script d’étude, à la révision de cette étude. Les données d’évaluation Custom 4 sont exclues de ses entrées.
