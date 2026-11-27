# SNAR — continuité sur une grille déjà observée

## État actuel : quatre niveaux gagnés

Le second correctif gagne désormais **L1–4**, en **16, 21, 23 et 36 commandes**. Le L4 marque son score à **16,886 s**, puis réconcilie en **0,456 s**, sous les plafonds inchangés de 44 commandes et 24 s. Le strict s’arrête au L5 après 36 commandes sur 42 et 28,001 s sur 28 s ; ses huit derniers gestes viennent de `sic_cavity_access`. Il reste donc **4/6**, avec 132 commandes toutes autorisées par SIC. L6 n’a pas été atteint. Les empreintes complètes L1–3 restent celles du témoin.

Source locale `07676e1eb49caf0d4323c798df20b15a2e480161`, GitHub `5773d96313daec7d62d6d314c484274f03ed565c`, arbre identique `9e155b4413a2cc109c5ea37e0ea38d701b2878f9`. Les 24 tests ciblés et le contrôle de types passent ; la revue indépendante est favorable. Le lot n’est pas intégré ou publié et le contrôle global reste requis.

### Acquisition perdue à la frontière publique

Au premier geste L4 (global 61), une autre famille exécute ACTION1 avant que la navigation soit consultée. La géométrie héritée était reconnue sans ambiguïté juste avant. L’acteur reste dans sa cellule et le mur immédiatement visé apparaît. Seule cette cellule change dans la grille : les obstacles ne changent pas. Le contour du mur ajoute un second cadre de couleur unique ; la reconnaissance complète ne peut plus désigner une sortie unique. La lecture avec la géométrie observée avant le geste conserve pourtant un acteur unique, le quadrillage, la sortie et le mur révélé.

L’observateur retient désormais ce retour étranger seulement avec un rôle hérité et son score, des preuves de la même session, une époque et un score stables pendant le geste, une commande disponible et une géométrie unique avant. Il exige une translation commandée confirmée, ou une immobilité attestée par un mur nouvellement révélé exactement devant l’acteur. Il contrôle le quadrillage, l’image de la sortie, les réserves et les terrains connus ; il préserve les autres faits en cas de refus. Il n’intervient pas si la reconnaissance complète fonctionne encore ou si des mécanismes spéciaux sont présents.

Les deux transferts natifs apprennent réellement depuis L1 et traversent trois victoires avant la commande étrangère. La variante change palette, positions, forme du porteur et commande. Le premier ticket utile réemploie les faits réassociés. Dix refus et un cas d’idempotence vérifient notamment absence de mur nouveau, ambiguïté, commande contradictoire et frontière. Le retour du pulse final des tests est une extension synthétique déclarée, pas une victoire réelle supplémentaire.

La capture supplémentaire prouve également la continuité réelle du premier correctif : les commandes 19–23 exécutent les cinq gestes du même plan L2, tous concordants, avec clôture seulement après le dernier. La matrice L1/L2/L3 relève 6/6/7 commandes continuées et des séries maximales de 5/5/5.

La prochaine capture est bornée au premier retour L5, pour déterminer si la réassociation y est encore perdue et quelle preuve manque avant toute extension.

## Limite suivante et erreur séparée du banc

Une capture bornée depuis L1 reproduit les quatre scores, puis s’arrête après le premier geste L5 (global97). Ce geste preview ACTION1 déplace réellement l’acteur de136 à121. La géométrie héritée se reconnaît avant et après, avec les pads et la porte visibles. L’observateur conserve volontairement le rôle antérieur parce que la reconnaissance complète fonctionne encore. Les deux propositions calculées hors exécution contiennent chacune une seule commande vers une case encore inconnue ; elles ne prouvent pas une série de deux gestes déjà justifiée. Cette capture ne localise donc pas la perte suivante et ne qualifie aucun niveau supplémentaire.

Un deuxième wrapper devait conserver les groupes et s’arrêter avant le premier ticket cavity, au plus huit gestes L5. Il échoue par `RangeError: Maximum call stack size exceeded`. La cause est dans le banc : `canDispatch` lit `agent.snapshot`, dont le getter rappelle `canDispatch`. Cette récursion apparaît à l’arrivée au L5, avant conservation de sa capture. Le brut `instrumentation-error.jsonl.gz` et le wrapper exact sont conservés séparément ; cet arrêt n’est pas un verdict du jeu. Le dernier verdict strict reste **4/6**, et aucune production n’a changé. Le diagnostic ultérieur est différé pendant l’enquête d’un autre jeu.

## Premier checkpoint : clôture après une découverte

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
