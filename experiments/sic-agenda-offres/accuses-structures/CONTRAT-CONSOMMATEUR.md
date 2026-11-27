# Conditions de qualification d’un accusé matériel structuré

Ce contrat de comportement est fixé avant la lecture du schéma producteur. Parent vérifié : `615e249349e6f274b07c7626d30c545d374234a5`. Les noms de champs et le support de transport seront ceux du producteur. La question posée au retour d’un geste est « quelles conséquences de la commande en vol sont maintenant publiquement justifiées ? ».

1. Identifier l’unique commande demandée, ses arguments et le sujet qu’elle concerne. Une déclaration positive doit rattacher le retour à cette commande et à ce sujet. Le seul verbe, un mot ressemblant au libellé ou le fait que le jeu a continué ne suffisent pas.
2. Pour une fiche munie de la représentation structurée, consulter les déclarations applicables avant toute décision. Une contradiction, une déclaration ambiguë, un retour étranger, un refus ou l’absence de relation positive ne peuvent jamais être convertis en confirmation par le dictionnaire historique ou la prose.
3. Une confirmation ne permet que les conséquences annoncées et déterminées. Une issue conditionnelle non distinguée reste ouverte. Une valeur lue exige un retour de lecture effectivement reçu. Une réussite terminale ultérieure ne constitue pas une preuve rétroactive.
4. En cas de doute, conserver le dernier état attesté comme historique. L’effet actuel reste non confirmé ; émettre un arrêt explicable au lieu de notifier une validation fondée sur cet effet. La qualification d’un retour mal rattaché ne produit aucun successeur confirmé.
5. Le chemin des anciennes fiches reste identifiable par sa version et mesuré séparément. Un échec de validation d’un message structuré ne le transforme pas en message historique.

## Attendus publics

| Cas | Opération et retour | Attendu |
| --- | --- | --- |
| X1 | P en vol. Retour correspondant à l’annonce de P. | Confirmer l’effet annoncé sur P puis demander `valider`. |
| X2 | Même fiche, même demande. Retour du sujet Q, même si sa chaîne figure dans l’ancien vocabulaire du verbe. | Laisser l’effet sur P non confirmé, suspendre, aucune validation. |
| Reformulation | Mêmes déclarations, prose changée ou masquée. | Même décision. Un renommage cohérent de commande, identifiant et accusé reste reconnu. |
| Contradiction ou ambiguïté | Deux interprétations applicables incompatibles, un sujet inadéquat ou une preuve incompatible avec l’effet. | Rejeter la déclaration ou suspendre avant la mise à jour. |
| Refus et témoins | Retour refusé, valeur non lue ou fait indépendant inconnu. | Absence de confirmation pour le geste refusé, aucune imputation pour les faits non observés. |
| A, B, C | Indexation à issue conditionnelle, accusé matériel, puis risque d’engagement prématuré. | Réussites respectives 2/2, 1/1 et 2/2. Dans A et C, la marque dépend de la valeur effectivement rendue. |
| Historique | Dix-huit anciens départs dans leur format d’origine. | Comparer les reçus complets au parent, conserver un bilan distinct. |

Le faux positif de X2 est un défaut même si l’opérateur physique a réellement effectué le mouvement de P et valide ensuite la partie. L’oracle de ce test porte sur la justification de la mise à jour au moment où le solveur reçoit le libellé.
