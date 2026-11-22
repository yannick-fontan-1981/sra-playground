# SS16 — qualification

La version **0.2.0** est qualifiée avec le niveau 5 renforcé et les alertes rouges des miroirs. Les rapports JSON sont produits à partir du moteur, des cartes et du HTML livrés.

## Résultats du lot livré

| Vérification | Résultat |
|---|---|
| Compilation TypeScript stricte et construction du HTML autonome | Réussies |
| Tests du moteur et de la session | **40 / 40**, aucun échec ni test ignoré |
| Parcours de référence | **8 / 8** gagnants, les trois héros vivants |
| Entrées rejouées | **1 243**, dont **126 sélections** |
| Images d’animation et durées contrôlées | **3 655 images** |
| Mouvements refusés / morts dans les parcours de référence | **0 / 0** |
| Découvertes pédagogiques dans le niveau 1 | **20 / 20**, en 158 entrées |
| Scénarios ciblés dans le HTML | **29** : 17 de rôles, 3 de réflexion, 2 de glyphes, 7 d’alerte miroir |
| Campagne rejouée dans le HTML compilé | **8 / 8**, pixels, temporisations, annulation et rejeu de chaque victoire |
| Revue du niveau 5 renforcé | **15 contrôles d’auteur + 8 contrôles indépendants**, réussis |
| Revue des niveaux 5 à 8 | **40 contrôles**, dont les 23 du niveau 5 renforcé |

Commandes exécutées depuis `experiments/sinking-star-ss16` :

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Le HTML final mesure **124 799 octets**. Son SHA-256 est :

```text
fefe441bd01602e4b9e3069a17b41687350cba3d68fe86b537ef3a62361d8c09
```

Il est construit sous `dist/SS16-demo.html` et livré sans changement de contenu sous le nom `SS16-demo-v2.html`. `validation/delivery.json` conserve cette empreinte. Le fichier fonctionne sans réseau et ne contient ni témoins de solution ni outils d’auteur.

| Salle | Entrées du parcours de référence | Images vérifiées |
|---|---:|---:|
| 1 — L’atelier des trois passeurs | 158 | 476 |
| 2 — Récupérer avant de combler | 214 | 610 |
| 3 — Lâcher le miroir, garder son poids | 160 | 445 |
| 4 — Le quai des deux impulsions | 64 | 182 |
| 5 — La relève du gardien | 265 | 835 |
| 6 — Le chantier avant la marée basse | 82 | 230 |
| 7 — Les deux postes du miroir | 120 | 350 |
| 8 — Le gardien et les trois lests | 180 | 527 |

## Corrections de cette révision

Le niveau 5 passe de quatre grandes étapes dans l’ancien parcours à treize étapes explicatives : préparation de la presse, relève du gardien, récupération et parking de sa charge, ouverture de réserve, extraction et regroupement de ses deux caisses, transferts perpendiculaires, construction des appuis, puis réemploi de la clef et de la charge de relève comme lests. Son parcours de référence comporte 265 entrées et 23 sélections, sans refus ni mort. Ces nombres ne constituent pas une mesure absolue de difficulté ni un minimum.

Les revues conservent un contournement réel du premier candidat : passage au nord de la porte de réserve sans utiliser la clef. La carte corrigée le refuse à la 34e entrée. Une recherche de marche à ressources et personnages inactifs fixes épuise **136 états et 544 transitions** sans accès à la réserve. Les contre-branches vérifient également une approche prématurée fatale, la reprise trop précoce de la clef, le refus de traction dans l’eau, le retrait fatal des plateformes pendant une traversée, le manque du second appui dans l’état testé et les expulsions des deux sas vers le nord.

Les miroirs bloqués par un mur, une porte, une presse, un occupant ou un conflit désignent désormais les miroirs concernés par le refus. Leur dos suit **rouge → normal → rouge → normal**, durées **110 / 70 / 110 / 0 ms**, en gardant la diagonale blanche visible. Les tests couvrent la vraie salle 8, les autres miroirs inchangés, les commandes verrouillées pendant l’animation, l’absence de nouvelle annulation et la réduction des animations. Aucune pièce ne se déplace lors du refus.

## Vérifications conservées

Les vingt découvertes sont obtenues dans le niveau 1 par un parcours réel. Leur suivi utilise uniquement les pixels publics ; aucune coche ne conditionne la victoire.

`validation/design-report.json` agrège cinq contre-branches des niveaux 2 à 4, les revues du niveau 5 renforcé et les contrôles des niveaux 6 à 8. Les huit cartes compilées sont comparées à leurs spécifications de référence ; les presses et boutons sont distincts, et aucune sortie n’est accessible par simple marche dans l’état initial à circuits fixes.

La revue indépendante du tutoriel reproduit deux anciens raccourcis gagnants et vérifie leur blocage. Elle exécute **96 recherches restreintes**, soit **9 576 états** et **47 880 transitions**, avec toutes les files épuisées.

La revue indépendante des finales reproduit trois anciens raccourcis sur des cartes historiques immuables, puis vérifie leur rejet : transport de héros évitant le chantier du niveau 7, traversée sans appui permanent au niveau 8 et maintien du pont hydraulique jusqu’à la sortie du niveau 8. Trois sondes géométriques ou locales bornées complètent cette revue. Une solution alternative élaborée du niveau 8 reste acceptée : **224 entrées**, un appui permanent, les trois héros vivants et aucun mouvement refusé. Elle conserve la clef de réserve, les deux charges de presse, les poids et le retrait des plateformes. Deux appuis permanents ou un miroir comme lest ne sont pas présentés comme des nécessités globales.

## Portée et limites

Un témoin gagnant prouve une possibilité de terminer. Les comptes d’actions sont ceux de parcours explicatifs, sélections comprises ; ils ne prouvent ni optimalité ni unicité. Les ressources utilisées dans le parcours de référence du niveau 5 ne sont pas annoncées comme la seule combinaison possible à l’échelle du jeu entier.

Les recherches du tutoriel et de la réserve du niveau 5 conservent les ressources et les héros inactifs fixes. Les files épuisées établissent seulement l’absence de solution dans ces modèles restreints. Les contre-branches locales établissent leurs effets décrits, sans prouver une impossibilité globale après chaque erreur.

La chambre finale du tutoriel a une entrée sèche par la porte `(18,4)` et une frontière d’eau en `(14,3)` : elle n’est pas entièrement murée. Le parcours utilise la presse pour produire l’appui hydraulique et rapprocher les monstres ; la nécessité exclusive de cette presse pour créer cet appui n’est pas démontrée.

Les tests Happy DOM vérifient le vrai HTML et ses interactions, ses pixels et ses durées ; ils ne valident pas le rendu CSS réel d’un navigateur. La prévisualisation native avait été bloquée pendant la version 0.1.0 et n’a pas été reprise pour cette révision. `validation/browser-review-status.json` distingue ces anciennes tentatives et la qualification 0.2.0. Les rendus déterministes des plateaux et des phases rouge/normale ont été inspectés directement.

Le laboratoire ne modifie pas le runtime partagé de SRA Playground et ne fournit aucune mesure de résolution autonome par SRA. Le raccordement natif, le contrôle ordinateur/mobile et la publication du Site restent l’étape d’intégration suivante.
