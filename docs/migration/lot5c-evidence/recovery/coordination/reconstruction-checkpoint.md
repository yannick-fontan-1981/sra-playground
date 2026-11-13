# Lot 5C : reprise après remplacement de l’environnement

Le checkout est ouvert par Sites depuis la version publiée 95, commit `3a70463039768f7114edae7d94d7dd33b7f36aa8`. Les anciens fichiers 5C et le journal CGWL n’ont pas été récupérés. Les nouveaux fichiers sont une reconstruction depuis les sources originales, et non une restauration à l’octet près.

## État au point de reprise

- Les huit modules de liaison d’objets sont présents. Le runtime commun, le contrat de record et l’audit d’entrées sont raccordés.
- Premier contrôle de types : passé. Les validations de parité et d’extensions sont en cours ; elles doivent être terminées avant le gel final.
- Les anciens compteurs de tests 5C ne sont pas utilisés comme preuves. Les reçus neufs sont sous `recovery/`.
- L’oracle indépendant nouveau vérifie les 1 786 fichiers originaux avant/après ; toutes les sources restent immuables.
- Le premier passage natif a révélé le contrat reset/extras de Python et un défaut de projection tuple/liste de quatre stimuli helper ; les tentatives et corrections restent distinctes.
- Aucune nouvelle session réelle de jeu n’est lancée. CGWL conserve un plancher historique de 1 177,604336 secondes consommées ; WEAV reste épuisé à 2 401,227841 secondes. Les reçus historiques manquants ne sont pas recréés.
- Les huit outils de coût sont reconstruits, mais aucune capture fonctionnelle ni mesure officielle n’est encore validée.
- La version native cible réservée est 0.63.0. L’ordre de publication coordonné est 6A, suivi du complément 7, de 10B, puis de 5C. Chaque intégration exigera sa publication effective.

## Validation restante

Terminer les tests ciblés et les sept scénarios de boucle commune ; vérifier les comparaisons originales ; préserver un checkpoint Git ; intégrer les prédécesseurs réellement publiés ; déclarer et exécuter les tests/rejeux/QA sur le gel final ; qualifier les formes STCK/SMLP ; mesurer A1/B1/B2/A2 ; revoir les calculs puis publier en privé.

Le critère de coût est la médiane groupée du temps de session complet, strictement sous +10 % pour chaque jeu. Un dépassement de phase reste un diagnostic visible, sans bloquer à lui seul un global conforme.
