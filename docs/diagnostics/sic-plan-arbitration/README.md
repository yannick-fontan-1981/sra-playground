# SS01 L2 et préservation des plans de SIC Fallback

Le candidat figé `3ea19a860f6b1155324ffb8fefae62b14d793b42` gagne **en 44 commandes au départ direct** et **en 32 commandes après la leçon du L1**. Le départ direct commence par une sélection publique du L2, avec zéro action antérieure, zéro niveau accompli et une mémoire neuve. Sur les quatre jeux demandés, la version reproduit les victoires de `main` jusqu’à la dernière commande et à la dernière image.

## Quand le raisonnement change de main

Les deux versions choisissent les 17 mêmes premières commandes à froid. Aux coups 11 et 15, l’exploration obtient deux déplacements du marchand par activation. Tous deux aboutissent sur le même îlot. Les coups 15 et 16 produisent des images inédites. Le coup 17 retrouve une image connue. Les observations de l’agent permettent alors à la famille de composition de proposer un objectif spatial vérifiable.

| Décision prise dans la partie à froid | Réalisation physique |
|---|---|
| **18.** Le modèle trouve 18 cases accessibles, envisage 13 configurations et choisit le premier miroir en (5,3), un lancement en (10,3), une arrivée en (5,8) et un premier pas en (5,9). | Les poussées vers la gauche ont lieu aux coups 20 à 22. La traversée vers l’îlot gauche se produit au coup **27**. |
| **29.** Le modèle propose 25 configurations et choisit de placer le second miroir en (7,9). Il prévoit de lancer depuis (7,12), d’arriver en (10,9) et d’avancer en (11,9). | SIC pousse trois fois vers la droite puis deux fois vers le haut. Il arrive sur l’îlot de droite au coup **42** et effectue la continuation au coup **43**. |
| **44.** La famille de composition a achevé son programme. La famille d’exploration ordinaire reprend la main. | Le marchand monte en (11,8). Le moteur valide le L2. |

Le banc vérifie huit déplacements prédits du mécanisme, deux arrivées et les deux premières actions sur les nouvelles rives. Le dernier déplacement à froid est choisi par l’exploration, sans témoin de contact terminal hérité du L1. Dans la partie avec leçon, SIC dispose de ce témoin et s’en sert au dernier coup. Les 32 commandes et les 33 images correspondent exactement au [parcours de v30](../ss01-l2-victoire-sic/README.md). Les deux essais utilisent le sélecteur natif complet et ne demandent aucune remise à zéro.

Le témoin `main` (`f3b4edc227b0f375108002d0243539901a2d5cf9`) utilise l’exploration ordinaire pendant ses 54 commandes du départ direct, puis déclare qu’aucune stratégie ne s’applique. Chez le candidat, l’exploration choisit les commandes 1 à 17, la composition choisit les commandes 18 à 43 et l’exploration choisit la commande 44. [Commandes publiques, familles et prédictions spatiales](depart-direct.json)

J’ai isolé l’effet de l’arbitrage en suspendant uniquement l’entrée qui donne la priorité à une prédiction déjà étayée. L’observation et les autres expériences restent actives dans le banc. Au même plafond de 90 commandes, le candidat intact gagne en 44. Le candidat privé de cette priorité diverge au coup 18, vérifie une arrivée extérieure et sa continuation, puis épuise les 90 commandes avec le score 0. Ce contrôle a été choisi après la partie. Son résultat porte sur ce budget. [Mesures des quatre conditions et du témoin v30](mesures.json)

## Mesures sur les jeux sources

Le développement a utilisé 2 926 commandes des 100 traces historiques. Une nouvelle image publique donne à la stratégie qui l’a produite la possibilité de poursuivre. Des retours répétés permettent de considérer une autre expérience lorsque les stratégies spécialisées ont décliné. Une arrivée prévue hors de la zone accessible ou une conséquence appuyée par l’expérience d’un niveau antérieur peut, elle, obtenir une priorité plus tôt. L’expérience conserve cette priorité en confrontant son programme à chaque nouvel état. Les traces historiques et les critères de sélection sont détaillés dans le [protocole antérieur au gel](../../architecture/sic-plan-continuation-source100.md).

| L1 | Commandes de `main` | Commandes du candidat | Comparaison |
|---|---:|---:|---|
| SKBN | 22 | 22 | Toutes les commandes et images sont identiques. |
| SWCH | 25 | 25 | Toutes les commandes et images sont identiques. |
| KEYD | 35 | 35 | Toutes les commandes et images sont identiques. |
| GABA | 49 | 49 | Toutes les commandes et images sont identiques. |

Au plafond historique de **60 commandes par L1**, `main` et le candidat gagnent tous les **100 niveaux sur 100**. Les trajectoires publiques sont identiques dans **99 jeux**. Dans VOIS, la première différence arrive au coup 28, où le candidat sélectionne un essai de préparation. Il gagne en **57** commandes contre **45** pour `main`. Sur l’ensemble, le coût passe de 1 559 à 1 571 commandes. Les deux séries ont été rejouées dans le moteur source depuis les mêmes images initiales. Ces 100 jeux sont le corpus source. Ce résultat mesure la préservation des acquis sur les jeux connus. [Résultats par jeu](cohorte.json) · [Vérificateur des deux séries](verifier-cohorte.mjs)

Les **423 tests ciblés** passent depuis l’archive canonique avec ses références et ses fixtures. La vérification TypeScript passe également.

## Conditions et reproduction

Le tag `sic-source100-plan-arbitration-v31` a été poussé avant les mesures sur Custom 4. L’archive du solveur contient 2 546 fichiers. Son empreinte SHA-256 est `bdea7938b1c14b9cbf4ea105d38eb6968cb4bc4428a724ccdb62134955f0fc59`. SS01 avait déjà servi aux versions antérieures. SS09 L2 a été gardé en réserve.

Le premier lancement du banc à froid a rencontré une erreur après la commande gagnante. Lorsque le L2 est sélectionné directement et validé, le moteur affiche le premier niveau encore inachevé, le L1. Le compteur officiel passe de 0 à 1 et l’ancien banc traduisait cet affichage en niveau ordinal 0. Le correctif porte sur la traduction des compteurs dans le comparateur et interdit toute autre commande après la victoire. Le candidat figé a ensuite reproduit le trajet à deux reprises, aux plafonds de 90 et 1 200 commandes. Le vérificateur physique rejoue toutes les commandes du départ direct et vérifie le score, chaque image et chaque position prédite. [Code du rejeu](rejouer.mjs)

Avec Node 24, depuis la racine du dépôt et avec un checkout moteur à la révision `f4d28aee9ebbb35533bb97a26968efd22887473d`, les deux commandes suivantes rejouent respectivement la preuve physique et la sélection native.

```powershell
node docs/diagnostics/sic-plan-arbitration/rejouer.mjs ../sic-contact-acquisition
node scripts/compare-source100.mjs ../solveur-v31 ../sic-contact-acquisition ../froid.jsonl SS01 2 2 1200
```

Pour obtenir le journal vérifiable complet, définir `SIC_STUDY_RECORD_COMMANDS=1` avant le comparateur puis appeler `node scripts/verify-projected-run.mjs ../sic-contact-acquisition ../froid.jsonl`. Pour le départ avec leçon, définir aussi `SIC_STUDY_OBSERVED_LESSON=docs/diagnostics/ss01-l2-victoire-sic/parcours.json`. Les chemins de sortie du comparateur doivent être neufs. La branche de travail est `codex/sic-source100-plan-arbitration`. Aucune publication du Site ni fusion dans `main` pour cette expérience.
