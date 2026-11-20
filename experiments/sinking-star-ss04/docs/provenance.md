# Provenance des niveaux SS04

SS04 conserve les conventions visuelles et l’interface de session du laboratoire SS03. Son déplacement est celui d’un Magicien à échange automatique. Les règles de référence sont consultées pour concevoir une adaptation en grille ; il ne s’agit pas d’une exécution du moteur commercial d’Order of the Sinking Star.

## Sources principales

- [Sinking Star Walkthrough — Heroes of Hauling](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/), énigmes 10 et 11.
- [Heroes 2: Monsters](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-4), énigme 4.
- [Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30), énigme 30 : le Magicien peut échanger autour d’un angle grâce à la visée réfléchie.
- [Transcription communautaire de Joric](https://github.com/joric/ootss/blob/main/scripts/ootss.pz), blob lu `3b8768a5152c34e0f572e7e66251dfadb4cb6d1d`. Les quatre cartes, leurs caractères originaux et leurs parcours sont conservés dans `reference/source-grids.json`.
- [Captures et tuiles de Joric](https://github.com/joric/ootss_tileset), capture `wizard_mirror_intro.webp`, blob `eb7d86538f24e5a06d580960c00de8d0689d1d25`.
- [Export des dispositions de salles OSS-puzzlewiki](https://github.com/chenyuyang712/OSS-puzzlewiki/blob/main/data/levels_layout.json.gz), utilisé pour les coordonnées des îlots et objets du niveau miroir.

Le code du moteur SS04 réutilise le moteur local SS03 et ajoute ses propres transitions TypeScript. Les solveurs d’auteur et leur état sémantique ne sont jamais transmis à l’agent joueur.

## Attribution par niveau

| SS04 | Origine | Portée de la reprise |
|---|---|---|
| 1 — L’atelier des échanges | Création originale | Deux caisses ; apprentissage de l’échange, presse, appui, miroir et poids sur bouton. |
| 2 — Le convoyeur des trois salles | `heroes1_8_v2` ; Hauling 10 | Grille et positions transcrites, témoin original de 54 directions conservé. |
| 3 — L’échiquier des neuf blocs | `heroes1_10_inv_v4_b` ; Hauling 11 | Grille et positions transcrites, témoin original de 17 directions conservé. |
| 4 — La galerie des sentinelles | `heroes2_3_v2` ; Monsters 4 | Grille et positions transcrites, témoin original de 36 directions conservé. Les sentinelles suivent les règles exécutables de la transcription. |
| 5 — Le long détour des îlots | `a_wiz_out_of_water` | Grille et positions transcrites, témoin original de 79 directions conservé. Attribution à Heroes and Water ; numéro du guide non confirmé, donc aucun numéro inventé. |
| 6 — Les deux relais | `wizard_mirror_intro` ; Heroes and Mirrors 30 | Adaptation explicite des trois îlots, avec blocs relais, deuxième plaque et miroirs fixes. |
| 7 — Les deux digues | Création originale | Deux passages d’eau à construire et deux poids de sortie dont un monstre. |
| 8 | Création originale | Combinaison finale décrite dans `level-design.md` et son fichier de référence. |

Dans les quatre grilles transcrites, seules les conventions de caractères et de rendu changent : `*→o` caisse, `G→g` sortie, `_→~` eau, `{` ou `}→b` bouton, `[` ou `]→D` porte et `O→m` monstre. Les cartes restent centrées dans une grille de 20 × 20 cellules. La validation compare chaque ligne aux données originales et rejoue les quatre parcours sans coup refusé ni mort.

## Adaptation des miroirs

Le niveau 6 conserve les 55 cases de sol extraites, les trois îlots, le Magicien, la caisse de départ, le bouton d’origine, la destination et les deux positions de miroir. Trois blocs relais sont ajoutés en `(2,3)`, `(8,7)` et `(10,8)`, ainsi qu’une plaque en `(5,5)`. Les deux plaques commandent la sortie. Les coordonnées précèdent le centrage.

Les miroirs sont orientés NE en `(3,7)` et SE en `(12,2)` pour cette adaptation. Les orientations du jeu source étaient partiellement inférées depuis la capture ; elles ne sont pas présentées comme une reproduction certaine. Les haies dont les cellules logiques ne sont pas établies par l’export ne sont pas inventées. Le détail de l’extraction est conservé dans `reference/mirror-source-grid.json`.

La source emploie aussi une commande X de réflexion globale. SS04 conserve uniquement la réflexion automatique de la visée du Magicien : dos bloquant, miroirs fixes, aucune duplication ni commande X. Le parcours de 35 directions de la nouvelle carte est donc calculé et vérifié séparément. Les deux miroirs sont nécessaires dans cette version, ce que confirment deux recherches exhaustives les remplaçant individuellement par un obstacle.

## Limites des affirmations

« Grille transcrite » signifie fidèle à la représentation discrète conservée, pas une copie des graphismes ou du moteur commercial. « Adaptation » signale une modification des objets, règles ou contraintes. Les parcours vérifiés prouvent la solvabilité de SS04 ; ils ne constituent pas une mesure de difficulté humaine. Ils ne sont pas présentés comme tous minimaux. Une recherche bornée interrompue reste une limite, sans conclusion d’insolubilité.
