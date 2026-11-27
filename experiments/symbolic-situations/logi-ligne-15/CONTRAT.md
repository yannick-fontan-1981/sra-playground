# LOGI · ligne 15 · mesurer quels affichages répondent ensemble

Le [contrat de référence](https://github.com/yannick-fontan-1981/sra-playground/blob/e03b78df9c0776dbe3e64a88282b5f096c3d13bf/docs/architecture/sic-logi-ligne-15.md) est figé à `e03b78df9c0776dbe3e64a88282b5f096c3d13bf` sur le gel des 107 jeux. Deux types de preuves sont évalués séparément.

**Parcours historique.** L'opérateur rejoue les trois observations publiques de LOGI capturées au niveau 1. Le service doit libérer son propre ticket avant de recevoir l'observation suivante. Au premier tour, le bouton (49,50) change de valeur et deux récepteurs changent. La prédiction `coupled_switch` est la seule compatible. Au deuxième tour, le clic (5,50) précède une frontière de niveau, qui laisse les trois prédictions de ce nouvel essai inconnues. Une offre est admissible au tour 1, deux au tour 2. Le nombre de boutons comparés, celui des offres admissibles et celui des tentatives du planificateur sont relevés séparément.

**Situations construites.** Les trois contrôles et trois récepteurs sont les intérieurs de rectangles publics, indexés de gauche à droite. Toute commande de clic admissible dans un contrôle a un retour défini. Le dispositif peint les valeurs dans les images, puis le moteur décide. Ni les indices attendus ni les étiquettes des hypothèses jugées correctes ne lui sont envoyés.

| Situation et retours | Règle de jugement figée |
| --- | --- |
| D1 · trois valeurs de lampes distinctes, puis un départ distinct avec une seule valeur minoritaire au centre. Toutes les commandes sont initialement neuves. | En cas d'égalité des distances aux valeurs les plus rares, tout contrôle ex æquo convient. Les trois contrôles du premier départ sont acceptables. Dans l'autre, la position centrale est la seule minimale. Une réponse entièrement stable confirme `inert_decoration` pour cet essai. La prochaine question doit exclure ce contrôle resté inerte et tenir compte de la géométrie. |
| D2 · même fiche initiale, même premier clic et même modification locale. Une seule lampe distante change, à gauche ou au centre. Les deux retours ont le même histogramme et la même classe globale `coupled`. | Au retour, le reçu doit être lié à la question libérée et à la nouvelle révision. Le vecteur effectivement repris par la question suivante doit désigner les bonnes valeurs à leurs coordonnées. La nouvelle rareté doit changer le deuxième clic entre les deux départs. À ce clic, un autre contrôle que celui demandé change en même temps qu'une lampe : le résultat `other` contredit les trois prédictions. Une nouvelle validation de `coupled_switch` sur la seule présence d'un changement distant échoue. |

**Attribution.** Le classificateur indépendant relit les pixels des six rectangles avant et après chaque clic. Il compare le contrôle touché, les récepteurs effectivement modifiés, les prédictions gelées, la révision du résultat et le nouvel état utilisé par le producteur. Le reçu natif de mesure classe le résultat globalement. La liaison au récepteur se vérifie au moyen des positions, des valeurs et du choix suivant. Deux essais contigus peuvent conserver le même identifiant d'objectif. La révision d'observation fait alors partie du contrôle d'attribution. La frontière de niveau est jugée séparément.

**Périmètre.** Le montage exécute `V6AgentService.handle` du SHA candidat, en session neuve et avec les seules observations publiques. Les interventions ne prétendent pas décrire la physique du jeu après un clic alternatif. Elles vérifient la sélection d'une expérience et l'interprétation de retours construits. Le diagnostic séparé des producteurs inspecte les offres au point d'élection et compare ses tickets et reçus au parcours natif habituel.

Depuis ce répertoire dans un clone contenant la référence et le SHA à éprouver :

```powershell
node qualifier.mjs --sha e03b78df9c0776dbe3e64a88282b5f096c3d13bf --depot . --rapport dev-15.json
node offres.mjs e03b78df9c0776dbe3e64a88282b5f096c3d13bf dev-15.json
```

Utiliser Node 24 et `tar`. [Générateur et paramètres publics](situations.mjs) · [Évaluateur des décisions et des retours](oracle.mjs)
