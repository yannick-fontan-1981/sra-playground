# SS19 — Les Gardiens Noirs

**Laboratoire autonome 0.2.0 · huit niveaux · Guerrier, Magicien et Barde.**

Les monstres restent sur leur case jusqu’à ce qu’une poussée, un chant, un échange, un reflet ou une presse les déplace. Chaque transport a une cause visible. Un gardien posé sur un bouton reste un poids stable ; il demeure dangereux au contact. La campagne associe ces transports aux caisses, à l’eau, aux miroirs et aux circuits.

## Jouer

```sh
npm ci
npm run build
```

Ouvrir `dist/SS19-demo.html` dans un navigateur. Le fichier est autonome : aucun accès réseau n’est nécessaire pour jouer. La démo livrée est identifiée par son SHA-256 dans `validation/delivery.json`.

Commandes : flèches ; 1 / 2 / 3 ou Tab pour changer de héros ; clic sur un personnage ; Espace / X pour les reflets ; Z pour Annuler ; R pour Recommencer. Des boutons tactiles sont disponibles. Annuler restaure le geste et toutes ses cascades. Les avertissements rouges des miroirs, les fonds gris opaques des boutons et les centres noir fermé / gris ouvert des presses sont conservés.

## Campagne

Le niveau 1 propose **31 découvertes**, suivies uniquement depuis les pixels publics : poussées en file, déplacement imposé de partenaires, visée déviée, chant sélectif à travers les murs, appuis, reflets, commandes, presses et transports des monstres. Chaque sortie possède un verrou. Les coches enseignent les règles et ne font pas partie de la condition de victoire.

La refonte concerne toutes les salles avec monstres : le tutoriel N1, les livraisons N2/N4/N5/N8 et la requalification de N7. Les cartes et commandes de qualification de N3 et N6 restent inchangées. N7 conserve aussi sa carte et son témoin ; son gardien reste sur place jusqu’à un transport imposé.

Les géométries sont originales, inspirées des guides [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/). Les références numérotées et les adaptations sont affichées par salle. SS19 0.2.0 reprend les contraintes de placement des gardiens sans reproduire la poursuite des sources.

Les comptes ci-dessous décrivent les parcours de qualification ; ils ne sont pas des minima et ne mesurent pas la difficulté.

| Niveau | Titre | Entrées | Sélections | Actions hors sélection |
| --- | --- | ---: | ---: | ---: |
| 1 | Les galeries des gardiens | 208 | 20 | 188 |
| 2 | Le gardien du seuil | 62 | 8 | 54 |
| 3 | L’interrupteur hors d’atteinte | 150 | 18 | 132 |
| 4 | Le gardien de la vanne | 135 | 12 | 123 |
| 5 | Le troisième doit rester vivant | 134 | 13 | 121 |
| 6 | La seconde image | 74 | 10 | 64 |
| 7 | Le relais condamné | 52 | 9 | 43 |
| 8 | Les deux gardiens vivants | 97 | 15 | 82 |
| **Total** | | **912** | **105** | **807** |

N2 livre son gardien avec trois presses à commandes distinctes, puis exige un monstre et une caisse comme poids finaux. N4 articule chant, soutien escamotable et deux réserves à transporter. N5 sépare la conservation du troisième gardien, la rencontre de la paire et la livraison de la caisse haute. N8 combine livraison par chant et livraison par reflet puis presse : sa caisse unique permet l’entrée sur une île vide, et ses deux gardiens vivants maintiennent les deux autres destinations.

Les revues conservent les alternatives légales requalifiées : N4 autorise notamment de retirer le soutien avant le chant ou de traverser le pont en chantant ; N7 peut garder son monstre vivant ; N8 admet une livraison par chant remplaçant la presse verte et une récupération optique de la caisse. Aucun historique de solution ni quota de mécanismes n’est imposé.

## Qualification

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

- **78 tests** de moteur, session, transports physiques et pédagogie.
- Huit témoins complets avec zéro refus et zéro perte de héros.
- Rejeu depuis L1 dans le HTML compilé, via les commandes DOM : **2 615 images**, pixels et durées comparés ; annulation puis répétition de chaque victoire.
- **29 cas UI de mécanismes**, complétés par les contrôles des reflets, dispositifs, interruptions et commandes.
- Quatre scripts de revue, **88 contrôles ciblés**, variantes gagnantes et contre-branches observées.
- Comparaison des terrains avec les 40 salles de SS14–SS18, en normalisant translations, rotations et réflexions.
- Conservation vérifiée des cartes et témoins N3, N6 et N7 par comparaison avec la version précédente.

Les rapports complets sont dans `validation/`. Les témoins sont des contrôles d’auteur ; ils ne sont pas embarqués dans le HTML, ne sont pas transmis à SRA et ne démontrent pas une résolution autonome de l’agent. La revue CSS dans un navigateur de production appartient à l’intégration native.

## Documentation

- [Contrat moteur et public](docs/specification.md)
- [Conception des huit niveaux et variantes](docs/level-design.md)
- [Sources et écarts d’adaptation](docs/source-audit.md)
- [Résultats de validation](docs/validation.md)
- [État et prochaine étape](docs/roadmap.md)
- [Prompt Codex pour intégrer SS19 et publier le Site existant](docs/codex-integration-prompt.md)

Le code du laboratoire est conservé dans le dépôt canonique `yannick-fontan-1981/sra-playground`. L’intégration native et la publication de SRA Playground constituent la prochaine phase. Le compte rendu de session donne la branche, le commit poussé et le commit d’intégration vérifiés.
