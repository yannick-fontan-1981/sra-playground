# Réutiliser une sélection de support mesurée

## Première perte publique

La capture `public-first-loss.json.gz` part de L1, dans une session SIC avec un seul worker. La source est `e246862b84f8d2d2392a754d2dd7f57eb120095b`. Les cinq premières empreintes et leurs comptes (19, 39, 33, 33, 33) sont identiques à l'audit initial. Le collecteur ajoute du travail : ses 61 commandes du sixième niveau avant le plafond de 34 secondes constituent un diagnostic, jamais une qualification de temps.

Au sixième niveau, les commandes 4 et 9 sélectionnent chacun des deux supports. Les retours publics conservent les supports et les cubes à leurs places et changent les deux marquages de sélection. À la commande 10, ces deux effets sont disponibles ; pourtant la proposition est coupée avant la prochaine sélection, déjà mesurée (commande 13). La même coupe se répète. À la commande 46, une préparation indépendante remplace la suite encore courante du propriétaire.

## Correction générique

`observed-support-selection.ts` retient la commande, le contrôle observé, sa couleur, les marquages avant/après et les deux références d'une sélection réellement exécutée. Le lecteur de supports conserve l'identification unique de la géométrie. Une sélection inconnue reste une expérience unitaire. Une sélection connue peut entrer dans un préfixe de seize commandes au maximum, chaque mouvement, marquage, contrôle adressé et liaison de rail restant vérifié sur le retour public réel.

Le propriétaire d'un parcours non épuisé peut aussi continuer avant une préparation indépendante quand sa référence courante, sa pose et son support actif sont encore confirmés. Ce droit ne s'applique ni à une nouvelle sélection inconnue, ni à une référence périmée, ni à une autre géométrie.

Les apprentissages et l'acteur actif sont mis à jour selon la jambe réellement exécutée, y compris après plusieurs sélections dans le même préfixe. Une contradiction ferme le préfixe et réconcilie uniquement les commandes exécutées. Les plafonds de recherche, de commandes et de temps restent inchangés ; aucun identifiant de jeu, niveau, palette ou itinéraire n'entre dans la production.

## Preuves natives

`tests/sic-support-selection-continuity.test.ts` utilise des retours publics archivés, sans reproduire les prédictions du planificateur. Les deux interfaces passent par L1 pour apprendre les directions, puis apprennent les sélections sur une nouvelle scène. La deuxième varie les silhouettes des contrôles, leur origine, la palette et les codes directionnels. Chacune exécute seize tickets de mouvements/sélections sous la même décision, avec une seule clôture et la réconciliation finale. Une préparation indépendante disponible vérifie la priorité du rôle acquis.

Les mutations couvrent un marquage contradictoire, une sélection sans effet, une liaison de rail supprimée, un contrôle adressé altéré, des références d'une autre portée et des effets ambigus. Les contrats géométriques existants sur les stocks et les croisements sont conservés.

## Qualification stricte complète

La source figée `dd683bd38281de5ba84801e53008df1d74c33069` (GitHub `a397a6b12d62de789c51f0dbb79fac11131f7c29`, arbre `dee28a3a2cf928344974cad29b91e45d8ab10da5`) gagne les huit niveaux depuis L1 : **348 commandes**, une session SIC, un worker, aucun reset ni undo. Les comptes sont **19, 39, 33, 33, 33, 69, 80, 42** ; les huit plafonds de commandes et de temps d'origine sont respectés. Les 348 commandes sont autorisées par SIC et acquises par le runtime, avec onze séries réelles mêlant clics et déplacements. Le huitième niveau prend 12 852 ms pour une limite inchangée de 17 000 ms.

Les reçus bruts, le manifeste de source/runner/références et le résumé vérifié sont dans `qualification/`. Cette victoire stricte reste à intégrer dans le contrôle physique complet, fusionner sur main, publier et vérifier dans le viewer avant de la déclarer livrée.
