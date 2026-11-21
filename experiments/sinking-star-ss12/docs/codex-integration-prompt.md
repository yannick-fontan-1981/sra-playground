# Intégration native de SS12

Travaille dans `yannick-fontan-1981/sra-playground`, depuis la branche canonique actuelle. Lis `AGENTS.md` et `docs/migration/git-site-sync-policy.md` avant modification.

Intègre **SS12 — La Colonne en Marche**, duo **Guerrier rouge + Barde magenta**, au groupe Custom 4 en suivant le raccordement natif de SS11.

## Source autoritative du laboratoire

`experiments/sinking-star-ss12/`

Lis `README.md`, `docs/specification.md`, `docs/level-design.md`, `docs/validation.md` et `docs/roadmap.md`. Les cartes finales sont dans `src/levels.ts`. Les huit références et parcours d’auteur sont dans `reference/levelN-design.json` et `tests/witnesses.json`.

## Travail demandé

1. Ajouter l’adaptateur natif, l’entrée de catalogue, la vignette, le lien direct et la sélection de SS12, avec ses huit niveaux dans le même ordre. Le tutoriel reste en première position.
2. Réutiliser le moteur déterministe du laboratoire. Préserver ACTION1–6, les images 64 × 64, la palette, les durées des animations, les deux héros et les deux destinations.
3. Raccorder les contrôles manuels, la sélection par clic/Tab/1/2, les reflets, Annuler, Recommencer et Repartir. La victoire et la défaite attendent la dernière image d’animation.
4. Préserver les explications, sources et treize découvertes du tutoriel. L’agent SRA n’a accès qu’au contrat public du jeu ; ni les références d’auteur ni les parcours témoins ne doivent entrer dans son observation ou sa décision.
5. Vérifier les huit parcours dans l’adaptateur puis dans le navigateur, le changement de niveau, les images, les fins de niveau, les annulations et les contrôles au format mobile. Rejouer les contrôles de non-régression Custom 4 concernés.
6. Si le raccordement modifie un chemin partagé du runtime, mesurer le coût global avant/après dans les mêmes conditions. Respecter la tolérance globale convenue de +10 % ; un dépassement de phase isolée est acceptable si le global reste dans cette limite.
7. Commiter, pousser, intégrer sur la branche canonique puis publier le Site depuis cet état. Vérifier le lien entre commit GitHub et SHA source de la version Site. Conserver l’accès actuel au Site.

Les parcours d’auteur servent seulement à la validation du jeu. Leur réussite ne signifie pas que SRA a appris ou résolu SS12. Évaluer l’agent séparément sans lui donner les itinéraires.

Au compte rendu, préciser branche, commit local, commit poussé, commit intégré, version Site, SHA source, état de synchronisation et prochaine étape.
