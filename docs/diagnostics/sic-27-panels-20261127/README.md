# Transfert des effets : interfaces observées et priorité des rôles

Cette cohorte mesure huit jeux sur le commit local `79e6cce7d6fd126e29e1baf6263ca266728b4470`, dont l’arbre `c296191cd767d2be7b39cff1a91fcb81b115dc80` est exactement celui du commit GitHub `4612293c174826c1acfcceaa54d7fd2003397780`. Les identifiants des commits diffèrent à cause des métadonnées attribuées par l’API GitHub. Le manifeste conserve les deux chaînes.

## Résultats mesurés

Chaque jeu démarre au niveau 1, dans une seule session SIC, avec un worker et les plafonds archivés inchangés. Le processus standard a terminé avec le code 0. Il y a un premier verdict par jeu, sans relance externe.

| Jeu | Niveaux gagnés | Commandes par niveau atteint | Verdict |
| --- | ---: | --- | --- |
| CRAF | 6/6 | 9, 11, 16, 19, 24, 27 | Complet, réconcilié |
| SB26 | 8/8 | 9, 15, 15, 15, 17, 19, 17, 17 | Complet, réconcilié |
| CASC | 6/6 | 6, 14, 22, 20, 11, 22 | Complet, réconcilié |
| CLRS | 6/6 | 8, 10, 13, 15, 14, 24 | Complet, réconcilié |
| GRIL | 1/6 | 5, 10 | Plafond de commandes au niveau 2 |
| RSWP | 4/6 | 3, 8, 8, 14, 36 | Plafond de commandes au niveau 5 |
| COLM | 1/6 | 17, 34 | Plafond de commandes au niveau 2 |
| WEAV | 1/6 | 27, 34 | Plafond de commandes au niveau 2 |

La cohorte produit **33 niveaux gagnés sur 50**, avec 605 commandes, 605 commandes autorisées et 605 retours acquis. Les 37 lignes de niveaux atteints, dont quatre arrêts, sont identiques entre les résultats par jeu et le miroir `.levels`. Les 33 scores sont mesurés sous leurs plafonds ; aucun reset, undo ou défaut du banc n’est relevé. Les 34 budgets comparables à la campagne de référence sont exactement identiques. Les 37 budgets atteints correspondent au module de budgets et aux références archivées.

Sur ces mêmes huit jeux, la campagne `4a546a13` avait gagné 26 niveaux en 665 commandes. Il ne s’agit pas d’une nouvelle campagne complète des 107 jeux. Les corrections séparées de VOIS et WA30 ne sont pas présentes dans l’arbre mesuré ici.

## Première décision et correction commune

Les paquets publics complets précédant le premier transfert erroné sont conservés dans `tests/fixtures/sic-preview-transfer-public.json.gz`. CRAF, niveau 3, première commande (globale 21), et SB26, niveau 2, première commande (globale 10), tentaient un effet appris alors que l’interface de sélection observée lors de son acquisition n’était plus présente. Les grilles avant et après ces gestes étaient identiques.

Le transfert conserve désormais les rôles des petits contours centrés autour du sujet ou de son repère. Il exige une preuve acquise compatible avec les repères actuels. Une réussite réellement observée sans cet ancien contour peut réviser la condition, en conservant les deux preuves. Un geste contredit sur une grille inchangée est réfuté pour cette image et ce niveau, même lorsqu’une autre association propose le même geste.

La revalidation d’un transfert dont la géométrie a changé passe après les rôles spécialisés. Les plans déjà étayés dont la géométrie relative reste compatible gardent leur priorité existante. Deux transferts natifs varient formes, palettes, positions et commandes ; les tests couvrent aussi absence, ambiguïté, contradiction, image identique dans un autre niveau et révision de la condition par un retour réel. Les 21 tests ciblés et le contrôle TypeScript passent.

## Limites et suite

GRIL, RSWP et WEAV reproduisent exactement les mêmes commandes et effets publics que la référence, jusqu’à leurs arrêts. COLM reste au même plafond ; son parcours diverge à la commande globale 21, niveau 2, commande 4 : le rôle de placement utilise son contrôle au lieu du geste générique préparé. Cette modification ne suffit pas à gagner le niveau.

Le contrôle complet de continuité et les vérifications dans le viewer restent à faire sur la branche d’intégration. Ce lot ne transforme aucun des quatre arrêts restants en victoire et n’augmente aucun plafond.

## Fichiers et reproduction

`report.json` détaille les comptes, scores, réconciliations et comparaisons. `results.jsonl.gz` et `results.levels.jsonl.gz` conservent les résultats bruts. `expected-budgets.json` contient les 50 budgets ; `manifest.json` fournit leurs SHA256, les sources, le protocole et l’équivalence des arbres Git.

Depuis l’arbre indiqué, avec les dépendances et actifs Pyodide présents :

```bash
SIC_REPLAY_REFERENCES=docs/architecture/sic-replay-reference-levels-20261126.json node scripts/check-sic-chronological.mjs CRAF,SB26,CASC,GRIL,CLRS,RSWP,COLM,WEAV auto /tmp/sic-panel-roles.jsonl 1
```
