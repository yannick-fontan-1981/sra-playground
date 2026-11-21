# SS12 — feuille de route

## Périmètre de cette étape

Livrer le laboratoire autonome **La Colonne en Marche**, huit salles Guerrier–Barde, tutoriel dense et adaptations identifiées de North/Crossovers. Le raccordement au catalogue Playground est suivi séparément.

| Étape | État | Preuve ou suite |
| --- | --- | --- |
| Duo et moteur commun | **100 %** | 25 tests, règles de chant/poussée/reflets/circuits/eau/combat. |
| Tutoriel de treize découvertes | **100 %** | Parcours L1, 13/13 découvertes depuis les pixels. |
| Huit salles et références | **100 %** | Huit références d’auteur et métadonnées synchronisées. |
| Solvabilité de la campagne | **100 %** | 526 entrées, zéro refus, zéro mort, état WIN. |
| HTML autonome et comportements DOM | **100 %** | Build et rapport `ui-dom-report.json`. |
| Contrôle visuel en navigateur | **Bloqué** | Politique de l’environnement ; voir `validation.md`. |
| Intégration au catalogue natif | **À faire** | Prompt préparé dans `codex-integration-prompt.md`. |
| Publication Site et vérification GitHub ↔ Site | **À faire après intégration** | Aucun déploiement du laboratoire seul. |

Le contenu du laboratoire est terminé. Le blocage du contrôle navigateur reste explicite ; le taux de contenu ne vaut pas certification du rendu CSS ni résultat de SRA.

## Prochaine étape

Raccorder SS12 au catalogue Custom 4 depuis ces sources, puis vérifier le comportement et le rendu dans un navigateur autorisé. Conserver le tutoriel en niveau 1, les règles du duo, les durées et l’annulation des animations. Évaluer ensuite SRA séparément depuis les seules observations publiques.

Appliquer la politique du dépôt pour cette intégration : tests → commit → push GitHub → intégration canonique → publication Site → vérification des SHA. Respecter la tolérance globale de +10 % si un chemin partagé de l’agent est modifié.
