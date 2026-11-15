# Feuille de route SS01–SS25

Date de ce jalon : 15 novembre 2026 — version 0.1.0, huit niveaux de SS01.

## Architecture retenue

Un laboratoire exécutable sans SRA Playground, conservé dans `experiments/sinking-star/` du même dépôt, sur `feat/sinking-star-lab-20261115`. Le même cœur TypeScript sera importé par un adaptateur du Playground : pas de copie divergente et pas de réécriture des règles.

L'intégration est volontairement précoce : raccorder le premier jeu terminé avant de multiplier les autres. Un prototype autonome ne doit pas devenir une longue branche de 200 niveaux dont la compatibilité n'est découverte qu'à la fin.

## Lots et critères de sortie

| Lot | Contenu | Critère de sortie | État |
|---|---|---|---|
| SS0 | Contrat, géométrie, palette locale, démarrage autonome | Compilation et tests de géométrie ; règles restantes identifiées | Socle livré, spécification complète encore évolutive |
| SS1a | SS01 L1–L3, marchand et miroirs | Jeu manuel, solutions témoins, aucun raccourci sans miroir, Undo | Livré ; L1–L3 élargis à 25/25/24 cases accessibles |
| SS1b | SS01 L4–L8, pierres/boutons/portes nécessaires | 8 niveaux originaux, tous rejouables et testés ; règle de porte occupée définie | Livré dans le laboratoire ; tests et témoins validés |
| SS2 | Adaptateur natif et intégration pilote de SS01 | Parité des frames/replays ; 100 jeux existants non régressés ; mesure globale | Prochaine étape |
| SS3 | SS02–SS05 : autres compétences seules | 4 jeux × 8 niveaux ; chaque règle identifiable par observation | À faire |
| SS4 | SS06–SS15 : toutes les paires | 10 jeux × 8 niveaux ; interaction des deux rôles réellement nécessaire | À faire |
| SS5 | SS16–SS20 : trios | 5 jeux × 8 niveaux ; simultanéité et monstres spécifiés avant utilisation | À faire |
| SS6 | SS21–SS25 : synthèses | 5 jeux × 8 niveaux ; couverture de la série et campagnes gelées | À faire |

Contenu actuel : **8/8 niveaux de SS01 (100 % du contenu prévu pour ce jeu)** ; **1/25 jeux développé en autonomie** ; **8/200 niveaux ciblés (4 % du nombre de niveaux)**. **0/25 jeux intégré au Playground.** Ces ratios ne mesurent pas l'effort moteur ni l'avancement de l'intégration globale.

## Retour utilisateur pris en compte

Les premiers niveaux étaient trop contraints. Les cartes ont été remplacées par des salles à deux dimensions, avec boucles et quatre directions possibles au départ. L1/L2/L3 : 25/25/24 cases accessibles avant tout pouvoir, contre 2/4/3. La destination demeure inaccessible à pied. Plusieurs points d'activation du miroir restent possibles : la règle ne se réduit plus à un couloir imposé.

Ajouts : pierres échangeables, boutons maintenus, portes conditionnelles, deux miroirs successifs et cinq cartes nouvelles. Une action qui refermerait une porte sur une entité est refusée atomiquement ; cette règle est documentée et testée.

## Catalogue de conception

Codes provisoires à contrôler dans le catalogue au moment de l'enregistrement, pas encore des entrées publiques.

| Code | Titre de travail | Personnages |
|---|---|---|
| SS01 | Les Îles du Reflet | Marchand |
| SS02 | La Force Rouge | Guerrier |
| SS03 | Le Fil Vert | Voleur |
| SS04 | L'Axe Violet | Magicien |
| SS05 | Le Chant Magenta | Barde |
| SS06 | Les Ponts Réfléchis | Marchand, Guerrier |
| SS07 | La Distance Dérobée | Marchand, Voleur |
| SS08 | La Double Transposition | Marchand, Magicien |
| SS09 | Le Chœur des Miroirs | Marchand, Barde |
| SS10 | L'Entrepôt Réversible | Guerrier, Voleur |
| SS11 | La Force Transposée | Guerrier, Magicien |
| SS12 | La Colonne en Marche | Guerrier, Barde |
| SS13 | L'Ancre Verte | Voleur, Magicien |
| SS14 | La Traction Harmonique | Voleur, Barde |
| SS15 | La Résonance Violette | Magicien, Barde |
| SS16 | Les Ponts Engloutis | Marchand, Guerrier, Voleur |
| SS17 | La Forteresse Rose | Guerrier, Voleur, Magicien |
| SS18 | La Galerie Résonante | Marchand, Magicien, Barde |
| SS19 | La Chasse Noire | Guerrier, Magicien, Barde |
| SS20 | Le Relais des Îles | Marchand, Voleur, Barde |
| SS21 | Les Cinq Destinations | Les cinq |
| SS22 | Le Château Submergé | Les cinq |
| SS23 | Le Labyrinthe des Reflets | Les cinq |
| SS24 | La Procession Noire | Les cinq |
| SS25 | L'Étoile Engloutie | Les cinq |

## Passage dans le Playground

1. Relever le HEAD canonique au moment du raccordement et relire les consignes persistantes ; ne pas supposer que la base de ce pilote est encore la version actuelle.
2. Ajouter un chemin de dispatch natif, chargé seulement pour les jeux SS. Conserver le worker/Pyodide existant pour les autres jeux. Préserver la sérialisation des requêtes et le protocole d'erreur.
3. Enregistrer seulement SS01 terminé, avec code disponible, miniature, règles des contrôles et compteur de niveaux exact. Ne pas afficher les 24 jeux restants comme jouables.
4. Rejouer les mêmes actions dans le laboratoire et dans l'hôte et comparer les frames et la progression. Vérifier la palette locale, Undo, Reset, Restart, victoire et sélection de niveau.
5. Lancer le SRA sans le modifier pour ce jeu. Un échec d'agent est une observation de recherche, pas une raison pour lui transmettre le moteur ou adapter les cartes à ses faiblesses.
6. Enregistrer séparément taux de résolution du validateur d'auteur et taux de résolution du SRA. Conserver des niveaux/variantes de validation non utilisés pour la mise au point de l'agent.

## Qualité des niveaux

Chaque niveau doit disposer d'un témoin rejouable, d'un objectif pédagogique et de tests d'invariants. Une recherche en largeur prouve le plus court témoin seulement si l'exploration est exhaustive ; un arrêt sur budget est indéterminé, jamais une preuve d'impossibilité. Sur les grands niveaux, un témoin légal suffit pour prouver la solvabilité, sans revendiquer l'optimalité.

Tester les préconditions qui échouent autant que les effets qui réussissent ; toutes les orientations, limites, cibles bloquées et superpositions visuelles pertinentes. Une palette ou un texte d'aide ne doit pas fournir à l'agent des informations absentes de ses observations autorisées.

## Performances et non-régression

Au stade autonome, les sources de production restent inchangées. Cela n'est **pas** une mesure chiffrée de performance du Playground.

Au raccordement, fixer une baseline et comparer sur le même environnement, les mêmes jeux, budgets et paramètres, avec échauffement et plusieurs répétitions : chargement, transition moteur, rendu, décision SRA, coût global, mémoire et taille chargée. Pas de préchargement des 25 jeux dans les sessions des jeux existants.

Critère demandé par le projet : augmentation globale strictement inférieure à 10 %. Une sous-phase au-delà de 10 % peut être acceptée si le coût global reste sous ce seuil et si les résultats fonctionnels sont conservés. L'amélioration d'une moyenne ne doit pas masquer des erreurs ou des blocages : conserver aussi les distributions et les cas dégradés.

Les jeux nouveaux n'ont pas encore de baseline historique : établir leur propre mesure, sans prétendre la comparer à un moteur antérieur inexistant.

## Vérification du présent jalon

- Node `22.16.0`, TypeScript local `5.8.3` : compilation stricte et **66/66 tests réussis**. Les 23 tests du pilote initial sont conservés, avec leurs cartes comme fixtures de non-régression.
- Huit solutions témoins rejouées ; impossibilité de résoudre chaque niveau par la marche seule, établie par recherche exhaustive. Aucun état pertinent accessible ne rend la résolution impossible. Les limites de budget ne sont jamais assimilées à une preuve d'impossibilité.
- Échange de pierre indispensable dans L5, L6 et L8 ; chacun des deux miroirs indispensable dans L7 et L8.
- Rapport reproductible : `npm run validate` produit `docs/validation.json`. Le solveur et les solutions restent hors de la démonstration et hors observation agent.
- Chromium : campagne des huit niveaux au clavier jusqu'à WIN, boutons, Undo de pierre, Undo après WIN, Reset, Restart, sélection de niveau et largeur mobile 390 px validés. Aucune erreur JavaScript ni requête HTTP.
- L'ouverture `file://` reste bloquée par la politique du navigateur de cet environnement ; contrôle par `set_content` du HTML autonome exact. L'ouverture directe du fichier sur le poste utilisateur n'a donc pas été vérifiée ici.
- Le dépôt annonce Node `>=22.18.0` et TypeScript `5.9.3` : qualification avec ces versions exactes à réaliser lors du raccordement.
- Aucun fichier de production modifié ; aucune campagne du SRA ni mesure officielle du coût global du Playground. Le seuil global inférieur à +10 % reste à vérifier lors de l'intégration, pas revendiqué ici.
- Aucune intégration canonique ni publication Site dans ce jalon. La synchronisation du Site déjà publié n'a pas été contrôlée.

## Sauvegarde et reprise

Respecter `AGENTS.md` et `docs/migration/git-site-sync-policy.md` : travail → tests → commit → sauvegarde GitHub → intégration canonique → publication Site → vérification des SHA.

Branche du lot : `feat/sinking-star-lab-20261115`. Le SHA de livraison est indiqué dans le compte rendu du jalon ; ne pas fabriquer un SHA autoréférent dans son propre commit. Pas d'intégration canonique ni publication dans ce jalon. Prochaine étape : SS2, relire le HEAD canonique actuel et brancher le même moteur natif TypeScript pour SS01, puis tester la parité laboratoire/Playground et les jeux existants avant toute publication. Ne pas modifier le SRA pour lui révéler les règles de ce jeu.
