# Intégrer SS13 dans SRA Playground et publier le Site

Travaille dans `yannick-fontan-1981/sra-playground` depuis le `main` distant à jour. Lis `AGENTS.md`, `docs/migration/git-site-sync-policy.md` et les instructions applicables. Crée une branche ou un worktree dédié et préserve les travaux concurrents.

Intègre nativement **SS13 — L’Ancre Verte**, duo **Voleur vert 14 + Magicien violet 15**, dans **Custom 4**, puis publie le **Site SRA Playground existant** depuis le code testé, poussé et intégré sur `main`. Conserve ses paramètres d’accès actuels.

## Sources

Le laboratoire est `experiments/sinking-star-ss13/`. Lis son `README.md`, `docs/specification.md`, `docs/level-design.md`, `docs/source-audit.md`, `docs/validation.md` et `docs/roadmap.md`.

Utilise la **campagne 0.2.0 ou ultérieure**, avec les niveaux 7 et 8 reconstruits et durcis. Les anciennes salles de 49 et 48 entrées appartiennent à la version 0.1.0 et ne doivent pas remplacer ces nouvelles cartes. Vérifie la parité avec les références actuelles et consulte `validation/hard-finals-report.json` ; conserve les règles du contrat moteur 0.1.0.

Réutilise `src/core.ts`, les huit cartes `src/levels.ts`, leurs textes `src/level-info.ts` et le tutoriel `src/tutorial.ts`. Inspecte le raccordement natif de SS11 et les éventuels jeux SS intégrés plus récemment. Adapte le modèle actuel du catalogue, du dispatcher, de l’interface et des tests Custom 4.

## Travail

1. Ajouter l’adaptateur natif, l’entrée de catalogue Custom 4, la vignette, la sélection et le lien direct SS13. Conserver les huit niveaux dans leur ordre, tutoriel en premier.
2. Préserver le contrat public ACTION1–6, les images 64 × 64, les couleurs 14/15, toutes les frames et durées, les deux héros et les deux destinations simultanées. ACTION6 utilise des coordonnées pixel entières 0–63 et ne déclenche aucun tour.
3. Réutiliser les règles du laboratoire : traction d’un seul occupant arrière sans poussée, premier échange aligné ou par rayon dévié, reflet prioritaire/proche ou échange égal, appuis fixes, presses, stabilisation hydraulique et combats simultanés. Un déplacement forcé ne déclenche aucune capacité.
4. Raccorder clavier, boutons, clic, Tab/1/2, reflets, Annuler, Recommencer et Repartir. Préserver l’interruption d’animation, les préférences de réduction des animations et les écrans terminaux différés.
5. Préserver les quatorze découvertes détectées depuis les pixels, les aides contextuelles et les références, y compris les liens secondaires. Aucun témoin, solveur ou état privé ne doit entrer dans la décision ou l’observation de SRA.
6. Rejouer les huit témoins dans l’adaptateur, puis vérifier dans un navigateur le jeu intégré, les contrôles, les huit niveaux, l’annulation et les formats ordinateur/mobile. Le laboratoire est validé dans Happy DOM, mais son rendu dans un véritable navigateur reste à contrôler : ne pas assimiler les deux validations.
7. Exécuter les tests, TypeScript et build requis, ainsi que les non-régressions Custom 4 pertinentes. Si un chemin partagé du runtime est modifié, comparer le coût global avant/après dans les mêmes conditions, avec la tolérance globale de +10 % convenue.
8. Commiter et pousser régulièrement ; intégrer les changements testés sur le `main` actuel sans écraser les avancées concurrentes. Vérifier le commit distant, publier depuis cet état, puis contrôler le chargement de SS13, le lien direct et les commandes sur le Site déployé.

Commandes du laboratoire : `npm test`, `npm run validate`, `node scripts/verify-design-constraints.mjs`, `node scripts/audit-hard-finals.mjs`, `node scripts/verify-ui-dom.mjs`. Le dernier script requiert Happy DOM (`HAPPY_DOM_MODULE` optionnel). Le script `verify-ui-browser.mjs` prépare le contrôle du laboratoire avec Playwright/Chromium ; il ne remplace pas celui de l’intégration Playground.

Les témoins prouvent la solvabilité, pas une réussite autonome de SRA. Toute exécution de l’agent doit être évaluée séparément depuis les seules observations publiques.

## Publication et compte rendu

Respecter : **tests → commit → push GitHub → intégration main → publication Site → vérification GitHub/Site**.

Relever la version publiée et son SHA source lorsqu’il est exposé, puis vérifier leur correspondance avec le commit GitHub durable. En cas de divergence, préserver les deux états et les réconcilier. Si le SHA source n’est pas exposé, préciser la limite et consigner le commit utilisé pour publier, sans inventer de preuve.

Mettre à jour la documentation et donner : résultat fonctionnel, tests, vérification navigateur, branche, SHA local/poussé/intégré, URL du Site et lien SS13, version Site, SHA source disponible, état de synchronisation et éventuelles limites. Si une capacité manque réellement, conserver le travail sur GitHub et nommer le blocage exact.
