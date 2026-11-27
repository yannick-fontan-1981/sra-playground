# COLM — continuité des préparations et réception exécutée

Le 27 novembre 2026, deux sessions SIC distinctes, chacune depuis le niveau 1 avec un seul worker, ont gagné les six niveaux de COLM en **103 commandes** sur la source figée `b653fada3b29ce085eb80a7a04bbdc6598913a69`. Le premier passage applique les plafonds chronométriques historiques ; le second enregistre les tickets natifs et les réacquisitions. Leur empreinte des commandes et retours publics est identique : `96fa4f9de4fa3bdd962b528ee2cd5b87cb45f32b373cc4545c3aa208986102db`. Les deux manifestes confirment une source propre et inchangée avant/après.

## Résultat strict et préparations avant réception

| Niveau | Commandes/plafond | Score/plafond (s) | Réceptions après préparation continue | Translations préparatoires | Réordonnancements préparatoires | Réacquisitions courantes + scores officiels |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 17/22 | 5.623/20 | 4 | 4 | 3 | 4 + 1 |
| 2 | 17/34 | 3.364/24 | 5 | 4 | 7 | 5 + 1 |
| 3 | 20/63 | 4.783/43 | 5 | 7 | 2 | 5 + 1 |
| 4 | 23/32 | 5.397/19 | 6 | 7 | 6 | 5 + 1 |
| 5 | 10/69 | 2.053/43 | 3 | 2 | 5 | 2 + 1 |
| 6 | 16/26 | 4.390/13 | 6 | 6 | 4 | 5 + 1 |

Les **29 séries** exécutent **57 préparations**, puis la commande `receive` déjà connue, dans la même décision. Elles contiennent au plus quatre commandes ; le moteur conserve sa limite générale de seize. Le collecteur mesure **46 décisions**, **103 tickets** et **103 effets**, sans reset ni undo. Les 32 réceptions connues comprennent trois contacts unitaires ; 26 réceptions sont réacquises sur les observations courantes et six terminent un niveau par son score officiel. La toute première expérience qui apprend `receive` reste une acquisition, pas un réemploi inventé. Neuf tickets d'autres familles conservent leurs retours natifs sans fausse attribution à la famille des files.

Les budgets stricts restent **22/34/63/32/69/26 commandes** et **20/24/43/19/43/13 secondes**. `scoredMs` mesure l'arrivée au score, `settlementMs` la clôture ultérieure ; les deux sont conservés dans `summary.json`. Le collecteur utilise le maximum historique de 69 pour collecter les six niveaux, puis le contrat vérifie les plafonds propres à chaque niveau. Cette collecte ne remplace pas le passage strict.

## Ce que le nouveau contrat protège

Le helper partagé `requireExecutedPrefix` garde à l'identique les assertions LKEY : chaque ticket possède un seul retour de même plan et index, les retours intermédiaires sont confirmés et ouverts, puis une seule réconciliation couvre exactement les commandes exécutées. COLM l'applique aussi à ses retours.

Le contrôle COLM lie les rôles connus avant la commande à leurs preuves, l'action au ticket, les observations aux empreintes des effets physiques et les retours successifs à la même série. Chaque préparation doit produire un changement physique confirmé ; le dernier geste doit être une réception. Une réception ordinaire exige une réacquisition du rôle sur les deux observations exactes et l'époque courante. Une réception qui gagne exige son retour natif `official_boundary` et le score correspondant ; une réacquisition antérieure n'est pas présentée comme une preuve nouvelle.

Les seuils par niveau sont les couples **préparations/réceptions préparées** observés : **7/4, 11/5, 9/5, 13/6, 7/3, 10/6**. Comme les contrats de continuité existants, leur minimum est proportionnel au nombre de commandes du niveau, arrondi vers le haut par rapport au témoin **17,17,20,23,10,16**. Seules les séries terminées par une réception qualifiée contribuent ; de la marche ailleurs ne compense pas leur disparition. Les seuils des 14 jeux et 84 niveaux précédents restent inchangés.

Les contre-épreuves conservent les commandes publiques gagnantes puis retirent une propriété : séries découpées, réception omise, rôle inconnu avant le geste, preuve périmée ou mal liée, absence de score natif, substitution par une autre famille, pixels inchangés, contradiction, clôture prématurée, réconciliation doublée et départ hors niveau 1. Un cas positif conserve les six scores avec acquisition courante absente, conformément au retour réel de frontière. Les tests natifs de transfert de la correction de production restent dans la CI, avec leurs deux variantes et refus.

## Sources et validation

- Source réelle des deux passages : `b653fada3b29ce085eb80a7a04bbdc6598913a69`, arbre `2491aae984acb46645a0299f59154af75851b127`.
- Bruts stricts SHA-256 : `6cce111fdf577ceccc7fc7cba6cc2f4c727e40f0b589cddcfbdea15f85da4396`.
- Bruts du collecteur SHA-256 : `0e3699ad9b8526727066105e0594c276e58a19d6df805e31231b251b274c828b`.
- La calibration et ses tests sont postérieurs aux deux captures ; leurs empreintes de fichiers figurent dans `summary.json`. Aucun code de production n'a changé après la source exécutée.
- Tests ciblés et typecheck : voir `validation` dans `summary.json` et les journaux complets dans l'archive.
- Le contrôle complet devient **15 jeux, 90 niveaux, 13 cohortes**. La CI rejoue chaque cohorte depuis le niveau 1 avec un worker, lie les artefacts au même SHA, puis exécute l'agrégateur obligatoire `Executed series and final reconciliation`.

L'archive conserve les résultats complets, la progression du strict, les manifestes avant/après, les journaux, la commande reproductible, les validations et un manifeste interne SHA-256 de chaque membre. Elle est reproductible (ordre fixe, dates et propriétaires normalisés). Les premières captures de perte, deux corrections génériques et tests de transfert sont déjà sauvegardés dans `../sic-queue-control-and-contact-20261127/`.

Le passage global des 90 niveaux sur le SHA final et le rejeu COLM dans le Site livré restent des contrôles d'intégration/publication distincts. Cette archive qualifie les deux sessions exécutées et le contrat local ; elle n'annonce pas ces deux contrôles ultérieurs comme terminés.

Archive : `public-evidence.tar.gz`, **24,642 octets**, SHA-256 `0c3da740362b7e45d55e04d9f726322dc8d2226ab3f68297de0e53ac76e741fe`.
