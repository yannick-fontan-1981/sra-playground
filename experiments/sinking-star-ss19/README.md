# SS19 — La Chasse Noire

**Laboratoire autonome 0.1.0 · huit niveaux · Guerrier, Magicien et Barde.**

SS19 ajoute une poursuite déterministe aux règles de la série. Après un geste effectif, les monstres survivants tentent un pas vers le héros sélectionné. L’axe de plus grande distance décide ; la verticale gagne les égalités. Un obstacle les retient sans détour. Changer de héros ne consomme aucun tour et permet de choisir la cible suivante.

## Jouer

```sh
npm ci
npm run build
```

Ouvrir `dist/SS19-demo.html` dans un navigateur. Le fichier est autonome : aucun accès réseau n’est nécessaire pour jouer. La démo livrée est identifiée par son SHA-256 dans `validation/delivery.json`.

Commandes : flèches ; 1 / 2 / 3 ou Tab pour changer de héros ; clic sur un personnage ; Espace / X pour les reflets ; Z pour Annuler ; R pour Recommencer. Des boutons tactiles sont disponibles. Annuler restaure le geste, la poursuite et les cascades. Les avertissements rouges des miroirs et les fonds opaques des boutons et presses sont conservés.

## Campagne

Le niveau 1 propose **31 découvertes**, suivies uniquement depuis les pixels publics : poussées en file, déplacement imposé de partenaires, visée déviée, chant sélectif à travers les murs, appuis, reflets, commandes, presses et chasse. Chaque sortie possède un verrou. Les coches enseignent les règles et ne font pas partie de la condition de victoire.

Les autres cartes alternent gardien utilisé comme poids, commande optique réversible, capture hydraulique, choix des monstres à conserver, effet retardé des reflets, suppression d’un relais et finale à deux gardiens vivants. Les géométries sont originales, inspirées des guides [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/). Les références numérotées et les adaptations sont affichées par salle.

Les comptes ci-dessous décrivent les parcours de qualification ; ils ne sont pas des minima et ne mesurent pas la difficulté.

| Niveau | Titre | Actions hors sélection | Sélections |
| --- | --- | ---: | ---: |
| 1 | Les galeries de la première chasse | 184 | 17 |
| 2 | Le gardien du seuil | 48 | 8 |
| 3 | L’interrupteur hors d’atteinte | 132 | 18 |
| 4 | Le gardien de la vanne | 134 | 9 |
| 5 | Le troisième doit rester vivant | 128 | 15 |
| 6 | La seconde image | 64 | 10 |
| 7 | Le relais condamné | 43 | 9 |
| 8 | Les deux gardiens vivants | 103 | 12 |
| **Total** | **934 entrées de qualification** | **836** | **98** |

Le niveau 8 exige physiquement sa caisse unique pour entrer sur une île vide, puis ses deux gardiens vivants comme poids pour les deux autres destinations. La conception conserve des variantes légales documentées : en N4, une réserve peut rester sèche pendant le transport ; en N5, une relève plus élaborée peut remplacer la seconde presse ; en N8, un autre départ optique évite la visée coudée. Aucun historique de solution n’est imposé.

## Qualification

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

- 75 tests de moteur, session, poursuite et pédagogie.
- Huit témoins complets avec zéro refus et zéro perte de héros.
- Rejeu des huit salles depuis L1 dans le HTML compilé, via les commandes DOM, avec comparaison des pixels et durées ; annulation puis répétition de chaque victoire.
- Quatre scripts de revue, variantes gagnantes et contre-branches observées.
- Comparaison des terrains avec les 40 salles de SS14–SS18, en normalisant translations, rotations et réflexions.

Les rapports complets sont dans `validation/`. Les témoins sont des contrôles d’auteur ; ils ne sont pas embarqués dans le HTML, ne sont pas transmis à SRA et ne démontrent pas une résolution autonome de l’agent. La revue CSS dans un navigateur de production appartient à l’intégration native.

## Documentation

- [Contrat moteur et public](docs/specification.md)
- [Conception des huit niveaux et variantes](docs/level-design.md)
- [Sources et écarts d’adaptation](docs/source-audit.md)
- [Résultats de validation](docs/validation.md)
- [État et prochaine étape](docs/roadmap.md)
- [Prompt Codex pour intégrer SS19 et publier le Site existant](docs/codex-integration-prompt.md)

Le code du laboratoire est conservé dans le dépôt canonique `yannick-fontan-1981/sra-playground`. Cette livraison ne raccorde pas encore SS19 au Site natif. Le compte rendu de session donne la branche, le commit poussé et le commit d’intégration vérifiés.
