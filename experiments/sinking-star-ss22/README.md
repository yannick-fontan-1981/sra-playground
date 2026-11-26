# SS22 — Les Cortèges Mécaniques

Campagne de huit salles pour **Marchand, Guerrier, Voleur et Barde**, avec un tutoriel de **33 découvertes observées dans les images publiques**. Les énigmes travaillent les positions relatives, les départs sans déclencher une capacité, la sélection par la portée du chant, les itinéraires de livraison et la réorganisation d’appuis immergés.

Le livrable autonome est [dist/SS22-demo.html](dist/SS22-demo.html). Il contient le moteur, les huit cartes et l’interface ; il se joue sans réseau. Les scripts d’auteur et leurs solutions restent dans `reference/` et ne sont pas intégrés au jeu. L’intégration au Playground et la publication sont suivies depuis la racine du dépôt ; le présent laboratoire et ses rapports ne constituent pas, à eux seuls, une attestation de publication.

## Jouer et reconstruire

Depuis ce répertoire, avec Node.js 22 ou plus récent :

```bash
npm ci
npm run build
```

Ouvrir ensuite `dist/SS22-demo.html`. Pour servir le dossier localement, on peut utiliser :

```bash
python3 -m http.server 4173 --directory dist
```

Le jeu est alors disponible à `http://localhost:4173/SS22-demo.html`.

| Commande | Effet |
| --- | --- |
| Flèches | Déplacer le héros choisi et appliquer sa capacité |
| Clic sur un héros | Le sélectionner sans faire avancer le monde |
| `1`, `2`, `3`, `4` | Choisir Marchand, Guerrier, Voleur, Barde |
| `Tab` | Passer au héros suivant |
| `X` ou espace | Déclencher les reflets des miroirs |
| `Z` | Annuler la dernière action, avec ses effets en cascade |
| `R` | Recommencer la salle |

Les quatre contours jaunes doivent être occupés ensemble. Les découvertes du tutoriel accompagnent l’apprentissage ; leur compteur n’est pas une condition supplémentaire de victoire.

## Les huit salles

Les nombres ci-dessous sont ceux des témoins d’auteur qualifiés, sélections comprises. Ils mesurent une solution disponible, sans annoncer un minimum.

| Niveau | Salle | Enseignement principal | Entrées |
| --- | --- | --- | ---: |
| 1 | L’école des cortèges | Comparer les quatre rôles, les transports imposés, les miroirs, les presses et les appuis | 321 |
| 2 | La marche à deux temps | Chanter pour avancer une charge, puis replacer la Barde sans chanter | 185 |
| 3 | L’atelier du décrochage | Faire partir le Voleur en laissant sa charge sur place | 106 |
| 4 | La frontière du chant | Atteindre un gardien depuis le bord de la portée et préserver une réserve sèche | 203 |
| 5 | Les entrées décalées | Livrer trois charges par des approches différentes et préparer le départ de l’opérateur | 198 |
| 6 | Le quartier des reprises | Commander une charge depuis plusieurs rues et décharger au bon carrefour | 136 |
| 7 | Les cales du bassin | Débarquer, changer la formation de deux appuis vides, puis rétablir le passage | 149 |
| 8 | La dernière traverse | Déposer un appui pour le retour de la caisse, construire avec les deux autres et effectuer une relève continue | 116 |

Total qualifié : **1 414 entrées, dont 173 sélections**, sans refus ni perte dans les huit témoins. Le parcours du niveau 1 observe les **33 découvertes** avant de quitter sa salle. Les données détaillées sont dans [validation/levels-report.json](validation/levels-report.json).

## Contrat des quatre rôles

| Rôle | Capacité volontaire |
| --- | --- |
| Marchand | Pousse un seul occupant vers une arrivée libre |
| Guerrier | Pousse toute une file contiguë, éventuellement composée de héros et d’objets |
| Voleur | Tire l’occupant immédiatement derrière lui lorsqu’il avance ; il ne pousse pas |
| Barde | Déplace d’une case les participants possibles de son carré de portée de 5×5, centré sur sa position de départ |

Un héros déplacé par un partenaire, un chant, une presse ou un reflet ne déclenche pas sa propre capacité. Les miroirs ne suivent pas le chant. Un participant bloqué du chant reste sur place ; une arrivée impossible de la Barde ou la perte d’un appui nécessaire à un héros fait refuser l’action.

Une caisse immergée dans une case sans appui devient un appui. **Les appuis glissent au chant d’eau en eau ; un appui occupé par un héros reste ancré et ne transporte pas son passager.** L’arrivée de la Barde ancre également l’appui qu’elle va emprunter. Les monstres restent immobiles hors d’un effet physique et leurs contacts orthogonaux sont dangereux, y compris pour les héros inactifs.

Le contrat complet est implémenté dans [src/core.ts](src/core.ts). Les cartes et crédits livrés se trouvent dans [src/levels.ts](src/levels.ts) et [src/level-info.ts](src/level-info.ts).

## Vérifier le laboratoire

```bash
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Les revues d’auteur se relancent aussi séparément :

```bash
node reference/author/review-intro-ss22.mjs
node reference/author/review-middle-ss22.mjs
node reference/author/review-final-ss22.mjs
node reference/author/independent-review-ss22.mjs
```

Les quatre revues disponibles totalisent **69 contrôles** : 12 pour l’introduction, 17 pour les salles centrales, 24 pour les finales et 16 pour la revue indépendante. Les variantes sont conservées avec leurs résultats. Une variante gagne notamment le niveau 3 sans impulsion de presse, et une autre utilise l’entrée basse du niveau 5 grâce au Voleur : l’usage d’un mécanisme dans le témoin n’est donc pas présenté comme sa nécessité exclusive.

La comparaison indépendante des silhouettes de sol, murs et eau, après translation, rotation ou réflexion, ne retrouve aucun terrain identique parmi les **64 salles de SS14 à SS21**. Ce contrôle porte sur la répétition exacte des silhouettes ; il ne mesure pas la difficulté ni toute ressemblance conceptuelle.

Le script `scripts/package-delivery.mjs` lie le HTML à ses rapports réussis et à leurs empreintes lorsque la qualification globale est terminée. Les contrôles natifs du Playground et sa publication sont menés depuis la racine du dépôt.

## Documentation et preuves

- [docs/source-audit.md](docs/source-audit.md) : sources exactes, principes repris et limites des adaptations.
- [docs/level-design.md](docs/level-design.md) : progression pédagogique, descriptions des huit salles et variantes établies.
- [reference/](reference/) : cartes d’auteur, parcours, étapes et contre-épreuves.
- [validation/](validation/) : qualification du moteur, du HTML, de l’interface et des cartes.

Les témoins établissent la solvabilité et les effets décrits. Ils ne certifient ni solution unique, ni optimalité, ni réussite autonome de l’agent SRA.
