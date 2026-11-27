# Priorité d’une interaction de panneau acquise publiquement

Le diagnostic reproduit depuis L1 les 404 premières commandes de DC22 sur `0dc7f2eeccdcf29f27564d279750cc5fb1c10e1e`. Les cinq premiers niveaux gardent exactement les préfixes du témoin : 22, 44, 45, 76 et 185 commandes. La capture est arrêtée volontairement après 32 gestes L6 ; ce n’est pas un verdict chronométré.

## Première perte observée

Au L6 geste 19, un clic réel change le panneau sans déplacer l’acteur et fournit une preuve d’effet. Les déplacements avaient déjà été mesurés par les retours de commandes étrangères. Avant le geste 20, la famille publique dispose d’une approche de cinq déplacements vers le marqueur correspondant à ce contrôle. L’entrée précoce renvoie pourtant null et une composition indépendante prend la main. Le même défaut apparaît au geste 30 : le contact de panneau est disponible mais écarté. La proposition a été relue avec le programme SRC réel, à partir de l’état acquis et des seules observations publiques.

La première hypothèse — perte du rôle de support distant lors du changement de niveau — est réfutée par la géométrie publique. Les preuves précédentes sont encore présentes, mais le nouveau panneau ne satisfait pas leur interface. Le reconnaisseur de support distant n’est pas élargi.

## Réutilisation et contradiction

Le rôle réutilisé relie un acteur aux commandes de translation mesurées et à un effet de contrôle réellement observé, indépendamment de la famille exécutante. La continuation exige la même époque et portée, des preuves non futures, le contexte courant exact, un acteur retrouvé et un bouton toujours compatible. Les routes, contacts, commandes révélées par contact, mouvements de mécanisme, programmes connus et phases de terrain mesurées peuvent continuer. Une direction encore inconnue ou un nouvel essai de terrain garde son admission ordinaire.

Chaque geste utilise les gardes physiques existants ; une contradiction clôt le préfixe et réconcilie seulement les commandes exécutées. La fin d’une approche ne vaut pas essai du contact : le clic correspondant reste une décision distincte dont le retour est vérifié.

Deux scénarios natifs indépendants changent les formes des contrôles, les pigments, les positions, les commandes et le sens de l’interface. Les directions et l’effet de panneau y sont acquis passivement depuis une autre famille à travers les vrais tickets natifs. Les contre-épreuves retirent l’acteur ou le contrôle, rendent l’acteur ambigu, contredisent le déplacement ou altèrent la portée, l’époque ou la date des preuves. Une calibration encore inconnue ne reçoit pas la priorité acquise.

Les fichiers comprimés et leurs sommes figurent dans le manifeste. Les scripts de capture sont des instruments de diagnostic hors production ; aucun code de jeu, numéro de niveau, pigment absolu, coordonnée fixe ou parcours de référence ne décide du comportement de production. Le rejeu strict, le contrôle complet de continuité, la fusion et le viewer restent à effectuer à ce checkpoint.

La capture de frontière conserve toutes les commandes, tous les plans et tous les rasters publics avant/après. Les instantanés dérivés répétés des familles et des entités géométriques sont omis de cette projection ; le manifeste conserve l’empreinte du brut original et la première grille fautive est aussi archivée avec son état complet.


## Contre-exemple de priorité sur le premier candidat complet

Le candidat local `ca1d84e4` / distant `403a8ffa` termine seulement **4/6** : au L5 il atteint 215 commandes sur 215, sous le plafond de temps inchangé. Les quatre premiers préfixes sont identiques au bilan de départ. Les 363 premières commandes suivent le même parcours ; à la commande globale **364** (L5, geste 177), l'approche de panneau choisit `ACTION1` à la place du clic de support distant déjà lié. Ce déplacement ne modifie pas le terrain, puis le rôle de support perd sa continuité. Le contre-exemple complet et la scène publique antérieure sont archivés dans `specialist-priority-counterexample/`.

La continuation de panneau reçoit donc une entrée dédiée **après les mécanismes spécialisés et avant les essais indépendants**, au bout du dernier groupe existant. Elle n'est plus dans la priorité de pression. Le nombre de groupes du moteur reste inchangé ; l'adaptateur refuse toute autre clé de sous-question. Le garde et les preuves du panneau restent ceux du premier candidat.

Un nouveau test natif met en concurrence une interaction de panneau acquise et un mécanisme déjà lié : son contact est réellement exécuté et acquis avant de rendre la main à l'approche du panneau. Les fixtures utilisent désormais explicitement l'ordre du pack SIC complet. Les **54 tests** incluant le runtime complet passent ; après fermeture de l'adaptateur, les **31 tests ciblés** et TypeScript passent. Le second passage chronologique complet reste à exécuter ; cette correction de priorité n'est pas encore qualifiée comme victoire.
