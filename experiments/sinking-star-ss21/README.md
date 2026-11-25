# SS21 — Les Quatre Destinations

Laboratoire autonome **0.1.0** : huit salles pour le **Marchand, le Guerrier, le Voleur et le Magicien**, avec quatre destinations à occuper simultanément. Le Marchand est sélectionné au départ. Le premier niveau, **L’école des quatre**, propose **31 découvertes**, reconnues dans les images publiques du jeu.

La campagne associe les quatre capacités à des problèmes distincts : libérer des chambres, distribuer les départs d’un miroir mobile, interrompre une boucle optique, remplacer des poids sans couper leur circuit, construire des passages et conserver un gardien utile. Les cartes sont originales ; leurs principes d’adaptation sont attribués dans [l’audit des sources](docs/source-audit.md).

## Construire et jouer

Depuis la racine du dépôt, avec **Node.js 22 ou ultérieur** et npm :

```sh
cd experiments/sinking-star-ss21
npm ci
npm run build
```

Ouvrir ensuite **`dist/SS21-demo.html`** dans un navigateur. Ce fichier contient le jeu, les cartes, les animations, le tutoriel et l’interface ; jouer ne demande ni serveur ni connexion réseau. Les liens de référence sont facultatifs et ouvrent des pages externes. Les témoins d’auteur, le solveur et les scripts de vérification ne sont pas incorporés au HTML.

### Commandes

La grille doit avoir le focus pour les raccourcis clavier.

| Commande | Effet |
| --- | --- |
| Flèches ou boutons directionnels | Action du personnage sélectionné ; le Magicien échange avec sa première cible avant d’envisager un pas. |
| Clic sur un héros, boutons de rôle, `1` / `2` / `3` / `4` | Sélectionner Marchand / Guerrier / Voleur / Magicien. |
| `Tab` dans la grille | Sélectionner le personnage suivant. |
| `Espace` ou `X` | Activer les reflets géométriques des miroirs. |
| `Z` ou **Annuler** | Revenir avant l’action et toute sa cascade ; disponible pendant l’animation. |
| `R` ou **Recommencer** | Restaurer la salle courante. |
| Sélecteur de niveau | Essayer directement une salle. |
| Bouton de reprise depuis le niveau 1 | Réinitialiser la campagne complète. |

Le compteur de découvertes est pédagogique : aucune découverte n’est un péage caché pour terminer le tutoriel. Une défaite reste annulable.

## Les huit salles

| Niveau | Salle | Travail demandé |
| --- | --- | --- |
| 1 | L’école des quatre | Découvrir les pouvoirs, les relèves, l’eau, les reflets et une rencontre de monstres commandée par presse. |
| 2 | Trois caisses, deux chambres | Remplacer deux prisonniers par deux caisses et conserver le dernier poids pour l’accès commun. |
| 3 | Les quatre balcons | Déplacer un unique miroir entre ses postes et garder un manipulateur pour le dernier départ. |
| 4 | Le rectangle sans issue | Injecter une caisse dans une visée bouclée, puis la récupérer comme poids. |
| 5 | Le dernier intercepteur | Relever deux commandes, puis interposer un partenaire pour libérer le Magicien sans reprendre la caisse finale. |
| 6 | Le compte des îlots | Répartir quatre caisses entre trois appuis permanents et une commande sèche. |
| 7 | L’écluse à deux étages | Éliminer le gardien par retrait du soutien, rendre le passage permanent et livrer deux poids. |
| 8 | Le verrou à trois poids | Conserver le gardien, extraire une réserve isolée et financer deux poids secs plus le passage d’eau. |

Les distinctions avec SS16–SS20 et les limites des arguments de conception figurent dans [la conception des niveaux](docs/level-design.md).

## Vérifier

Depuis ce dossier :

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

`test` et `validate` reconstruisent le HTML. Les deux autres commandes examinent ce build et ses cartes : les exécuter après une reconstruction. Les résultats mesurés, leur portée et les éventuelles limites sont consignés dans [la validation](docs/validation.md), séparément de cette description du jeu. `scripts/package-delivery.mjs` peut ensuite lier le HTML, les sources et les rapports réussis dans un manifeste de livraison.

Les parcours de `reference/levelN-design.json` et de `tests/witnesses.json` sont des témoins d’auteur. Ils servent à rejouer les salles et à examiner leurs étapes ; leur existence ne démontre ni une solution optimale, ni un ordre unique, ni la réussite de l’agent SRA.

## Organisation

- [Spécification](docs/specification.md) : règles, API publique et liste des 31 découvertes.
- [Conception](docs/level-design.md) : topologies, ressources, enseignements et portée des contrôles.
- [Sources](docs/source-audit.md) : références précises et différences assumées avec le jeu d’origine.
- [Validation](docs/validation.md) : exécutions et résultats de qualification.
- [Feuille de route](docs/roadmap.md) et [consignes d’intégration](docs/codex-integration-prompt.md) : livraison dans SRA Playground.
- `src/core.ts` : moteur déterministe ; `src/levels.ts` : campagne ; `src/tutorial.ts` : détection des découvertes ; `src/browser.ts` et `index.template.html` : démonstration autonome.
- `reference/` et `tests/` : matériel d’auteur et de vérification, séparé du programme livré.

## Intégration et sauvegarde

Le dépôt canonique est [yannick-fontan-1981/sra-playground](https://github.com/yannick-fontan-1981/sra-playground). Le laboratoire autonome et l’intégration native sont deux surfaces à qualifier. Le raccordement natif est réalisé dans le chantier de cette livraison ; le statut des contrôles finaux, les commits et la publication éventuelle sont tenus dans la feuille de route et le compte rendu de livraison.

Une construction du HTML ou un parcours gagné dans le laboratoire ne constitue pas une publication du Site. Toute publication suit les règles du dépôt : **tests → commit → push GitHub → intégration sur `main` → publication → vérification GitHub/Site**.
