# Qualification distincte de l’ajout du propriétaire Feedback

Déclarée le **10 novembre 2026 à 19:43 UTC**, après la fenêtre de mesure et son échec de consolidation stricte, mais avant les captures de graphes et le calcul groupé qualifié. Ce document complète le diagnostic ; il ne modifie ni la déclaration préalable, ni les quatre rapports bruts, ni un comparateur officiel.

## Échec strict conservé

Les quatre séries A1/B1/B2/A2 sont terminées, avec 32 sessions et 400 actions mesurées. Les deux comparateurs officiels par cohorte conservent leurs résultats. L’agrégateur officiel échoue à `Within-cohort work metadata changed` et ne produit aucun `combined-comparison.json`. Son échec, le journal intégral reproduit et les empreintes des entrées sont conservés dans `aggregation-failure-reproduced.json` et `.log`.

La première lecture exhaustive des métadonnées identifie trois nœuds supplémentaires dans le candidat et une différence de révision finale de **trois installations plus une révision par préfixe scellé**. Les identités attendues, tirées du contrat de `NativeV6Runtime.initialize`, `attachPrograms` et `persistFamilies`, sont `family_state:feedback_sequences`, `family_activation:feedback_sequences` et `program:v6.feedback_sequences.choose`. Cette lecture n’est pas encore une observation des graphes : la capture ci-dessous doit la confirmer.

Supprimer ces nœuds de production supprimerait l’état propre, son contrôle ou le programme. Aucune modification native n’est prévue pour égaliser les compteurs.

## Preuve structurelle supplémentaire, non chronométrée

Un diagnostic séparé exécute le vrai runtime et le service commun, depuis une mémoire froide, dans chaque checkout gelé. Pour chacun des deux jeux, il couvre la chauffe de trois actions et la forme mesurée complète, STCK10 ou SMLP15, avec les mêmes plafonds et le même ordre de requêtes. Les commandes sont calculées avant réception du retour public et vérifiées contre la trace déclarée. Aucun secret de jeu, état appris ou solution ne sert à initialiser le moteur.

À chaque `init`, `advance` et `resume`, conserver les nœuds réels, leurs identifiants, les deltas et révisions, l’état éventuel Feedback, ainsi que les métadonnées de la requête. Le diagnostic ne mesure aucun temps de coût et n’ajoute aucune session à la fenêtre. Ses échecs éventuels restent séparés et conservés.

La comparaison exige exactement les trois identifiants supplémentaires annoncés, aucun identifiant supprimé, et attribue chaque delta supplémentaire à ces installations ou à la provenance du propriétaire Feedback lors d’un préfixe scellé. Les comptes et positions doivent rejoindre toutes les formes stables des rapports bruts. Les autres métadonnées complètes de `workSignature` doivent être exactement égales : phases, requêtes, observations hors compte structurel, Pause, commandes/effets déjà contrôlés par le harnais, actions, acquisitions, préfixes et niveaux. Toute autre différence bloque cette qualification.

Il n’est pas permis d’ignorer un sous-arbre arbitraire, de normaliser un champ par son seul nom ou d’ajouter une tolérance numérique. Les graphes restent différents ; aucune identité binaire ni égalité intégrale de leurs valeurs privées n’est revendiquée.

## Calcul qualifié et décision séparée

Si la preuve structurelle passe, un nouvel agrégat de **schéma explicitement qualifié** peut reprendre les fonctions arithmétiques exportées par le comparateur officiel inchangé. Il doit reproduire exactement les deux comparaisons originales avant de grouper les huit sessions par jeu/version. Toutes les durées restent inchangées, y compris le coût de création, conservation et traitement des trois nœuds supplémentaires. Aucun temps n’est soustrait ou corrigé.

Une revue Python indépendante recalcule les distributions, médianes, p95 autorisés, dispersions et classifications de phase depuis les quatre rapports bruts. Elle vérifie aussi les sources gelées, les outils inchangés, le journal de sessions, l’ordre exclusif, les empreintes, les chauffes exclues à l’avance et la preuve structurelle. La règle numérique reste celle annoncée avant mesure : hausse de médiane de session complète **strictement inférieure à 10 % séparément pour STCK et SMLP**, sans compensation, exclusion supplémentaire ni choix de cohorte.

Le verdict porte le statut **qualifié par l’ajout du propriétaire**. Il ne remplace pas l’échec strict, ne produit pas un faux agrégat officiel, ne positionne pas `workMetadataExactAcrossAllSessions` à vrai et ne prétend pas que le protocole de consolidation stricte a passé. Il permet seulement d’évaluer le coût total de l’extension, à travail public et positions de phases conservés, avec ce delta structurel démontré. Une valeur globale défavorable demeure un refus de coût ; les dépassements de phase restent visibles sous la règle globale autorisée.
