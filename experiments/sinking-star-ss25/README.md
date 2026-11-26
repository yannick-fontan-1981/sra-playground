# SS25 — Les Derniers Équilibres

Huit salles pour **Guerrier / Voleur / Magicien / Barde**, avec un atelier d’ouverture de **39 découvertes**. La campagne poursuit SS24 en travaillant les files mixtes, les réceptions à préparer, les changements de fonction d’une caisse et le retour à conserver après la fermeture d’un accès.

SS25 s’intègre nativement à **SRA Playground → Custom 4**, après SS24. Le laboratoire construit aussi `dist/SS25-demo.html`, un jeu autonome hors ligne. Les témoins, les auteurs de cartes et les outils de recherche restent hors du fichier jouable.

## Les huit salles

| Salle | Problème principal | Référence étudiée |
| --- | --- | --- |
| 1 — Le chantier des quatre gestes | Comparer les capacités et les transports passifs ; conserver les appuis et les poids du départ. | Atelier original, monde Nord |
| 2 — Le quai à deux réceptions | Préparer le réceptionnaire, dégager la première charge sans perdre son poids puis réceptionner le miroir. | Heroes and Stones, East 2 |
| 3 — Les deux formes du pont | Employer les appuis séparément, puis les réunir sans sacrifier les deux charges livrées. | Heroes and Stones, East 4 |
| 4 — La cale que l’on reprend | Retirer un masque de visée, lui substituer un poids sans coupure, puis réemployer la même caisse. | Heroes and Light 29 |
| 5 — La cale qui change de côté | Réorganiser une file de caisses et de miroir, maintenir le service et extraire la cale latéralement. | Heroes and Light 30 |
| 6 — Le dernier usage de la butée | Employer une cible sèche avant son immersion, préparer un nouveau retour puis récupérer le poids de service. | Heroes and Artifacts 9 |
| 7 — Le retour de la troisième charge | Maintenir une charge par une butée, rapporter une troisième caisse et changer la configuration du retour. | Heroes, Doubled 10 |
| 8 — Les deux accès avant le retour | Préparer les miroirs et remplacer le Magicien sur la presse avant de libérer deux commandes. | Heroes and Water 22 |

Les références proviennent des index [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/). Le [dossier des adaptations](docs/source-audit.md) décrit la lecture et les transformations réelles. Les numéros choisis diffèrent de SS24 ; la comparaison géométrique couvre aussi les 88 cartes SS14–SS24. Ni les nouveaux numéros ni l’absence de terrain identique ne suffisent à mesurer la difficulté.

## Un tutoriel dense, fondé sur l’observation

Les 39 découvertes expliquent la poussée de file du Guerrier, la prise unique du Voleur, la priorité de la première cible du Magicien, la portée et les butées du Barde, les transports de partenaires sans leur pouvoir, les échanges de poids, les miroirs, les presses latérales, l’eau et les appuis, ainsi que les contacts simultanés des monstres.

Les acquisitions utilisent les pixels et les transitions de l’observation publique. Une simple sélection, un geste refusé ou le transport passif d’un héros ne vaut pas démonstration de son pouvoir volontaire. **Les découvertes ne constituent pas un quota de victoire.** Les quatre héros vivants doivent occuper simultanément les quatre destinations ; chaque destination peut recevoir n’importe lequel des héros.

Le Guerrier ne possède aucune immunité ni attaque spéciale. Les monstres restent immobiles sans cause de transport ; ils frappent leurs voisins orthogonaux après la résolution des mécanismes. Deux monstres adjacents s’éliminent simultanément, sans protéger un héros qui serait aussi leur voisin.

## Commandes

- **Flèches** : agir avec le héros sélectionné.
- **1 / 2 / 3 / 4**, les boutons de rôle ou un clic : Guerrier / Voleur / Magicien / Barde ; **Tab** : sélection suivante.
- **X** ou action 5 : activer les reflets. L’interface native accepte également Espace.
- **Undo**, **Reset**, **Restart** et choix du niveau : disponibles dans les interfaces.

Une caisse déposée dans l’eau nue devient un appui. Un appui occupé par un héros, ou placé sous l’arrivée immédiate du Barde, reste ancré. Un appui libre ne glisse que d’eau en eau ; le chant ne déplace jamais les miroirs. Les règles détaillées et les 39 identifiants pédagogiques figurent dans la [spécification](docs/specification.md).

## Construire et vérifier

Depuis ce laboratoire :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
node scripts/package-delivery.mjs
```

Après une modification d’auteur, `node scripts/sync-levels.mjs` synchronise les huit cartes, les objectifs, les références et les témoins. Recompiler et requalifier ces mêmes octets avant de livrer. Les scripts d’auteur sont sous `reference/author/` ; aucune génération ou résolution d’auteur ne s’exécute pendant une partie.

Les résultats sont consignés dans la [validation](docs/validation.md) et la [note d’intégration native](../../docs/migration/ss25-native-integration.md). Les revues conservent leurs contre-branches et variantes gagnantes. Une route d’auteur démontre la jouabilité ; elle ne démontre ni optimum, ni unicité, ni résolution autonome par SRA.

## Livraison et suite

La [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) suit l’intégration et conserve le reçu de publication. La [feuille de route](docs/roadmap.md) distingue la création des 25 campagnes de leur résolution par l’agent. Le [prompt de reprise](docs/codex-integration-prompt.md) impose d’inspecter l’état courant de `main` et du Site avant de modifier ou republier une campagne déjà intégrée.
