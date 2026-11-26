# SS23 — validation de livraison

**Les huit salles sont jouables et le parcours complet a été reproduit dans l’interface native Chrome, en mode Manual, depuis N1 jusqu’à la victoire finale.** Le niveau 1 enseigne les 36 découvertes attendues. Cette qualification concerne le jeu, le tutoriel et leur intégration ; elle ne constitue pas une résolution autonome par SRA.

## Résultats par salle

Les commandes comprennent les sélections de personnage. Les compteurs décrivent les témoins d’auteur effectivement rejoués, sans prétendre qu’ils sont minimaux.

| Salle | Entrées | Sélections | Commandes physiques | Images publiques |
| --- | ---: | ---: | ---: | ---: |
| N1 — Le conservatoire des échanges | 221 | 34 | 187 | 612 |
| N2 — La grille des places libres | 91 | 12 | 79 | 250 |
| N3 — La case de trop | 43 | 12 | 31 | 106 |
| N4 — Le poste emprunté | 132 | 17 | 115 | 363 |
| N5 — Les deux côtés du sort | 50 | 16 | 34 | 124 |
| N6 — Le poste derrière la file | 126 | 28 | 98 | 328 |
| N7 — Le pas qui laisse un appui | 172 | 33 | 139 | 459 |
| N8 — La forme et la place vide | 112 | 21 | 91 | 295 |
| **Total** | **947** | **173** | **774** | **2 537** |

Les témoins atteignent tous la victoire avec **zéro refus et zéro décès**. Les observations du laboratoire et celles de l’adaptateur natif sont comparées image par image, durées comprises. Chaque fin de salle est annulée puis rejouée dans les contrôles automatisés. Les rapports sont [levels-report.json](../validation/levels-report.json), [ui-dom-report.json](../validation/ui-dom-report.json) et [la preuve native](../../../docs/migration/ss23-evidence/native-tests.txt).

## Vérification dans le navigateur

Un redémarrage propre au niveau 1 précède le parcours final. Les entrées passent exclusivement par les commandes publiques du plateau : flèches, Tab pour changer de personnage et X pour les reflets. Le contrôle attend le retour public `aria-busy=false` avant la commande suivante. Aucun appel au moteur privé, changement d’état interne ou injection de solution dans le jeu n’est utilisé.

Les huit confirmations « Les quatre destinations sont occupées. Salle terminée ! » sont observées, avec passage automatique à la salle suivante. Le compteur atteint **36 / 36 découvertes** à la fin de N1 et reste conservé. Au terme de N8, le panneau visible affiche **« VICTORY · Les quatre destinations sont occupées »**, avec un plateau au repos.

Le [rapport Chrome](../../../docs/migration/ss23-evidence/chrome-manual-report.json) conserve les entrées par salle, les retours visibles, les empreintes des cartes et les sources présentes pendant le test. Les manipulations exploratoires antérieures au redémarrage propre sont exclues des 947 entrées de campagne. Le mode est **Manual avec un parcours d’auteur**, et non SRA Agent.

## Batteries et contrôles

| Contrôle | Résultat | Portée |
| --- | --- | --- |
| Tests du laboratoire | **114 / 114** | 81 contrats moteur/monstres et 33 cas pédagogiques |
| Témoins de campagne | **8 / 8** | Actions publiques, zéro refus/mort, états finaux et historique |
| HTML autonome dans Happy DOM | **34 configurations et 8 salles** | Pixels et durées exacts, quatre rôles, commandes, aides, liens, interruptions, défaite et victoire |
| Tests natifs Custom 4, SS21, SS22 et SS23 | **94 / 94** | Dispatcher, API, sélections, historique, transitions et non-régression des campagnes précédentes |
| TypeScript et build du Site | **Réussis** | Galerie de 123 jeux et 820 aperçus ; avertissement de taille de bundle non bloquant |
| `npm run test:sic-continuity` | **Réussi sur 41 niveaux protégés** | Contrats existants de continuité et effets physiques ; aucune qualification autonome de SS23 |
| Revues d’auteur et indépendante | **85 contrôles dans 5 revues** | Contre-branches, variantes gagnantes, causes physiques et diversité |
| Comparaison géométrique | **72 terrains antérieurs** | Aucun terrain identique sous translation, rotation ou réflexion parmi SS14–SS22 |

Les preuves originales du build, de SIC et des tests sont conservées dans [ss23-evidence](../../../docs/migration/ss23-evidence/). Le rapport [design-report.json](../validation/design-report.json) agrège les cinq revues : 13 contrôles pour N1, 8 pour N2, 21 pour N3–N5, 25 pour N6–N8 et 18 contrôles indépendants.

La correction finale de N5 modifie une carte, son témoin et son aperçu. Les contrôles de campagne, du HTML et les 94 tests natifs ont été réexécutés après cette correction. Les 114 tests moteur/pédagogie et SIC restent applicables : leurs sources, N1, le moteur, le tutoriel et les niveaux protégés n’ont pas changé.

## Ce que les revues ont corrigé

Le premier état de N5 autorisait un reflet global qui éliminait les gardiens immédiatement. La géométrie finale fait rencontrer au transfert initial un autre miroir : le geste est refusé atomiquement. Une variante optique préparée demeure gagnante ; la préparation du poste et l’évacuation du voisinage restent observables. Le témoin principal comporte désormais 50 entrées.

La porte nord de N7 suit la condition inverse des plateformes, ce qui ferme le détour pendant la traversée. La réserve sèche conserve un rôle dans l’ouverture de l’arrivée. N8 commence par deux fragments décalés et une réserve, au lieu d’une seconde grille pleine semblable à N2. Le fragment inférieur reste immobile aux deux premiers chants droits, puis entre dans le mouvement au troisième.

L’analyse de marche a aussi été corrigée : un héros qui quitte un bouton ne laisse pas artificiellement sa porte ouverte, et le voisinage orthogonal d’un monstre n’est pas un passage sûr. Les autres pièces restent fixes et les pouvoirs sont supprimés dans ce modèle limité. Les nombres maximaux de buts assignables sont **3, 0, 2, 0, 3, 0, 0, 0**. Ce modèle ne représente ni la coopération complète ni les cascades de presses ; il ne constitue donc pas une preuve d’impossibilité globale.

## Artefact et traçabilité

L’artefact autonome est **SS23-demo.html**, version 0.1.0, **144 949 octets**, SHA256 :

```text
2c3d7cf83a71a82860376809f318583738adcd041f4e33ff368d81b0a7d9d5ce
```

Il contient le moteur, les cartes, le rendu, les aides et les commandes nécessaires au jeu hors ligne. Les parcours d’auteur et le solveur de validation sont exclus du bundle. Le [manifeste de livraison](../validation/delivery-manifest.json) lie les octets du HTML aux rapports et aux sources. Le contrôle visuel Chrome décrit ci-dessus porte sur l’intégration native dans SRA-Playground ; le HTML autonome est qualifié séparément par ses contrôles DOM.

La branche de travail est `feat/sinking-star-ss23-20261126`. La livraison est suivie dans la [PR 127](https://github.com/yannick-fontan-1981/sra-playground/pull/127), où le relevé final associe le commit GitHub intégré, la version du Site et son SHA source. Une reprise doit consulter cette preuve et les états courants, puis suivre [la politique GitHub–Site](../../../docs/migration/git-site-sync-policy.md).

## Limites

Les variantes gagnantes démontrent que les parcours principaux ne sont pas uniques. Les échecs locaux décrivent ce qui se produit depuis les positions testées, sans interdire toute autre préparation. La comparaison des terrains détecte les répétitions exactes ; la variété des problèmes centraux est examinée séparément dans [level-design.md](level-design.md). Aucun minimum de commandes, niveau de difficulté mesuré auprès de joueurs, ni succès autonome de SIC sur SS23 n’est revendiqué.
