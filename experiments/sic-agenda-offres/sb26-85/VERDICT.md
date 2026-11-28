# Verdict SB26 · ligne 85

Le catalogue `8ce7ee35` et le gel `d0e7527c` prennent les mêmes familles, émettent les mêmes commandes et reçoivent les mêmes paquets sur 16 gestes. Les deux premiers gestes appartiennent à d'autres familles. Le premier ticket de substitution est N1/T3 `slot_substitution / ordered_slot_substitution / OP18`, ACTION6 (35,58). Le gel porte déjà la mesure, le choix et la reprise.

| Situation | Choix et retour |
|---|---|
| N1/T3, quatre emplacements vides | Le mot lu de gauche à droite est [9,14,11,15]. L'inventaire dans l'ordre spatial est [14,15,9,11]. Le premier emplacement [22,29,23,30] exige 9 et sélectionne la pièce d'indice 2. Le vrai retour lie cette sélection à l'inventaire intact et aux quatre places encore vides. |
| N1/T4 | La référence du retour T3 est consommée. Le clic (22,29) dépose 9 à l'indice 0. Le même retour retire de l'inventaire la pièce d'indice 2 et libère la sélection. |
| Permuter les deux premières bordures de référence de 9 et 14 | Le mot devient [14,9,11,15], avec les mêmes emplacements, liens, stocks et géométrie. T3 sélectionne la pièce d'indice 0 en (19,58). Le dépôt proposé garde le clic (22,29) pour une conséquence prévue différente, [14,vide,vide,vide]. L'échange est une image de diagnostic présentée au service. |
| Inverser seulement l'ordre des entrées candidates au T3 | Même sélection (35,58), même réponse et même offre de dépôt. L'inventaire et l'ordre des places restent déterminants. |
| Retour du vrai placement T4 présenté avec 14 à la place de 9 | Même paquet exécuté, même disparition du jeton d'indice 2. La garde de retour refuse la correspondance, ferme le plan et retire la famille dans l'epoch courant. La sélection déjà observée reste acquise et aucune loi de placement n'est ajoutée. |
| N1/T6–T12 | Les deux opérations acquises autorisent un préfixe de sept gestes. Les transferts sont comparés à chaque étape. ACTION5 est enfin libérée pour le mot complet et reçoit le seul verdict officiel de N1. |
| N2/T14–T15 | Deux rangées et un appel interne étendent l'ordre à [12,15,8,9,14,11,6] suivant les rangées 22,22,36,36,36,36,22. Le service réacquiert sélection puis placement de la pièce 12 sur (22,22). |

`measureSlotLayout` déduit l'ordre en développant les références de bordure et en comparant les multiplicités de l'inventaire. `SlotSubstitution.propose` consomme le mot mesuré et `readSlotState` pour choisir la source et l'emplacement. `SlotSubstitution.before` compare le scope et l'occupation, puis `after` et `record` observent la sélection ou le transfert pour revenir au même objectif. La permutation de référence est vérifiée à l'admission de l'epoch. Le contrôle de continuation vérifie les occupations à partir du plan figé pendant cet epoch.

Cinq préfixes et 127 tests passent, sans relance. Durée du préenregistrement au reçu 6 min 25 s. Harnais `4e1760327c1aea9031654e7de7c26da3ae19cf7b`. Reçu local `artifacts/qualification-sb26-85/4e176032.json`, SHA-256 `803ab9210cf0b39897abd43551ded6b0d4494d21f87e77980f932731af6c8811`. [Commande de rejeu](README.md).
