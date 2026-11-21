# SS13 — feuille de route

## Laboratoire autonome

| Étape | Avancement | État vérifié |
| --- | ---: | --- |
| Duo Voleur–Magicien et moteur | 100 % | 31 tests moteur réussis |
| Tutoriel de quatorze découvertes | 100 % | Niveau 1, 77 actions, 14/14 détections publiques |
| Huit salles et adaptations documentées | 100 % | Références, cartes et témoins synchronisés |
| Finales 7 et 8 durcies — version 0.2.0 | 100 % | 231 et 212 entrées ; réemploi des ressources et circuits liés, 16 contrefactuels indépendants réussis |
| Solvabilité de la campagne | 100 % | 781 entrées, 0 refus, 0 mort, 8/8 victoires |
| HTML autonome et interface DOM | 100 % | Pixels, temporisation, contrôles et annulation vérifiés |
| Contrôle visuel natif | À faire | Environnement précédent bloqué, aucun contournement |
| Intégration Custom 4 dans le Playground | À faire | Prompt dans `codex-integration-prompt.md` |
| Publication Site et synchronisation | À faire après intégration | Chaîne GitHub→Site obligatoire |

La version 0.2.0 reconstruit les deux finales. Les six premières cartes et les règles du moteur sont identiques à la version 0.1.0. La longueur des témoins ne représente pas une difficulté mesurée ni un minimum de coups.

Le contenu du laboratoire est terminé. Ce taux ne vaut ni validation CSS native ni résolution autonome par SRA.

## Prochaine étape

Raccorder les sources de SS13 au catalogue Custom 4, vérifier l’adaptateur et l’interface dans un navigateur autorisé, puis publier le Site existant depuis l’état testé et intégré sur GitHub. Préserver l’accès actuel du Site.

Appliquer `AGENTS.md` et `docs/migration/git-site-sync-policy.md` : travail→tests→commit→push→intégration main→publication→vérification des identités GitHub/Site. Si l’intégration modifie le runtime partagé, respecter la tolérance globale de +10 % avec une comparaison avant/après homogène.

L’agent ne reçoit que les observations publiques. Une campagne SRA reste distincte des témoins d’auteur.
