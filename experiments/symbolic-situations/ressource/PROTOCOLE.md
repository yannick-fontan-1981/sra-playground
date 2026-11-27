# Transfert réservé · protocole opérateur

Version 1, issue de `4b58e1146a7620715e4dfd1b02e52bc05305ff36`. Ce protocole fixe la sélection et les critères avant l’exécution du générateur, de l’évaluateur et de tout essai Agenda sur cette famille.

## Situation

Une poignée unique tient un clapet sur un poste amont pendant une purge. Cette même poignée sert ensuite à sceller un poste aval. Deux opérations irréversibles, retirer la poignée et bloquer le clapet, sont nécessaires. Selon l’effort interne, l’une de ces opérations peut fermer le clapet ou coincer la poignée si on la fait la première. L’ordre est déduit de deux essais publics réalisés sur le même montage. Une mesure du cycle en cours donne un des deux codes d’effort après la purge. Le dernier relevé archivé provient d’un autre cycle. Selon le montage, il faut également indexer le poste aval avec la poignée libérée.

## Propriétés observables fixées avant essai

| Situation de départ | Critère |
| --- | --- |
| Purge faite, mesure courante présente, chacun des deux codes à son tour | Une opération matérielle est déjà justifiée. Toute solution minimale s’en sert immédiatement. Sonder à nouveau augmente le coût. |
| Purge faite, seule une archive est disponible | Les deux états ont les mêmes observations initiales. Aucun ordre fixe ne gagne dans les deux. Sonder est l’unique première action garantissant le but. |
| Purge à faire, seule une archive est disponible | La première action gagnante est commune aux deux états et productive. Il faut purger avec la poignée en place, puis sonder avant de choisir un ordre. Un retrait prématuré fait perdre. |
| Après la mesure | Un résultat corrobore l’archive et l’autre la contredit. Dans ce second monde l’ordre suggéré par l’archive échoue et l’ordre révisé doit réussir. |
| Ressource et but | Chaque succès conserve la poignée pendant la purge, la libère et bloque le clapet avant le scellement. Si l’indexation est requise, elle doit intervenir après le retrait et avant le scellement. Tous les ordres de même coût compatibles avec ces contraintes sont admis. |

Une politique indique quoi faire pour chaque historique observable. Son coût est le nombre d’actions dans le pire monde compatible. Le contrôle énumère les plans gagnants et les politiques applicables à des historiques identiques, puis compare toutes les politiques minimales au corrigé. Une politique qui anticipe le code sans le mesurer et une politique qui conserve l’ordre de l’archive après une contradiction doivent être rejetées.

## Sélection et remise

La graine de mise au point est la chaîne ASCII `17`. Les graines auxiliaires prévues sont les chaînes `1` à `8`. Pour toute graine, les deux bits de configuration sont les bits de poids faible des premier et deuxième octets de SHA-256 de `montage/` suivi de la graine en UTF-8. Le premier bit donne l’affectation des deux codes aux deux défaillances, le deuxième indique si l’indexation est requise.

Pour la réserve, prendre le premier entier n à partir de zéro dont le candidat a les deux bits opposés à ceux de `17`. Le candidat est la chaîne `r-` suivie des 32 premiers caractères hexadécimaux minuscules du SHA-256 du texte ASCII `sra-ressource-v1/4b58e1146a7620715e4dfd1b02e52bc05305ff36/` suivi de n en décimal sans zéro initial. La sélection dépend uniquement des propriétés du montage. Elle est reproductible indépendamment des réponses d’Agenda.

Garder les quatre fiches du tirage sélectionné, et les deux mondes de chaque fiche ambiguë. L’ordre opérateur est mesure présente pour le premier code, mesure présente pour le second, purge faite sans mesure, puis purge à faire sans mesure. Pour chaque paire, jouer les mondes 1 puis 2 avec un contexte agent neuf à chaque départ. Ne transmettre que le texte public initial, puis le retour de l’action réellement choisie. Conserver chez l’opérateur la graine, le numéro du monde, le manifeste, les verdicts et les corrigés. Les contrôles de développement utilisent les neuf graines de mise au point. La matérialisation de la réserve attend la remise à l’opérateur de l’essai.
