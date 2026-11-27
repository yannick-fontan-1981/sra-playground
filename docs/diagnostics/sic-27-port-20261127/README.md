# PORT — marche connue entre les passages

Le 27 novembre 2026, une session SIC depuis le niveau 1 gagne les **six niveaux en 116 commandes**, sans reset ni undo, sur la source propre et figée `1f5f03f08e36ba0f375ebaaa9398bee770bcf485`. Le niveau 6 marque le score en **8,691 secondes**, sous son plafond inchangé de 12 secondes. Les 116 effets ont été acquis.

## Qualification chronométrique

| Niveau | Commandes/plafond | Score/plafond (s) | Réconciliation après score (s) |
|---|---:|---:|---:|
| 1 | 16/21 | 3.730/12 | 1.061 |
| 2 | 18/23 | 3.289/15 | 0.809 |
| 3 | 26/32 | 7.959/20 | 0.719 |
| 4 | 19/22 | 5.482/15 | 1.824 |
| 5 | 19/22 | 6.080/14 | 1.390 |
| 6 | 18/21 | 8.691/12 | 1.092 |

Les budgets historiques restent **21/23/32/22/22/21 commandes** et **12/15/20/15/14/12 secondes**. Le score public et la réconciliation sont conservés séparément. Les cinq empreintes de préfixe des commandes et retours L1–5 sont strictement identiques à celles de la campagne `4a546a139f9064422c078ef5f40b8c22133c39a8`. Le parcours gagnant complet porte l'empreinte `6ac0996092896e035f77015d8a6f76a5aaba6857ca936c6af7832723877834e1`. Le témoin de cette campagne s'arrêtait au niveau 6 après 16 commandes sous 12 secondes.

## Première continuité perdue et correction

La capture publique sur `51e5bffc9a4670766431633c7b24af094ab5d480` reproduit les cinq mêmes préfixes gagnants et l'arrêt au niveau 6. Dès sa troisième décision, le propriétaire calcule une route de quatre gestes : trois marches déjà justifiées, puis un contact. Il n'en expose qu'un. Le filtre excluait toute scène de passages à motifs ou d'interrupteurs, même pour la portion de marche précédant le prochain contact.

La correction expose uniquement cette marche connue. Elle coupe le préfixe avant le premier passage ou interrupteur, conserve la limite de seize et le budget restant, puis remesure l'acteur, les ouvertures, leurs partenaires, les indicateurs, les sorties, le sol et les commandes avant chaque continuation. Les contacts restent unitaires et l'acquisition traite chaque retour exécuté dans l'ordre. Les comparaisons de géométrie utilisent les valeurs normalisées, y compris celles du but, afin de rester équivalentes après restauration.

La capture initiale est instrumentée : ses durées ne servent pas à annoncer un pourcentage d'accélération. Un probe hors jeu repropose la décision originale avec le correctif, puis valide les trois gardes et les trois retours publics réellement capturés (`ACTION2`, `ACTION2`, `ACTION4`). Le quatrième geste de contact reste séparé et un budget restant de deux borne la proposition à deux.

## Transferts et refus

Les **11 tests ciblés passent**, ainsi que le typecheck. Deux simulateurs raster natifs apprennent les passages sur trois niveaux successifs. Le second change la taille, les positions par réflexion, les couleurs et le sens des commandes. Tous deux observent les sorties, réemploient deux marches dans la même décision, exécutent ensuite l'interrupteur seul et gagnent les trois niveaux.

Les contre-épreuves changent l'acteur, un indicateur, une sortie, un interrupteur ou la disponibilité d'une commande ; elles ferment le préfixe après le seul geste exécuté. Un déplacement contredit produit son retour `matched=false`, sans effacer les preuves précédentes. Sans témoin appris des passages et sorties, la scène à motifs n'est pas admise.

## Sources conservées et contrôles suivants

L'archive contient la capture publique complète, ses manifestes, le diagnostic de première perte, les vrais retours reproposés, le strict et ses préfixes, les journaux de tests/typecheck, le témoin extrait de la campagne, les commandes reproductibles et un manifeste SHA-256 de chaque membre. Les manifestes du strict confirment le même SHA, les mêmes empreintes et un checkout propre avant et après.

Le collecteur de tickets exécutés, son contrat PORT, le gate complet sur l'intégration finale et le rejeu dans le Site livré sont des contrôles ultérieurs distincts ; cette archive n'annonce pas leur achèvement.

Archive : `public-evidence.tar.gz`, **874,244 octets**, SHA-256 `db892aa0e454a131b0b695383e2d295a569536e2c869653209b82bfe4140fc8b`.
