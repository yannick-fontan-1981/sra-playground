# SS24 — Les Voies de Traverse

Une campagne de huit salles pour le quatuor **Marchand / Voleur / Magicien / Barde**. Le tutoriel d’ouverture rassemble **37 découvertes** ; les sept salles suivantes travaillent les départs, les places libérées et les ressources qu’il faudra retrouver au retour.

Le jeu est intégré nativement à SRA Playground, dans **Custom 4**, après SS23. Le laboratoire produit aussi `dist/SS24-demo.html`, autonome et jouable hors ligne. Les témoins d’auteur et les outils de recherche restent hors du fichier jouable.

## Huit problèmes différents

| Salle | Structure et travail demandé | Référence étudiée |
| --- | --- | --- |
| 1 — L’atelier des départs | Trois cours et un bassin : comparer poussée, traction, échange, chant, reflet et effets des commandes ; préparer une relève qui permette aux quatre héros de partir. | Atelier original, monde Nord |
| 2 — L’escalier à rebours | Descendre la première charge, ouvrir la salle basse et organiser les transferts sans reprendre le poids qui garde le passage. | Heroes of Hauling 6 |
| 3 — Les tiroirs décalés | Séparer des paires que le Marchand ne peut pas pousser ensemble, dégager la fenêtre d’échange et réutiliser une cible au retour. | Heroes, Doubled 4 |
| 4 — Le pas et la visée | Déplacer le Magicien sans lancer de sort, atteindre une autre ligne et récupérer ce que le précédent échange renvoie. | Heroes and Light Advanced 6–7 |
| 5 — Le relais interrompu | Charger une presse, conserver d’abord la commande puis la relâcher au moment utile, avant d’organiser une relève durable. | Heroes and Water 9 |
| 6 — Trois postes, un seul retour | Garer puis restaurer un miroir, extraire la charge avant de fermer son atelier et déposer dans une niche sans poste de traction inférieur. | Heroes and Light 11 |
| 7 — La place qui restera sûre | Choisir le poste du miroir qui survivra aux trois déclenchements suivants, puis préparer un court passage à appui immergé. | Heroes and Water 8 |
| 8 — Le dernier pas sans échange | Préparer des dépôts répartis et une visée coudée, puis faire arriver le Magicien sans que son propre pas défasse le montage. | Heroes and Light Advanced 8 |

Les références viennent des pages [Nord](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/). Les changements sont expliqués dans le [dossier des sources](docs/source-audit.md). La réutilisation de Water 8, déjà secondaire dans SS16 N8, est déclarée : la nouvelle salle porte sur l’anticipation de trois commandes explicites. Les huit plans sont comparés aux 80 cartes SS14–SS23, symétries comprises.

## Un tutoriel à expérimenter

Les découvertes portent sur les quatre capacités, la prise unique du Voleur, les partenaires transportés sans leur pouvoir, l’extraction du Barde qui laisse son groupe, la priorité de la première cible du Magicien et les visées déviées, le chant sélectif à travers les murs, l’eau et les appuis mobiles ou ancrés, les miroirs, les relais de poids, les presses latérales et les contacts avec les monstres.

La progression se fonde sur les pixels et les transitions de l’observation publique. Une sélection ou un geste refusé ne vaut pas démonstration d’une capacité ; un héros transporté ne reçoit pas le crédit d’un pouvoir qu’il n’a pas activé. Les 37 découvertes accompagnent l’apprentissage : elles ne sont pas un quota caché pour gagner.

## Commandes

- Flèches : agir avec le héros sélectionné.
- **1 / 2 / 3 / 4** : Marchand / Voleur / Magicien / Barde ; **Tab** : sélection suivante ; clic sur un héros : sélection directe.
- **X** ou action 5 : activer les miroirs.
- **Undo**, **Reset**, **Restart** et sélection de niveau : disponibles dans l’interface.
- Victoire : les quatre héros vivants occupent simultanément les quatre destinations, sans assignation de couleur.

Une caisse déposée dans l’eau nue devient un appui. Un appui occupé par un héros ou situé sous l’arrivée immédiate du Barde reste ancré ; un appui libre ne glisse que d’eau en eau. Les monstres restent immobiles sans transport et frappent au contact orthogonal après résolution des mécanismes.

## Construire et vérifier

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
node scripts/package-delivery.mjs
```

Les scripts de conception restent sous `reference/author/`. Après une modification de carte, `node scripts/sync-levels.mjs` met à jour les cartes expédiées, les crédits et les témoins ; les contrôles doivent ensuite être exécutés sur ces mêmes octets.

Les résultats et leurs limites sont consignés dans la [validation](docs/validation.md) et la [note d’intégration native](../../docs/migration/ss24-native-integration.md). Les variantes gagnantes sont conservées dans les revues : aucune unicité, optimalité ou nécessité globale de tous les pouvoirs n’est déduite du témoin principal. Ces rejeux ne qualifient pas une résolution autonome de SRA.

## Livraison et reprise

La [PR 128](https://github.com/yannick-fontan-1981/sra-playground/pull/128) conserve les checkpoints GitHub et le reçu de publication. La [feuille de route](docs/roadmap.md) suit le jalon SS24 et la prochaine composition, SS25 : **Guerrier / Voleur / Magicien / Barde**. Le [prompt Codex de reprise](docs/codex-integration-prompt.md) inspecte l’état actuel avant toute action et conserve les campagnes plus récentes.
