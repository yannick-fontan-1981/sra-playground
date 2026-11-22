# SS18 — La Galerie Résonante

Laboratoire autonome **0.1.1**, avec huit salles qualifiées et le trio fixé par la feuille de route : **Marchand orange 12, Magicien violet 15, Barde magenta 6**. Le Marchand est sélectionné au départ. Les trois héros doivent occuper les trois destinations simultanément.

## Jouer et reconstruire

```sh
npm ci
npm run build
```

Ouvrir `dist/SS18-demo.html` dans un navigateur autorisé. Le fichier est autonome et n’a besoin d’aucun accès réseau pour jouer. Il propose clavier, clic, commandes tactiles, choix de niveau, Annuler, Recommencer et Repartir.

Flèches : capacité ou marche du rôle actif. Espace/X : reflets. 1 / 2 / 3 et Tab : sélection Marchand / Magicien / Barde. Z : Annuler. R : Recommencer. Le tutoriel du niveau 3 comprend **27 découvertes**, suivies uniquement à partir des pixels publics.

## Une campagne aux problèmes variés

| N° | Salle | Idée centrale | Coups du témoin, hors sélection |
| --- | --- | --- | ---: |
| 1 | Les trois pièces du chœur | Tri de caisses sans eau, boutons, portes ou miroirs | 56 |
| 2 | Le carrefour à contretemps | Commande à distance et sas de polarités opposées | 82 |
| 3 | Le jardin des trois issues | Atelier dans une cour octogonale, trois accès à préparer | 94 |
| 4 | Personne ne part le premier | Trois départs croisés et simultanés | 78 |
| 5 | Les gardiens de l’arène | Combattre une paire de monstres et conserver deux contrepoids | 83 |
| 6 | Le miroir en tournée | Faire voyager un miroir puis dégager son ancien axe | 46 |
| 7 | La navette des alcôves | Recaler un appui et ses passagers dans un canal en peigne | 43 |
| 8 | La cour au cœur du lac | Réaffecter trois ressources pour atteindre les destinations centrales | 135 |

Les témoins démontrent une solution, pas un minimum. Les variantes intéressantes sont conservées : notamment un départ sans échange dans N4 et une autre navette dans N7. Le niveau 3 privilégie la richesse pédagogique ; toutes ses découvertes sont démontrées, sans devenir obligatoires pour gagner.

Les références viennent des [zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/) et du [Nord](https://sinkingstarwalkthrough.com/fr/north/), puis des énigmes précisément identifiées dans [l’audit des sources](docs/source-audit.md). Les cartes, le chant carré et les règles du trio sont adaptés au contrat de la série SS. Les silhouettes et problèmes sont détaillés dans [la conception des salles](docs/level-design.md).

## Qualification

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Résultat qualifié : **56 tests réussis**, huit témoins gagnants sans refus ni mort, **700 entrées** dont 83 sélections, **1 988 images publiques** et **27/27 découvertes** dans le tutoriel. Le HTML compilé est également rejoué dans Happy DOM par ses commandes, avec comparaison des pixels, durées et annulations. Les avertissements rouges sont contrôlés sur des cas ciblés et sur la vraie carte N8.

Les cinq scripts de revue vérifient les contre-branches locales et les variantes conservées. La comparaison avec les 32 terrains de SS14–17 ne trouve aucun doublon exact après translation, rotation ou réflexion. Elle complète une relecture des mécanismes et ne constitue pas une mesure générale d’originalité.

Les rapports de `validation/` et [leur explication](docs/validation.md) délimitent ce qui a été testé. La revue CSS dans un navigateur natif, le raccordement au dispatcher et un éventuel essai autonome SRA restent distincts de cette qualification du laboratoire.

## Organisation

- `src/` : moteur, huit cartes, crédits, suivi pédagogique et interface.
- `index.template.html` : mise en page et aides du fichier autonome.
- `tests/` : tests et témoins de référence.
- `reference/author/` : constructeurs de cartes, relectures et outils d’auteur.
- `scripts/` : construction, synchronisation et qualification.
- `docs/` : [règles](docs/specification.md), conception, sources, validation, [feuille de route](docs/roadmap.md) et [prompt d’intégration/publication](docs/codex-integration-prompt.md).

Après une modification des références de cartes, lancer `node scripts/sync-levels.mjs`, reconstruire, puis rejouer les qualifications pertinentes. Les témoins, le solveur et l’état privé auteur ne sont pas embarqués dans le HTML ni exposés à SRA.

GitHub reste la source canonique. L’intégration native à Custom 4 puis la publication du Site SRA Playground existant sont l’étape suivante décrite par le prompt ; cette livraison autonome ne constitue pas leur exécution.
