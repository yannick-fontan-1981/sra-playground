# Lot 10A : index des preuves AxialQuestion

Le [bilan](../lot10a-axial-question.md), la
[filiation source](../lot10a-axial-question-lineage.md) et la
[feuille de route](../v6-delivery-roadmap.md) délimitent le transfert.
La référence reste le commit V6
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

La validation du candidat intégré **0.56.0** passe **1 538/1 538 tests sur
45 fichiers**, **5/5 contrôles du projet** et **7/7 rejeux, 119/119 comparaisons**.
Ces contrôles ont été exécutés avant publication de 7B. Les publications
réelles Site 88 et Site 89 sont maintenant intégrées ; l'identité octet pour
octet des entrées du candidat validé est vérifiée après fusion. La QA navigateur
TRIA passe sur ce candidat avec trois niveaux, 17 actions et 17 plans ; le coût
et la publication 10A restent à établir. La réserve d'apport propre Axial/POLA
n'est pas levée.

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
La chaîne native portait encore l'étiquette provisoire 0.52.0 ; le digest distingue
ce candidat du moteur 0.52 publié. Ce premier gel précède l'intégration des
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

Les contrôles isolés ne remplacent pas la validation du candidat après intégration
des prédécesseurs. Le test corrigé est inclus dans les 45 fichiers du candidat
intégré décrit ci-dessous, depuis réconcilié avec 7B réellement publié. Aucun coût, succès
de jeu ou déploiement supplémentaire n'est déduit du gel isolé ; son reçu en échec
et les autres essais historiques restent conservés.

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
la publication de 7B restait à intégrer à ce stade historique.

## Candidat validé avant publication 7B et réconcilié après fusion

Le candidat de validation **0.56.0** a été composé et testé avant publication de 7B avec le gel préparé **7B / 0.55.0**, commit `28f3f388e18bad21a186795f965102a83e6b53d7`, digest `ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b`. La [déclaration de source préparée](coordination/prepared-7b-source-observation.json) conserve cette provenance. La [publication réelle Site 88](coordination/published-7b-site88.json), commit `43ee01ba5469fd4fbffe10eb6a786fe99b1c35a7`, et sa clôture documentaire **Site 89**, commit `4cea66731c0809f08288ea6f7287ef3dd7a392bd`, sont maintenant intégrées. L'identité octet pour octet du candidat validé est vérifiée après fusion pour les **294 fichiers natifs, 676 entrées source/tests, 359 entrées de build, 11 entrées de rejeu et le worker final**. Les entrées source, tests, scripts, public, contenu et build de 7B sont identiques entre le gel préparé et ces deux publications. **La référence de coût sera Site 88 / native 0.55.0** ; Site 89 conserve la même archive comme clôture documentaire. Aucun coût 10A n'est encore exécuté.

Le [gel natif intégré](integrated-final/source-manifest.json) est établi sur
`19f3116c95e8e8ce99aff067de113ae23fc634d6`. Son digest est
`be11e761de3c0f3c7d50d10da47be9e0d7b4fc9c5b7d5002cc9272ffce85645a`,
avec **294 fichiers natifs** et **305 membres dans l'archive de source**.

| Preuve intégrée du 10 novembre 2026 | Résultat réel et portée |
| --- | --- |
| [Suite des 45 fichiers](integrated-final/validation/delta-tests-run.json) | **1 538/1 538**, zéro échec, annulation ou test sauté. Périmètre Axial, runtime/persistance partagés, familles voisines et contrats affectés des prédécesseurs ; ce n'est pas l'ensemble de la suite historique V6. |
| [Cinq contrôles du projet](integrated-final/validation/checks-run.json) | **5/5** : typage, audit réel des entrées, audit de migration, diff et build. Le registre recalculé compte **60/76 entrées**. Sources natives et entrées source/tests inchangées pendant les tests et ces contrôles. |
| [Sept rejeux publics](integrated-final/regressions/regression-summary.json) | **7/7 et 119/119 comparaisons** sur CATR, RSWP, FOGW, VOIS, WEAV, CONN et MIND. **292 actions, 210 préfixes, 299 paquets publics complets, 1 405 images d'animation, 502 requêtes et 21 frontières naturelles** conservés. |
| [Reçu du driver de rejeux](integrated-final/regression-launch.json) | Exécution terminée à **23:25:37.152744 UTC**, code 0, entrées d'exécution et digest natif inchangés. Les sept cas finissent sans timeout ni comparaison échouée. |
| [Archive du gel](integrated-final/source-archive.json) et [journaux de validation](integrated-final/validation/log-transport.json) | Les reçus relient les entrées du gel et les sorties conservées. Ils ne prouvent pas la publication de 7B ni celle de 10A. |

Les rejeux utilisent les retours publics archivés et le comparateur historique
inchangé de 17 contrôles par cas. Aucune référence n'est régénérée. Ils vérifient
les commandes, paquets et champs de décision déclarés, les préfixes et les
frontières sur ces traces ; l'égalité de tout l'état des nouveaux propriétaires
et la parité complète de l'appelant source ne sont pas revendiquées. Le manifeste
n'impose aucun préfixe supplémentaire de propriétaire passif : **0/0** contrôle
de ce type n'ajoute aucune preuve d'acquisition passive Axial. Les preuves de sa
boucle passive restent celles des scénarios synthétiques dédiés.

Ces résultats fonctionnels ne constituent ni de nouvelles parties, ni une mesure
de vitesse, ni une contribution propre Axial. Les durées conservées supervisent
les exécutions ; elles ne font pas partie du protocole de coût. La réconciliation
après fusion des publications réelles Sites 88 et 89 conserve exactement les
entrées natives, source/tests, build et de rejeu ainsi que le worker validé.

## Contrôle navigateur TRIA du candidat

Le [reçu navigateur](integrated-final/browser/browser-qa.json) atteste une
session froide continue sur le candidat **0.56.0**, liée au gel et au worker
compilé : **trois niveaux terminés, 17 actions, 17 plans**, sans état appris
injecté. Les [observations réelles](integrated-final/browser/observed-states.json)
confirment « Paused. » à **4 actions / 1 niveau / 4 plans**, puis exactement
une action, « One action completed. », à **5 / 1 / 5**.

La [première capture de la frontière](integrated-final/browser/tria-boundary-in-progress.png)
conserve l'URL du niveau 4 alors que le dernier retour n'est pas encore scellé :
**16 actions / 2 niveaux / 16 plans**. Le résultat terminé est celui de la
[capture finale](integrated-final/browser/tria-three-levels.png), **17 / 3 / 17**,
avec « Level completed. ». Le preview est ensuite arrêté.

L'[horloge de continuation](integrated-final/browser/case-clock-continuation.json)
ajoute **132,058631 secondes** aux **763,736664 secondes** antérieures et atteint
**895,795295 secondes cumulées**, sans remise à zéro. Cette preuve concerne la
régression UI et le contrôleur sur TRIA, cas RelativeArrangements existant.
Elle n'établit aucune contribution propre Axial et ne modifie pas le budget POLA.

## Contrôles et livraison encore à établir

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

La qualification puis la mesure de coût contre **Site 88 / native 0.55.0**
et les vérifications de publication 10A restent à faire. La clôture documentaire
Site 89 est intégrée séparément et ne remplace pas cette référence de coût. La réserve [POLA](diagnostic/pola-case-budget-review.json) est inchangée :
94 actions historiques, zéro niveau, durée inconnue et aucun budget restant
positif établi. Les rejeux et la QA TRIA ne créent aucune nouvelle horloge POLA
et ne lèvent ni sa réserve d'apport propre Axial ni celle de réussite officielle.
