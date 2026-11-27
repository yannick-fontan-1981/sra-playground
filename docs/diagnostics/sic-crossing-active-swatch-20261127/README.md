# Continuité après sélection d’une pastille alternative — 27 novembre 2026

## Première perte publique reproduite

Le rejeu diagnostique depuis le niveau 1, en une session SIC et avec les plafonds originaux, reproduit le blocage à 2/6. Les deux niveaux gagnés comptent 27 puis 28 commandes. Au niveau 3, la commande 5 sélectionne une autre couleur. Le retour public échange cette couleur avec celle du contrôle actif : la couleur choisie occupe le contrôle actif, tandis que la position cliquée redevient une alternative.

Avant la commande 6 (index global 61), la mémoire de croisement possède encore le scope, l’époque, la frontière officielle et la référence courante. La vérification de continuité demande toutefois que le contrôle actif soit à la position de l’alternative cliquée. Le preview concurrent prend alors la priorité. Le premier geste non comptabilisé rend ensuite la mémoire obsolète. `first-loss.json.gz` conserve les quatre transitions publiques autour de cette perte ; son en-tête identifie la source et la capture intégrale.

## Rôle et correction

Le rôle acquis est celui du contrôle actif d’une ligne ou colonne, avec ses commandes d’avancement observées et ses contributions aux croisements. La couleur attendue peut provenir de l’alternative choisie ; la position à re-mesurer reste celle du contrôle actif acquis. La correction sépare ces deux attributs dans la vérification existante. Elle ne change ni l’apprentissage, ni le choix de solution, ni les plafonds.

L’unicité des contrôles, la commande disponible, le scope, l’époque, le score officiel et la référence actuelle restent exigés. Une couleur ou une position du contrôle actif incompatible refuse cette priorité. Un retour contradictoire retire la continuation sans effacer les preuves précédentes.

## Validation locale

Les 10 tests ciblés passent. Deux scénarios natifs acquièrent les commandes et relations au premier niveau puis résolvent une nouvelle forme nécessitant une couleur alternative. Les palettes, formes, mailles, positions et commandes diffèrent. Les scénarios négatifs couvrent l’ambiguïté, la commande absente, la référence absente et la contradiction. Une contre-épreuve utilise l’observation publique exacte de la première perte et refuse une couleur ou une position modifiée. Le contrôle TypeScript passe.

Le parcours strict complet du nouveau candidat et sa continuité instrumentée restent à exécuter. Ce document ne revendique pas encore une victoire complète.
