# Première tranche SIC V8 en shadow

Cette tranche part de `main` au commit `dbf3c956` avec le moteur natif 0.68. Elle met en œuvre le besoin `know_control_effect` défini dans la [spécification SIC V8](https://github.com/yannick-fontan-1981/sra-playground/blob/b23381aaddc65e152be68315fdecf662f74f34d0/docs/architecture/v8-human-configurable-intelligence.md).

| Cadre prouvé | Méthode proposée |
|---|---|
| Clic sur une commande identifiée | Comparer l’état avant et après le clic |
| Commande directionnelle sur un sujet identifiable | Suivre le même sujet après la commande |
| Transformation après sélection établie | Suivre le sujet sélectionné pendant la transformation |
| Expériences exclues et observation passive démontrée | Chercher la preuve dans un retour ordinaire |

Une expérience exige une commande disponible, un sujet observable, un effet isolable, un risque borné et l’absence d’une autre expérience en attente. Une contre-indication établie exclut la branche. Une inconnue conserve la branche en attente et suspend le fallback. Deux méthodes prouvées sans règle de départage restent ambiguës. L’identité du besoin dépend de la session, du niveau, de la commande et du sujet. Une nouvelle révision dans la même portée produit une nouvelle évaluation.

Le panneau lit la dernière observation stabilisée et les retours V6 qui correspondent à la session, au niveau et à la séquence. Il montre les commandes visibles, l’action déjà retenue par V6 quand elle est disponible et le dernier retour vérifié. La disponibilité d’une action et le résultat d’une garde V6 fournissent des faits distincts. La production d’une preuve typée sur l’identité du sujet, le modèle de contrôle et l’attribution causale reste à raccorder. Les trois méthodes sont donc qualifiées par des cadres de test, tandis que la vue live expose les preuves manquantes.

Le calcul est différé au prochain rendu du navigateur, après la fin d’une opération. Le panneau ne demande aucun calcul au worker et ne produit aucune action. Les tests couvrent la matrice, la révision, la portée, le fallback, l’ambiguïté et la parité du transport V6 jusqu’à un retour terminal.
