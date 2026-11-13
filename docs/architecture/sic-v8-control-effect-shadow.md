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

Le résultat de la garde V6 et le changement mesuré sont affichés séparément. Le clic de STCK niveau 1 à (4, 50) change la couleur d’une région de 40 pixels à forme et position identiques. Le rôle de cette région et la répétabilité de l’effet restent à établir. Le reçu décrit la commande passée et n’identifie pas le sujet d’une commande future. La matrice garde ces inconnues jusqu’à l’arrivée de preuves causales et d’identité adaptées.

Le résumé natif est construit après la décision, hors de la mesure du temps actif. L’affichage est différé au prochain rendu du navigateur après la fin d’une opération. Les tests couvrent la matrice, la révision, la portée, le fallback, l’ambiguïté, les retours natifs et la parité du transport V6 jusqu’à un retour terminal.
