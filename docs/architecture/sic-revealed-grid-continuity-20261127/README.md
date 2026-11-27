# SNAR — continuité sur une grille déjà observée

## État du lot

Le correctif est sauvegardé et testé, mais **SNAR reste à 3/6 niveaux**. Le strict corrigé s’arrête au L4 après 31 commandes à 24,002 s, sous les plafonds inchangés de 44 commandes et 24 s. L1–3 gagnent en 16/21/23 ; leurs empreintes complètes sont identiques au témoin de campagne. Aucune victoire supplémentaire n’est attribuée à ce checkpoint.

Source locale `d6f8040d4f590170d9d5c801ac1846a257729b61`, GitHub `a0a78147caa681af6f1d6ee96e6167f42c1154f4`, arbre identique `622ad28949e2a42f65c1115ee308c62a1852c341`. Branche `fix/sic-27-grid-continuity-20261127`, base `c97797426f619db16de5b29738a8d4209c78ebca`. Ce checkpoint n’est ni intégré ni publié.

## Première décision reproduite

Une session publique depuis L1 gagne celui-ci en 16 commandes. Au L2, commande 3 (globale 19), SIC annonce cinq déplacements sur des cellules connues libres. Le premier atteint sa destination, `matched=true`, puis la série est close après une commande. Le seul ajout de terrain est une cellule hors du trajet, découverte lorsque l’obstacle mobile la quitte. Les quatre destinations restantes étaient et restent libres, sans occupation ni risque enregistré ; le garde original du second déplacement répond `admitted=true`.

Le diagnostic s’arrête volontairement par `canDispatch`. Son état final « public board changed » provient de cette coupure du banc ; ce fichier n’est pas un verdict chronométré.

## Rôle, réutilisation et réfutation

Le rôle est l’accès aux cellules libres d’un quadrillage mesuré, établi par les observations du terrain et les déplacements confirmés. Il reste utilisable avec un porteur unique à la position attendue, un sol déjà connu et des prémisses de déplacement concordantes. Une découverte hors de la suite ne clôt plus à elle seule la marche. Terrain connu contredit, danger sur la suite, acteur ambigu, déplacement erroné ou frontière officielle ferment toujours le préfixe. Les faits nouveaux sont acquis par `record`, une seule fois et dans l’ordre des commandes réellement exécutées. Aucun identifiant de jeu, niveau, palette absolue ou parcours témoin n’intervient en production.

## Vérification et limite

Les 11 tests ciblés passent, dont deux transferts natifs depuis L1 avec cinq tickets de la même décision, déplacements vérifiés dans les images et une seule clôture. Le second scénario réfléchit les positions, permute la palette et change la forme du porteur ainsi que les commandes horizontales. Les retours après le premier déplacement public sont des extensions synthétiques déclarées dans la fixture, pas un rejeu réel du jeu. Les négatifs couvrent terrain contradictoire, obstacle dans la suite, acteur ambigu, mauvais déplacement, frontière et garde intermédiaire. Typecheck et revue indépendante sont favorables. Le contrôle global de continuité reste requis avant intégration.

Les huit dernières commandes L4 sont de `sic_cavity_access`, comme dans le témoin. La prochaine mesure est la frontière L3→L4 et la première commande L4, avec les offres/refus et le rôle de navigation hérité. L’hypothèse distincte d’un historique de patrouille trop prudent n’a pas été modifiée.
