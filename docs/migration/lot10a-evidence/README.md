# Lot 10A : index des preuves AxialQuestion

Le [bilan](../lot10a-axial-question.md), la
[filiation source](../lot10a-axial-question-lineage.md) et la
[feuille de route](../v6-delivery-roadmap.md) délimitent le transfert.
La référence reste le commit V6
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

## Composant et boucle commune

| Preuve | Résultat et portée |
| --- | --- |
| [Comparaisons de référence](diagnostic/axial-reference-validation.json) | 130/130 tests : 68 cas de famille, 38 de géométrie/V5, 16 de politique/SRC et huit contrats natifs. Les 1 786 fichiers originaux sont vérifiés avant/après l'oracle. |
| [Dernier journal de référence](diagnostic/axial-reference-04.tap) | Les essais antérieurs restent conservés, notamment l'écart réel de zéro négatif corrigé. |
| [Boucle commune](diagnostic/kernel-03.log) | 6/6 scénarios synthétiques : sélection passive froide, action Axial autorisée, acquisition unique, décision influencée, tentatives, frontières et restauration. |
| [Revue source](independent-source-review.md) | Relecture de la famille, de la politique et du raccordement par un agent distinct ; la géométrie est relue par son auteur. Aucun nouveau défaut bloquant identifié dans le domaine annoncé. |
| [Admission publique initiale](diagnostic/initial-public-admission.json) | 95 images initiales archivées ; POLA est seul admis par la mesure. Aucune action de jeu. |
| [Budget POLA](diagnostic/pola-case-budget-review.json) | Essai historique de 94 actions, zéro niveau, temps inconnu. Aucune nouvelle horloge créée ; contribution en nouvelle partie ouverte. |

Les références proviennent du Python original inchangé, exécuté sur des rasters
contrôlés. Le chemin source `recordSource` et l'adaptation native de frontière
`recordObserved` restent distincts. Une rotation projetée n'est ni une loi
physique acquise ni une réussite officielle.

## Première validation isolée

Le [gel natif](isolated-functional/source-manifest.json)
`cabd056f2fddded1c5f7bcc214bd1fd1ac387764b61cddf42606debe72f37915`
contient 282 fichiers natifs ; son archive contient 293 fichiers. Il ajoute Axial
à la base publiée Site 83 / `bed48116585da864dd5c412ed11dd6990a950e8e`.
La chaîne native porte encore l'étiquette provisoire 0.52.0 ; le digest distingue
ce candidat du moteur 0.52 publié. Cette branche n'est pas encore intégrée aux
publications suivantes.

| Contrôle | État conservé |
| --- | --- |
| [Suite de 31 fichiers](isolated-functional/validation/delta-tests-run.json) | 866/867 tests réussis. Le reçu reste en échec ; aucun résultat n'est remplacé. |
| [Résolution du test Recolor](diagnostic/isolated-test-order-resolution.json) | Une attente d'adjacence était obsolète : Axial vient après Recolor selon le DRM. Correction du test uniquement, puis reprise de ses trois tests : 3/3. Source native inchangée. |
| [Cinq contrôles du projet](isolated-functional/validation/checks-run.json) | 5/5 : typage, audit réel des entrées, audit de migration sans défaillance sémantique, diff et build. |
| [Sept rejeux archivés](isolated-functional/regressions/regression-summary.json) | 7/7 cas et 119/119 comparaisons : 292 commandes, 210 préfixes, 299 paquets publics complets, 1 405 images d'animation, 502 requêtes et 21 frontières naturelles conservés. |
| [Transport exact des rapports](isolated-functional/evidence-byte-transport.json) | Les sept rapports sont fractionnés sans perte, avec les originaux conservés localement. Aucun résultat n'est régénéré par ce transport. |

Les [journaux de validation](isolated-functional/validation/log-transport.json)
conservent leurs octets exacts en gzip, y compris les espaces produits par les
outils et la sortie du test en échec. Trois originaux sont exclus de Git pour
éviter de modifier ces sorties au contrôle de whitespace. Leur décompression
aux chemins `raw` du reçu restitue exactement les empreintes déclarées.

Les contrôles isolés ne remplacent pas la future validation du candidat après
intégration des prédécesseurs effectivement publiés. Le test corrigé sera inclus
dans ce périmètre final. Aucun coût, succès de jeu ou déploiement supplémentaire
n'est déduit de ce gel.

## Intégration intermédiaire du lot 5A publié

Le commit `fff552b4222b001b4fa6da013accb70ed539e301` fusionne le vrai
Site 84 / `51e2813dedb2d71001290f94f100605e0327ead3` avec Axial.
Les [audits intermédiaires](diagnostic/post5a-inventory-run.json) trouvent
58/76 entrées et aucune défaillance sémantique. Les
[six scénarios Axial](diagnostic/post5a-kernel-run.json) passent aussi sur le
cœur optimisé 5A, avec leurs entrées inchangées pendant l’exécution. Ce diagnostic
ne remplace pas le futur gel après les publications de 4B et 7B.

La [recherche locale des méthodes](history-lookup-source-review.md) a ensuite
été simplifiée pour éviter les copies répétées de l’historique par relation.
La [reprise des deux fichiers Axial](diagnostic/history-lookup-validation.json)
passe **136/136**, avec les mêmes attentes Python et des entrées inchangées.
Cette réduction d’allocations ne constitue pas une mesure de durée.

## Intégration intermédiaire du lot 4B publié

Le [Site 86 effectivement publié](coordination/published-4b-site86.json), commit
`082ce553ce4dfbac37071a64497bcca129b7ced0`, est fusionné avec Axial. La
[réconciliation native](coordination/published-4b-site86-reconciliation.json)
conserve ses autres entrées et limite le diff natif à Axial et son raccordement.
Les [audits réels](diagnostic/post4b-inventory-run.json) passent : **59/76 entrées**,
181 composants vérifiés, 146 transferts partiels, 1 042 en attente, aucun échec
de mapping. Ce point intermédiaire ne constitue pas la validation finale 10A ;
la publication de 7B doit encore être intégrée.

## Candidat composé avant publication 7B

Le candidat de validation **0.56.0** est composé avec le gel préparé **7B / 0.55.0**, commit `28f3f388e18bad21a186795f965102a83e6b53d7`, digest `ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b`. Ce prédécesseur n'est pas encore publié. La [déclaration de source préparée](coordination/prepared-7b-source-observation.json) identifie ses octets ; la réutilisation finale des contrôles exige une fusion de la publication réelle et une comparaison exacte de toutes les entrées natives, source/tests, build et d'exécution. Aucun coût 10A n'est déclaré ou mesuré sur ce seul état préparé.

## Préparation des contrôles finaux

- [Périmètre fonctionnel et rejeux](validation-and-regression-plan.md),
  [revue des runners](validation-runner-source-review.md),
  [checklist des prédécesseurs préparés](upcoming-predecessor-merge-review.md).
- [Commandes de coût](README-commands.md),
  [préparation des déclarations](README-preparation.md).
- [Finalisation de la readiness](README-readiness.md),
  [revue indépendante du lecteur](readiness-source-review.md). Sa préparation
  et sa revue textuelle ne constituent pas une readiness exécutée. Le
  [contrôle AST et aide CLI](diagnostic/readiness-helper-validation.json) passe
  sur les octets inchangés ; il n’exécute pas la finalisation sur les preuves.
- [Revue des analyseurs de coût](cost-tool-source-review.md),
  [revue des finaliseurs](cost-preparation-source-review.md),
  [contrôle syntaxique borné](diagnostic/cost-preparation-syntax.json).

Les captures fonctionnelles doivent qualifier l'ajout du seul propriétaire
Axial sur la référence intégrée réelle avant la mesure. La fenêtre officielle
conserve A1/B1/B2/A2, 32 sessions mesurées et 400 actions. Chaque jeu doit rester
strictement sous +10 % de médiane complète ; aucun temps de propriétaire n'est
soustrait. Le refus du comparateur historique et l'analyse complémentaire restent
des résultats distincts. La présence des outils ne vaut pas qualification,
readiness, mesure ni acceptation.

La croissance de l'historique propre à Axial n'a pas de borne de coût démontrée.
Les tests synthétiques et les petits rejeux de coût ne remplacent pas cette
caractérisation. La parité de l'appelant Python complet reste également ouverte.
