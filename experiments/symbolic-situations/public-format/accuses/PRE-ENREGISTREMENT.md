# Qualification des accusés publics

Base opérateur `35fd9299`, solveur témoin `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. Cette sélection précède la mesure du témoin et du candidat. Les deux versions recevront les mêmes octets de fiche et le même traitement du retour. Un processus neuf ne reçoit que la fiche et les retours du geste qu'il a effectivement choisi.

| Cas | Transformation de la fiche B ou incident au retour | Attendu observable |
| --- | --- | --- |
| B0 | Fiche et libellé originaux | `indexer P`, reçu `indexé`, `valider`, succès |
| B1 | Renommage simultané en `caler P` et `calage enregistré` | Même trace au renommage près |
| B2 | B1 avec ordre inversé des commandes, règles et lignes de la fiche, citations renumérotées | Même trace que B1 |
| B3 | B2 avec l'annonce de l'accusé placée avant la condition et l'effet dans la ligne citée | Même trace que B1 |
| B4 | B0 avec un poste Q indépendant, initialement non indexé, et sa propre commande `indexer Q` qui renvoie `Q prêt` | Seule l'indexation de P avance le but. Même trace que B0 |
| B5 | B4 avec le seul accusé de Q changé en `poste indexé` | Même trace que B4 malgré le libellé historique de Q |
| B6 | B4 avec le seul accusé de Q changé en `indexé` | Même trace que B4. La commande en vol identifie P malgré le libellé partagé |
| N1 | B0, indisponibilité du dispositif lors de l'exécution | Véritable refus du geste, retour du protocole `Action indisponible.`, état initial conservé et aucune validation autorisée |
| N2 | B5, substitution sur le fil du libellé de Q à celui de P | L'accusé de Q, même historiquement familier, ne justifie aucune validation après la commande P |
| N3 | B0, retour perdu, remplacé par le même texte `accusé illisible` après exécution ou refus réels | Les deux dialogues publics sont identiques jusqu'au retour inclus. Une validation immédiate échouerait dans le monde du refus |

Pour N2 et N3, le banc conserve séparément le résultat physique et la chaîne livrée. Ce sont des incidents de transport injectés. N1 emploie le refus standard de l'opérateur. Aucun de ces appareils n'offre une observation de réparation dans le dialogue testé. Le passage des négatifs demande que le solveur admette la fiche, demande le geste attendu puis suspende le dialogue sur le retour insuffisant, sans valider. Un abandon au départ est compté séparément. Les deux départs N3 comptent comme un même cas avec deux exécutions.

Pour B0 à B6, le minimum à vérifier indépendamment par énumération est deux commandes, sans geste sur Q. La seule modification autorisée entre B4, B5 et B6 est le libellé du retour de Q dans sa ligne publique et sur l'appareil. L'interprétation du consommateur est mesurée par sa réponse observable au retour. Le reçu conserve séparément admission, première commande, état physique, texte livré, commande ou arrêt suivant et issue. Le banc ne lit pas la mémoire du solveur.

Les contrôles rejouent A et C, les huit anciens départs structurels, les 18 départs des familles historiques déjà qualifiés et leurs 18 départs de développement. La nouvelle réserve pour le traitement conjoint de A et B est exclue de tous les imports et exécutions de cette campagne.

## Provenance

La [fiche B](../reductions/B.json) fournit le format, le but et sa métrique (ligne 1), la valeur initiale de P (ligne 2), sa commande, son prérequis, son effet et sa chaîne de confirmation (ligne 3), ainsi que la condition terminale (ligne 4). Le renommage et la permutation transportent ces mêmes citations. L'ajout de Q cite deux nouvelles lignes de même forme pour son état, son opération et sa confirmation. La validation continue à dépendre exclusivement du fait relatif à P. L'ordre de sérialisation, les identifiants de test, la réponse attendue et l'état du dispositif restent chez l'opérateur. Le contrat d'échange fournit l'enveloppe, l'association à une commande en vol et le refus standard. Les sorties de diagnostic N2 et N3 sont documentées ici comme injonctions du banc et ne sont jamais ajoutées à la fiche. [Dialogue public](../DIALOGUE.md)
