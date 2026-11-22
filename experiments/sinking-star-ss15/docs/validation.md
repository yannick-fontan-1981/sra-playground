# SS15 — Validation du laboratoire 0.1.0

## Résultat qualifié

**Les huit salles sont gagnantes, les vingt découvertes du tutoriel sont détectées et les 38 tests moteur réussissent.** Le HTML compilé a été rejoué par ses événements de clavier et de clic, avec comparaison exacte de son tampon canvas et de ses durées d’animation. Les références et les cartes distribuées correspondent.

| Contrôle | Résultat |
| --- | --- |
| Compilation TypeScript stricte et construction autonome | Réussite |
| Tests moteur | 38 / 38 |
| Routes d’auteur | 8 victoires |
| Entrées de la campagne | 724, dont 58 sélections |
| Refus et décès sur ces routes | 0 / 0 |
| Images de la campagne | 2 123 images 64 × 64, indices 0–15 |
| Tutoriel | 20 / 20 découvertes, issues des pixels |
| HTML compilé | Parité de toutes les images et durées des huit routes |
| Fin de chaque salle | Annulée puis rejouée avec succès |
| Revue indépendante des finales | 10 contrôles, 18 branches exécutées |

Le fichier autonome qualifié, `dist/SS15-demo.html`, possède l’empreinte SHA-256 :

```text
ae6663a8cd8e0ca0a0580f8bf948eb02f72b37b3206eec8e3b6454030a426e7c
```

La copie de livraison `SS15-demo-v1.html` doit conserver exactement ces octets. Cette empreinte figure également dans `validation/levels-report.json` et `validation/ui-dom-report.json`.

## Parcours de référence

| Niveau | Entrées | Sélections | Images | Échanges | Chants | Déplacements d’appui | Poussées par presse |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 134 | 10 | 393 | 5 | 10 | 1 | 1 |
| 2 | 49 | 4 | 141 | 1 | 2 | 0 | 0 |
| 3 | 56 | 4 | 162 | 3 | 4 | 0 | 0 |
| 4 | 56 | 6 | 157 | 1 | 9 | 6 | 0 |
| 5 | 39 | 6 | 108 | 2 | 5 | 0 | 0 |
| 6 | 47 | 6 | 152 | 1 | 5 | 0 | 2 |
| 7 | 162 | 12 | 475 | 3 | 42 | 17 | 1 |
| 8 | 181 | 10 | 535 | 4 | 31 | 2 | 1 |
| **Total** | **724** | **58** | **2 123** | **20** | **108** | **26** | **5** |

Les métriques de chants comptent les phases où un autre membre suit effectivement le Barde. Une marche solitaire du Barde n’incrémente pas ce compteur. Le nombre d’entrées comprend les sélections et n’est pas une longueur minimale de solution.

Le validateur vérifie les états finaux, les dimensions et couleurs, les champs publics, les ACTION1–6, les coordonnées pixel, les actions mal formées sans mutation, l’annulation des fins de niveau et l’absence d’outils d’auteur dans le bundle distribué. Il contrôle également les hash de cartes, les crédits et la couverture des mécanismes. Aucun solveur de campagne ne sert de condition de succès.

## Moteur et interface

Les tests moteur couvrent l’échange réciproque et la conservation des poids, la première cible, les rayons à plusieurs coudes et en boucle, les déplacements forcés silencieux, la portée carrée du chant, ses dépendances et butées, les appuis mobiles et ancrés, les reflets simultanés, les presses et déplacements de miroir, les retraits hydrauliques, le combat simultané et la progression de session.

La vérification du **HTML réellement compilé** comprend 26 situations ciblées de rôles et dispositifs. Elle exerce aussi les prévisions de reflet, les conflits entre miroirs, le rayon en boucle, les glyphes des boutons et presses, les touches 1/2 et Tab, les boutons de rôle, les clics en coordonnées publiques, le verrouillage pendant animation, l’annulation et les changements de salle en cours d’animation, la réduction des animations et les panneaux terminaux différés. Elle rejoue ensuite les huit salles complètes, sans remplacer leur logique.

Le tutoriel acquiert ses vingt découvertes au cours des 134 entrées de L1. Les contrôles ciblés vérifient notamment qu’un échange ne produit pas une fausse leçon de chant, qu’un combat ne devient pas une presse et qu’un rayon bouclé ne donne pas une découverte de transfert.

Le bouton exposé attendu est gris 3 avec plus rose 7 et centre de circuit. Une presse simple présente un centre 5 fermé et 3 ouvert. Les vérifications incluent le cas d’un bouton explicitement superposé dans une situation de test ; les huit cartes distribuées n’utilisent aucune superposition bouton/presse. Une inspection des rendus initiaux des huit salles et d’états intermédiaires de L6–L8 complète la lecture des pixels.

**Portée visuelle :** Happy DOM vérifie les événements, les pixels et l’ordonnancement des animations. Il ne certifie pas le rendu CSS d’un navigateur natif ni la disposition sur un vrai écran mobile. Ce contrôle reste prévu lors de l’intégration Custom 4 ; aucune session de navigateur natif n’est revendiquée pour ce laboratoire.

## Revue indépendante des finales

`scripts/verify-design-constraints.mjs` recharge les références et exécute réellement ses branches. Il vérifie cinq contraintes par finale : réemploi de l’appui, secours et poids finaux pour L7 ; conservation des comptes par rive, chargement de presse, import réel de caisse et poids finaux pour L8, plus les accès directs aux chambres.

Les 18 branches aboutissent à **12 états légaux, 5 refus et 1 victoire après réparation**, sans mort. Les variantes légales restent admises : import précoce de la caisse, départ retenu par une butée ou ordre d’arrivée différent. Un état légal non gagnant n’est pas qualifié d’impasse.

Neuf familles d’accès direct sont explorées sans atteindre leur limite : **10 020 essais exacts**, dont 7 226 légaux, 2 497 refusés et 297 mortels. Aucune entrée directe dans la chambre finale n’est obtenue dans ces familles. Ces recherches fixent les ressources et le partenaire pendant l’approche, puis essaient un vrai pas, rayon ou reflet. Elles ne constituent pas une exploration exhaustive du jeu. Une limite éventuelle serait indiquée comme résultat inconclusif.

L8 vérifie spécifiquement que les quatre échanges aux entrées 5, 45, 116 et 130 conservent les comptes par rive, tandis que le chant à l’entrée 69 transporte la caisse de la rivière vers la rive orientale. L’immersion par presse transforme une autre caisse en appui. Les deux monstres et la caisse sèche conservent les trois commandes jusqu’au gain.

## Reproduction et limites

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Node 22 ou ultérieur ; versions fixées dans `package-lock.json` : TypeScript 5.9.3 et Happy DOM 21.0.4. La qualification a été exécutée avec Node 24.22.3. `HAPPY_DOM_MODULE` peut désigner une installation externe du même module.

Les preuves établissent la solvabilité des parcours, leurs conséquences et les résultats des variantes exécutées. Elles ne certifient ni reproduction exacte des cartes sources, ni optimalité, ni unicité, ni nécessité globale d’une capacité, ni réussite autonome de SRA. La frontière publique doit rester identique lors de l’intégration native et d’une éventuelle évaluation de l’agent.
