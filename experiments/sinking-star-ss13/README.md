# SS13 — L’Ancre Verte

Laboratoire autonome du treizième jeu de la série Sinking Star pour SRA Playground. Le **Voleur vert (14)** tire un seul occupant en reculant. Le **Magicien violet (15)** échange avec la première cible de sa visée, y compris à travers les faces blanches des miroirs.

La campagne comprend **huit salles**, avec un **tutoriel de quatorze découvertes au niveau 1**. Les adaptations s’appuient sur des énigmes identifiées des guides [North](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/). Les cartes sont originales ; les contraintes reprises et les différences sont déclarées dans `docs/source-audit.md` et `docs/level-design.md`.

## Jouer et reconstruire

Depuis ce répertoire, avec Node et TypeScript 5.9.3 :

```sh
npm install
npm run build
```

Ouvrir `dist/SS13-demo.html`. Le fichier contient l’interface, le moteur et les huit cartes ; aucun accès réseau n’est nécessaire pour jouer. Les liens de référence sont externes et facultatifs.

- Flèches : marcher / tirer avec le Voleur ; viser / échanger avec le Magicien.
- Clic sur un héros, Tab ou 1/2 : sélectionner, sans tour du monde.
- Espace ou X : activer les miroirs.
- Z : annuler toute la dernière action et ses cascades.
- R : recommencer le niveau ; Repartir : revenir au niveau 1.
- Maj+Tab : quitter le focus de la grille.

## Contenu

Les cartes finales sont dans `src/levels.ts`, les textes et crédits dans `src/level-info.ts`, le moteur déterministe dans `src/core.ts`, et les découvertes détectées à partir des pixels publics dans `src/tutorial.ts`.

Les scripts `reference/author/build-levelN.mjs` fabriquent les cartes et vérifient leurs parcours. Leurs résultats `reference/levelN-design.json` gardent cartes, références, choix d’adaptation, étapes et témoins. `scripts/sync-levels.mjs` synchronise cartes, crédits et `tests/witnesses.json`. Ces outils et itinéraires sont absents du HTML jouable.

```sh
npm test
npm run validate
node scripts/verify-ui-dom.mjs
```

Le dernier contrôle exige Happy DOM ; `HAPPY_DOM_MODULE` peut désigner son module installé. `scripts/verify-ui-browser.mjs` prépare la vérification dans un navigateur autorisé, avec Playwright/Chromium. Le rapport de livraison distingue explicitement le contrôle DOM du rendu natif encore non validé.

## Documents

- `docs/specification.md` : règles et contrat public.
- `docs/level-design.md` : progression et contraintes de chaque salle.
- `docs/source-audit.md` : références précises et limites des adaptations.
- `docs/validation.md` : résultats et reproduction.
- `docs/roadmap.md` : état du laboratoire et prochaine étape.
- `docs/codex-integration-prompt.md` : raccordement natif à Custom 4 et publication ultérieure.

Les témoins prouvent la solvabilité du jeu. Ils ne constituent pas une évaluation de SRA. Cette livraison ajoute uniquement le laboratoire ; l’adaptateur natif et la publication du Site sont une étape distincte.
